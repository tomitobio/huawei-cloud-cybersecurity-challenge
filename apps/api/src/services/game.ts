import { prisma } from '../db';
import { ApiError } from '../lib/http';
import { emitToSession, emitToTeam } from '../socket';
import {
  applyDecision,
  applyDecisions,
  applyDeltas,
  availableOptions,
  conditionMet,
  finalScoreFor,
  getEvent,
  getEventCards,
  getProductCard,
  getVisibleSignals,
  initGameState,
  normalizeWeights,
  prepareActiveEvent,
  resolveNextEventId,
  selectionProblem,
  type DecisionOption,
  type GameStateData,
  type Scenario,
  DEFAULT_WEIGHTS,
} from '@hcc/shared';
import { uniqueSessionCode, uniqueTeamCode } from './codes';
import { resolveScenarioDefinition } from './scenarioStore';

function asState(data: unknown): GameStateData {
  return data as unknown as GameStateData;
}

/** Ensure the scenario exists as a DB row and return it (built-in or custom). */
export async function ensureScenario(key: string) {
  const def = await resolveScenarioDefinition(key);
  if (!def) throw ApiError.badRequest(`Unknown scenario: ${key}`);
  return prisma.scenario.upsert({
    where: { key },
    update: { name: def.name.en, version: def.version, definition: def as unknown as object },
    create: {
      key,
      name: def.name.en,
      version: def.version,
      definition: def as unknown as object,
    },
  });
}

export async function loadScenarioForSession(sessionId: string): Promise<Scenario> {
  const session = await prisma.workshopSession.findUnique({
    where: { id: sessionId },
    include: { scenario: true },
  });
  if (!session) throw ApiError.notFound('Session not found');
  return session.scenario.definition as unknown as Scenario;
}

export interface CreateSessionInput {
  name: string;
  scenarioKey: string;
  seed?: number;
  weights?: Record<string, number>;
  teams?: { name: string; color?: string; budget?: number; maturity?: 'low' | 'medium' | 'high' }[];
}

/** A random 31-bit seed for workshops that do not pin one explicitly. */
function randomSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}

export async function createSession(instructorId: string, input: CreateSessionInput) {
  const scenarioRow = await ensureScenario(input.scenarioKey);
  const def = (await resolveScenarioDefinition(input.scenarioKey))!;
  const weights = input.weights
    ? normalizeWeights({ ...DEFAULT_WEIGHTS, ...input.weights } as never)
    : def.weights;
  const seed = input.seed ?? randomSeed();

  const joinCode = await uniqueSessionCode();
  const session = await prisma.workshopSession.create({
    data: {
      name: input.name,
      joinCode,
      instructorId,
      scenarioId: scenarioRow.id,
      weights: weights as unknown as object,
      seed,
      status: 'LOBBY',
    },
  });

  const teamInputs =
    input.teams && input.teams.length
      ? input.teams
      : [
          { name: 'Equipo Alfa', color: '#22d3ee' },
          { name: 'Equipo Bravo', color: '#f472b6' },
        ];

  for (const t of teamInputs) {
    const team = await prisma.team.create({
      data: {
        sessionId: session.id,
        name: t.name,
        color: t.color ?? '#22d3ee',
        joinCode: await uniqueTeamCode(),
        budgetStart: t.budget ?? def.start.budget,
        maturity: ((t.maturity ?? def.start.maturity).toUpperCase()) as 'LOW' | 'MEDIUM' | 'HIGH',
      },
    });
    const scenarioForTeam: Scenario = {
      ...def,
      start: { ...def.start, budget: team.budgetStart, maturity: team.maturity.toLowerCase() as 'low' | 'medium' | 'high' },
    };
    await prisma.gameState.create({
      data: {
        teamId: team.id,
        data: initGameState(team.id, scenarioForTeam, seed) as unknown as object,
        version: 0,
      },
    });
  }

  await audit(session.id, instructorId, 'session.created', { name: input.name, scenarioKey: input.scenarioKey });
  return getSessionConsole(session.id);
}

