import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../db';
import { ApiError, asyncHandler } from '../lib/http';
import { loginSchema, registerSchema } from '@hcc/shared';
import { hashPassword, verifyPassword } from '../lib/passwords';
import { AUTH_COOKIE, signToken } from '../lib/tokens';
import { attachUser, requireAuth, requireRole, type AuthedRequest } from '../middleware/auth';
import { env } from '../env';

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

function setAuthCookie(res: import('express').Response, token: string) {
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProd,
    maxAge: 12 * 60 * 60 * 1000,
  });
}

function publicUser(user: { id: string; email: string; displayName: string; role: string }) {
  return { id: user.id, email: user.email, displayName: user.displayName, role: user.role };
}

authRouter.post(
  '/register',
  authLimiter,
  asyncHandler(async (req, res) => {
    const count = await prisma.user.count();
    const requester = attachUser(req);
    const isBootstrap = count === 0;
    if (!isBootstrap && (!requester || requester.role !== 'ADMIN')) {
      throw ApiError.forbidden('Only administrators can register new users');
    }
    const input = registerSchema.parse(req.body);
    const role = 'ADMIN';
    const exists = await prisma.user.findUnique({ where: { email: input.email } });
    if (exists) throw ApiError.conflict('Email already registered');
    const user = await prisma.user.create({
      data: {
        email: input.email,
        displayName: input.displayName,
        role,
        passwordHash: await hashPassword(input.password),
      },
    });
    if (isBootstrap) setAuthCookie(res, signToken({ sub: user.id, role: user.role, displayName: user.displayName }));
    res.status(201).json({ user: publicUser(user) });
  }),
);

authRouter.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) throw ApiError.unauthorized('Invalid credentials');
    const ok = await verifyPassword(input.password, user.passwordHash);
    if (!ok) throw ApiError.unauthorized('Invalid credentials');
    setAuthCookie(res, signToken({ sub: user.id, role: user.role, displayName: user.displayName }));
    res.json({ user: publicUser(user) });
  }),
);

authRouter.post('/logout', (req, res) => {
  res.clearCookie(AUTH_COOKIE);
  res.json({ ok: true });
});

authRouter.get(
  '/me',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const payload = attachUser(req);
    if (!payload) return res.json({ user: null });
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) return res.json({ user: null });
    res.json({ user: publicUser(user) });
  }),
);

authRouter.get(
  '/users',
  requireAuth,
  requireRole('ADMIN'),
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
    res.json({ users: users.map(publicUser) });
  }),
);
