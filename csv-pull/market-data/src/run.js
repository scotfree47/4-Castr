import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createObjectCsvWriter } from 'csv-writer';
import https from 'https';

// Import config
import { SYMBOLS } from './config/symbols.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_ROOT = path.join(__dirname, '..', 'data');

const ASTRO_DATES = {
  2005: ['2005-03-20', '2005-06-21', '2005-09-22', '2005-12-21'],
  2015: ['2015-03-20', '2015-06-21', '2015-09-23', '2015-12-21'],
  2018: ['2018-03-20', '2018-06-21', '2018-09-22', '2018-12-21'],
  2022: ['2022-03-20', '2022-06-21', '2022-09-22', '2022-12-21'],
  2025: ['2025-03-20', '2025-06-20', '2025-09-22', '2025-12-21']
};

const ALL_TARGET_DATES = Object.values(ASTRO_DATES).flat();

const DATA_DIRS = ['anchors', 'commodities', 'crypto', 'equities', 'forex', 'stress'];

function ensureDirectories() {
  DATA_DIRS.forEach(dir => {
    const fullPath = path.join(DATA_ROOT, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  });
}

// Check if CSV already exists and has data
function csvExists(filename) {
  if (!fs.existsSync(filename)) return false;
  
  const content = fs.readFileSync(filename, 'utf8');
  const lines = content.trim().split('\n');
  return lines.length > 1; // More than just header
}

async function writeCSV(filename, records, headers) {
  if (!records || records.length === 0) {
    console.log(`⚠️  No records for ${path.basename(filename)}`);
    return false;
  }

  const csvWriter = createObjectCsvWriter({
    path: filename,
    header: headers
  });

  await csvWriter.writeRecords(records);
  console.log(`✓ ${path.basename(filename)}: ${records.length} rows`);
  return true;
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Improved Yahoo Finance fetcher with better error handling
async function fetchYahooData(symbol, targetDates, type = 'equity') {
  const period1 = Math.floor(new Date('2005-01-01').getTime() / 1000);
  const period2 = Math.floor(new Date('2025-12-31').getTime() / 1000);
  
  let yahooSymbol = symbol;
  if (type === 'crypto') yahooSymbol = `${symbol}-USD`;
  if (type === 'forex') yahooSymbol = `${symbol}=X`;
  if (type === 'index') yahooSymbol = `^${symbol}`;
  if (type === 'commodity') {
    const commodityMap = {
      'COTTON': 'CT=F', 'WHEAT': 'ZW=F', 'CORN': 'ZC=F',
      'SUGAR': 'SB=F', 'COFFEE': 'KC=F'
    };
    yahooSymbol = commodityMap[symbol] || symbol;
  }

  const url = `https://query1.finance.yahoo.com/v7/finance/download/${yahooSymbol}?period1=${period1}&period2=${period2}&interval=1d&events=history`;

  try {
    const csvData = await new Promise((resolve, reject) => {
      const options = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/csv,application/csv',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      };

      const req = https.get(url, options, (res) => {
        // Handle redirects
        if (res.statusCode === 301 || res.statusCode === 302) {
          https.get(res.headers.location, options, (res2) => {
            let body = '';
            res2.on('data', chunk => body += chunk);
            res2.on('end', () => resolve(body));
          }).on('error', reject);
          return;
        }

        if (res.statusCode !== 200) {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => {
            reject(new Error(`HTTP ${res.statusCode}: ${body.substring(0, 100)}`));
          });
          return;
        }

        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve(body));
      });

      req.on('error', reject);
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    });

    // Parse CSV
    const lines = csvData.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].toLowerCase().split(',');
    const targetSet = new Set(targetDates);
    const results = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const date = values[0];

      if (targetSet.has(date)) {
        const row = {};
        headers.forEach((header, idx) => {
          row[header.trim()] = values[idx];
        });

        if (type === 'crypto') {
          results.push({
            symbol: symbol,
            date: date,
            price: parseFloat(row.close) || null,
            volume: parseFloat(row.volume) || null,
            market_cap: null
          });
        } else if (type === 'forex') {
          results.push({
            pair: symbol,
            date: date,
            rate: parseFloat(row.close) || null,
            change: 0
          });
        } else if (type === 'commodity') {
          results.push({
            commodity: symbol,
            date: date,
            price: parseFloat(row.close) || null,
            unit: 'USD'
          });
        } else if (type === 'stress') {
          results.push({
            indicator: symbol,
            date: date,
            value: parseFloat(row.close) || null,
            unit: 'index'
          });
        } else {
          results.push({
            symbol: symbol,
            date: date,
            open: parseFloat(row.open) || null,
            high: parseFloat(row.high) || null,
            low: parseFloat(row.low) || null,
            close: parseFloat(row.close) || null,
            volume: parseFloat(row.volume) || null
          });
        }
      }
    }

    return results;
  } catch (err) {
    // Silent fail - just return empty array
    return [];
  }
}