export async function audit(sessionId: string | null, actorId: string | null, action: string, payload: object) {
  await prisma.auditLog.create({ data: { sessionId, actorId, action, payload: payload as object } });
}

export async function getTeamState(teamId: string): Promise<{ state: GameStateData; version: number }> {
  const row = await prisma.gameState.findUnique({ where: { teamId } });
  if (!row) throw ApiError.notFound('Team state not found');
  return { state: asState(row.data), version: row.version };
}

/** Full instructor console data for a session. */
export async function getSessionConsole(sessionId: string) {
  const session = await prisma.workshopSession.findUnique({
    where: { id: sessionId },
    include: {
      scenario: true,
      teams: {
        include: {
          state: true,
          members: { include: { user: { select: { id: true, displayName: true, role: true } } } },
          decisions: { orderBy: { createdAt: 'desc' } },
          history: { orderBy: { createdAt: 'desc' }, take: 20 },
        },
        orderBy: { createdAt: 'asc' },
      },
      insights: true,
      auditLogs: { orderBy: { createdAt: 'desc' }, take: 40 },
    },
  });
  if (!session) throw ApiError.notFound('Session not found');
  const scenario = session.scenario.definition as unknown as Scenario;

  const teams = session.teams.map((team) => {
    const state = team.state ? asState(team.state.data) : null;
    const currentEvent = state?.currentEventId ? getEvent(scenario, state.currentEventId) : null;
    const pendingDecision = state
      ? team.decisions.find((d) => d.eventId === state.currentEventId)
      : undefined;
    return {
      id: team.id,
      name: team.name,
      color: team.color,
      joinCode: team.joinCode,
      budgetStart: team.budgetStart,
      maturity: team.maturity,
      members: team.members.map((m) => ({ id: m.user.id, displayName: m.user.displayName, role: m.user.role })),
      state,
      score: state ? finalScoreFor(scenario, state) : 0,
      currentEvent: currentEvent
        ? {
            id: currentEvent.id,
            round: currentEvent.round,
            title: currentEvent.title,
            phase: currentEvent.phase,
            instructorNotes: currentEvent.instructorNotes,
          }
        : null,
      pendingDecision: pendingDecision
        ? {
            optionId: pendingDecision.optionId,
            rationale: pendingDecision.rationale,
            cost: pendingDecision.cost,
            createdAt: pendingDecision.createdAt,
            submittedById: pendingDecision.submittedById,
          }
        : null,
      decisionCount: team.decisions.length,
      recentHistory: team.history.map((h) => ({ type: h.type, payload: h.payload, createdAt: h.createdAt })),
    };
  });

  return {
    id: session.id,
    name: session.name,
    joinCode: session.joinCode,
    audienceToken: session.audienceToken,
    status: session.status,
    currentRound: session.currentRound,
    deadlineAt: session.deadlineAt,
    deadlineSeconds: session.deadlineSeconds,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    seed: session.seed,
    weights: session.weights,
    scenario: {
      key: scenario.key,
      name: scenario.name,
      summary: scenario.summary,
      organization: scenario.organization,
      architecture: scenario.architecture,
      debrief: scenario.debrief,
      events: scenario.events.map((e) => ({
        id: e.id,
        round: e.round,
        title: e.title,
        phase: e.phase,
        insightKey: e.insightKey,
      })),
    },
    teams,
    leaderboard: buildLeaderboard(teams, scenario),
    insights: session.insights.map((i) => i.insightKey),
    audit: session.auditLogs.map((a) => ({ action: a.action, payload: a.payload, createdAt: a.createdAt })),
  };
}

function buildLeaderboard(
  teams: { id: string; name: string; color: string; state: GameStateData | null; score: number }[],
  scenario: Scenario,
) {
  return [...teams]
    .map((t) => ({
      teamId: t.id,
      name: t.name,
      color: t.color,
      score: t.state ? finalScoreFor(scenario, t.state) : 0,
      budget: t.state?.budget ?? 0,
      metrics: t.state?.metrics ?? null,
      status: t.state?.status ?? 'active',
      fundedControls: (t.state?.flags ?? []).filter((f) => f.endsWith('_funded')).map((f) => f.replace('_funded', '')),
    }))
    .sort((a, b) => b.score - a.score);
}

