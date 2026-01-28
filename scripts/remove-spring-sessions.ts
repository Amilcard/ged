/**
 * Remove spring sessions (keep only summer: 03/07 - 30/08)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function removeSpringSessions() {
  console.log('🗑️ SUPPRESSION SESSIONS PRINTEMPS\n');

  const summerStart = new Date('2026-07-03');
  const summerEnd = new Date('2026-08-30');

  const allSessions = await prisma.staySession.findMany({
    include: {
      stay: {
        select: { title: true }
      }
    },
    orderBy: { startDate: 'asc' }
  });

  const outsideSummer = allSessions.filter(s => {
    const start = new Date(s.startDate);
    return start < summerStart || start > summerEnd;
  });

  console.log(`Sessions à supprimer: ${outsideSummer.length}\n`);

  let deleted = 0;
  for (const session of outsideSummer) {
    const start = new Date(session.startDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    const end = new Date(session.endDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });

    console.log(`❌ ${session.stay.title}`);
    console.log(`   ${start} → ${end}`);

    await prisma.staySession.delete({
      where: { id: session.id }
    });

    deleted++;
  }

  console.log(`\n✅ ${deleted} sessions supprimées`);
  console.log(`✅ ${allSessions.length - deleted} sessions conservées (été uniquement)`);

  await prisma.$disconnect();
}

removeSpringSessions().catch(console.error);
