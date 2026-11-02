import 'dotenv/config';
import { prisma } from '../src/db';
import { hashPassword } from '../src/lib/passwords';
import { ensureScenario, createSession } from '../src/services/game';

async function main() {
  // Fictional demo accounts. Change these before any real use.
  const admin = await prisma.user.upsert({
    where: { email: 'admin@hcc.local' },
    update: {},
    create: {
      email: 'admin@hcc.local',
      displayName: 'Platform Admin',
      role: 'ADMIN',
      passwordHash: await hashPassword('Admin123!'),
    },
  });

  const instructor = await prisma.user.upsert({
    where: { email: 'instructor@hcc.local' },
    update: {},
    create: {
      email: 'instructor@hcc.local',
      displayName: 'Instructor Demo',
      role: 'INSTRUCTOR',
      passwordHash: await hashPassword('Instructor123!'),
    },
  });

  await ensureScenario('ransomware-retail');

  const existing = await prisma.workshopSession.findFirst({
    where: { instructorId: instructor.id, name: 'Demo — Ransomware Workshop' },
  });

  if (!existing) {
    const session = await createSession(instructor.id, {
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
  console.log(`  admin@hcc.local / Admin123! (${admin.role})`);
  // eslint-disable-next-line no-console
  console.log(`  instructor@hcc.local / Instructor123! (${instructor.role})`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