/** Team-facing workspace payload. Strips instructor-only and future data. */
export async function getTeamWorkspace(teamId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      session: { include: { scenario: true } },
      state: true,
      members: { include: { user: { select: { id: true, displayName: true, role: true } } } },
      decisions: true,
      history: { orderBy: { createdAt: 'desc' }, take: 30 },
    },
  });
  if (!team) throw ApiError.notFound('Team not found');
  const scenario = team.session.scenario.definition as unknown as Scenario;
  const state = team.state ? asState(team.state.data) : initGameState(teamId, scenario, team.session.seed);

  const event = state.currentEventId ? getEvent(scenario, state.currentEventId) : null;
  const options: (DecisionOption & { available: boolean; reason?: string })[] = event
    ? getEventCards(scenario, event, state).map((o) => {
        const reqOk = conditionMet(o.requires, state);
        const budgetOk = state.budget >= o.cost;
        const available = reqOk && budgetOk;
        return {
          ...o,
          // never expose instructor-only fields; options have none, but keep shape safe
          available,
          reason: !reqOk ? 'requirements' : !budgetOk ? 'budget' : undefined,
        };
      })
    : [];

  const submitted = state.currentEventId
    ? team.decisions.find((d) => d.eventId === state.currentEventId)
    : undefined;

  // Public leaderboard (no private rationale of other teams)
  const sessionTeams = await prisma.team.findMany({
    where: { sessionId: team.sessionId },
    include: { state: true },
    orderBy: { createdAt: 'asc' },
  });
  const leaderboard = buildLeaderboard(
    sessionTeams.map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      state: t.state ? asState(t.state.data) : null,
      score: 0,
    })),
    scenario,
  );

  const proposals = team.history
    .filter((h) => h.type === 'proposal' || h.type === 'vote')
    .map((h) => ({ id: h.id, type: h.type, payload: h.payload as Record<string, unknown>, createdAt: h.createdAt }));

  const timeline = state.completedEventIds
    .map((id) => scenario.events.find((e) => e.id === id))
    .filter((e): e is NonNullable<typeof e> => Boolean(e))
    .map((e) => ({ id: e.id, round: e.round, title: e.title, phase: e.phase, narrative: e.narrative }));

  return {
    team: { id: team.id, name: team.name, color: team.color, joinCode: team.joinCode, maturity: team.maturity },
    session: {
      id: team.session.id,
      name: team.session.name,
      status: team.session.status,
      currentRound: team.session.currentRound,
      deadlineAt: team.session.deadlineAt,
      budgetStart: team.budgetStart,
      incomePerRound: scenario.economy?.incomePerRound ?? 0,
    },
    scenario: {
      name: scenario.name,
      summary: scenario.summary,
      organization: scenario.organization,
      architecture: scenario.architecture,
    },
    state: {
      metrics: state.metrics,
      budget: state.budget,
      version: state.version,
      status: state.status,
      flags: state.flags,
      fundedControls: state.flags.filter((f) => f.endsWith('_funded')).map((f) => f.replace('_funded', '')),
    },
    currentEvent: event
      ? {
          id: event.id,
          round: event.round,
          phase: event.phase,
          title: event.title,
          narrative: event.narrative,
          intel: event.intel ?? [],
          businessImpact: event.businessImpact,
          controlsInPlay: event.controlsInPlay ?? [],
          options,
          signals: getVisibleSignals(event, state),
          hypotheses: event.hypotheses ?? [],
          clarity: state.knowledge?.clarity ?? 0,
        }
      : null,
    submittedDecision: submitted
      ? {
          optionId: submitted.optionId,
          optionIds: submitted.optionIds?.length ? submitted.optionIds : [submitted.optionId],
          rationale: submitted.rationale,
          cost: submitted.cost,
          createdAt: submitted.createdAt,
        }
      : null,
    proposals,
    timeline,
    leaderboard,
    members: team.members.map((m) => ({ id: m.user.id, displayName: m.user.displayName, role: m.user.role })),
  };
}

