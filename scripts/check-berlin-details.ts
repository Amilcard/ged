import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const berlin = await prisma.stay.findFirst({
    where: { title: { contains: 'Berlin' } },
    include: { sessions: true }
  });

  if (berlin) {
    console.log('🏙️  SÉJOUR BERLIN - DÉTAILS COMPLETS\n');
    console.log('='.repeat(80));

    console.log('\n📋 INFORMATIONS GÉNÉRALES:');
    console.log(`   Titre: ${berlin.title}`);
    console.log(`   Slug: ${berlin.slug}`);
    console.log(`   Âges: ${berlin.ageMin || '?'} - ${berlin.ageMax || '?'} ans`);

    console.log('\n🌍 GÉOGRAPHIE:');
    console.log(`   Lieu: ${berlin.geoLabel || 'Non défini'}`);
    console.log(`   Précision: ${berlin.geoPrecision || 'Non définie'}`);

    console.log('\n🏠 HÉBERGEMENT:');
    console.log(`   Type: ${berlin.accommodationLabel || 'Non défini'}`);
    console.log(`   Catégorie: ${berlin.accommodationType || 'Non définie'}`);

    if (berlin.accommodationFacts) {
      const facts = JSON.parse(berlin.accommodationFacts as string);
      console.log('   Détails:');
      if (facts.chambres) console.log(`      - Chambres: ${facts.chambres}`);
      if (facts.sanitaires) console.log(`      - Sanitaires: ${facts.sanitaires}`);
      if (facts.equipements) console.log(`      - Équipements: ${facts.equipements}`);
    }

    console.log('\n🚃 TRANSPORT:');
    console.log(`   Villes de départ: ${berlin.departureCity || 'Non défini'}`);

    console.log('\n📅 SESSIONS:');
    berlin.sessions.forEach((session, i) => {
      const start = new Date(session.startDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const end = new Date(session.endDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const duration = Math.ceil((new Date(session.endDate).getTime() - new Date(session.startDate).getTime()) / (1000 * 60 * 60 * 24));

      console.log(`   Session ${i+1}:`);
      console.log(`      Dates: ${start} → ${end} (${duration} jours)`);
      console.log(`      Places: ${session.seatsLeft} / ${session.seatsTotal} disponibles`);
    });

    console.log('\n📝 DESCRIPTIONS:');
    console.log(`   Courte: ${berlin.descriptionShort || 'Non définie'}`);
    console.log(`   Option pédagogique: ${berlin.educationalOption || 'Non définie'}`);

    console.log('\n🖼️  MÉDIAS:');
    console.log(`   Image de couverture: ${berlin.imageCover || 'Non définie'}`);

    console.log('\n🔗 SOURCE:');
    console.log(`   URL: ${berlin.sourceUrl}`);

    console.log('\n✅ VALIDATION:');
    const hasRequired = berlin.geoLabel && berlin.accommodationLabel && berlin.sessions.length > 0;
    console.log(`   Prêt pour affichage: ${hasRequired ? 'OUI ✅' : 'NON ❌'}`);
  }

  await prisma.$disconnect();
}

main();
