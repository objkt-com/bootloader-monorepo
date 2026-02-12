import { UserRole, type User } from '../types';

/**
 * Check if user has a specific role
 */
export function hasRole(user: User | null, role: number): boolean {
  if (!user) return false;
  return (user.roles & role) === role;
}

/**
 * Check if user is admin
 */
export function isAdmin(user: User | null): boolean {
  return hasRole(user, UserRole.ADMIN);
}

/**
 * Check if user is moderator (or admin)
 */
export function isModerator(user: User | null): boolean {
  return hasRole(user, UserRole.MODERATOR) || isAdmin(user);
}

/**
 * Check if user is a verified creator
 */
export function isCreator(user: User | null): boolean {
  return hasRole(user, UserRole.CREATOR);
}

/**
 * Add role to user roles
 */
export function addRole(currentRoles: number, role: number): number {
  return currentRoles | role;
}

/**
 * Remove role from user roles
 */
export function removeRole(currentRoles: number, role: number): number {
  return currentRoles & ~role;
}

/**
 * Get role names for a user
 */
export function getRoleNames(roles: number): string[] {
  const names: string[] = [];
  if ((roles & UserRole.ADMIN) === UserRole.ADMIN) names.push('admin');
  if ((roles & UserRole.MODERATOR) === UserRole.MODERATOR) names.push('moderator');
  if ((roles & UserRole.CREATOR) === UserRole.CREATOR) names.push('creator');
  return names;
}

/**
 * Create role value from names
 */
export function createRoles(names: string[]): number {
  let roles = 0;
  for (const name of names) {
    switch (name.toLowerCase()) {
      case 'admin':
        roles = addRole(roles, UserRole.ADMIN);
        break;
      case 'moderator':
        roles = addRole(roles, UserRole.MODERATOR);
        break;
      case 'creator':
        roles = addRole(roles, UserRole.CREATOR);
        break;
    }
  }
  return roles;
}

/**
 * Require authentication middleware helper
 * Returns the user or throws an error
 */
export function requireAuth(user: User | null): User {
  if (!user) {
    throw new AuthorizationError('Authentication required');
  }
  return user;
}

/**
 * Require admin role
 */
export function requireAdmin(user: User | null): User {
  const authenticatedUser = requireAuth(user);
  if (!isAdmin(authenticatedUser)) {
    throw new AuthorizationError('Admin access required');
  }
  return authenticatedUser;
}

/**
 * Require moderator role (or admin)
 */
export function requireModerator(user: User | null): User {
  const authenticatedUser = requireAuth(user);
  if (!isModerator(authenticatedUser)) {
    throw new AuthorizationError('Moderator access required');
  }
  return authenticatedUser;
}

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}
