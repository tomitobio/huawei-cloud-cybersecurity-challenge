import { Router } from 'express';
import { prisma } from '../db';
import { ApiError, asyncHandler } from '../lib/http';
import { decisionSubmissionSchema } from '@hcc/shared';
import { requireAuth, type AuthedRequest } from '../middleware/auth';
import { castVote, createProposal, getTeamWorkspace, submitDecision } from '../services/game';

export const teamRouter = Router();
teamRouter.use('/teams', requireAuth);

async function getMembership(userId: string, teamId: string) {
  return prisma.teamMembership.findFirst({ where: { userId, teamId }, include: { team: { include: { session: true } } } });
}

async function assertTeamAccess(userId: string, role: string, teamId: string) {
  const team = await prisma.team.findUnique({ where: { id: teamId }, include: { session: true } });
  if (!team) throw ApiError.notFound('Team not found');
  if (role === 'ADMIN') return team;
  if (team.session.instructorId === userId) return team;
  const membership = await getMembership(userId, teamId);
  if (!membership) throw ApiError.forbidden('You do not belong to this team');
  return team;
}

teamRouter.get(
  '/teams/:id',
  asyncHandler<AuthedRequest>(async (req, res) => {
    await assertTeamAccess(req.user!.sub, req.user!.role, req.params.id);
    const workspace = await getTeamWorkspace(req.params.id);
    res.json({ workspace });
  }),
);

teamRouter.post(
  '/teams/:id/decision',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const team = await assertTeamAccess(req.user!.sub, req.user!.role, req.params.id);
    const input = decisionSubmissionSchema.parse(req.body);
    const decision = await submitDecision(team.id, req.user!.sub, input);
    res.json({ decision: { eventId: decision.eventId, optionId: decision.optionId } });
  }),
);

teamRouter.post(
  '/teams/:id/proposals',
  asyncHandler<AuthedRequest>(async (req, res) => {
    await assertTeamAccess(req.user!.sub, req.user!.role, req.params.id);
    const optionId = String(req.body?.optionId ?? '');
    if (!optionId) throw ApiError.badRequest('optionId is required');
    const proposal = await createProposal(req.params.id, req.user!.displayName, {
      optionId,
      rationale: String(req.body?.rationale ?? ''),
    });
    res.status(201).json({ proposal: { id: proposal.id } });
  }),
);

teamRouter.post(
  '/teams/:id/vote',
  asyncHandler<AuthedRequest>(async (req, res) => {
    await assertTeamAccess(req.user!.sub, req.user!.role, req.params.id);
    const proposalId = String(req.body?.proposalId ?? '');
    if (!proposalId) throw ApiError.badRequest('proposalId is required');
    const vote = await castVote(req.params.id, req.user!.displayName, { proposalId });
    res.status(201).json({ vote: { id: vote.id } });
  }),
);
