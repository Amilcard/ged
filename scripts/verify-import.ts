/**
 * Verify imported enriched data in database
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Verifying imported data...\n');

  // Count stats
  const totalStays = await prisma.stay.count();
  const totalSessions = await prisma.staySession.count();

  // Count enriched fields
  const withGeoLabel = await prisma.stay.count({
    where: { geoLabel: { not: null } }
  });
  const withGeoPrecision = await prisma.stay.count({
    where: { geoPrecision: { not: null } }
  });
  const withAccommodationLabel = await prisma.stay.count({
    where: { accommodationLabel: { not: null } }
  });
  const withAccommodationType = await prisma.stay.count({
    where: { accommodationType: { not: null } }
  });
  const withAccommodationFacts = await prisma.stay.count({
    where: { accommodationFacts: { not: null } }
  });
  const withMeetingPoint = await prisma.stay.count({
    where: { meetingPoint: { not: null } }
  });

  console.log('📊 DATABASE STATS\n');
  console.log(`Total stays: ${totalStays}`);
  console.log(`Total sessions: ${totalSessions}\n`);

  console.log('📍 ENRICHED FIELDS\n');
  console.log(`geoLabel: ${withGeoLabel}/${totalStays} (${Math.round(withGeoLabel/totalStays*100)}%)`);
  console.log(`geoPrecision: ${withGeoPrecision}/${totalStays} (${Math.round(withGeoPrecision/totalStays*100)}%)`);
  console.log(`accommodationLabel: ${withAccommodationLabel}/${totalStays} (${Math.round(withAccommodationLabel/totalStays*100)}%)`);
  console.log(`accommodationType: ${withAccommodationType}/${totalStays} (${Math.round(withAccommodationType/totalStays*100)}%)`);
  console.log(`accommodationFacts: ${withAccommodationFacts}/${totalStays} (${Math.round(withAccommodationFacts/totalStays*100)}%)`);
  console.log(`meetingPoint: ${withMeetingPoint}/${totalStays} (${Math.round(withMeetingPoint/totalStays*100)}%)\n`);

  // Show sample stays
  console.log('🏖️ SAMPLE STAYS\n');

  const sampleStays = await prisma.stay.findMany({
    where: {
      geoPrecision: { not: null },
      accommodationLabel: { not: null }
    },
    take: 5,
    orderBy: { title: 'asc' }
  });

  for (const stay of sampleStays) {
    console.log(`✅ ${stay.title}`);
    console.log(`   📍 ${stay.geoLabel} - ${stay.geoPrecision}`);
    console.log(`   🏠 ${stay.accommodationLabel} (${stay.accommodationType})`);
    if (stay.meetingPoint) {
      console.log(`   🎯 ${stay.meetingPoint.substring(0, 60)}...`);
    }
    console.log('');
  }

  // Check Berlin specifically
  console.log('🇩🇪 BERLIN VERIFICATION\n');
  const berlin = await prisma.stay.findFirst({
    where: {
      OR: [
        { title: { contains: 'Berlin' } },
        { geoLabel: 'Berlin' }
      ]
    }
  });

  if (berlin) {
    console.log(`✅ Found: ${berlin.title}`);
    console.log(`   geoLabel: ${berlin.geoLabel}`);
    console.log(`   geoPrecision: ${berlin.geoPrecision}`);
    console.log(`   accommodationLabel: ${berlin.accommodationLabel}`);
    console.log(`   accommodationType: ${berlin.accommodationType}`);

    if (berlin.geoPrecision === 'urbain / étranger') {
      console.log(`   ✅ CORRECT: Berlin is "urbain / étranger"\n`);
    } else {
      console.log(`   ❌ WARNING: geoPrecision is "${berlin.geoPrecision}"\n`);
    }
  } else {
    console.log('❌ Berlin stay not found!\n');
  }

  // Check Chamonix
  console.log('🏔️ CHAMONIX VERIFICATION\n');
  const chamonix = await prisma.stay.findFirst({
    where: {
      OR: [
        { title: { contains: 'Chamonix' } },
        { geoLabel: 'Chamonix' }
      ]
    }
  });

  if (chamonix) {
    console.log(`✅ Found: ${chamonix.title}`);
    console.log(`   geoLabel: ${chamonix.geoLabel}`);
    console.log(`   geoPrecision: ${chamonix.geoPrecision}`);
    console.log(`   accommodationLabel: ${chamonix.accommodationLabel}`);

    if (chamonix.geoPrecision === 'montagne') {
      console.log(`   ✅ CORRECT: Chamonix is "montagne"\n`);
    } else {
      console.log(`   ❌ WARNING: geoPrecision is "${chamonix.geoPrecision}"\n`);
    }
  } else {
    console.log('❌ Chamonix stay not found!\n');
  }

  // Check Bassin d'Arcachon
  console.log('🏖️ BASSIN D\'ARCACHON VERIFICATION\n');
  const arcachon = await prisma.stay.findFirst({
    where: {
      OR: [
        { title: { contains: 'Bassin' } },
        { title: { contains: 'Taussat' } }
      ]
    }
  });

  if (arcachon) {
    console.log(`✅ Found: ${arcachon.title}`);
    console.log(`   geoLabel: ${arcachon.geoLabel}`);
    console.log(`   geoPrecision: ${arcachon.geoPrecision}`);
    console.log(`   accommodationLabel: ${arcachon.accommodationLabel}`);

    if (arcachon.geoPrecision === 'mer') {
      console.log(`   ✅ CORRECT: Bassin d'Arcachon is "mer"\n`);
    } else {
      console.log(`   ❌ WARNING: geoPrecision is "${arcachon.geoPrecision}"\n`);
    }
  } else {
    console.log('❌ Bassin d\'Arcachon stay not found!\n');
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