export async function submitDecision(
  teamId: string,
  userId: string,
  input: { optionId?: string; optionIds?: string[]; rationale?: string; expectedVersion: number },
) {
  const team = await prisma.team.findUnique({ where: { id: teamId }, include: { session: true } });
  if (!team) throw ApiError.notFound('Team not found');
  if (team.session.status !== 'ACTIVE') throw ApiError.conflict('Session is not active');
  if (team.session.deadlineAt && team.session.deadlineAt.getTime() < Date.now()) {
    throw ApiError.conflict('The decision deadline has passed');
  }
  const { state } = await getTeamState(teamId);
  if (state.version !== input.expectedVersion) {
    throw new ApiError(409, 'STALE_STATE', 'The game state changed; please refresh and try again');
  }
  if (!state.currentEventId) throw ApiError.conflict('No active event');
  if (state.status !== 'active') throw ApiError.conflict('This team has finished the simulation');

  const scenario = await loadScenarioForSession(team.sessionId);
  const event = getEvent(scenario, state.currentEventId);

  const ids = [...new Set(
    (input.optionIds && input.optionIds.length ? input.optionIds : input.optionId ? [input.optionId] : []).filter(Boolean),
  )];
  if (ids.length === 0) throw ApiError.badRequest('Select at least one option');
  const problem = selectionProblem(scenario, event, state, ids);
  if (problem === 'OPTION_NOT_FOUND' || problem === 'NO_OPTION') {
    throw ApiError.badRequest('This option is not available for the current state');
  }
  if (problem === 'REQUIREMENT_NOT_MET') throw ApiError.badRequest('Option requirements are not satisfied');
  if (problem === 'INSUFFICIENT_BUDGET') throw ApiError.badRequest('The combined cost exceeds the remaining budget');

  const cards = getEventCards(scenario, event, state);
  const chosen = ids.map((id) => cards.find((o) => o.id === id)!);
  const totalCost = chosen.reduce((acc, c) => acc + c.cost, 0);

  const decision = await prisma.submittedDecision.upsert({
    where: { teamId_eventId: { teamId, eventId: state.currentEventId } },
    update: {
      optionId: chosen[0]!.id,
      optionIds: ids,
      rationale: input.rationale ?? '',
      cost: totalCost,
      submittedById: userId,
      round: event.round,
    },
    create: {
      teamId,
      eventId: state.currentEventId,
      optionId: chosen[0]!.id,
      optionIds: ids,
      rationale: input.rationale ?? '',
      cost: totalCost,
      round: event.round,
      submittedById: userId,
    },
  });

  await prisma.eventHistory.create({
    data: { teamId, type: 'decision_submitted', eventId: state.currentEventId, payload: { optionId: chosen[0]!.id, optionIds: ids } as object },
  });

  emitResolved(team.sessionId, teamId, 'decisionSubmitted', { teamId, eventId: state.currentEventId });
  return decision;
}

export async function createProposal(
  teamId: string,
  displayName: string,
  input: { optionId: string; rationale?: string },
) {
  const { state } = await getTeamState(teamId);
  if (!state.currentEventId) throw ApiError.conflict('No active event');
  const proposal = await prisma.eventHistory.create({
    data: {
      teamId,
      type: 'proposal',
      eventId: state.currentEventId,
      payload: { optionId: input.optionId, rationale: input.rationale ?? '', by: displayName } as object,
    },
  });
  emitResolved(null, teamId, 'proposalCreated', { teamId, proposalId: proposal.id });
  return proposal;
}

export async function castVote(teamId: string, displayName: string, input: { proposalId: string }) {
  const { state } = await getTeamState(teamId);
  const vote = await prisma.eventHistory.create({
    data: {
      teamId,
      type: 'vote',
      eventId: state.currentEventId ?? undefined,
      payload: { proposalId: input.proposalId, by: displayName } as object,
    },
  });
  emitResolved(null, teamId, 'voteCast', { teamId, proposalId: input.proposalId });
  return vote;
}

function emitResolved(sessionId: string | null, teamId: string | null, event: string, payload: unknown) {
  if (teamId) emitToTeam(teamId, event, payload);
  if (sessionId) emitToSession(sessionId, event, payload);
}

