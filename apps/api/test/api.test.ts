import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/db';
import { hashPassword } from '../src/lib/passwords';
import { ensureScenario } from '../src/services/game';
import { getScenarioByKey, type Scenario } from '@hcc/shared';

const app = createApp();
const stamp = Date.now();
const instructorEmail = `test_instructor_${stamp}@hcc.local`;
let sessionId = '';
let teamAId = '';
let teamACode = '';
let teamBId = '';
const createdUserIds: string[] = [];
const createdSessionIds: string[] = [];
const createdScenarioKeys: string[] = [];

const instructor = request.agent(app);
const captain = request.agent(app);
const participant = request.agent(app);
const outsider = request.agent(app);

beforeAll(async () => {
  await ensureScenario('ransomware-retail');
  await prisma.user.create({
    data: {
      email: instructorEmail,
      displayName: 'Test Instructor',
      role: 'INSTRUCTOR',
      passwordHash: await hashPassword('Password123!'),
    },
  });
});

afterAll(async () => {
  for (const id of createdSessionIds) {
    await prisma.workshopSession.delete({ where: { id } }).catch(() => {});
  }
  await prisma.scenario.deleteMany({ where: { key: { in: createdScenarioKeys } } });
  await prisma.user.deleteMany({ where: { email: instructorEmail } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe('API authorization and gameplay', () => {
  it('rejects unauthenticated access to protected routes', async () => {
    const res = await request(app).get('/api/sessions');
    expect(res.status).toBe(401);
  });

  it('instructor logs in', async () => {
    const res = await instructor.post('/api/auth/login').send({ email: instructorEmail, password: 'Password123!' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('INSTRUCTOR');
  });

  it('instructor creates a session with two teams', async () => {
    const res = await instructor
      .post('/api/sessions')
      .send({
        name: `Test Session ${stamp}`,
        scenarioKey: 'ransomware-retail',
        teams: [
          { name: 'Team A', color: '#22d3ee' },
          { name: 'Team B', color: '#f472b6' },
        ],
      });
    expect(res.status).toBe(201);
    sessionId = res.body.session.id;
    createdSessionIds.push(sessionId);
    expect(res.body.session.teams).toHaveLength(2);
    teamAId = res.body.session.teams[0].id;
    teamACode = res.body.session.teams[0].joinCode;
    teamBId = res.body.session.teams[1].id;
  });

  it('persists an explicit seed and exposes it on the session console and list', async () => {
    const res = await instructor
      .post('/api/sessions')
      .send({
        name: `Seeded Session ${stamp}`,
        scenarioKey: 'ransomware-retail',
        seed: 4242,
        teams: [{ name: 'Seed Team', color: '#34d399' }],
      });
    expect(res.status).toBe(201);
    expect(res.body.session.seed).toBe(4242);
    createdSessionIds.push(res.body.session.id);

    const list = await instructor.get('/api/sessions');
    const found = list.body.sessions.find((s: { id: string }) => s.id === res.body.session.id);
    expect(found.seed).toBe(4242);
  });

  it('a member joins a team', async () => {
    const res = await captain.post('/api/join').send({ code: teamACode, displayName: 'Cap' });
    expect(res.status).toBe(201);
    createdUserIds.push(res.body.user.id);
    expect(res.body.team.id).toBe(teamAId);
    expect(res.body.user.role).toBe('MEMBER');
  });

  it('a second member joins the same team', async () => {
    const res = await participant.post('/api/join').send({ code: teamACode, displayName: 'Part' });
    expect(res.status).toBe(201);
    createdUserIds.push(res.body.user.id);
    expect(res.body.user.role).toBe('MEMBER');
  });

  it('an outsider (non-member) joins team B', async () => {
    const code = (await prisma.team.findUnique({ where: { id: teamBId } }))!.joinCode;
    const res = await outsider.post('/api/join').send({ code, displayName: 'Other' });
    createdUserIds.push(res.body.user.id);
    expect(res.status).toBe(201);
  });

  it('instructor releases the first round', async () => {
    const res = await instructor.post(`/api/sessions/${sessionId}/release`).send({});
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.currentRound).toBe(1);
  });

  it('team workspace never exposes instructor notes or future events', async () => {
    const res = await captain.get(`/api/teams/${teamAId}`);
    expect(res.status).toBe(200);
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('instructorNotes');
    expect(raw).not.toContain('e4-admin'); // future event must not leak
    expect(res.body.workspace.currentEvent.id).toBe('e1-investment');
  });

  it('a team cannot access another team workspace', async () => {
    const res = await captain.get(`/api/teams/${teamBId}`);
    expect(res.status).toBe(403);
  });

  it('a non-member cannot submit a decision for another team', async () => {
    const res = await outsider
      .post(`/api/teams/${teamAId}/decision`)
      .send({ optionId: 'fix-monitor', rationale: 'nope', expectedVersion: 0 });
    expect(res.status).toBe(403);
  });

  it('any team member submits a decision; stale version is rejected', async () => {
    const ok = await captain
      .post(`/api/teams/${teamAId}/decision`)
      .send({ optionId: 'fix-monitor', rationale: 'balanced', expectedVersion: 0 });
    expect(ok.status).toBe(200);

    const stale = await captain
      .post(`/api/teams/${teamAId}/decision`)
      .send({ optionId: 'fix-monitor', rationale: 'stale', expectedVersion: 999 });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('STALE_STATE');
  });

  it('cannot resolve while teams are pending unless forced', async () => {
    const pending = await instructor.post(`/api/sessions/${sessionId}/resolve`).send({});
    expect(pending.status).toBe(409);
    expect(pending.body.code).toBe('PENDING_TEAMS');

    const forced = await instructor.post(`/api/sessions/${sessionId}/resolve`).send({ force: true });
    expect(forced.status).toBe(200);
  });

  it('applying the decision advanced the game and scored the team higher than a passive team', async () => {
    const consoleRes = await instructor.get(`/api/sessions/${sessionId}`);
    const rows = consoleRes.body.session.leaderboard;
    const a = rows.find((r: { teamId: string }) => r.teamId === teamAId);
    const b = rows.find((r: { teamId: string }) => r.teamId === teamBId);
    expect(a.score).toBeGreaterThan(b.score);
    // Team A advanced to the next event
    const teamARes = await captain.get(`/api/teams/${teamAId}`);
    expect(teamARes.body.workspace.currentEvent.id).toBe('e2-host-alert');
    expect(Array.isArray(teamARes.body.workspace.state.fundedControls)).toBe(true);
  });

  it('non-instructor cannot access the instructor console', async () => {
    const res = await captain.get(`/api/sessions/${sessionId}`);
    expect(res.status).toBe(403);
  });

  it('generates a report with ranking and disclaimer', async () => {
    const res = await instructor.get(`/api/sessions/${sessionId}/report`);
    expect(res.status).toBe(200);
    expect(res.body.report.ranking.length).toBe(2);
    expect(res.body.report.disclaimer).toBeTruthy();
    expect(res.body.report.relevantControls.length).toBeGreaterThan(0);
  });

  it('audience view is public and hides private data', async () => {
    const consoleRes = await instructor.get(`/api/sessions/${sessionId}`);
    const token = consoleRes.body.session.audienceToken;
    const res = await request(app).get(`/api/audience/${token}`);
    expect(res.status).toBe(200);
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('rationale');
    expect(raw).not.toContain('instructorNotes');
    expect(res.body.view.leaderboard.length).toBe(2);
  });

  it('records audit logs for instructor actions', async () => {
    const res = await instructor.get(`/api/sessions/${sessionId}/audit`);
    expect(res.status).toBe(200);
    const actions = res.body.audit.map((a: { action: string }) => a.action);
    expect(actions).toContain('round.released');
    expect(actions).toContain('round.resolved');
  });

  it('team report returns 409 while the team has not finished all rounds', async () => {
    const res = await outsider.get(`/api/teams/${teamBId}/report`);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('NOT_FINISHED');
  });

  it('a team cannot read another team report (403)', async () => {
    const res = await outsider.get(`/api/teams/${teamAId}/report`);
    expect(res.status).toBe(403);
  });

  it('multi-select records all chosen options and sums their cost', async () => {
    const ws = await outsider.get(`/api/teams/${teamBId}`);
    const w = ws.body.workspace;
    const avail = (w.currentEvent.options as { id: string; available: boolean; cost: number }[]).filter((o) => o.available);
    const pick = avail.slice(0, 2);
    const expectedCost = pick.reduce((acc, o) => acc + o.cost, 0);
    const res = await outsider
      .post(`/api/teams/${teamBId}/decision`)
      .send({ optionIds: pick.map((o) => o.id), rationale: 'combined', expectedVersion: w.state.version });
    expect(res.status).toBe(200);
    expect(res.body.decision.optionIds).toHaveLength(2);
    const after = await outsider.get(`/api/teams/${teamBId}`);
    expect(after.body.workspace.submittedDecision.optionIds).toHaveLength(2);
    expect(after.body.workspace.submittedDecision.cost).toBe(expectedCost);
  });

  it('finishes a team and serves its own report (200, isolated)', async () => {
    // Drive team A through all rounds with a valid single pick each round.
    for (let i = 0; i < 10; i += 1) {
      const ws = await captain.get(`/api/teams/${teamAId}`);
      const w = ws.body.workspace;
      if (w.state.status === 'ended') break;
      const avail = (w.currentEvent.options as { id: string; available: boolean }[]).filter((o) => o.available);
      await captain
        .post(`/api/teams/${teamAId}/decision`)
        .send({ optionIds: [avail[0]!.id], expectedVersion: w.state.version });
      await instructor.post(`/api/sessions/${sessionId}/resolve`).send({ force: true });
    }
    const res = await captain.get(`/api/teams/${teamAId}/report`);
    expect(res.status).toBe(200);
    expect(res.body.report.team.id).toBe(teamAId);
    expect(res.body.report.decisions.length).toBeGreaterThan(0);
    expect(Array.isArray(res.body.report.strengths)).toBe(true);
    expect(Array.isArray(res.body.report.weaknesses)).toBe(true);
    // Isolation: no other team's name leaks into this team's report.
    expect(JSON.stringify(res.body.report)).not.toContain('Team B');
  });
});

describe('scenario editor', () => {
  let customKey = '';

  it('requires authentication', async () => {
    const res = await request(app).get('/api/scenarios');
    expect(res.status).toBe(401);
  });

  it('lists built-in scenarios with their source', async () => {
    const res = await instructor.get('/api/scenarios');
    expect(res.status).toBe(200);
    const builtins = res.body.scenarios.filter((s: { source: string }) => s.source === 'builtin');
    expect(builtins.length).toBeGreaterThanOrEqual(3);
    const keys = builtins.map((s: { key: string }) => s.key);
    expect(keys).toContain('webapp-travel');
    expect(keys).toContain('privileged-access-health');
  });

  it('returns a built-in definition with no validation problems', async () => {
    const res = await instructor.get('/api/scenarios/webapp-travel');
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('builtin');
    expect(res.body.problems).toEqual([]);
    expect(res.body.scenario.events.length).toBe(6);
  });

  it('validates a scenario payload and reports problems for broken ones', async () => {
    const good = getScenarioByKey('privileged-access-health')!;
    const okRes = await instructor.post('/api/scenarios/validate').send({ scenario: good });
    expect(okRes.status).toBe(200);
    expect(okRes.body.ok).toBe(true);
    expect(okRes.body.problems).toEqual([]);

    const broken: Scenario = JSON.parse(JSON.stringify(good));
    broken.events[1]!.next = 'ghost-event';
    const badRes = await instructor.post('/api/scenarios/validate').send({ scenario: broken });
    expect(badRes.status).toBe(200);
    expect(badRes.body.ok).toBe(false);
    expect(badRes.body.problems.join(' ')).toContain('ghost-event');
  });

  it('previews a playthrough with steps and a final score', async () => {
    const res = await instructor
      .post('/api/scenarios/preview')
      .send({ key: 'privileged-access-health' });
    expect(res.status).toBe(200);
    expect(res.body.steps.length).toBe(6);
    expect(res.body.finalScore).toBeGreaterThan(0);
    expect(res.body.steps[0].eventId).toBe('c1-investment');
  });

  it('creates, updates and deletes a custom scenario', async () => {
    customKey = `test-custom-${stamp}`;
    const def: Scenario = JSON.parse(JSON.stringify(getScenarioByKey('webapp-travel')!));
    def.key = customKey;
    def.name = { es: 'Escenario de prueba', en: 'Test scenario' };

    const create = await instructor.post('/api/scenarios').send({ scenario: def });
    expect(create.status).toBe(201);
    createdScenarioKeys.push(customKey);

    const list = await instructor.get('/api/scenarios');
    const custom = list.body.scenarios.find((s: { key: string }) => s.key === customKey);
    expect(custom.source).toBe('custom');

    // update
    def.name.en = 'Updated test scenario';
    const update = await instructor.put(`/api/scenarios/${customKey}`).send({ scenario: def });
    expect(update.status).toBe(200);
    expect(update.body.scenario.name.en).toBe('Updated test scenario');

    // reject invalid custom definitions (engine-level reachability problem)
    const invalid: Scenario = JSON.parse(JSON.stringify(def));
    invalid.events[1]!.next = 'ghost-event';
    const bad = await instructor.post('/api/scenarios').send({ scenario: invalid });
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('SCENARIO_INVALID');

    // delete
    const del = await instructor.del(`/api/scenarios/${customKey}`);
    expect(del.status).toBe(200);
  });

  it('protects built-in scenarios from being edited or deleted', async () => {
    const del = await instructor.del('/api/scenarios/ransomware-retail');
    expect(del.status).toBe(400);

    const scenarioDef = getScenarioByKey('ransomware-retail')!;
    const put = await instructor.put('/api/scenarios/ransomware-retail').send({ scenario: scenarioDef });
    expect(put.status).toBe(400);
  });
});

describe('session deletion', () => {
  let deleteSessionId = '';
  let deleteTeamId = '';

  beforeAll(async () => {
    const res = await instructor
      .post('/api/sessions')
      .send({
        name: `Delete Me ${stamp}`,
        scenarioKey: 'ransomware-retail',
        teams: [{ name: 'Doomed Team', color: '#22d3ee' }],
      });
    expect(res.status).toBe(201);
    deleteSessionId = res.body.session.id;
    deleteTeamId = res.body.session.teams[0].id;
  });

  it('rejects unauthenticated deletion', async () => {
    const res = await request(app).del(`/api/sessions/${deleteSessionId}`);
    expect(res.status).toBe(401);
  });

  it('a non-instructor cannot delete a session', async () => {
    const res = await captain.del(`/api/sessions/${deleteSessionId}`);
    expect(res.status).toBe(403);
  });

  it('the instructor deletes their session and all related data is removed', async () => {
    const res = await instructor.del(`/api/sessions/${deleteSessionId}`);
    expect(res.status).toBe(200);

    const gone = await prisma.workshopSession.findUnique({ where: { id: deleteSessionId } });
    expect(gone).toBeNull();
    const teamGone = await prisma.team.findUnique({ where: { id: deleteTeamId } });
    expect(teamGone).toBeNull();
  });

  it('returns 404 when deleting an unknown session', async () => {
    const res = await instructor.del('/api/sessions/does-not-exist');
    expect(res.status).toBe(404);
  });
});
