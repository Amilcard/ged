/**
 * Fix duration days for all stays
 * Problem: Durées calculées avec -1 jour (ex: 7-13 août = 6j au lieu de 7j)
 * Fix: Recalculate from first session with correct formula
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixAllDurations() {
  console.log('🔧 CORRECTION DES DURÉES\n');

  const stays = await prisma.stay.findMany({
    include: {
      sessions: {
        take: 1,
        orderBy: { startDate: 'asc' }
      }
    }
  });

  let fixed = 0;
  let verified = 0;

  for (const stay of stays) {
    const session = stay.sessions[0];

    if (session && session.startDate && session.endDate) {
      // Calcul correct: (endDate - startDate) / 86400000 + 1
      const start = new Date(session.startDate);
      const end = new Date(session.endDate);
      const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      if (stay.durationDays !== days) {
        console.log(`❌ ${stay.title}`);
        console.log(`   Session: ${start.toLocaleDateString('fr-FR')} → ${end.toLocaleDateString('fr-FR')}`);
        console.log(`   Durée actuelle: ${stay.durationDays}j`);
        console.log(`   Durée correcte: ${days}j`);
        console.log(`   Correction: ${days - stay.durationDays > 0 ? '+' : ''}${days - stay.durationDays}j`);

        await prisma.stay.update({
          where: { id: stay.id },
          data: { durationDays: days }
        });

        console.log(`   ✅ Corrigé\n`);
        fixed++;
      } else {
        verified++;
      }
    }
  }

  console.log('='.repeat(80));
  console.log(`\n📊 RÉCAPITULATIF:`);
  console.log(`   ✅ Corrigées: ${fixed} séjours`);
  console.log(`   ✅ Vérifiées: ${verified} séjours (déjà correctes)`);
  console.log(`   📋 Total: ${stays.length} séjours\n`);

  await prisma.$disconnect();
}

fixAllDurations().catch(console.error);
