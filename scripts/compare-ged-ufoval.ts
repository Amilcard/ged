/**
 * Compare GED vs UFOVAL - Mode sécurisé économies
 * Scanne les écarts: âges, dates, durées, sessions
 */
import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function compare() {
  // Données GED en base
  const gedStays = await prisma.stay.findMany({
    where: { sourceUrl: { not: null } },
    select: {
      id: true,
      title: true,
      ageMin: true,
      ageMax: true,
      durationDays: true,
      sourceUrl: true,
      sessions: {
        select: {
          startDate: true,
          endDate: true
        },
        orderBy: { startDate: 'asc' }
      }
    },
    orderBy: { title: 'asc' }
  });

  // Données UFOVAL brutes
  const ufovalData = JSON.parse(fs.readFileSync('out/ufoval/rewrite_ready_final.json', 'utf-8'));

  console.log('🔍 COMPARAISON GED vs UFOVAL\n');
  console.log('='.repeat(120));

  let totalAgeDiff = 0;
  let totalSessionDiff = 0;

  gedStays.forEach(ged => {
    const ufoval = ufovalData.find((u: any) => u.source_url === ged.sourceUrl);

    if (!ufoval) {
      console.log(`⚠️  ${ged.title}`);
      console.log(`   NON TROUVÉ dans UFOVAL\n`);
      return;
    }

    // Âges
    const ageMatch = (ged.ageMin === ufoval.age_min && ged.ageMax === ufoval.age_max);
    const ageIcon = ageMatch ? '✅' : '❌';

    if (!ageMatch) totalAgeDiff++;

    // Sessions
    const gedSessions = ged.sessions.map(s => {
      const start = new Date(s.startDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      const end = new Date(s.endDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      return `${start}-${end}`;
    }).join(', ');

    const ufovalSessions = ufoval.sessions_json?.map((s: any) => {
      const start = new Date(s.start_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      const end = new Date(s.end_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      return `${start}-${end}`;
    }).join(', ') || 'AUCUNE';

    const sessionCountDiff = ged.sessions.length - (ufoval.sessions_json?.length || 0);
    const sessionIcon = sessionCountDiff === 0 ? '✅' : (sessionCountDiff > 0 ? '➕' : '➖');

    if (sessionCountDiff !== 0) totalSessionDiff++;

    console.log(`\n${ged.title}`);
    console.log(`  Âge:    GED ${ged.ageMin}-${ged.ageMax} | ${ageIcon} UFOVAL ${ufoval.age_min}-${ufoval.age_max}`);
    console.log(`  Sessions GED (${ged.sessions.length}): ${sessionIcon} ${gedSessions}`);
    console.log(`  Sessions UFOVAL (${ufoval.sessions_json?.length || 0}):     ${ufovalSessions}`);

    if (sessionCountDiff !== 0) {
      console.log(`  ⚠️  ÉCART: ${sessionCountDiff > 0 ? sessionCountDiff + ' en trop' : Math.abs(sessionCountDiff) + ' manquantes'}`);
    }
  });

  console.log('\n' + '='.repeat(120));
  console.log('\n📊 RÉCAPITULATIF DES ÉCARTS\n');
  console.log(`❌ Âges différents: ${totalAgeDiff} séjours`);
  console.log(`⚠️  Sessions différentes: ${totalSessionDiff} séjours`);
  console.log(`✅ Alignés: ${gedStays.length - totalSessionDiff} séjours\n`);

  await prisma.$disconnect();
}

compare().catch(console.error);
