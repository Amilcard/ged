/**
 * RESTORE SESSIONS - Fixed version with default values for required fields
 */
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 RESTORING SESSIONS (FIXED)...\n');

  // Read enriched data
  const dataPath = path.join(process.cwd(), 'out/ufoval/rewrite_ready_final.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  let restored = 0;
  let skipped = 0;

  for (const stayData of data) {
    try {
      const title = stayData.pro?.title_pro || stayData.title || 'Unknown';
      const slug = stayData.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      // Find the stay
      const stay = await prisma.stay.findFirst({
        where: {
          OR: [
            { slug: slug },
            { sourceUrl: stayData.source_url }
          ]
        }
      });

      if (!stay) {
        console.log(`⚠️  Stay not found: ${title}`);
        skipped++;
        continue;
      }

      // Delete existing sessions for this stay
      await prisma.staySession.deleteMany({
        where: { stayId: stay.id }
      });

      // Create sessions with default values for required fields
      if (stayData.sessions_json && stayData.sessions_json.length > 0) {
        console.log(`📅 Creating ${stayData.sessions_json.length} sessions for: ${title}`);

        for (const sessionData of stayData.sessions_json) {
          await prisma.staySession.create({
            data: {
              stayId: stay.id,
              startDate: new Date(sessionData.start_date),
              endDate: new Date(sessionData.end_date),
              seatsTotal: sessionData.capacity_total || 30, // Default 30 if null
              seatsLeft: sessionData.capacity_remaining || 30, // Default 30 if null
              departureCity: sessionData.departure_city || null,
            }
          });
          restored++;
        }

        console.log(`  ✅ Restored ${stayData.sessions_json.length} sessions\n`);
      }

    } catch (error) {
      console.error(`❌ Error: ${(error as Error).message}\n`);
    }
  }

  console.log('='.repeat(80));
  console.log(`\n📊 RESTORE SUMMARY\n`);
  console.log(`✅ Sessions restored: ${restored}`);
  console.log(`⏭️  Skipped: ${skipped}\n`);

  // Count totals
  const totalStays = await prisma.stay.count();
  const totalSessions = await prisma.staySession.count();

  console.log(`💾 Database now contains:`);
  console.log(`   ${totalStays} stays`);
  console.log(`   ${totalSessions} sessions\n`);

  // Verify Berlin
  const berlin = await prisma.stay.findFirst({
    where: { title: { contains: 'Berlin' } },
    include: { sessions: true }
  });

  if (berlin && berlin.sessions.length > 0) {
    console.log(`✅ BERLIN verified: ${berlin.sessions.length} sessions restored`);
    berlin.sessions.forEach((s, i) => {
      const start = s.startDate.toISOString().split('T')[0];
      const end = s.endDate.toISOString().split('T')[0];
      const days = Math.ceil((s.endDate.getTime() - s.startDate.getTime()) / (1000 * 60 * 60 * 24));
      console.log(`   Session ${i+1}: ${start} → ${end} (${days} jours)`);
    });
  } else {
    console.log('❌ BERLIN: No sessions found!');
  }

  // Verify Chamonix
  const chamonix = await prisma.stay.findFirst({
    where: { title: { contains: 'Chamonix' } },
    include: { sessions: true }
  });

  if (chamonix && chamonix.sessions.length > 0) {
    console.log(`\n✅ CHAMONIX verified: ${chamonix.sessions.length} sessions`);
  }

  // Verify Bassin d'Arcachon
  const arcachon = await prisma.stay.findFirst({
    where: { title: { contains: 'Bassin' } },
    include: { sessions: true }
  });

  if (arcachon && arcachon.sessions.length > 0) {
    console.log(`✅ BASSIN D'ARCACHON verified: ${arcachon.sessions.length} sessions`);
  }
}

main()
  .catch((e) => {
    console.error('❌ Fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
