import { prisma } from '../db';
import { ApiError } from '../lib/http';
import {
  finalScoreFor,
  getProductCard,
  METRIC_KEYS,
  METRIC_LABELS,
  DEFAULT_WEIGHTS,
  type GameStateData,
  type Scenario,
} from '@hcc/shared';

/** Build (and persist) a post-workshop report. All data is simulated. */
export async function generateReport(sessionId: string) {
  const session = await prisma.workshopSession.findUnique({
    where: { id: sessionId },
    include: {
      scenario: true,
      instructor: { select: { displayName: true } },
      teams: { include: { state: true, decisions: true, metricChanges: { orderBy: { createdAt: 'asc' } } } },
      insights: true,
    },
  });
  if (!session) throw ApiError.notFound('Session not found');
  const scenario = session.scenario.definition as unknown as Scenario;
  const weights = (session.weights as Record<string, number>) ?? DEFAULT_WEIGHTS;

  const teams = session.teams.map((team) => {
    const state = team.state ? (team.state.data as unknown as GameStateData) : null;
    const score = state ? finalScoreFor(scenario, state) : 0;

    const decisions = team.decisions.map((d) => {
      const ev = scenario.events.find((e) => e.id === d.eventId);
      const opt = ev?.options.find((o) => o.id === d.optionId);
      return {
        round: d.round,
        eventId: d.eventId,
        eventTitle: ev?.title,
        optionId: d.optionId,
        optionLabel: opt?.label,
        controls: opt?.controls ?? [],
        cost: d.cost,
        scoreDelta: opt?.scoreDelta ?? 0,
        rationale: d.rationale,
        submittedAt: d.createdAt,
      };
    });

    const spent = team.budgetStart - (state?.budget ?? 0);

    return {
      teamId: team.id,
      name: team.name,
      color: team.color,
      maturity: team.maturity,
      score,
      rank: 0,
      metrics: state?.metrics ?? {},
      budgetStart: team.budgetStart,
      budgetRemaining: state?.budget ?? 0,
      budgetSpent: spent,
      status: state?.status ?? 'active',
      fundedControls: (state?.flags ?? []).filter((f) => f.endsWith('_funded')).map((f) => f.replace('_funded', '')),
      decisions,
      successfulDecisions: decisions.filter((d) => d.scoreDelta > 0),
      missedOpportunities: decisions.filter((d) => d.scoreDelta < 0),
      noResponse:
        state?.decisions.filter((d) => d.optionId === '__no_response__').map((d) => d.round) ?? [],
    };
  });

  teams.sort((a, b) => b.score - a.score);
  teams.forEach((t, i) => (t.rank = i + 1));

  const metricComparison = METRIC_KEYS.map((key) => ({
    key,
    label: METRIC_LABELS[key],
    weight: weights[key] ?? 0,
    values: teams.map((t) => ({ teamId: t.teamId, name: t.name, value: (t.metrics as Record<string, number>)[key] ?? 0 })),
  }));

  const relevantControls = Array.from(
    new Set(scenario.events.flatMap((e) => e.options.flatMap((o) => o.controls))),
  );
  const services = relevantControls.map((c) => {
    const card = getProductCard(c);
    return { service: c, docs: card?.docs ?? [], domain: card?.domain };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    workshop: {
      name: session.name,
      date: session.startedAt ?? session.createdAt,
      scenario: scenario.name,
      scenarioKey: scenario.key,
      seed: session.seed,
      instructor: session.instructor.displayName,
      organization: scenario.organization,
      status: session.status,
    },
    disclaimer: {
      es: 'Todos los datos, incidentes y resultados de este informe son ficticios y simulados. Las puntuaciones NO constituyen una evaluación real de seguridad del entorno del cliente.',
      en: 'All data, incidents and results in this report are fictional and simulated. Scores are NOT a real security assessment of the customer environment.',
    },
    ranking: teams.map((t) => ({ rank: t.rank, name: t.name, score: t.score, color: t.color })),
    teams,
    metricComparison,
    weights,
    insightsRevealed: session.insights.map((i) => i.insightKey),
    relevantControls: services,
    lessonsLearned: scenario.debrief.learningObjectives,
    correctReasoning: scenario.debrief.correctReasoning,
    recommendationNote: {
      es: 'Las recomendaciones son inferidas a partir del desempeño simulado y deben validarse con una evaluación real.',
      en: 'Recommendations are inferred from simulated performance and must be validated with a real assessment.',
    },
  };

  await prisma.report.upsert({
    where: { sessionId },
    update: { data: report as unknown as object },
    create: { sessionId, data: report as unknown as object },
  });

  return report;
}
