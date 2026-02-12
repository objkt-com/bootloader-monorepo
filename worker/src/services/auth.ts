import { getPkhfromPk, verifySignature } from '@taquito/utils';
import { Buffer } from 'buffer';
import type { D1Database } from '@cloudflare/workers-types';
import type { User, AuthNonce } from '../types';

const NONCE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

// Taquito utils can rely on Node globals in some code paths.
if (!(globalThis as any).global) {
  (globalThis as any).global = globalThis;
}
if (!(globalThis as any).Buffer) {
  (globalThis as any).Buffer = Buffer;
}

/**
 * Convert a string to Micheline-encoded hex (for signature verification)
 * Format: 05 (expression marker) + 01 (string tag) + 4 bytes length (big-endian) + string bytes
 */
function stringToMichelineHex(str: string): string {
  const bytes = new TextEncoder().encode(str);
  const len = bytes.length;

  // Micheline string format: 01 (string tag) + 4 bytes big-endian length + string bytes
  const michelineBytes = new Uint8Array(1 + 4 + len);
  michelineBytes[0] = 0x01; // string tag
  michelineBytes[1] = (len >> 24) & 0xff;
  michelineBytes[2] = (len >> 16) & 0xff;
  michelineBytes[3] = (len >> 8) & 0xff;
  michelineBytes[4] = len & 0xff;
  michelineBytes.set(bytes, 5);

  // Prepend 05 (expression marker) for the full Micheline payload
  const fullPayload = new Uint8Array(1 + michelineBytes.length);
  fullPayload[0] = 0x05;
  fullPayload.set(michelineBytes, 1);

  return Array.from(fullPayload, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a secure random nonce
 */
function generateNonce(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a UUID v4
 */
function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Create the signature payload that the wallet should sign
 * Format: "Tezos Signed Message: bootloader.art {address} {nonce}"
 */
export function createSignaturePayload(address: string, nonce: string): string {
  return `Tezos Signed Message: bootloader.art ${address} ${nonce}`;
}

export class AuthService {
  constructor(private db: D1Database) {}

  /**
   * Register a login nonce for a public key
   * The user will sign this nonce to prove ownership
   */
  async registerLoginNonce(publicKey: string): Promise<{ nonce: string; address: string }> {
    const address = getPkhfromPk(publicKey);
    const nonce = generateNonce();
    const id = generateUUID();
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + NONCE_EXPIRY_MS).toISOString();

    // Clean up expired nonces for this public key
    await this.db
      .prepare('DELETE FROM auth_nonces WHERE public_key = ? OR expires_at < ?')
      .bind(publicKey, now)
      .run();

    // Insert new nonce
    await this.db
      .prepare('INSERT INTO auth_nonces (id, public_key, nonce, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
      .bind(id, publicKey, nonce, now, expiresAt)
      .run();

    return { nonce, address };
  }

  /**
   * Verify signature and log in user
   * Returns the authenticated user on success
   */
  async login(publicKey: string, signature: string): Promise<User> {
    const now = new Date().toISOString();

    // Get the pending nonce
    const nonceResult = await this.db
      .prepare('SELECT * FROM auth_nonces WHERE public_key = ? AND expires_at > ? ORDER BY created_at DESC LIMIT 1')
      .bind(publicKey, now)
      .first<AuthNonce>();

    if (!nonceResult) {
      throw new AuthError('No pending sign request or nonce expired');
    }

    const address = getPkhfromPk(publicKey);
    const expectedMessage = createSignaturePayload(address, nonceResult.nonce);

    // Convert message to Micheline hex for Taquito verification (matches what wallet signs)
    const messageHex = stringToMichelineHex(expectedMessage);

    // Verify the signature
    const isValid = this.verifySignature(publicKey, signature, messageHex);
    if (!isValid) {
      throw new AuthError('Invalid signature');
    }

    // Delete the used nonce
    await this.db
      .prepare('DELETE FROM auth_nonces WHERE id = ?')
      .bind(nonceResult.id)
      .run();

    // Find or create user
    let user = await this.findUserByAddress(address);

    if (!user) {
      // Create new user
      const userId = generateUUID();
      await this.db
        .prepare('INSERT INTO users (id, address, public_key, roles, created_at) VALUES (?, ?, ?, 0, ?)')
        .bind(userId, address, publicKey, now)
        .run();

      user = {
        id: userId,
        address,
        publicKey,
        roles: 0,
        createdAt: now,
        lastLogin: now,
        displayName: null,
        avatarUrl: null,
      };
    } else {
      // Update last login and public key if needed
      await this.db
        .prepare('UPDATE users SET last_login = ?, public_key = COALESCE(public_key, ?) WHERE id = ?')
        .bind(now, publicKey, user.id)
        .run();

      user.lastLogin = now;
      if (!user.publicKey) user.publicKey = publicKey;
    }

    return user;
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    const result = await this.db
      .prepare('SELECT id, address, public_key as publicKey, roles, created_at as createdAt, last_login as lastLogin, display_name as displayName, avatar_url as avatarUrl FROM users WHERE id = ?')
      .bind(userId)
      .first<User>();

    return result || null;
  }

  /**
   * Find user by address
   */
  async findUserByAddress(address: string): Promise<User | null> {
    const result = await this.db
      .prepare('SELECT id, address, public_key as publicKey, roles, created_at as createdAt, last_login as lastLogin, display_name as displayName, avatar_url as avatarUrl FROM users WHERE address = ?')
      .bind(address)
      .first<User>();

    return result || null;
  }

  /**
   * Find user by public key
   */
  async findUserByPublicKey(publicKey: string): Promise<User | null> {
    const result = await this.db
      .prepare('SELECT id, address, public_key as publicKey, roles, created_at as createdAt, last_login as lastLogin, display_name as displayName, avatar_url as avatarUrl FROM users WHERE public_key = ?')
      .bind(publicKey)
      .first<User>();

    return result || null;
  }

  /**
   * Update user roles (admin only)
   */
  async updateUserRoles(userId: string, roles: number): Promise<void> {
    await this.db
      .prepare('UPDATE users SET roles = ? WHERE id = ?')
      .bind(roles, userId)
      .run();
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId: string, updates: { displayName?: string; avatarUrl?: string }): Promise<void> {
    const sets: string[] = [];
    const values: (string | null)[] = [];

    if (updates.displayName !== undefined) {
      sets.push('display_name = ?');
      values.push(updates.displayName);
    }
    if (updates.avatarUrl !== undefined) {
      sets.push('avatar_url = ?');
      values.push(updates.avatarUrl);
    }

    if (sets.length === 0) return;

    values.push(userId);
    await this.db
      .prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();
  }

  /**
   * Verify a Tezos signature
   */
  private verifySignature(publicKey: string, signature: string, message: string): boolean {
    try {
      return verifySignature(message, publicKey, signature);
    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}
