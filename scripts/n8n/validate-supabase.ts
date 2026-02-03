#!/usr/bin/env tsx
/**
 * Supabase Configuration Validator for GED n8n Integration
 *
 * This script validates that Supabase is properly configured for the n8n workflow
 * that writes to gd_stays and gd_stay_sessions tables.
 *
 * Usage:
 *   npx tsx scripts/n8n/validate-supabase.ts
 *
 * Environment variables required:
 *   SUPABASE_URL - Your Supabase project URL
 *   SUPABASE_SERVICE_KEY - Your Supabase service role key
 */

interface ValidationResult {
  success: boolean;
  message: string;
  details?: string;
}

interface TableInfo {
  tableName: string;
  exists: boolean;
  columns: string[];
  indexes: string[];
}

interface SupabaseConfig {
  url: string;
  project: string;
  tables: TableInfo[];
}

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset'): void {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message: string): ValidationResult {
  return { success: true, message };
}

function error(message: string, details?: string): ValidationResult {
  return { success: false, message, details };
}

function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is not set`);
  }
  return value;
}

async function fetchSupabase(query: string, headers: Record<string, string>): Promise<any> {
  const response = await fetch(query, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': headers['apikey'] || '',
      'Authorization': `Bearer ${headers['Authorization'] || ''}`,
      ' Prefer': 'return=representation',
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error(`Supabase query failed: ${response.statusText}`);
  }

  return response.json();
}

async function checkTableExists(
  tableName: string,
  headers: Record<string, string>
): Promise<ValidationResult> {
  try {
    const query = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = '${tableName}'
      );
    `;

    const result = await fetchSupabase(query, headers);

    if (result.data && result.data.length > 0) {
      const exists = result.data[0].exists;
      return exists
        ? success(`Table 'public.${tableName}' exists`)
        : error(`Table 'public.${tableName}' does not exist`, 'Run the SQL setup script first');
    }

    return error(`Could not verify table '${tableName}'`, 'Unexpected response from Supabase');
  } catch (e) {
    return error(`Failed to check table '${tableName}'`, (e as Error).message);
  }
}

