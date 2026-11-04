import { prisma } from '../db';
import { ApiError } from '../lib/http';
import {
  finalScoreFor,
  getProductCard,
  METRIC_KEYS,
  METRIC_LABELS,
  MATURITY_BASELINE,
  DEFAULT_WEIGHTS,
  type GameStateData,
  type Scenario,
  type DecisionOption,
  type LocalizedText,
  type MaturityLevel,
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

  // Deck scenarios keep their options in `scenario.cards`; legacy scenarios keep
  // them inline per event. Build a lookup that covers both.
  const cardIndex = new Map<string, DecisionOption>();
  for (const card of scenario.cards ?? []) cardIndex.set(card.id, card);

  const teams = session.teams.map((team) => {
    const state = team.state ? (team.state.data as unknown as GameStateData) : null;
    const score = state ? finalScoreFor(scenario, state) : 0;

    const decisions = team.decisions.map((d) => {
      const ev = scenario.events.find((e) => e.id === d.eventId);
      const ids = d.optionIds && d.optionIds.length ? d.optionIds : [d.optionId];
      const opts = ids
        .map((id) => cardIndex.get(id) ?? ev?.options?.find((o) => o.id === id))
        .filter((o): o is DecisionOption => Boolean(o));
      const controls = Array.from(new Set(opts.flatMap((o) => o.controls)));
      const scoreDelta = opts.reduce((acc, o) => acc + (o.scoreDelta ?? 0), 0);
      return {
        round: d.round,
        eventId: d.eventId,
        eventTitle: ev?.title,
        optionId: d.optionId,
        optionIds: ids,
        optionLabel: opts[0]?.label,
        optionLabels: opts.map((o) => o.label),
        controls,
        cost: d.cost,
        scoreDelta,
        rationale: d.rationale,
        submittedAt: d.createdAt,
      };
    });

    const spent = team.decisions.reduce((acc, d) => acc + d.cost, 0);

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
    new Set([
      ...(scenario.cards ?? []).flatMap((o) => o.controls),
      ...scenario.events.flatMap((e) => (e.options ?? []).flatMap((o) => o.controls)),
    ]),
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

/** Localized text helper for composed (dynamic) report sentences. */
function txt(es: string, en: string): LocalizedText {
  return { es, en };
}

/**
 * Build a self-service report for a single team. On-demand (not persisted) and
 * strictly scoped to the team's own data. Requires the team to have finished all
 * rounds (state.status === 'ended'); otherwise throws 409 NOT_FINISHED.
 */
export async function buildTeamReport(teamId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      session: { include: { scenario: true } },
      state: true,
      decisions: true,
    },
  });
  if (!team) throw ApiError.notFound('Team not found');

  const state = team.state ? (team.state.data as unknown as GameStateData) : null;
  if (!state || state.status !== 'ended') {
    throw new ApiError(409, 'NOT_FINISHED', 'The team has not finished all rounds yet');
  }

  const scenario = team.session.scenario.definition as unknown as Scenario;
  const weights = (team.session.weights as Record<string, number>) ?? DEFAULT_WEIGHTS;
  const maturity = String(team.maturity).toLowerCase() as MaturityLevel;
  const baseline = MATURITY_BASELINE[maturity];

  const cardIndex = new Map<string, DecisionOption>();
  for (const card of scenario.cards ?? []) cardIndex.set(card.id, card);
  const findCard = (id: string, eventId: string): DecisionOption | undefined => {
    const ev = scenario.events.find((e) => e.id === eventId);
    return cardIndex.get(id) ?? ev?.options?.find((o) => o.id === id);
  };

  const submittedByEvent = new Map(team.decisions.map((d) => [d.eventId, d]));

  const decisions = (state.decisions ?? []).map((d) => {
    const ev = scenario.events.find((e) => e.id === d.eventId);
    const ids = d.optionIds && d.optionIds.length ? d.optionIds : [d.optionId];
    const noResponse = ids.length === 1 && ids[0] === '__no_response__';
    const opts = noResponse
      ? []
      : ids.map((id) => findCard(id, d.eventId)).filter((o): o is DecisionOption => Boolean(o));
    const controls = Array.from(new Set(opts.flatMap((o) => o.controls)));
    const scoreDelta = opts.reduce((acc, o) => acc + (o.scoreDelta ?? 0), 0);
    return {
      round: d.round,
      eventId: d.eventId,
      eventTitle: ev?.title,
      optionIds: ids,
      optionLabels: opts.map((o) => o.label),
      controls,
      cost: d.cost,
      scoreDelta,
      noResponse,
      rationale: submittedByEvent.get(d.eventId)?.rationale ?? '',
    };
  });

  const metrics = METRIC_KEYS.map((key) => {
    const value = state.metrics[key] ?? 0;
    const base = baseline[key] ?? 0;
    return {
      key,
      label: METRIC_LABELS[key],
      value,
      baseline: base,
      weight: weights[key] ?? 0,
      delta: Math.round((value - base) * 10) / 10,
    };
  });

  const fundedControls = (state.flags ?? [])
    .filter((f) => f.endsWith('_funded'))
    .map((f) => f.replace('_funded', ''));
  const clarity = state.knowledge?.clarity ?? 0;
  const spent = (state.decisions ?? []).reduce((acc, d) => acc + (d.cost ?? 0), 0);

  const strengths: { kind: string; label: LocalizedText; detail?: LocalizedText }[] = [];
  const weaknesses: { kind: string; label: LocalizedText; detail?: LocalizedText }[] = [];

  for (const d of decisions) {
    if (d.noResponse) {
      weaknesses.push({
        kind: 'noResponse',
        label: txt(`Ronda ${d.round} sin decisión`, `Round ${d.round} with no decision`),
        detail: txt(
          'No se registró respuesta a tiempo; se aplicó la penalización por inacción.',
          'No response was submitted in time; the inaction penalty applied.',
        ),
      });
      continue;
    }
    const labels = d.optionLabels.map((l) => (l ? l.es : '')).filter(Boolean).join(', ');
    if (d.scoreDelta > 0) {
      strengths.push({
        kind: 'decision',
        label: txt(`Ronda ${d.round}: ${labels}`, `Round ${d.round}: ${labels}`),
        detail: txt(
          `Decisión con impacto positivo (+${d.scoreDelta} puntos explícitos).`,
          `Decision with positive impact (+${d.scoreDelta} explicit points).`,
        ),
      });
    } else if (d.scoreDelta < 0) {
      weaknesses.push({
        kind: 'decision',
        label: txt(`Ronda ${d.round}: ${labels}`, `Round ${d.round}: ${labels}`),
        detail: txt(
          `Decisión con impacto negativo (${d.scoreDelta} puntos explícitos).`,
          `Decision with negative impact (${d.scoreDelta} explicit points).`,
        ),
      });
    }
  }

  for (const m of metrics) {
    if (m.delta >= 5) {
      strengths.push({
        kind: 'metric',
        label: txt(`${m.label.es}: ${m.value} vs base ${m.baseline}`, `${m.label.en}: ${m.value} vs baseline ${m.baseline}`),
        detail: txt('Por encima de la línea base de madurez.', 'Above the maturity baseline.'),
      });
    } else if (m.delta <= -5) {
      weaknesses.push({
        kind: 'metric',
        label: txt(`${m.label.es}: ${m.value} vs base ${m.baseline}`, `${m.label.en}: ${m.value} vs baseline ${m.baseline}`),
        detail: txt('Por debajo de la línea base de madurez.', 'Below the maturity baseline.'),
      });
    }
  }

  if (fundedControls.length > 0) {
    strengths.push({
      kind: 'coverage',
      label: txt(`Servicios financiados: ${fundedControls.join(', ')}`, `Funded services: ${fundedControls.join(', ')}`),
      detail: txt('Se invirtió en controles de servicio concretos.', 'Investment went into concrete service controls.'),
    });
  }

  const hadSignals = scenario.events.some((e) => (e.signals ?? []).length > 0);
  if (clarity >= 0.5) {
    strengths.push({
      kind: 'investigation',
      label: txt(`Claridad final ${Math.round(clarity * 100)}%`, `Final clarity ${Math.round(clarity * 100)}%`),
      detail: txt('Se investigó la evidencia ambigua antes de actuar.', 'Ambiguous evidence was investigated before acting.'),
    });
  } else if (hadSignals && clarity < 0.3) {
    weaknesses.push({
      kind: 'investigation',
      label: txt(`Claridad final baja (${Math.round(clarity * 100)}%)`, `Low final clarity (${Math.round(clarity * 100)}%)`),
      detail: txt(
        'Se actuó con poca investigación de las señales ambiguas.',
        'Acted with little investigation of ambiguous signals.',
      ),
    });
  }

  // Architecture: covered vs gap controls (from nodes + cards), with docs.
  const relevantControls = Array.from(
    new Set([
      ...scenario.architecture.map((n) => n.control).filter((c): c is NonNullable<typeof c> => Boolean(c)),
      ...(scenario.cards ?? []).flatMap((c) => c.controls),
    ]),
  );
  const covered = relevantControls
    .filter((c) => fundedControls.includes(c))
    .map((c) => ({ control: c, docs: getProductCard(c)?.docs ?? [], domain: getProductCard(c)?.domain }));
  const gaps = relevantControls
    .filter((c) => !fundedControls.includes(c))
    .map((c) => ({
      control: c,
      zone: scenario.architecture.find((n) => n.control === c)?.zone ?? 'internal',
      docs: getProductCard(c)?.docs ?? [],
      domain: getProductCard(c)?.domain,
      businessProblem: getProductCard(c)?.businessProblem,
    }));
  for (const gap of gaps) {
    weaknesses.push({
      kind: 'architecture',
      label: txt(
        `Brecha de arquitectura: no se financió ${gap.control}`,
        `Architecture gap: ${gap.control} was not funded`,
      ),
      detail: gap.businessProblem,
    });
  }
  const services = relevantControls.map((c) => ({
    service: c,
    funded: fundedControls.includes(c),
    domain: getProductCard(c)?.domain,
    docs: getProductCard(c)?.docs ?? [],
  }));

  const score = finalScoreFor(scenario, state);

  return {
    generatedAt: new Date().toISOString(),
    team: { id: team.id, name: team.name, color: team.color, maturity, score, status: state.status },
    scenario: { key: scenario.key, name: scenario.name, summary: scenario.summary },
    metrics,
    budget: { start: team.budgetStart, spent, remaining: state.budget },
    clarity,
    fundedControls,
    decisions,
    strengths,
    weaknesses,
    architecture: { gaps, covered, services },
    lessons: scenario.debrief.learningObjectives,
    correctReasoning: scenario.debrief.correctReasoning,
    disclaimer: {
      es: 'Todos los datos, incidentes y resultados de este informe son ficticios y simulados. Las puntuaciones NO constituyen una evaluación real de seguridad del entorno del cliente.',
      en: 'All data, incidents and results in this report are fictional and simulated. Scores are NOT a real security assessment of the customer environment.',
    },
  };
}
