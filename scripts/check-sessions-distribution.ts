import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const stays = await prisma.stay.findMany({
    select: {
      title: true,
      geoLabel: true,
      geoPrecision: true,
      accommodationLabel: true,
      _count: {
        select: { sessions: true }
      }
    },
    orderBy: {
      title: 'asc'
    }
  });

  console.log('📊 DISTRIBUTION DES SESSIONS\n');
  console.log('='.repeat(80));

  let totalSessions = 0;
  let withSessions = 0;
  let withoutSessions = 0;
  let withAccommodation = 0;
  let withGeo = 0;

  stays.forEach(stay => {
    const sessionCount = stay._count.sessions;
    totalSessions += sessionCount;

    if (sessionCount > 0) withSessions++;
    else withoutSessions++;

    if (stay.accommodationLabel) withAccommodation++;
    if (stay.geoLabel) withGeo++;

    const hasSessions = sessionCount > 0 ? '✅' : '❌';
    const hasAccom = stay.accommodationLabel ? '✅' : '❌';
    const hasGeo = stay.geoLabel ? '✅' : '❌';

    console.log(`${hasSessions} ${stay.title.substring(0, 50).padEnd(50)} | ${hasAccom} ${hasGeo} | ${sessionCount} sessions`);
  });

  console.log('='.repeat(80));
  console.log('\n📈 STATISTIQUES:\n');
  console.log(`Total séjours: ${stays.length}`);
  console.log(`Avec sessions: ${withSessions} (${Math.round(withSessions/stays.length*100)}%)`);
  console.log(`Sans sessions: ${withoutSessions}`);
  console.log(`Total sessions: ${totalSessions}`);
  console.log(`Moyenne sessions/séjour: ${(totalSessions/stays.length).toFixed(1)}`);
  console.log(`Avec accommodation: ${withAccommodation} (${Math.round(withAccommodation/stays.length*100)}%)`);
  console.log(`Avec geoLabel: ${withGeo} (${Math.round(withGeo/stays.length*100)}%)`);

  await prisma.$disconnect();
}

main();