async function fetchEquities() {
  const filename = path.join(DATA_ROOT, 'equities', `equities_solstice_equinox.csv`);
  
  if (csvExists(filename)) {
    console.log('✓ Equities CSV already exists, skipping...');
    return;
  }

  console.log('\n📈 Fetching Equities...');
  const allData = [];
  let successCount = 0;

  for (const symbol of SYMBOLS.equities) {
    const data = await fetchYahooData(symbol, ALL_TARGET_DATES, 'equity');
    if (data.length > 0) {
      allData.push(...data);
      successCount++;
      process.stdout.write(`✓`);
    } else {
      process.stdout.write(`✗`);
    }
    await delay(150);
  }

  console.log(`\n  Success: ${successCount}/${SYMBOLS.equities.length}`);

  await writeCSV(filename, allData, [
    { id: 'symbol', title: 'Symbol' },
    { id: 'date', title: 'Date' },
    { id: 'open', title: 'Open' },
    { id: 'high', title: 'High' },
    { id: 'low', title: 'Low' },
    { id: 'close', title: 'Close' },
    { id: 'volume', title: 'Volume' }
  ]);
}

async function fetchCrypto() {
  const filename = path.join(DATA_ROOT, 'crypto', `crypto_solstice_equinox.csv`);
  
  if (csvExists(filename)) {
    console.log('✓ Crypto CSV already exists, skipping...');
    return;
  }

  console.log('\n📊 Fetching Crypto...');
  const allData = [];
  let successCount = 0;

  const cryptoSymbols = ['BTC', 'ETH', 'BNB', 'XRP', 'BCH', 'SOL', 'ADA', 'DOT', 'LINK', 'XLM'];

  for (const symbol of cryptoSymbols) {
    const data = await fetchYahooData(symbol, ALL_TARGET_DATES, 'crypto');
    if (data.length > 0) {
      allData.push(...data);
      successCount++;
      process.stdout.write(`✓`);
    } else {
      process.stdout.write(`✗`);
    }
    await delay(150);
  }

  console.log(`\n  Success: ${successCount}/${cryptoSymbols.length}`);

  await writeCSV(filename, allData, [
    { id: 'symbol', title: 'Symbol' },
    { id: 'date', title: 'Date' },
    { id: 'price', title: 'Price' },
    { id: 'volume', title: 'Volume' },
    { id: 'market_cap', title: 'Market Cap' }
  ]);
}

async function fetchForex() {
  const filename = path.join(DATA_ROOT, 'forex', `forex_solstice_equinox.csv`);
  
  if (csvExists(filename)) {
    console.log('✓ Forex CSV already exists, skipping...');
    return;
  }

  console.log('\n💱 Fetching Forex...');
  const allData = [];
  let successCount = 0;

  for (const [base, quote, pairName] of SYMBOLS.forex) {
    const yahooSymbol = `${base}${quote}`;
    const data = await fetchYahooData(yahooSymbol, ALL_TARGET_DATES, 'forex');
    
    data.forEach(row => row.pair = pairName);
    
    if (data.length > 0) {
      allData.push(...data);
      successCount++;
      process.stdout.write(`✓`);
    } else {
      process.stdout.write(`✗`);
    }
    await delay(150);
  }

  console.log(`\n  Success: ${successCount}/${SYMBOLS.forex.length}`);

  await writeCSV(filename, allData, [
    { id: 'pair', title: 'Pair' },
    { id: 'date', title: 'Date' },
    { id: 'rate', title: 'Rate' },
    { id: 'change', title: 'Change %' }
  ]);
}

