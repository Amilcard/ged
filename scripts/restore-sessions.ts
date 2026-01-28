/**
 * RESTORE SESSIONS - Fix regression where sessions were deleted
 */
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 RESTORING SESSIONS...\n');

  // Read enriched data
  const dataPath = path.join(process.cwd(), 'out/ufoval/rewrite_ready_final.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  let restored = 0;
  let errors = 0;

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
        continue;
      }

      // Check if sessions already exist
      const existingSessions = await prisma.staySession.count({
        where: { stayId: stay.id }
      });

      if (existingSessions > 0) {
        console.log(`✅ ${title}: Already has ${existingSessions} sessions`);
        continue;
      }

      // Create sessions
      if (stayData.sessions_json && stayData.sessions_json.length > 0) {
        console.log(`📅 Creating ${stayData.sessions_json.length} sessions for: ${title}`);

        for (const sessionData of stayData.sessions_json) {
          try {
            await prisma.staySession.create({
              data: {
                stayId: stay.id,
                startDate: new Date(sessionData.start_date),
                endDate: new Date(sessionData.end_date),
                seatsTotal: sessionData.capacity_total || null,
                seatsLeft: sessionData.capacity_remaining || null,
                departureCity: sessionData.departure_city || null,
              }
            });
            restored++;
          } catch (sessionError) {
            console.error(`    ❌ Session error: ${(sessionError as Error).message}`);
            errors++;
          }
        }

        console.log(`  ✅ Restored\n`);
      }

    } catch (error) {
      console.error(`❌ Error: ${(error as Error).message}\n`);
      errors++;
    }
  }

  console.log('='.repeat(80));
  console.log(`\n📊 RESTORE SUMMARY\n`);
  console.log(`✅ Sessions restored: ${restored}`);
  console.log(`❌ Errors: ${errors}\n`);

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

  if (berlin) {
    console.log(`✅ BERLIN verified: ${berlin.sessions.length} sessions restored`);
    berlin.sessions.forEach((s, i) => {
      console.log(`   Session ${i+1}: ${s.startDate.toISOString().split('T')[0]} → ${s.endDate.toISOString().split('T')[0]}`);
    });
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
