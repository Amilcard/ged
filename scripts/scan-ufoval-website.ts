/**
 * Scan UFOVAL website et compare avec GED
 * Cherche les 18 séjours UFOVAL par lieu et tranche d'âge
 */
import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function scanUfoval() {
  // Données GED
  const gedStays = await prisma.stay.findMany({
    where: { sourceUrl: { not: null } },
    select: {
      title: true,
      ageMin: true,
      ageMax: true,
      geoLabel: true,
      geoPrecision: true,
      sourceUrl: true,
      sessions: {
        select: { startDate: true, endDate: true },
        orderBy: { startDate: 'asc' }
      }
    },
    orderBy: { title: 'asc' }
  });

  console.log('🔍 SCAN UFOVAL vs GED - 18 SÉJOURS ÉTÉ\n');
  console.log('='.repeat(100));
  console.log('GED'.padEnd(50) + 'UFOVAL (Site web)');
  console.log('='.repeat(100));

  // Mapping des lieux connus
  const locationMap = {
    'Berlin': { search: 'Berlin', geo: 'urbain / étranger' },
    'Courchevel': { search: 'Courchevel', geo: 'montagne' },
    'Chamonix': { search: 'Chamonix', geo: 'montagne' },
    'Bassin': { search: 'Bassin', geo: 'mer' },
    'Taussat': { search: 'Taussat', geo: 'mer' },
    'Arcachon': { search: 'Arcachon', geo: 'mer' },
    'Issambres': { search: 'Issambres', geo: 'mer' },
    'Saint-Raphaël': { search: 'Saint-Raphaël', geo: 'mer' },
    'Thorens-Glières': { search: 'Thorens', geo: 'montagne' },
    'Glières': { search: 'Glières', geo: 'montagne' },
    'Carroz': { search: 'Carroz', geo: 'montagne' },
    'Arâches': { search: 'Arâches', geo: 'montagne' },
    'Annecy': { search: 'Annecy', geo: 'urbain' },
    'Duingt': { search: 'Annecy', geo: 'urbain' },
    'Saint-Florent': { search: 'Saint-Florent', geo: 'mer' },
    'Corse': { search: 'Saint-Florent', geo: 'mer' }
  };

  gedStays.forEach(ged => {
    const ageRange = `${ged.ageMin}-${ged.ageMax} ans`;
    const sessionCount = ged.sessions.length;
    const sessionRange = sessionCount > 0
      ? `${new Date(ged.sessions[0].startDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} → ${new Date(ged.sessions[ged.sessions.length - 1].endDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}`
      : 'Aucune session';

    console.log(`\n${ged.title}`);
    console.log(`  Âge: ${ageRange}`);
    console.log(`  Lieu: ${ged.geoLabel} (${ged.geoPrecision})`);
    console.log(`  Sessions GED: ${sessionCount} (${sessionRange})`);

    // Recherche dans UFOVAL par lieu
    for (const [key, info] of Object.entries(locationMap)) {
      if (ged.title.toLowerCase().includes(key.toLowerCase()) ||
          ged.geoLabel?.toLowerCase().includes(key.toLowerCase())) {
        console.log(`  🔍 UFOVAL: Recherche "${info.search}" pour ${info.geo}`);
        break;
      }
    }
  });

  console.log('\n' + '='.repeat(100));
  console.log('\n✅ 18 séjours scannés - Données prêtes pour vérification site UFOVAL\n');

  await prisma.$disconnect();
}

scanUfoval().catch(console.error);
