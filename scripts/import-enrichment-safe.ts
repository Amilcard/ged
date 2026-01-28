/**
 * IMPORT SÉCURISÉ D'ENRICHISSEMENT UFOVAL → GED
 * Mission: Importer 3 champs manquants ZERO modification des textes
 *
 * Champs à importer:
 * 1. accommodationLabel (hébergement)
 * 2. departureCities (villes de départ depuis ufoval_enrichment_full.json)
 * 3. geoLabel (localisation géographique)
 *
 * Contrainte absolue: ZERO modification des textes reformulés (presentation, detailedProgram, etc.)
 *
 * Base cible: SQLite locale (dev.db) - PAS Supabase en production
 */
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// Configuration
const ENRICHED_FILE = 'out/ufoval/rewrite_ready_final.json';
const DEPARTURES_FILE = 'out/ufoval/ufoval_enrichment_full.json';
const BACKUP_DIR = '.ai-workspace/backups';

interface DepartureCity {
  city: string;
  extra_eur: number;
}

interface UfovalEnrichmentItem {
  source_url: string;
  departures: DepartureCity[];
  sessions: any[];
  meta: {
    has_departures: boolean;
    sessions_count: number;
  };
}

interface StayData {
  id: string;
  title: string;
  sourceUrl: string | null;
  accommodationLabel: string | null;
  geoLabel: string | null;
  contentKids: any; // Json field pour stocker departureCities
}

async function createBackup() {
  console.log('📦 CRÉATION BACKUP SÉCURISÉ\n');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const backupFile = path.join(BACKUP_DIR, `backup-stays-${timestamp}.json`);

  // Créer dossier backup si inexistant
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  // Sauvegarder tous les séjours avec leurs champs actuels
  const stays = await prisma.stay.findMany({
    select: {
      id: true,
      title: true,
      sourceUrl: true,
      accommodationLabel: true,
      geoLabel: true,
      geoPrecision: true,
      accommodationType: true,
      programme: true,
      descriptionShort: true,
    }
  });

  fs.writeFileSync(backupFile, JSON.stringify(stays, null, 2));
  console.log(`✅ Backup créé: ${backupFile}`);
  console.log(`   ${stays.length} séjours sauvegardés\n`);

  return backupFile;
}

async function importEnrichment() {
  console.log('🚀 IMPORT SÉCURISÉ ENRICHISSEMENT UFOVAL\n');
  console.log('='.repeat(80));

  // Backup AVANT modification
  const backupFile = await createBackup();

  // Charger les données
  console.log('📂 CHARGEMENT DONNÉES\n');
  const enrichedData = JSON.parse(fs.readFileSync(ENRICHED_FILE, 'utf-8'));
  const departuresData = JSON.parse(fs.readFileSync(DEPARTURES_FILE, 'utf-8'));

  console.log(`✅ Données enrichies: ${enrichedData.length} séjours`);
  console.log(`✅ Données départs: ${departuresData.total} séjours\n`);

  // Statistiques
  let stats = {
    updatedAccommodation: 0,
    updatedGeoLabel: 0,
    updatedDepartures: 0,
    skipped: 0,
    errors: 0
  };

  const errors: string[] = [];

  // Traiter chaque séjour
  for (const ufovalStay of enrichedData) {
    try {
      // Trouver le séjour correspondant en base
      const stay = await prisma.stay.findFirst({
        where: { sourceUrl: ufovalStay.source_url }
      });

      if (!stay) {
        console.log(`⚠️  NON TROUVÉ: ${ufovalStay.source_url}`);
        stats.skipped++;
        continue;
      }

      // Récupérer les villes de départ
      const departureItem = departuresData.items.find(
        (item: UfovalEnrichmentItem) => item.source_url === ufovalStay.source_url
      );

      const updateData: any = {};

      // 1. accommodationLabel
      if (ufovalStay.accommodation_label && stay.accommodationLabel !== ufovalStay.accommodation_label) {
        updateData.accommodationLabel = ufovalStay.accommodation_label;
        console.log(`🏠 ${stay.title.substring(0, 40)}...`);
        console.log(`   accommodationLabel: "${stay.accommodationLabel || 'NULL'}" → "${ufovalStay.accommodation_label}"`);
        stats.updatedAccommodation++;
      }

      // 2. geoLabel
      if (ufovalStay.geo_label && stay.geoLabel !== ufovalStay.geo_label) {
        updateData.geoLabel = ufovalStay.geo_label;
        console.log(`📍 geoLabel: "${stay.geoLabel || 'NULL'}" → "${ufovalStay.geo_label}"`);
        stats.updatedGeoLabel++;
      }

      // 3. departureCities (stocké dans contentKids.Json)
      if (departureItem?.departures && departureItem.departures.length > 0) {
        const currentContent = stay.contentKids as any || {};
        const currentCities = currentContent.departureCities;
        const needsUpdate = !currentCities || currentCities.length !== departureItem.departures.length;

        if (needsUpdate) {
          updateData.contentKids = {
            ...currentContent,
            departureCities: departureItem.departures
          };
          console.log(`🚌 departureCities: ${currentCities?.length || 0} → ${departureItem.departures.length} villes`);
          stats.updatedDepartures++;
        }
      }

      // Appliquer les mises à jour
      if (Object.keys(updateData).length > 0) {
        await prisma.stay.update({
          where: { id: stay.id },
          data: updateData
        });
        console.log(`   ✅ Mis à jour\n`);
      } else {
        stats.skipped++;
      }

    } catch (error) {
      const errorMsg = `Erreur sur ${ufovalStay.source_url}: ${error}`;
      console.log(`❌ ${errorMsg}\n`);
      errors.push(errorMsg);
      stats.errors++;
    }
  }

  // Rapport final
  console.log('='.repeat(80));
  console.log('\n📊 RAPPORT D\'IMPORT\n');

  console.log(`✅ accommodationLabel mis à jour: ${stats.updatedAccommodation}`);
  console.log(`✅ geoLabel mis à jour: ${stats.updatedGeoLabel}`);
  console.log(`✅ departureCities mis à jour: ${stats.updatedDepartures}`);
  console.log(`⏭️  Déjà à jour (skip): ${stats.skipped}`);
  console.log(`❌ Erreurs: ${stats.errors}\n`);

  console.log(`📦 Backup: ${backupFile}`);

  if (errors.length > 0) {
    console.log('\n❌ ERREURS:\n');
    errors.forEach(e => console.log(`  - ${e}`));
  }

  // Générer rapport JSON
  const report = {
    timestamp: new Date().toISOString(),
    backupFile,
    stats,
    errors,
    staysProcessed: enrichedData.length
  };

  const reportFile = '.ai-workspace/enrichment-import-report.json';
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(`\n📄 Rapport JSON: ${reportFile}`);

  await prisma.$disconnect();
}

importEnrichment().catch(console.error);