export async function setSessionStatus(
  sessionId: string,
  actorId: string,
  status: 'LOBBY' | 'ACTIVE' | 'PAUSED' | 'ENDED',
) {
  const session = await prisma.workshopSession.findUnique({ where: { id: sessionId } });
  if (!session) throw ApiError.notFound('Session not found');
  const data: Record<string, unknown> = { status };
  if (status === 'ACTIVE' && !session.startedAt) data.startedAt = new Date();
  if (status === 'ENDED') data.endedAt = new Date();
  const updated = await prisma.workshopSession.update({ where: { id: sessionId }, data });
  await audit(sessionId, actorId, `session.${status.toLowerCase()}`, {});
  emitResolved(sessionId, null, 'sessionStatus', { status });
  return updated;
}

export async function releaseRound(sessionId: string, actorId: string) {
  const session = await prisma.workshopSession.findUnique({ where: { id: sessionId } });
  if (!session) throw ApiError.notFound('Session not found');
  if (session.status === 'ENDED') throw ApiError.conflict('Session has ended');

  const firstRelease = session.status === 'LOBBY' || session.currentRound === 0;
  const currentRound = firstRelease ? 1 : session.currentRound + 1;
  const deadlineAt = new Date(Date.now() + session.deadlineSeconds * 1000);

  const updated = await prisma.workshopSession.update({
    where: { id: sessionId },
    data: {
      status: 'ACTIVE',
      currentRound,
      deadlineAt,
      startedAt: session.startedAt ?? new Date(),
    },
  });
  await audit(sessionId, actorId, 'round.released', { currentRound });
  emitResolved(sessionId, null, 'roundReleased', { currentRound, deadlineAt });
  return updated;
}

export async function setDeadline(sessionId: string, actorId: string, seconds: number) {
  const deadlineAt = new Date(Date.now() + seconds * 1000);
  await prisma.workshopSession.update({ where: { id: sessionId }, data: { deadlineAt, deadlineSeconds: seconds } });
  await audit(sessionId, actorId, 'deadline.set', { seconds });
  emitResolved(sessionId, null, 'deadlineSet', { deadlineAt });
  return deadlineAt;
}

const NO_RESPONSE_PENALTY = { responseQuality: -4, riskReduction: -3, continuity: -2 };

