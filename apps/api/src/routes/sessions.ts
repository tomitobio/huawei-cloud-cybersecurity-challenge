import { Router } from 'express';
import { prisma } from '../db';
import { ApiError, asyncHandler } from '../lib/http';
import { createSessionSchema, createTeamSchema, setDeadlineSchema } from '@hcc/shared';
import { requireAuth, type AuthedRequest } from '../middleware/auth';
import {
  createSession,
  getSessionConsole,
  releaseRound,
  resolveRound,
  revealInsight,
  setDeadline,
  setSessionStatus,
  audit,
} from '../services/game';
import { generateReport } from '../services/report';
import { uniqueTeamCode } from '../services/codes';
import { initGameState } from '@hcc/shared';
import { loadScenarioForSession } from '../services/game';

export const sessionRouter = Router();
sessionRouter.use('/sessions', requireAuth);

async function assertInstructor(userId: string, role: string, sessionId: string) {
  const session = await prisma.workshopSession.findUnique({ where: { id: sessionId } });
  if (!session) throw ApiError.notFound('Session not found');
  if (role === 'ADMIN') return session;
  if (session.instructorId !== userId) throw ApiError.forbidden('You do not facilitate this session');
  return session;
}

sessionRouter.get(
  '/sessions',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const user = req.user!;
    const where = user.role === 'ADMIN' ? {} : { instructorId: user.sub };
    const sessions = await prisma.workshopSession.findMany({
      where,
      include: { scenario: { select: { key: true, name: true } }, _count: { select: { teams: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({
      sessions: sessions.map((s) => ({
        id: s.id,
        name: s.name,
        joinCode: s.joinCode,
        status: s.status,
        currentRound: s.currentRound,
        teamCount: s._count.teams,
        scenarioKey: s.scenario.key,
        scenarioName: s.scenario.name,
        seed: s.seed,
        createdAt: s.createdAt,
      })),
    });
  }),
);

sessionRouter.post(
  '/sessions',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const user = req.user!;
    const input = createSessionSchema.parse(req.body);
    const console0 = await createSession(user.sub, input);
    res.status(201).json({ session: console0 });
  }),
);

sessionRouter.get(
  '/sessions/:id',
  asyncHandler<AuthedRequest>(async (req, res) => {
    await assertInstructor(req.user!.sub, req.user!.role, req.params.id);
    res.json({ session: await getSessionConsole(req.params.id) });
  }),
);

sessionRouter.post(
  '/sessions/:id/release',
  asyncHandler<AuthedRequest>(async (req, res) => {
    await assertInstructor(req.user!.sub, req.user!.role, req.params.id);
    const session = await releaseRound(req.params.id, req.user!.sub);
    res.json({ status: session.status, currentRound: session.currentRound, deadlineAt: session.deadlineAt });
  }),
);

sessionRouter.post(
  '/sessions/:id/pause',
  asyncHandler<AuthedRequest>(async (req, res) => {
    await assertInstructor(req.user!.sub, req.user!.role, req.params.id);
    const s = await setSessionStatus(req.params.id, req.user!.sub, 'PAUSED');
    res.json({ status: s.status });
  }),
);

sessionRouter.post(
  '/sessions/:id/resume',
  asyncHandler<AuthedRequest>(async (req, res) => {
    await assertInstructor(req.user!.sub, req.user!.role, req.params.id);
    const s = await setSessionStatus(req.params.id, req.user!.sub, 'ACTIVE');
    res.json({ status: s.status });
  }),
);

sessionRouter.post(
  '/sessions/:id/end',
  asyncHandler<AuthedRequest>(async (req, res) => {
    await assertInstructor(req.user!.sub, req.user!.role, req.params.id);
    const s = await setSessionStatus(req.params.id, req.user!.sub, 'ENDED');
    res.json({ status: s.status });
  }),
);

sessionRouter.post(
  '/sessions/:id/deadline',
  asyncHandler<AuthedRequest>(async (req, res) => {
    await assertInstructor(req.user!.sub, req.user!.role, req.params.id);
    const { seconds } = setDeadlineSchema.parse(req.body);
    const deadlineAt = await setDeadline(req.params.id, req.user!.sub, seconds);
    res.json({ deadlineAt });
  }),
);

sessionRouter.post(
  '/sessions/:id/resolve',
  asyncHandler<AuthedRequest>(async (req, res) => {
    await assertInstructor(req.user!.sub, req.user!.role, req.params.id);
    const force = Boolean(req.body?.force);
    const result = await resolveRound(req.params.id, req.user!.sub, { force });
    res.json(result);
  }),
);

sessionRouter.post(
  '/sessions/:id/insights',
  asyncHandler<AuthedRequest>(async (req, res) => {
    await assertInstructor(req.user!.sub, req.user!.role, req.params.id);
    const insightKey = String(req.body?.insightKey ?? '');
    const card = await revealInsight(req.params.id, req.user!.sub, insightKey);
    res.json({ card });
  }),
);

sessionRouter.post(
  '/sessions/:id/teams',
  asyncHandler<AuthedRequest>(async (req, res) => {
    await assertInstructor(req.user!.sub, req.user!.role, req.params.id);
    const input = createTeamSchema.parse(req.body);
    const sessionRow = await prisma.workshopSession.findUnique({ where: { id: req.params.id } });
    const scenario = await loadScenarioForSession(req.params.id);
    const team = await prisma.team.create({
      data: {
        sessionId: req.params.id,
        name: input.name,
        color: input.color,
        joinCode: await uniqueTeamCode(),
        budgetStart: input.budget ?? scenario.start.budget,
        maturity: (input.maturity ?? scenario.start.maturity).toUpperCase() as 'LOW' | 'MEDIUM' | 'HIGH',
      },
    });
    const scenarioForTeam = {
      ...scenario,
      start: { ...scenario.start, budget: team.budgetStart, maturity: team.maturity.toLowerCase() as 'low' | 'medium' | 'high' },
    };
    await prisma.gameState.create({
      data: { teamId: team.id, data: initGameState(team.id, scenarioForTeam, sessionRow?.seed ?? 0) as unknown as object },
    });
    await audit(req.params.id, req.user!.sub, 'team.created', { name: team.name });
    res.status(201).json({ team: { id: team.id, name: team.name, joinCode: team.joinCode } });
  }),
);

sessionRouter.get(
  '/sessions/:id/report',
  asyncHandler<AuthedRequest>(async (req, res) => {
    await assertInstructor(req.user!.sub, req.user!.role, req.params.id);
    const report = await generateReport(req.params.id);
    res.json({ report });
  }),
);

sessionRouter.get(
  '/sessions/:id/audit',
  asyncHandler<AuthedRequest>(async (req, res) => {
    await assertInstructor(req.user!.sub, req.user!.role, req.params.id);
    const logs = await prisma.auditLog.findMany({
      where: { sessionId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json({ audit: logs.map((l) => ({ action: l.action, payload: l.payload, createdAt: l.createdAt })) });
  }),
);

sessionRouter.delete(
  '/sessions/:id',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const session = await assertInstructor(req.user!.sub, req.user!.role, req.params.id);
    // Record a *global* audit entry (sessionId: null) so it survives the cascade
    // delete of the session and everything attached to it.
    await prisma.auditLog.create({
      data: {
        sessionId: null,
        actorId: req.user!.sub,
        action: 'session.deleted',
        payload: { sessionId: session.id, name: session.name } as object,
      },
    });
    await prisma.workshopSession.delete({ where: { id: session.id } });
    res.json({ ok: true });
  }),
);
