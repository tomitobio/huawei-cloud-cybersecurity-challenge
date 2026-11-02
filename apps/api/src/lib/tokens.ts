import jwt from 'jsonwebtoken';
import { env } from '../env';
import type { UserRole } from '@hcc/shared';

export interface TokenPayload {
  sub: string;
  role: UserRole;
  displayName: string;
  /** Present for audience tokens only (no user account). */
  audience?: boolean;
  sessionId?: string;
}

export function signToken(payload: TokenPayload, expiresIn: string = '12h'): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, env.jwtSecret) as TokenPayload;
  } catch {
    return null;
  }
}

export const AUTH_COOKIE = 'hcc_token';