async function fetchCommodities() {
  const filename = path.join(DATA_ROOT, 'commodities', `commodities_solstice_equinox.csv`);
  
  if (csvExists(filename)) {
    console.log('✓ Commodities CSV already exists, skipping...');
    return;
  }

  console.log('\n🌾 Fetching Commodities...');
  const allData = [];
  let successCount = 0;

  const commodities = ['COTTON', 'WHEAT', 'CORN', 'SUGAR', 'COFFEE'];

  for (const commodity of commodities) {
    const data = await fetchYahooData(commodity, ALL_TARGET_DATES, 'commodity');
    if (data.length > 0) {
      allData.push(...data);
      successCount++;
      process.stdout.write(`✓`);
    } else {
      process.stdout.write(`✗`);
    }
    await delay(150);
  }

  console.log(`\n  Success: ${successCount}/${commodities.length}`);

  await writeCSV(filename, allData, [
    { id: 'commodity', title: 'Commodity' },
    { id: 'date', title: 'Date' },
    { id: 'price', title: 'Price' },
    { id: 'unit', title: 'Unit' }
  ]);
}

async function fetchStressIndicators() {
  const filename = path.join(DATA_ROOT, 'stress', `stress_solstice_equinox.csv`);
  
  if (csvExists(filename)) {
    console.log('✓ Stress CSV already exists, skipping...');
    return;
  }

  console.log('\n⚡ Fetching Stress Indicators...');
  const allData = [];
  let successCount = 0;

  const indicators = ['VIX', 'TNX', 'DXY'];

  for (const indicator of indicators) {
    const data = await fetchYahooData(indicator, ALL_TARGET_DATES, 'index');
    data.forEach(row => row.indicator = indicator);
    
    if (data.length > 0) {
      allData.push(...data);
      successCount++;
      process.stdout.write(`✓`);
    } else {
      process.stdout.write(`✗`);
    }
    await delay(150);
  }

  console.log(`\n  Success: ${successCount}/${indicators.length}`);

  await writeCSV(filename, allData, [
    { id: 'indicator', title: 'Indicator' },
    { id: 'date', title: 'Date' },
    { id: 'value', title: 'Value' },
    { id: 'unit', title: 'Unit' }
  ]);
}

async function generateAnchors() {
  const filename = path.join(DATA_ROOT, 'anchors', `anchors_solstice_equinox.csv`);
  
  if (csvExists(filename)) {
    console.log('✓ Anchors CSV already exists, skipping...');
    return;
  }

  console.log('\n🎯 Generating Anchors...');
  
  const anchors = ALL_TARGET_DATES.map(date => ({
    date,
    type: 'solstice_equinox',
    significance: 'high',
    source: 'astronomical'
  }));

  await writeCSV(filename, anchors, [
    { id: 'date', title: 'Date' },
    { id: 'type', title: 'Type' },
    { id: 'significance', title: 'Significance' },
    { id: 'source', title: 'Source' }
  ]);
}

async function main() {
  console.log('🚀 Yahoo Finance CSV Pull (Safe Mode)');
  console.log('📅 Years: 2005, 2015, 2018, 2022, 2025');
  console.log('📁 Output:', DATA_ROOT);
  console.log('💾 Existing CSVs will be preserved\n');

  ensureDirectories();

  await fetchEquities();
  await fetchCrypto();
  await fetchForex();
  await fetchCommodities();
  await fetchStressIndicators();
  await generateAnchors();

  console.log('\n✅ Complete!\n');
}

main().catch(err => {
  console.error('\n❌ Fatal:', err.message);
  process.exit(1);
});