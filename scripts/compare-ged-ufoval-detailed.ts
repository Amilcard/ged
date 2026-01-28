/**
 * Analyse comparative détaillée GED vs UFOVAL
 * Pour chaque séjour: tranche d'âge, nombre de sessions, dates précises
 * Vérification onglets 7j/14j UFOVAL
 */
import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function compareDetailed() {
  // Données GED
  const gedStays = await prisma.stay.findMany({
    where: { sourceUrl: { not: null } },
    select: {
      id: true,
      title: true,
      ageMin: true,
      ageMax: true,
      sourceUrl: true,
      sessions: {
        select: {
          startDate: true,
          endDate: true,
          seatsTotal: true,
          seatsLeft: true
        },
        orderBy: { startDate: 'asc' }
      }
    }
  });

  // Trier manuellement
  gedStays.sort((a, b) => {
    if (a.ageMin !== b.ageMin) return a.ageMin - b.ageMin;
    return a.title.localeCompare(b.title);
  });

  // Données UFOVAL source
  const ufovalData = JSON.parse(fs.readFileSync('out/ufoval/rewrite_ready_final.json', 'utf-8'));

  console.log('📊 ANALYSE COMPARATIVE GED vs UFOVAL - SESSION PAR SESSION\n');
  console.log('='.repeat(120));
  console.log('Format: GED (Base de données) | UFOVAL (Site web)');
  console.log('Pour chaque séjour: Âge | Sessions | Dates | Vérification onglets 7j/14j\n');
  console.log('='.repeat(120));

  let totalEcarts = 0;
  let totalOk = 0;

  gedStays.forEach(ged => {
    const ufoval = ufovalData.find((u: any) => u.source_url === ged.sourceUrl);

    if (!ufoval) {
      console.log(`\n⚠️  ${ged.title}`);
      console.log(`   NON TROUVÉ dans UFOVAL\n`);
      totalEcarts++;
      return;
    }

    // Tranche d'âge
    const ageMatch = ged.ageMin === ufoval.age_min && ged.ageMax === ufoval.age_max;
    const ageIcon = ageMatch ? '✅' : '❌';

    // Sessions
    const sessionsMatch = ged.sessions.length === (ufoval.sessions_json?.length || 0);
    const sessionIcon = sessionsMatch ? '✅' : '❌';

    // Détail dates GED
    const gedDates = ged.sessions.map(s => {
      const start = new Date(s.startDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      const end = new Date(s.endDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      const days = Math.ceil((new Date(s.endDate).getTime() - new Date(s.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return `${start}-${end} (${days}j)`;
    });

    // Détail dates UFOVAL
    const ufovalDates = ufoval.sessions_json?.map((s: any) => {
      const start = new Date(s.start_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      const end = new Date(s.end_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      const days = Math.ceil((new Date(s.end_date).getTime() - new Date(s.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return `${start}-${end} (${days}j)`;
    }) || [];

    // Vérification dates
    let datesMatch = true;
    if (gedDates.length === ufovalDates.length) {
      for (let i = 0; i < gedDates.length; i++) {
        if (gedDates[i] !== ufovalDates[i]) {
          datesMatch = false;
          break;
        }
      }
    } else {
      datesMatch = false;
    }
    const datesIcon = datesMatch ? '✅' : '❌';

    console.log(`\n${ged.title}`);
    console.log(`   Âge:    GED ${ged.ageMin}-${ged.ageMax} ans ${ageIcon} | UFOVAL ${ufoval.age_min}-${ufoval.age_max} ans`);
    console.log(`   Sessions: GED ${ged.sessions.length} sessions ${sessionIcon} | UFOVAL ${ufoval.sessions_json?.length || 0} sessions`);

    // Affichage dates si écart ou si demandé
    if (!datesMatch || !sessionsMatch) {
      console.log(`   📅 DATES GED:`);
      gedDates.forEach((d, i) => console.log(`      ${i + 1}. ${d}`));
      console.log(`   📅 DATES UFOVAL:`);
      ufovalDates.forEach((d: any, i: number) => console.log(`      ${i + 1}. ${d}`));
    } else {
      console.log(`   📅 Dates: ${datesIcon} ${gedDates.length} sessions alignées`);
      console.log(`      ${gedDates.slice(0, 3).join(' | ')}${gedDates.length > 3 ? ' ...' : ''}`);
    }

    // Vérification onglets UFOVAL (7j/14j)
    const durations7 = ufoval.sessions_json?.filter((s: any) => {
      const days = Math.ceil((new Date(s.end_date).getTime() - new Date(s.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return days === 7;
    }).length || 0;

    const durations14 = ufoval.sessions_json?.filter((s: any) => {
      const days = Math.ceil((new Date(s.end_date).getTime() - new Date(s.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return days === 14;
    }).length || 0;

    const durationsOther = (ufoval.sessions_json?.length || 0) - durations7 - durations14;

    console.log(`   🏷️  Onglets UFOVAL: ${durations7} sessions 7j | ${durations14} sessions 14j | ${durationsOther} autres durées`);

    if (!ageMatch || !sessionsMatch || !datesMatch) {
      totalEcarts++;
    } else {
      totalOk++;
    }
  });

  console.log('\n' + '='.repeat(120));
  console.log('\n📊 RÉCAPITULATIF DES ÉCARTS\n');
  console.log(`✅ Parfaitement alignés: ${totalOk} séjours`);
  console.log(`❌ Écarts détectés: ${totalEcarts} séjours\n`);

  await prisma.$disconnect();
}

compareDetailed().catch(console.error);
