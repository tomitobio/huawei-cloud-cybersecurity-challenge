import 'dotenv/config';
import { prisma } from '../src/db';
import { hashPassword } from '../src/lib/passwords';
import { ensureScenario, createSession } from '../src/services/game';
import { CARD_LIBRARY } from '@hcc/shared';

async function main() {
  // Fictional demo account. This is the intended demo admin login; it can be
  // overridden (e.g. for a real event) via SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@admin.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'adminSOY4592';

  // Migrate the old demo email to the configured one (keeps the same user row,
  // so sessions/teams stay linked) if the target email doesn't exist yet.
  const legacyEmail = 'admin@hcc.local';
  if (adminEmail !== legacyEmail) {
    const legacyUser = await prisma.user.findUnique({ where: { email: legacyEmail } });
    const targetUser = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (legacyUser && !targetUser) {
      await prisma.user.update({ where: { id: legacyUser.id }, data: { email: adminEmail } });
    }
  }

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash: await hashPassword(adminPassword) },
    create: {
      email: adminEmail,
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
      // Refresh only the structural unlock-tree relations on existing rows so
      // the "buy one -> unlock others" tree stays in sync with the code-defined
      // CARD_TREE, while respecting any admin edits to the other fields.
      update: {
        requiresCards: card.requiresCards ?? [],
        unlocksCards: card.unlocksCards ?? [],
      },
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
        requiresCards: card.requiresCards ?? [],
        unlocksCards: card.unlocksCards ?? [],
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
  console.log(`  ${adminEmail} / ${adminPassword} (${admin.role})`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