export async function resolveRound(sessionId: string, actorId: string, options: { force?: boolean } = {}) {
  const session = await prisma.workshopSession.findUnique({
    where: { id: sessionId },
    include: { teams: { include: { state: true, decisions: true } } },
  });
  if (!session) throw ApiError.notFound('Session not found');
  if (session.status !== 'ACTIVE' && session.status !== 'PAUSED') {
    throw ApiError.conflict('Session is not active');
  }
  const scenario = await loadScenarioForSession(sessionId);

  const activeTeams = session.teams.filter((t) => {
    const st = t.state ? asState(t.state.data) : null;
    return st && st.status === 'active' && st.currentEventId;
  });

  const pending = activeTeams.filter(
    (t) => !t.decisions.some((d) => d.eventId === asState(t.state!.data).currentEventId),
  );
  if (pending.length > 0 && !options.force) {
    throw new ApiError(409, 'PENDING_TEAMS', `Teams pending: ${pending.map((t) => t.name).join(', ')}`);
  }

  const results: { teamId: string; next: string | null; score: number }[] = [];

  for (const team of activeTeams) {
    const current = asState(team.state!.data);
    const event = getEvent(scenario, current.currentEventId!);
    const submission = team.decisions.find((d) => d.eventId === current.currentEventId);

    let nextState: GameStateData;
    let appliedDeltas: Record<string, number>;
    let reason: string;

    if (submission) {
      const optionIds = submission.optionIds?.length ? submission.optionIds : [submission.optionId];
      const result = applyDecisions(scenario, current, optionIds);
      nextState = result.state;
      appliedDeltas = result.appliedDeltas as Record<string, number>;
      reason = 'decision';
    } else {
      // no response: penalize and advance
      const ns = structuredClone(current);
      ns.metrics = applyDeltas(ns.metrics, ns.pendingDelayed);
      ns.pendingDelayed = {};
      ns.metrics = applyDeltas(ns.metrics, NO_RESPONSE_PENALTY);
      ns.completedEventIds.push(event.id);
      ns.decisions.push({ eventId: event.id, optionId: '__no_response__', optionIds: ['__no_response__'], round: event.round, cost: 0 });
      const next = resolveNextEventId(scenario, event, ns);
      ns.currentEventId = next;
      ns.version += 1;
      if (!next) {
        ns.metrics = applyDeltas(ns.metrics, ns.pendingDelayed);
        ns.status = 'ended';
        ns.hand = [];
        ns.handEventId = undefined;
      } else {
        // draw the next round's hand and grant per-round income
        prepareActiveEvent(scenario, ns);
      }
      nextState = ns;
      appliedDeltas = { ...NO_RESPONSE_PENALTY };
      reason = 'no_response';
    }

    await prisma.gameState.update({
      where: { teamId: team.id },
      data: { data: nextState as unknown as object, version: nextState.version },
    });
    await prisma.metricChange.create({
      data: {
        teamId: team.id,
        eventId: event.id,
        round: event.round,
        deltas: appliedDeltas as object,
        resulting: nextState.metrics as unknown as object,
        reason,
      },
    });
    await prisma.eventHistory.create({
      data: {
        teamId: team.id,
        type: 'resolved',
        eventId: event.id,
        payload: {
          reason,
          optionId: submission?.optionId ?? null,
          optionIds: submission ? (submission.optionIds?.length ? submission.optionIds : [submission.optionId]) : [],
          nextEventId: nextState.currentEventId,
        } as object,
      },
    });
    results.push({ teamId: team.id, next: nextState.currentEventId, score: finalScoreFor(scenario, nextState) });
    emitResolved(sessionId, team.id, 'stateUpdated', { teamId: team.id });
  }

  // end session if every team finished
  const allStates = await prisma.gameState.findMany({ where: { team: { sessionId } } });
  const allEnded = allStates.length > 0 && allStates.every((s) => asState(s.data).status === 'ended');
  if (allEnded) {
    await prisma.workshopSession.update({ where: { id: sessionId }, data: { status: 'ENDED', endedAt: new Date() } });
  }

  await audit(sessionId, actorId, 'round.resolved', { results });
  emitResolved(sessionId, null, 'roundResolved', { results });
  return { results, allEnded };
}

export async function revealInsight(sessionId: string, actorId: string, insightKey: string) {
  const card = getProductCard(insightKey);
  if (!card) throw ApiError.badRequest('Unknown insight');
  await prisma.revealedInsight.upsert({
    where: { sessionId_insightKey: { sessionId, insightKey } },
    update: {},
    create: { sessionId, insightKey },
  });
  await audit(sessionId, actorId, 'insight.revealed', { insightKey });
  emitResolved(sessionId, null, 'insightRevealed', { insightKey });
  return card;
}

/** Public, read-only presentation payload for the audience. */
export async function getAudienceView(token: string) {
  const session = await prisma.workshopSession.findUnique({
    where: { audienceToken: token },
    include: {
      scenario: true,
      teams: { include: { state: true }, orderBy: { createdAt: 'asc' } },
      insights: true,
    },
  });
  if (!session) throw ApiError.notFound('Audience view not found');
  const scenario = session.scenario.definition as unknown as Scenario;
  const leaderboard = buildLeaderboard(
    session.teams.map((t) => ({ id: t.id, name: t.name, color: t.color, state: t.state ? asState(t.state.data) : null, score: 0 })),
    scenario,
  );
  return {
    sessionName: session.name,
    scenarioName: scenario.name,
    status: session.status,
    currentRound: session.currentRound,
    deadlineAt: session.deadlineAt,
    seed: session.seed,
    organization: scenario.organization,
    leaderboard,
    insights: session.insights.map((i) => ({ key: i.insightKey, card: getProductCard(i.insightKey) ?? null })),
  };
}
