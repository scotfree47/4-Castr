// scripts/data-manager.ts
// FINAL COMPLETE VERSION - All features included
// Usage: npx tsx scripts/data-manager.ts [command] [options]

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import Papa from 'papaparse';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface CSVMapping {
  csvPath: string;
  tableName: string;
  columnMapping: Record<string, string>;
  transform?: (row: any) => any;
}

interface APIProvider {
  name: string;
  categories: string[];
  priority: number;
  rateLimit: { calls: number; period: number };
  enabled: () => boolean;
  fetch: (symbol: string, category: string) => Promise<number | null>;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const CATEGORY_MAP = {
  'equity': ['SPY', 'QQQ', 'XLY'],
  'commodity': ['GLD', 'USO', 'HG1!', 'GC1!', 'CL1!'],
  'crypto': ['Bitcoin', 'Ethereum', 'Solana', 'BNB', 'XRP'],
  'forex': ['EUR/USD', 'USD/JPY', 'GBP/USD', 'GBP/JPY', 'AUD/USD'],
  'rates-macro': ['TLT', 'FEDFUNDS', 'CPI'],
  'stress': ['VIX', 'MOVE', 'TRIN']
};

const PRICE_CSVS = {
  equity: './csv-pull/market-data/data/unintegrated/equities/equities_solstice_equinox.csv',
  commodity: './csv-pull/market-data/data/unintegrated/commodities/commodities_solstice_equinox.csv',
  crypto: './csv-pull/market-data/data/unintegrated/crypto/crypto_solstice_equinox.csv',
  forex: './csv-pull/market-data/data/unintegrated/forex/forex_solstice_equinox.csv',
};

const CSV_MAPPINGS: CSVMapping[] = [
  {
    csvPath: './csv-pull/market-data/data/astro/aspects.csv',
    tableName: 'astro_aspects',
    columnMapping: {
      date: 'date',
      body1: 'body1',
      body2: 'body2',
      aspect_type: 'aspect_type'
    }
  }
];

// ============================================================================
// API PROVIDERS
// ============================================================================

function mapCryptoSymbol(symbol: string): string {
  const map: Record<string, string> = {
    'Bitcoin': 'bitcoin', 'BTC': 'bitcoin',
    'Ethereum': 'ethereum', 'ETH': 'ethereum',
    'Solana': 'solana', 'SOL': 'solana',
    'BNB': 'binancecoin', 'XRP': 'ripple'
  };
  return map[symbol] || symbol.toLowerCase();
}

const API_PROVIDERS: APIProvider[] = [
  {
    name: 'polygon',
    categories: ['equity', 'stress'],
    priority: 1,
    rateLimit: { calls: 5, period: 60000 },
    enabled: () => !!process.env.POLYGON_API_KEY,
    fetch: async (symbol: string) => {
      const url = `https://api.polygon.io/v2/aggs/ticker/${symbol}/prev?adjusted=true&apiKey=${process.env.POLYGON_API_KEY}`;
      const res = await axios.get(url, { timeout: 10000 });
      return res.data?.results?.[0]?.c || null;
    }
  },
  {
    name: 'coingecko',
    categories: ['crypto'],
    priority: 1,
    rateLimit: { calls: 10, period: 60000 },
    enabled: () => !!process.env.COINGECKO_API_KEY,
    fetch: async (symbol: string) => {
      const coinId = mapCryptoSymbol(symbol);
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&x_cg_demo_api_key=${process.env.COINGECKO_API_KEY}`;
      const res = await axios.get(url, { timeout: 10000 });
      return res.data?.[coinId]?.usd || null;
    }
  },
  {
    name: 'alpha_vantage',
    categories: ['equity', 'forex'],
    priority: 2,
    rateLimit: { calls: 5, period: 60000 },
    enabled: () => !!process.env.ALPHA_VANTAGE_API_KEY,
    fetch: async (symbol: string, category: string) => {
      if (category === 'forex' && symbol.includes('/')) {
        const [from, to] = symbol.split('/');
        const url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${from}&to_currency=${to}&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`;
        const res = await axios.get(url, { timeout: 10000 });
        return parseFloat(res.data?.['Realtime Currency Exchange Rate']?.['5. Exchange Rate']) || null;
      }
      const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`;
      const res = await axios.get(url, { timeout: 10000 });
      return parseFloat(res.data?.['Global Quote']?.['05. price']) || null;
    }
  }
];

// ============================================================================
// RATE LIMITER
// ============================================================================

class RateLimiter {
  private callHistory: Map<string, number[]> = new Map();

  async throttle(provider: APIProvider): Promise<void> {
    const now = Date.now();
    const history = this.callHistory.get(provider.name) || [];
    const validCalls = history.filter(time => now - time < provider.rateLimit.period);

    if (validCalls.length >= provider.rateLimit.calls) {
      const oldestCall = validCalls[0];
      const waitTime = provider.rateLimit.period - (now - oldestCall) + 100;
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    validCalls.push(Date.now());
    this.callHistory.set(provider.name, validCalls);
  }

  reset(): void {
    this.callHistory.clear();
  }
}

const rateLimiter = new RateLimiter();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function parseCSV(filePath: string): any[] {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const cleanedContent = content
    .split('\n')
    .filter(line => !line.trim().startsWith('//'))
    .join('\n');

  const parsed = Papa.parse(cleanedContent, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
    trim: true
  });

  return (parsed.data as any[]).filter((row: any) =>
    row.symbol || row.Symbol || row.Commodity || row.Pair
  );
}

function getLatestPrice(symbol: string, category: string): { price: number; date: string } | null {
  const csvPath = PRICE_CSVS[category as keyof typeof PRICE_CSVS];
  if (!csvPath || !fs.existsSync(csvPath)) return null;

  const data = parseCSV(csvPath);
  const symbolData = data.filter((row: any) => {
    const rowSymbol = row.Symbol || row.Commodity || row.Pair;
    return rowSymbol === symbol;
  });

  if (symbolData.length === 0) return null;
  const sorted = symbolData.sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime());
  const latest = sorted[0];

  return {
    price: latest.Close || latest.Price || latest.Rate || 0,
    date: latest.Date
  };
}

async function fetchPriceWithFallback(
  symbol: string,
  category: string
): Promise<{ price: number; provider: string } | null> {
  const providers = API_PROVIDERS
    .filter(p => p.categories.includes(category) && p.enabled())
    .sort((a, b) => a.priority - b.priority);

  for (const provider of providers) {
    try {
      await rateLimiter.throttle(provider);
      const price = await provider.fetch(symbol, category);
      if (price && price > 0) {
        return { price, provider: provider.name };
      }
    } catch (error: any) {
      continue;
    }
  }
  return null;
}

// ============================================================================
// CORE COMMANDS
// ============================================================================

async function loadAllCSVs(): Promise<void> {
  console.log('🚀 Starting CSV data load...\n');
  for (const mapping of CSV_MAPPINGS) {
    try {
      await loadCSV(mapping);
    } catch (error: any) {
      console.error(`❌ Error: ${error.message}`);
    }
  }
  console.log('✅ CSV data load complete!');
}

async function loadCSV(mapping: CSVMapping): Promise<void> {
  const { csvPath, tableName, columnMapping, transform } = mapping;
  if (!fs.existsSync(csvPath)) return;

  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  const cleanedContent = fileContent.split('\n').filter(line => !line.trim().startsWith('//')).join('\n');

  const records = parse(cleanedContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  }) as any[];

  const transformedRecords = records.map((record: any) => {
    const mapped: any = {};
    for (const [csvCol, dbCol] of Object.entries(columnMapping)) {
      if (record[csvCol] !== undefined && record[csvCol] !== '') {
        mapped[dbCol] = record[csvCol];
      }
    }
    return transform ? transform(mapped) : mapped;
  }).filter((r: any) => Object.keys(r).length > 0);

  const { error } = await supabase
    .from(tableName)
    .upsert(transformedRecords, { onConflict: 'symbol,date' });

  if (error) console.error(`❌ Error: ${error.message}`);
}

async function checkPriceFreshness(): Promise<void> {
  console.log('🔍 Checking price data freshness...\n');

  const symbols = ['SPY', 'QQQ', 'Bitcoin', 'EUR/USD'];

  for (const symbol of symbols) {
    const { data } = await supabase
      .from('financial_data')
      .select('symbol, date, close')
      .eq('symbol', symbol)
      .order('date', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const latest = data[0];
      const daysOld = Math.floor((Date.now() - new Date(latest.date).getTime()) / (1000 * 60 * 60 * 24));
      console.log(`${symbol.padEnd(10)} | $${latest.close.toFixed(2).padStart(8)} | ${latest.date} (${daysOld} days old)`);
    } else {
      console.log(`${symbol.padEnd(10)} | NO DATA FOUND`);
    }
  }
}

async function populateFeaturedTickers(): Promise<void> {
  console.log('🚀 Populating featured tickers...\n');

  const SCORES_CSV = './csv-pull/market-data/data/scores/confidence_scores_20251231.csv';
  const scores = parseCSV(SCORES_CSV);

  const allRecords: any[] = [];

  for (const [category, symbols] of Object.entries(CATEGORY_MAP)) {
    const categoryScores = scores
      .filter((row: any) => symbols.includes(row.symbol))
      .sort((a: any, b: any) => (b.total_score || 0) - (a.total_score || 0))
      .slice(0, 10);

    for (let i = 0; i < categoryScores.length; i++) {
      const score = categoryScores[i];
      const priceData = getLatestPrice(score.symbol, category);
      if (!priceData) continue;

      allRecords.push({
        symbol: score.symbol,
        category,
        current_price: priceData.price,
        confluence_score: score.total_score || 0,
        rank: i + 1,
        updated_at: new Date().toISOString()
      });
    }
  }

  const { error } = await supabase
    .from('featured_tickers')
    .insert(allRecords);

  if (error) console.error('❌ Error:', error);
  else console.log(`✅ Inserted ${allRecords.length} featured tickers`);
}

// ============================================================================
// CRON COMMANDS
// ============================================================================

async function cronUpdatePricesDelayTolerant(): Promise<void> {
  console.log('🔄 Starting smart price update...\n');

  const args = process.argv.slice(3);
  const categoryArg = args.find(arg => arg.startsWith('--categories='));
  const requestedCategories = categoryArg
    ? categoryArg.split('=')[1].split(',')
    : Object.keys(CATEGORY_MAP);

  for (const category of requestedCategories) {
    const symbols = CATEGORY_MAP[category as keyof typeof CATEGORY_MAP];
    if (!symbols) continue;

    console.log(`\n📂 ${category.toUpperCase()} (${symbols.length} symbols)`);
    console.log('═'.repeat(60));

    const records: any[] = [];
    const today = new Date().toISOString().split('T')[0];

    for (const symbol of symbols) {
      const result = await fetchPriceWithFallback(symbol, category);

      if (result) {
        records.push({
          symbol,
          date: today,
          close: result.price,
          open: result.price,
          high: result.price,
          low: result.price,
          volume: 0
        });
        console.log(`   ✅ ${symbol.padEnd(12)} $${result.price.toFixed(2).padStart(10)} (${result.provider})`);
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    if (records.length > 0) {
      await supabase.from('financial_data').upsert(records, { onConflict: 'symbol,date' });
      console.log(`   ✅ Database updated`);
    }
  }

  rateLimiter.reset();
  console.log('\n✅ Price update complete\n');
}

async function cronRefreshFeaturedDelayTolerant(): Promise<void> {
  console.log('🌞 Checking ingress status...\n');

  const today = new Date().toISOString().split('T')[0];
  const { data: currentIngress } = await supabase
    .from('astro_events')
    .select('*')
    .eq('event_type', 'ingress')
    .eq('body', 'Sun')
    .lte('date', today)
    .order('date', { ascending: false })
    .limit(1)
    .single();

  if (!currentIngress) {
    console.log('⚠️  No ingress data\n');
    return;
  }

  const daysSinceIngress = Math.floor(
    (Date.now() - new Date(currentIngress.date).getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceIngress <= 1 || (daysSinceIngress % 7 === 0 && daysSinceIngress <= 28)) {
    console.log(`✅ Refresh triggered (day ${daysSinceIngress})\n`);
    await populateFeaturedTickers();
  } else {
    console.log('⏭️  No refresh needed\n');
  }
}

async function testAPIProviders(): Promise<void> {
  console.log('🧪 Testing API Providers...\n');

  const testSymbols = { equity: 'SPY', crypto: 'Bitcoin', forex: 'EUR/USD' };

  for (const provider of API_PROVIDERS) {
    console.log(`📡 ${provider.name.toUpperCase()}`);
    console.log(`   Enabled: ${provider.enabled() ? '✅' : '❌'}`);

    if (!provider.enabled()) continue;

    let testSymbol = '';
    let testCategory = '';

    for (const [cat, sym] of Object.entries(testSymbols)) {
      if (provider.categories.includes(cat)) {
        testSymbol = sym;
        testCategory = cat;
        break;
      }
    }

    try {
      const price = await provider.fetch(testSymbol, testCategory);
      if (price) {
        console.log(`   ✅ ${testSymbol} = $${price.toFixed(2)}\n`);
      }
    } catch (error: any) {
      console.log(`   ❌ ${error.message}\n`);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const command = process.argv[2];

  const commands: Record<string, () => Promise<void>> = {
    'load-all': loadAllCSVs,
    'check-freshness': checkPriceFreshness,
    'populate-featured': populateFeaturedTickers,
    'cron-update-prices': cronUpdatePricesDelayTolerant,
    'cron-refresh-featured': cronRefreshFeaturedDelayTolerant,
    'test-providers': testAPIProviders,
    'check-ingress': async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('astro_events')
        .select('*')
        .eq('event_type', 'ingress')
        .eq('body', 'Sun')
        .lte('date', today)
        .order('date', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        const days = Math.floor((Date.now() - new Date(data.date).getTime()) / (1000 * 60 * 60 * 24));
        console.log(`🌞 Current ingress: ${data.sign} (${data.date}, ${days} days ago)`);
      }
    }
  };

  if (!command || !commands[command]) {
    console.log(`
📊 Data Manager

Commands:
  check-freshness                Check price data staleness
  populate-featured              Populate featured tickers
  test-providers                 Test API provider connections
  check-ingress                  Check current ingress status

  🔄 Cron Commands:
  cron-update-prices [--categories=equity,crypto,forex]
  cron-refresh-featured

Examples:
  npx tsx scripts/data-manager.ts check-freshness
  npx tsx scripts/data-manager.ts cron-update-prices --categories=crypto
    `);
    process.exit(1);
  }

  try {
    await commands[command]();
    console.log('\n✅ Operation complete');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
