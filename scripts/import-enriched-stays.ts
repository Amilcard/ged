/**
 * Import 18 enriched stays into local database
 * Reads rewrite_ready_final.json and imports into SQLite via Prisma
 */
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting import of 18 enriched stays...\n');

  // Read enriched data
  const dataPath = path.join(process.cwd(), 'out/ufoval/rewrite_ready_final.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  console.log(`📋 Found ${data.length} stays to import\n`);

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const stayData of data) {
    try {
      const title = stayData.pro?.title_pro || stayData.title || 'Unknown';
      const slug = stayData.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      console.log(`[${created + updated + 1}/${data.length}] ${title}`);
      console.log(`  📍 ${stayData.geo_label} (${stayData.geo_precision})`);
      console.log(`  🏠 ${stayData.accommodation_label}`);

      // Check if stay already exists
      const existing = await prisma.stay.findFirst({
        where: {
          OR: [
            { slug: slug },
            { sourceUrl: stayData.source_url }
          ]
        }
      });

      // Calculate duration from first session
      const firstSession = stayData.sessions_json?.[0];
      let durationDays = 7; // Default
      if (firstSession?.start_date && firstSession?.end_date) {
        const start = new Date(firstSession.start_date);
        const end = new Date(firstSession.end_date);
        durationDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      }

      // Extract all departure cities
      const departureCities = [...new Set(stayData.sessions_json?.map(s => s.departure_city).filter(Boolean) || [])];
      const departureCity = departureCities.length > 0 ? departureCities.join(', ') : null;

      // Prepare stay data
      const stayRecord: any = {
        slug: slug,
        title: title,
        descriptionShort: stayData.pro?.short_description_pro || stayData.kids?.short_description_kids,
        priceFrom: stayData.sessions_json?.[0]?.price_base || null,
        durationDays: durationDays,
        ageMin: stayData.age_min || null,
        ageMax: stayData.age_max || null,
        departureCity: departureCity,
        educationalOption: stayData.pro?.educational_option_pro || stayData.kids?.educational_option_kids,
        sourceUrl: stayData.source_url,
        // Enriched fields
        geoLabel: stayData.geo_label || null,
        geoPrecision: stayData.geo_precision || null,
        accommodationLabel: stayData.accommodation_label || null,
        accommodationType: stayData.accommodation_type || null,
        accommodationFacts: stayData.accommodation_facts ? JSON.stringify(stayData.accommodation_facts) : null,
        meetingPoint: stayData.meeting_point || null,
        factsSyncedAt: new Date(),
        sourceFacts: stayData.accommodation_source ? JSON.stringify({ source: stayData.accommodation_source }) : null,
      };

      // Only include imageCover if we have a value
      if (stayData.image_url) {
        stayRecord.imageCover = stayData.image_url;
      }

      // For updates, only include non-null fields
      const updateData: any = { ...stayRecord };
      if (existing) {
        // Remove fields that shouldn't be updated if null
        if (!stayData.image_url) {
          delete updateData.imageCover;
        }
      }

      // Create or update stay
      if (existing) {
        await prisma.stay.update({
          where: { id: existing.id },
          data: updateData
        });
        console.log(`  ✅ Updated (ID: ${existing.id})`);
        updated++;
      } else {
        const createdStay = await prisma.stay.create({
          data: stayRecord
        });
        console.log(`  ✅ Created (ID: ${createdStay.id})`);
        created++;
      }

      // Create sessions
      if (stayData.sessions_json && stayData.sessions_json.length > 0) {
        console.log(`  📅 Creating ${stayData.sessions_json.length} sessions...`);

        // Delete existing sessions for this stay
        if (existing) {
          await prisma.staySession.deleteMany({
            where: { stayId: existing.id }
          });
        }

        // Get stay ID (either existing or created)
        const stayId = existing ? existing.id : (await prisma.stay.findFirst({ where: { slug } }))!.id;

        for (const sessionData of stayData.sessions_json) {
          try {
            await prisma.staySession.create({
              data: {
                stayId: stayId,
                startDate: new Date(sessionData.start_date),
                endDate: new Date(sessionData.end_date),
                seatsTotal: sessionData.capacity_total || 30,
                seatsLeft: sessionData.capacity_remaining || 30,
              }
            });
          } catch (sessionError) {
            console.error(`    ❌ Session error: ${(sessionError as Error).message}`);
          }
        }

        console.log(`  ✅ Sessions imported`);
      }

      console.log('');

    } catch (error) {
      console.error(`  ❌ Error: ${(error as Error).message}\n`);
      errors++;
    }
  }

  console.log('='.repeat(80));
  console.log('\n📊 IMPORT SUMMARY\n');
  console.log(`✅ Created: ${created} stays`);
  console.log(`🔄 Updated: ${updated} stays`);
  console.log(`❌ Errors:  ${errors} stays`);
  console.log(`📋 Total:   ${data.length} stays\n`);

  // Count total in database
  const totalStays = await prisma.stay.count();
  const totalSessions = await prisma.staySession.count();

  console.log(`💾 Database now contains:`);
  console.log(`   ${totalStays} stays`);
  console.log(`   ${totalSessions} sessions\n`);
}

main()
  .catch((e) => {
    console.error('❌ Fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
