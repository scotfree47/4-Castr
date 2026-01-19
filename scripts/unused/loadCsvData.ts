// scripts/loadCsvData.ts
// Run this script to load all your CSV files into Supabase
// Usage: npx ts-node scripts/loadCsvData.ts

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface CSVMapping {
  csvPath: string;
  tableName: string;
  columnMapping: Record<string, string>;
  transform?: (row: any) => any;
}

// Define how each CSV maps to database tables
const CSV_MAPPINGS: CSVMapping[] = [
  // ASTRO DATA
  {
    csvPath: './csv-pull/market-data/data/astro/aspects.csv',
    tableName: 'astro_aspects',
    columnMapping: {
      date: 'date',
      body1: 'body1',
      body2: 'body2',
      aspect_type: 'aspect_type',
      aspect_nature: 'aspect_nature',
      orb: 'orb',
      exact: 'exact',
      body1_sign: 'body1_sign',
      body2_sign: 'body2_sign',
      primary_scoring: 'primary_scoring',
      bonus_eligible: 'bonus_eligible',
      influence_weight: 'influence_weight'
    }
  },
  {
    csvPath: './csv-pull/market-data/data/astro/ingresses.csv',
    tableName: 'astro_ingresses',
    columnMapping: {
      date: 'date',
      body: 'body',
      sign: 'sign',
      from_sign: 'from_sign',
      ruler: 'ruler',
      element: 'element'
    }
  },
  {
    csvPath: './csv-pull/market-data/data/astro/lunar_phases.csv',
    tableName: 'astro_lunar_phases',
    columnMapping: {
      date: 'date',
      phase: 'phase',
      illumination: 'illumination',
      sign: 'sign',
      ruler: 'ruler'
    }
  },
  {
    csvPath: './csv-pull/market-data/data/astro/retrogrades.csv',
    tableName: 'astro_retrogrades',
    columnMapping: {
      date: 'date',
      body: 'body',
      status: 'status',
      sign: 'sign',
      stationary: 'stationary',
      primary_scoring: 'primary_scoring',
      bonus_eligible: 'bonus_eligible',
      influence_weight: 'influence_weight'
    }
  },
  {
    csvPath: './csv-pull/market-data/data/astro/seasonal_anchors.csv',
    tableName: 'astro_seasonal_anchors',
    columnMapping: {
      date: 'date',
      type: 'type',
      sign: 'sign',
      fibonacci_anchor: 'fibonacci_anchor',
      anchor_type: 'anchor_type'
    }
  },
  
  // FIBONACCI LEVELS
  {
    csvPath: './csv-pull/market-data/data/fibonacci/fibonacci_levels.csv',
    tableName: 'fibonacci_levels',
    columnMapping: {
      symbol: 'symbol',
      category: 'category',
      anchor_pair: 'anchor_pair',
      high: 'high',
      low: 'low',
      range: 'range',
      time_span_days: 'time_span_days',
      'fib_0.236': 'fib_0_236',
      'fib_0.382': 'fib_0_382',
      'fib_0.500': 'fib_0_500',
      'fib_0.618': 'fib_0_618',
      'fib_0.786': 'fib_0_786',
      'fib_1.000': 'fib_1_000',
      'fib_1.272': 'fib_1_272',
      'fib_1.618': 'fib_1_618'
    }
  },
  
  // CONFIDENCE SCORES
  {
    csvPath: './csv-pull/market-data/data/scores/confidence_scores_20251231.csv',
    tableName: 'confidence_scores',
    columnMapping: {
      symbol: 'symbol',
      category: 'category',
      sector: 'sector',
      date: 'date',
      total_score: 'total_score',
      base_score: 'base_score',
      rating: 'rating',
      components: 'components',
      is_featured: 'is_featured'
    },
    transform: (row: any) => ({
      ...row,
      components: typeof row.components === 'string' ? JSON.parse(row.components.replace(/'/g, '"')) : row.components
    })
  },
  
  // MARKET DATA - EQUITIES
  {
    csvPath: './csv-pull/market-data/data/unintegrated/equities/equities_solstice_equinox.csv',
    tableName: 'market_seasonal_prices',
    columnMapping: {
      Symbol: 'symbol',
      Date: 'date',
      Open: 'open',
      High: 'high',
      Low: 'low',
      Close: 'close',
      Volume: 'volume'
    },
    transform: (row: any) => ({
      ...row,
      category: 'equity'
    })
  },
  
  // MARKET DATA - COMMODITIES
  {
    csvPath: './csv-pull/market-data/data/unintegrated/commodities/commodities_solstice_equinox.csv',
    tableName: 'market_seasonal_prices',
    columnMapping: {
      Commodity: 'symbol',
      Date: 'date',
      Price: 'close',
      Unit: 'unit'
    },
    transform: (row: any) => ({
      ...row,
      category: 'commodity'
    })
  },
  
  // MARKET DATA - FOREX
  {
    csvPath: './csv-pull/market-data/data/unintegrated/forex/forex_solstice_equinox.csv',
    tableName: 'market_seasonal_prices',
    columnMapping: {
      Pair: 'symbol',
      Date: 'date',
      Rate: 'close'
    },
    transform: (row: any) => ({
      ...row,
      category: 'forex'
    })
  },
  
  // MARKET DATA - CRYPTO
  {
    csvPath: './csv-pull/market-data/data/unintegrated/crypto/crypto_solstice_equinox.csv',
    tableName: 'market_seasonal_prices',
    columnMapping: {
      Symbol: 'symbol',
      Date: 'date',
      Price: 'close',
      Volume: 'volume',
      'Market Cap': 'market_cap'
    },
    transform: (row: any) => ({
      ...row,
      category: 'crypto'
    })
  },
  
  // MARKET DATA - RATES/MACRO
  {
    csvPath: './csv-pull/market-data/data/unintegrated/rates-macro/rates_macro_solstice_equinox.csv',
    tableName: 'market_seasonal_prices',
    columnMapping: {
      Symbol: 'symbol',
      Date: 'date',
      Open: 'open',
      High: 'high',
      Low: 'low',
      Close: 'close',
      Volume: 'volume'
    },
    transform: (row: any) => ({
      ...row,
      category: 'rates-macro'
    })
  },
  
  // MARKET DATA - STRESS
  {
    csvPath: './csv-pull/market-data/data/unintegrated/stress/stress_solstice_equinox.csv',
    tableName: 'market_seasonal_prices',
    columnMapping: {
      Indicator: 'symbol',
      Date: 'date',
      Value: 'close',
      Unit: 'unit'
    },
    transform: (row: any) => ({
      ...row,
      category: 'stress'
    })
  }
];

async function loadCSV(mapping: CSVMapping): Promise<void> {
  const { csvPath, tableName, columnMapping, transform } = mapping;
  
  console.log(`\n📂 Loading ${csvPath} into ${tableName}...`);
  
  // Check if file exists
  if (!fs.existsSync(csvPath)) {
    console.log(`   ⚠️  File not found, skipping: ${csvPath}`);
    return;
  }
  
  // Read and parse CSV
  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  
  // Skip comment lines starting with //
  const cleanedContent = fileContent
    .split('\n')
    .filter(line => !line.trim().startsWith('//'))
    .join('\n');
  
  const records = parse(cleanedContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });
  
  console.log(`   📊 Parsed ${records.length} records`);
  
  // Transform records
  const transformedRecords = records.map((record: any) => {
    const mapped: any = {};
    
    // Map columns
    for (const [csvCol, dbCol] of Object.entries(columnMapping)) {
      if (record[csvCol] !== undefined && record[csvCol] !== '') {
        mapped[dbCol] = record[csvCol];
      }
    }
    
    // Apply custom transform if provided
    if (transform) {
      return transform(mapped);
    }
    
    return mapped;
  }).filter((r: any) => Object.keys(r).length > 0);
  
  if (transformedRecords.length === 0) {
    console.log(`   ⚠️  No valid records after transformation`);
    return;
  }
  
  // Insert in batches of 500
  const batchSize = 500;
  let inserted = 0;
  
  for (let i = 0; i < transformedRecords.length; i += batchSize) {
    const batch = transformedRecords.slice(i, i + batchSize);
    
    const { error } = await supabase
      .from(tableName)
      .upsert(batch, { 
        onConflict: 'symbol,date', // Adjust based on table's unique constraint
        ignoreDuplicates: false 
      });
    
    if (error) {
      console.error(`   ❌ Error inserting batch ${i}-${i + batch.length}:`, error.message);
    } else {
      inserted += batch.length;
      console.log(`   ✅ Inserted batch ${i}-${i + batch.length}`);
    }
  }
  
  console.log(`   ✨ Completed: ${inserted} records inserted into ${tableName}`);
}

async function main() {
  console.log('🚀 Starting CSV data load...\n');
  console.log('=' .repeat(60));
  
  for (const mapping of CSV_MAPPINGS) {
    try {
      await loadCSV(mapping);
    } catch (error: any) {
      console.error(`❌ Error loading ${mapping.csvPath}:`, error.message);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ CSV data load complete!');
}

main().catch(console.error);