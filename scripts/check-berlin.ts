import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const berlin = await prisma.stay.findFirst({
    where: { title: { contains: 'Berlin' } },
    include: { sessions: true }
  });

  if (berlin) {
    console.log('=== BERLIN STAY ===');
    console.log('Title:', berlin.title);
    console.log('Geo:', berlin.geoLabel, '(', berlin.geoPrecision, ')');
    console.log('Accommodation:', berlin.accommodationLabel);
    console.log('Sessions:', berlin.sessions.length);
    berlin.sessions.forEach((s, i) => {
      const start = new Date(s.startDate).toLocaleDateString('fr-FR');
      const end = new Date(s.endDate).toLocaleDateString('fr-FR');
      console.log(`  Session ${i+1}: ${start} -> ${end}`);
    });
  }

  await prisma.$disconnect();
}

main();
