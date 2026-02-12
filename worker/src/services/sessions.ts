import type { D1Database } from '@cloudflare/workers-types';
import type { DbSession, User } from '../types';

/**
 * Generate a UUID v4
 */
function generateUUID(): string {
  return crypto.randomUUID();
}

export interface CreateSessionInput {
  id?: string;
  userId?: string | null;
  cid?: string | null;
  name?: string | null;
  description?: string | null;
  isPublic?: boolean;
}

export interface UpdateSessionInput {
  userId?: string | null;
  cid?: string | null;
  name?: string | null;
  description?: string | null;
  isPublic?: boolean;
}

export interface SessionWithUser extends DbSession {
  user?: User | null;
}

export class SessionService {
  constructor(private db: D1Database) {}

  /**
   * Create a new session record in the database
   */
  async createSession(input: CreateSessionInput = {}): Promise<DbSession> {
    const id = input.id || generateUUID();
    const now = new Date().toISOString();

    await this.db
      .prepare(`
        INSERT INTO sessions (id, user_id, cid, created_at, last_accessed, name, description, is_public)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        id,
        input.userId || null,
        input.cid || null,
        now,
        now,
        input.name || null,
        input.description || null,
        input.isPublic ? 1 : 0
      )
      .run();

    return {
      id,
      userId: input.userId || null,
      cid: input.cid || null,
      createdAt: now,
      lastAccessed: now,
      name: input.name || null,
      description: input.description || null,
      isPublic: input.isPublic || false,
    };
  }

  /**
   * Get a session by ID
   */
  async getSession(sessionId: string): Promise<DbSession | null> {
    const result = await this.db
      .prepare(`
        SELECT id, user_id as userId, cid, created_at as createdAt, last_accessed as lastAccessed,
               name, description, is_public as isPublic
        FROM sessions WHERE id = ?
      `)
      .bind(sessionId)
      .first<DbSession & { isPublic: number }>();

    if (!result) return null;

    return {
      ...result,
      isPublic: Boolean(result.isPublic),
    };
  }

  /**
   * Get a session with user info
   */
  async getSessionWithUser(sessionId: string): Promise<SessionWithUser | null> {
    const result = await this.db
      .prepare(`
        SELECT
          s.id, s.user_id as userId, s.cid, s.created_at as createdAt, s.last_accessed as lastAccessed,
          s.name, s.description, s.is_public as isPublic,
          u.id as u_id, u.address as u_address, u.public_key as u_publicKey, u.roles as u_roles,
          u.created_at as u_createdAt, u.last_login as u_lastLogin, u.display_name as u_displayName,
          u.avatar_url as u_avatarUrl
        FROM sessions s
        LEFT JOIN users u ON s.user_id = u.id
        WHERE s.id = ?
      `)
      .bind(sessionId)
      .first<Record<string, unknown>>();

    if (!result) return null;

    const session: SessionWithUser = {
      id: result.id as string,
      userId: result.userId as string | null,
      cid: result.cid as string | null,
      createdAt: result.createdAt as string,
      lastAccessed: result.lastAccessed as string | null,
      name: result.name as string | null,
      description: result.description as string | null,
      isPublic: Boolean(result.isPublic),
    };

    if (result.u_id) {
      session.user = {
        id: result.u_id as string,
        address: result.u_address as string,
        publicKey: result.u_publicKey as string | null,
        roles: result.u_roles as number,
        createdAt: result.u_createdAt as string,
        lastLogin: result.u_lastLogin as string | null,
        displayName: result.u_displayName as string | null,
        avatarUrl: result.u_avatarUrl as string | null,
      };
    }

    return session;
  }

  /**
   * Update a session
   */
  async updateSession(sessionId: string, updates: UpdateSessionInput): Promise<void> {
    const sets: string[] = [];
    const values: (string | number | null)[] = [];

    if (updates.userId !== undefined) {
      sets.push('user_id = ?');
      values.push(updates.userId);
    }
    if (updates.cid !== undefined) {
      sets.push('cid = ?');
      values.push(updates.cid);
    }
    if (updates.name !== undefined) {
      sets.push('name = ?');
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      sets.push('description = ?');
      values.push(updates.description);
    }
    if (updates.isPublic !== undefined) {
      sets.push('is_public = ?');
      values.push(updates.isPublic ? 1 : 0);
    }

    if (sets.length === 0) return;

    // Always update last_accessed
    sets.push('last_accessed = ?');
    values.push(new Date().toISOString());

    values.push(sessionId);
    await this.db
      .prepare(`UPDATE sessions SET ${sets.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();
  }

  /**
   * Link a session to a user
   */
  async linkSessionToUser(sessionId: string, userId: string): Promise<void> {
    await this.updateSession(sessionId, { userId });
  }

  /**
   * Update session CID
   */
  async updateSessionCid(sessionId: string, cid: string): Promise<void> {
    await this.updateSession(sessionId, { cid });
  }

  /**
   * Touch session (update last accessed time)
   */
  async touchSession(sessionId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .prepare('UPDATE sessions SET last_accessed = ? WHERE id = ?')
      .bind(now, sessionId)
      .run();
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM sessions WHERE id = ?')
      .bind(sessionId)
      .run();
  }

  /**
   * Get all sessions for a user
   */
  async getUserSessions(userId: string, limit = 50, offset = 0): Promise<DbSession[]> {
    const results = await this.db
      .prepare(`
        SELECT id, user_id as userId, cid, created_at as createdAt, last_accessed as lastAccessed,
               name, description, is_public as isPublic
        FROM sessions
        WHERE user_id = ?
        ORDER BY last_accessed DESC
        LIMIT ? OFFSET ?
      `)
      .bind(userId, limit, offset)
      .all<DbSession & { isPublic: number }>();

    return (results.results || []).map((r) => ({
      ...r,
      isPublic: Boolean(r.isPublic),
    }));
  }

  /**
   * Get public sessions
   */
  async getPublicSessions(limit = 50, offset = 0): Promise<SessionWithUser[]> {
    const results = await this.db
      .prepare(`
        SELECT
          s.id, s.user_id as userId, s.cid, s.created_at as createdAt, s.last_accessed as lastAccessed,
          s.name, s.description, s.is_public as isPublic,
          u.id as u_id, u.address as u_address, u.display_name as u_displayName, u.avatar_url as u_avatarUrl
        FROM sessions s
        LEFT JOIN users u ON s.user_id = u.id
        WHERE s.is_public = 1
        ORDER BY s.last_accessed DESC
        LIMIT ? OFFSET ?
      `)
      .bind(limit, offset)
      .all<Record<string, unknown>>();

    return (results.results || []).map((r) => {
      const session: SessionWithUser = {
        id: r.id as string,
        userId: r.userId as string | null,
        cid: r.cid as string | null,
        createdAt: r.createdAt as string,
        lastAccessed: r.lastAccessed as string | null,
        name: r.name as string | null,
        description: r.description as string | null,
        isPublic: Boolean(r.isPublic),
      };

      if (r.u_id) {
        session.user = {
          id: r.u_id as string,
          address: r.u_address as string,
          publicKey: null,
          roles: 0,
          createdAt: '',
          lastLogin: null,
          displayName: r.u_displayName as string | null,
          avatarUrl: r.u_avatarUrl as string | null,
        };
      }

      return session;
    });
  }

  /**
   * Check if user can access session
   */
  async canUserAccessSession(sessionId: string, userId: string | null): Promise<boolean> {
    const session = await this.getSession(sessionId);
    if (!session) return false;

    // Public sessions are accessible to everyone
    if (session.isPublic) return true;

    // Owner can always access
    if (userId && session.userId === userId) return true;

    // Anonymous sessions (no user) are accessible to everyone (legacy behavior)
    if (!session.userId) return true;

    return false;
  }

  /**
   * Check if user owns session
   */
  async isSessionOwner(sessionId: string, userId: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    return session?.userId === userId;
  }
}
