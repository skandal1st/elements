/**
 * Unified JWT handling for all Elements modules.
 *
 * Token payload format:
 * {
 *   "sub": "user-uuid",
 *   "email": "user@example.com",
 *   "roles": {"hr": "admin", "it": "user", "finance": "viewer"},
 *   "is_superuser": false,
 *   "exp": 1234567890,
 *   "iat": 1234567890
 * }
 */

import jwt from 'jsonwebtoken';

// JWT algorithm - must match across all modules
export const ALGORITHM = 'HS256';

// Default token expiration (12 hours in seconds)
const DEFAULT_EXPIRE_SECONDS = 12 * 60 * 60;

/**
 * Unified JWT payload for all Elements modules
 */
export interface TokenPayload {
  sub: string; // User ID (UUID)
  email: string;
  roles: Record<string, string>; // {"hr": "admin", "it": "user"}
  is_superuser: boolean;
  exp: number;
  iat: number;
}

/**
 * Create JWT access token with unified format
 */
export function createAccessToken(
  secretKey: string,
  userId: string,
  email: string,
  roles: Record<string, string> = {},
  isSuperuser: boolean = false,
  expiresSeconds: number = DEFAULT_EXPIRE_SECONDS
): string {
  const now = Math.floor(Date.now() / 1000);

  const payload: TokenPayload = {
    sub: userId,
    email,
    roles,
    is_superuser: isSuperuser,
    exp: now + expiresSeconds,
    iat: now,
  };

  return jwt.sign(payload, secretKey, { algorithm: ALGORITHM });
}

/**
 * Decode and validate JWT token
 */
export function decodeToken(token: string, secretKey: string): TokenPayload | null {
  try {
    const payload = jwt.verify(token, secretKey, { algorithms: [ALGORITHM] }) as TokenPayload;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Verify JWT token is valid without returning payload
 */
export function verifyToken(token: string, secretKey: string): boolean {
  return decodeToken(token, secretKey) !== null;
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1];
}
