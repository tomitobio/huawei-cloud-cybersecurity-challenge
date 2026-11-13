import 'dotenv/config';
import { prisma } from '../src/db';
import { hashPassword } from '../src/lib/passwords';
import { ensureScenario, createSession } from '../src/services/game';
import { CARD_LIBRARY } from '@hcc/shared';

async function main() {
  // Fictional demo account. This is the intended demo admin login; it can be
  // overridden (e.g. for a real event) via the SEED_ADMIN_PASSWORD env var.
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!';
  const admin = await prisma.user.upsert({
    where: { email: 'admin@hcc.local' },
    update: { passwordHash: await hashPassword(adminPassword) },
    create: {
      email: 'admin@hcc.local',
      displayName: 'Platform Admin',
      role: 'ADMIN',
      passwordHash: await hashPassword(adminPassword),
    },
  });

  await ensureScenario('ransomware-retail');

  // Seed the global card library from the built-in card definitions so admins
  // have an editable starting pool. Existing rows are left as-is (admin edits win).
  for (const card of Object.values(CARD_LIBRARY)) {
    await prisma.gameCard.upsert({
      where: { cardKey: card.id },
      update: {},
      create: {
        cardKey: card.id,
        label: card.label as unknown as object,
        description: card.description as unknown as object,
        cost: card.cost,
        controls: card.controls,
        tags: card.tags ?? [],
        kind: card.kind ?? 'action',
        immediate: (card.immediate as unknown as object) ?? undefined,
        delayed: (card.delayed as unknown as object) ?? undefined,
        scoreDelta: card.scoreDelta ?? 0,
        clarityDelta: card.clarityDelta ?? 0,
        revealsSignals: card.revealsSignals ?? [],
        premiumOnFocus: card.premiumOnFocus ?? false,
        serviceCard: card.serviceCard ?? false,
        baseWeight: card.baseWeight ?? 1,
        isActive: true,
      },
    });
  }
  // eslint-disable-next-line no-console
  console.log(`[seed] Card library: ${Object.keys(CARD_LIBRARY).length} cards`);

  const existing = await prisma.workshopSession.findFirst({
    where: { instructorId: admin.id, name: 'Demo — Ransomware Workshop' },
  });

  if (!existing) {
    const session = await createSession(admin.id, {
      name: 'Demo — Ransomware Workshop',
      scenarioKey: 'ransomware-retail',
      teams: [
        { name: 'Equipo Alfa', color: '#22d3ee' },
        { name: 'Equipo Bravo', color: '#f472b6' },
        { name: 'Equipo Charlie', color: '#fbbf24' },
      ],
    });
    // eslint-disable-next-line no-console
    console.log(`[seed] Created demo session "${session.name}" (join code: ${session.joinCode})`);
    for (const team of session.teams) {
      // eslint-disable-next-line no-console
      console.log(`[seed]   Team ${team.name} — join code: ${team.joinCode}`);
    }
  } else {
    // eslint-disable-next-line no-console
    console.log(`[seed] Demo session already exists (${existing.joinCode})`);
  }

  // eslint-disable-next-line no-console
  console.log('[seed] Accounts:');
  // eslint-disable-next-line no-console
  console.log(`  admin@hcc.local / ${adminPassword} (${admin.role})`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
