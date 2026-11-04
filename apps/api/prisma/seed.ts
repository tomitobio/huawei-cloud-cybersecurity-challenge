import 'dotenv/config';
import { prisma } from '../src/db';
import { hashPassword } from '../src/lib/passwords';
import { ensureScenario, createSession } from '../src/services/game';

async function main() {
  // Fictional demo accounts. Change these before any real use.
  // Passwords can be rotated via env (recommended for any real deployment):
  //   SEED_ADMIN_PASSWORD / SEED_INSTRUCTOR_PASSWORD
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Hcc-d25kuoAyPLMz1JVW0VoN!';
  const instructorPassword = process.env.SEED_INSTRUCTOR_PASSWORD ?? 'Instructor123!';
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

  const instructor = await prisma.user.upsert({
    where: { email: 'instructor@hcc.local' },
    update: { passwordHash: await hashPassword(instructorPassword) },
    create: {
      email: 'instructor@hcc.local',
      displayName: 'Instructor Demo',
      role: 'INSTRUCTOR',
      passwordHash: await hashPassword(instructorPassword),
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
  console.log(`  admin@hcc.local / ${adminPassword} (${admin.role})`);
  // eslint-disable-next-line no-console
  console.log(`  instructor@hcc.local / ${instructorPassword} (${instructor.role})`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
