import { Router } from 'express';
import { prisma } from '../db';
import { ApiError, asyncHandler } from '../lib/http';
import { joinSchema } from '@hcc/shared';
import { hashPassword } from '../lib/passwords';
import { AUTH_COOKIE, signToken } from '../lib/tokens';
import { env } from '../env';

export const joinRouter = Router();

/**
 * A team member joins a team using the team's join code. A lightweight user
 * account is created for auditing (no email needed). Every team member has the
 * same permissions; there is no captain/participant split.
 */
joinRouter.post(
  '/join',
  asyncHandler(async (req, res) => {
    const { code } = joinSchema.parse(req.body);
    const displayName = String(req.body.displayName ?? '').trim();
    if (displayName.length < 1 || displayName.length > 60) {
      throw ApiError.badRequest('A display name (1-60 chars) is required');
    }
    const role = 'MEMBER';

    const team = await prisma.team.findUnique({
      where: { joinCode: code.toUpperCase() },
      include: { session: true },
    });
    if (!team) throw ApiError.notFound('Invalid team code');
    if (team.session.status === 'ENDED') throw ApiError.conflict('This workshop has ended');

    const email = `player_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}@team.local`;
    const user = await prisma.user.create({
      data: {
        email,
        displayName,
        role,
        passwordHash: await hashPassword(Math.random().toString(36)),
      },
    });
    await prisma.teamMembership.create({
      data: { userId: user.id, teamId: team.id },
    });

    const token = signToken({ sub: user.id, role, displayName });
    res.cookie(AUTH_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.isProd,
      maxAge: 12 * 60 * 60 * 1000,
    });
    res.status(201).json({
      user: { id: user.id, displayName: user.displayName, role },
      team: { id: team.id, name: team.name },
      session: { id: team.session.id, name: team.session.name },
    });
  }),
);
