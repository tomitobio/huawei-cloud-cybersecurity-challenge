import type { Request } from 'express';
import { ApiError } from '../lib/http';
import { AUTH_COOKIE, verifyToken, type TokenPayload } from '../lib/tokens';

export interface AuthedRequest extends Request {
  user?: TokenPayload;
}

/** Attach the decoded user if a valid auth cookie is present. Never throws. */
export function attachUser(req: Request): TokenPayload | undefined {
  const token = (req as Request & { cookies?: Record<string, string> }).cookies?.[AUTH_COOKIE];
  if (!token) return undefined;
  const payload = verifyToken(token);
  if (!payload || payload.audience) return undefined;
  return payload;
}

/** Require an authenticated non-audience user. */
export function requireAuth(req: AuthedRequest, _res: unknown, next: (e?: unknown) => void) {
  const payload = attachUser(req);
  if (!payload) return next(ApiError.unauthorized());
  req.user = payload;
  next();
}

/** Require one of the given roles. Assumes requireAuth ran first. */
export function requireRole(...roles: string[]) {
  return (req: AuthedRequest, _res: unknown, next: (e?: unknown) => void) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
    next();
  };
}