async function checkRequiredColumns(
  tableName: string,
  requiredColumns: string[],
  headers: Record<string, string>
): Promise<ValidationResult> {
  try {
    const query = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = '${tableName}'
      AND column_name = ANY($1::text[]);
    `;

    const result = await fetchSupabase(query, headers);

    if (!result.data) {
      return error(`Could not check columns for '${tableName}'`);
    }

    const existingColumns = new Set(result.data.map((row: any) => row.column_name));
    const missingColumns = requiredColumns.filter(col => !existingColumns.has(col));

    if (missingColumns.length === 0) {
      return success(`All required columns exist in '${tableName}'`);
    }

    return error(
      `Missing columns in '${tableName}': ${missingColumns.join(', ')}`,
      'Run docs/URGENT_ALTER_TABLES_ADD_COLUMNS.sql'
    );
  } catch (e) {
    return error(`Failed to check columns for '${tableName}'`, (e as Error).message);
  }
}

async function checkUniqueIndex(
  tableName: string,
  indexName: string,
  headers: Record<string, string>
): Promise<ValidationResult> {
  try {
    const query = `
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND tablename = '${tableName}'
      AND indexname = '${indexName}';
    `;

    const result = await fetchSupabase(query, headers);

    if (result.data && result.data.length > 0) {
      return success(`Unique index '${indexName}' exists on '${tableName}'`);
    }

    return error(
      `Unique index '${indexName}' missing on '${tableName}'`,
      'Run docs/supabase_setup_ufoval.sql'
    );
  } catch (e) {
    return error(`Failed to check index '${indexName}'`, (e as Error).message);
  }
}

async function runValidation(): Promise<void> {
  log('\n=== Supabase Configuration Validator ===', 'cyan');
  log('For GED n8n → Supabase Integration\n', 'cyan');

  let allPassed = true;

  // Check environment variables
  log('📋 Step 1: Checking environment variables...', 'blue');
  try {
    const supabaseUrl = getEnvVar('SUPABASE_URL');
    const serviceKey = getEnvVar('SUPABASE_SERVICE_KEY');

    // Extract project ref from URL
    const projectRef = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1];
    if (!projectRef) {
      throw new Error('Could not extract project reference from SUPABASE_URL');
    }

    log(`   ✓ SUPABASE_URL: ${supabaseUrl}`, 'green');
    log(`   ✓ Project ref: ${projectRef}`, 'green');
    log(`   ✓ SUPABASE_SERVICE_KEY: ${serviceKey.substring(0, 10)}...\n`, 'green');

    const headers = {
      apikey: serviceKey,
      Authorization: serviceKey,
    };

    // Check tables exist
    log('📋 Step 2: Checking tables exist...', 'blue');

    const tables = ['gd_stays', 'gd_stay_sessions'];

    for (const table of tables) {
      const result = await checkTableExists(table, headers);
      if (result.success) {
        log(`   ✓ ${result.message}`, 'green');
      } else {
        log(`   ✗ ${result.message}`, 'red');
        if (result.details) {
          log(`     → ${result.details}`, 'yellow');
        }
        allPassed = false;
      }
    }
    console.log();

    // Check required columns for gd_stays
    log('📋 Step 3: Checking required columns for gd_stays...', 'blue');

    const staysColumns = [
      'source_url',
      'slug',
      'title_pro',
      'title_kids',
      'description_pro',
      'description_kids',
      'sessions_json',
      'import_batch_ts',
      'published',
    ];

    const staysColumnsResult = await checkRequiredColumns('gd_stays', staysColumns, headers);
    if (staysColumnsResult.success) {
      log(`   ✓ ${staysColumnsResult.message}`, 'green');
    } else {
      log(`   ✗ ${staysColumnsResult.message}`, 'red');
      if (staysColumnsResult.details) {
        log(`     → ${staysColumnsResult.details}`, 'yellow');
      }
      allPassed = false;
    }
    console.log();

    // Check required columns for gd_stay_sessions
    log('📋 Step 4: Checking required columns for gd_stay_sessions...', 'blue');

    const sessionsColumns = [
      'stay_slug',
      'start_date',
      'end_date',
      'seats_left',
      'city_departure',
      'price',
      'age_min',
      'age_max',
      'import_batch_ts',
    ];

    const sessionsColumnsResult = await checkRequiredColumns(
      'gd_stay_sessions',
      sessionsColumns,
      headers
    );
    if (sessionsColumnsResult.success) {
      log(`   ✓ ${sessionsColumnsResult.message}`, 'green');
    } else {
      log(`   ✗ ${sessionsColumnsResult.message}`, 'red');
      if (sessionsColumnsResult.details) {
        log(`     → ${sessionsColumnsResult.details}`, 'yellow');
      }
      allPassed = false;
    }
    console.log();

    // Check unique indexes
    log('📋 Step 5: Checking unique indexes (for deduplication)...', 'blue');

    const staysIndexResult = await checkUniqueIndex(
      'gd_stays',
      'uniq_gd_stays_source_url',
      headers
    );
    if (staysIndexResult.success) {
      log(`   ✓ ${staysIndexResult.message}`, 'green');
    } else {
      log(`   ✗ ${staysIndexResult.message}`, 'red');
      if (staysIndexResult.details) {
        log(`     → ${staysIndexResult.details}`, 'yellow');
      }
      allPassed = false;
    }

    const sessionsIndexResult = await checkUniqueIndex(
      'gd_stay_sessions',
      'uniq_gd_stay_sessions_slug_dates',
      headers
    );
    if (sessionsIndexResult.success) {
      log(`   ✓ ${sessionsIndexResult.message}`, 'green');
    } else {
      log(`   ✗ ${sessionsIndexResult.message}`, 'red');
      if (sessionsIndexResult.details) {
        log(`     → ${sessionsIndexResult.details}`, 'yellow');
      }
      allPassed = false;
    }
    console.log();

    // Final result
    if (allPassed) {
      log('✅ All validations passed! Supabase is ready for n8n integration.\n', 'green');
      log('Next steps:', 'cyan');
      log('  1. Add the 4 nodes to your n8n workflow (see scripts/n8n/nodes-config.json)', 'bright');
      log('  2. Configure the Supabase credential in n8n', 'bright');
      log('  3. Test the workflow by executing it manually', 'bright');
    } else {
      log('\n❌ Some validations failed. Please fix the issues above.\n', 'red');
      log('SQL scripts to run:', 'cyan');
      log('  1. docs/URGENT_ALTER_TABLES_ADD_COLUMNS.sql - Add missing columns', 'bright');
      log('  2. docs/supabase_setup_ufoval.sql - Create unique indexes', 'bright');
    }

  } catch (e) {
    log(`\n❌ Error: ${(e as Error).message}\n`, 'red');
    log('Make sure to set these environment variables:', 'cyan');
    log('  export SUPABASE_URL="https://iirfvndgzutbxwfdwawu.supabase.co"', 'bright');
    log('  export SUPABASE_SERVICE_KEY="your-service-role-key"', 'bright');
    allPassed = false;
  }
}

// Run the validation
runValidation().catch(console.error);
