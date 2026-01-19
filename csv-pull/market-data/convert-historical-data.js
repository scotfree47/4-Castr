// convert-historical-data.js
// Run from csv-pull/market-data directory: node convert-historical-data.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse CSV file
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  
  // Skip comment lines and empty lines
  const dataLines = lines.filter(line => {
    const trimmed = line.trim();
    return trimmed.length > 0 && !trimmed.startsWith('//');
  });
  
  if (dataLines.length === 0) {
    console.warn(`⚠️  No data found in ${filePath} after filtering comments`);
    return [];
  }
  
  const headers = dataLines[0].split(',');
  
  return dataLines.slice(1).map(line => {
    const values = line.split(',');
    const obj = {};
    headers.forEach((header, i) => {
      obj[header.trim()] = values[i]?.trim();
    });
    return obj;
  });
}

// Get all unique dates from anchors
function getAnchorDates() {
  const anchorsPath = path.join(__dirname, 'data/unintegrated/anchors/anchors_solstice_equinox.csv');
  const anchors = parseCSV(anchorsPath);
  return anchors.map(a => a.Date).sort();
}

// Process equity data
function processEquities(dates) {
  const equitiesPath = path.join(__dirname, 'data/unintegrated/equities/equities_solstice_equinox.csv');
  
  if (!fs.existsSync(equitiesPath)) {
    console.warn(`⚠️  Equities file not found at: ${equitiesPath}`);
    return {};
  }
  
  const data = parseCSV(equitiesPath);
  const tickerMap = {};
  
  data.forEach(row => {
    const symbol = row.Symbol;
    if (!symbol) return;
    
    if (!tickerMap[symbol]) {
      tickerMap[symbol] = [];
    }
    tickerMap[symbol].push({
      date: row.Date,
      close: parseFloat(row.Close),
      volume: parseFloat(row.Volume) || 0
    });
  });
  
  return tickerMap;
}

// Process commodities
function processCommodities(dates) {
  const commoditiesPath = path.join(__dirname, 'data/unintegrated/commodities/commodities_solstice_equinox.csv');
  
  if (!fs.existsSync(commoditiesPath)) {
    console.warn(`⚠️  Commodities file not found at: ${commoditiesPath}`);
    return {};
  }
  
  const data = parseCSV(commoditiesPath);
  const tickerMap = {};
  
  data.forEach(row => {
    const symbol = row.Commodity || row.Symbol;
    if (!symbol) return;
    
    if (!tickerMap[symbol]) {
      tickerMap[symbol] = [];
    }
    tickerMap[symbol].push({
      date: row.Date,
      close: parseFloat(row.Price),
      volume: 0
    });
  });
  
  return tickerMap;
}

// Process crypto
function processCrypto(dates) {
  const cryptoPath = path.join(__dirname, 'data/unintegrated/crypto/crypto_solstice_equinox.csv');
  
  if (!fs.existsSync(cryptoPath)) {
    console.warn(`⚠️  Crypto file not found at: ${cryptoPath}`);
    return {};
  }
  
  const data = parseCSV(cryptoPath);
  const tickerMap = {};
  
  data.forEach(row => {
    const symbol = row.Symbol;
    if (!symbol) return;
    
    if (!tickerMap[symbol]) {
      tickerMap[symbol] = [];
    }
    tickerMap[symbol].push({
      date: row.Date,
      close: parseFloat(row.Price),
      volume: parseFloat(row.Volume) || 0
    });
  });
  
  return tickerMap;
}

// Process forex
function processForex(dates) {
  const forexPath = path.join(__dirname, 'data/unintegrated/forex/forex_solstice_equinox.csv');
  
  if (!fs.existsSync(forexPath)) {
    console.warn(`⚠️  Forex file not found at: ${forexPath}`);
    return {};
  }
  
  const data = parseCSV(forexPath);
  const tickerMap = {};
  
  data.forEach(row => {
    const symbol = row.Pair || row.Symbol;
    if (!symbol) return;
    
    if (!tickerMap[symbol]) {
      tickerMap[symbol] = [];
    }
    tickerMap[symbol].push({
      date: row.Date,
      close: parseFloat(row.Rate),
      volume: 0
    });
  });
  
  return tickerMap;
}

// Process rates-macro
function processRatesMacro(dates) {
  const ratesPath = path.join(__dirname, 'data/unintegrated/rates-macro/rates_macro_solstice_equinox.csv');
  
  if (!fs.existsSync(ratesPath)) {
    console.warn(`⚠️  Rates-macro file not found at: ${ratesPath}`);
    return {};
  }
  
  const data = parseCSV(ratesPath);
  const tickerMap = {};
  
  data.forEach(row => {
    const symbol = row.Symbol;
    if (!symbol) return;
    
    if (!tickerMap[symbol]) {
      tickerMap[symbol] = [];
    }
    tickerMap[symbol].push({
      date: row.Date,
      close: parseFloat(row.Close),
      volume: parseFloat(row.Volume) || 0
    });
  });
  
  return tickerMap;
}

// Process stress indicators
function processStress(dates) {
  const stressPath = path.join(__dirname, 'data/unintegrated/stress/stress_solstice_equinox.csv');
  
  if (!fs.existsSync(stressPath)) {
    console.warn(`⚠️  Stress file not found at: ${stressPath}`);
    return {};
  }
  
  const data = parseCSV(stressPath);
  const tickerMap = {};
  
  data.forEach(row => {
    const symbol = row.Indicator || row.Symbol;
    if (!symbol) return;
    
    if (!tickerMap[symbol]) {
      tickerMap[symbol] = [];
    }
    tickerMap[symbol].push({
      date: row.Date,
      close: parseFloat(row.Value),
      volume: 0
    });
  });
  
  return tickerMap;
}

// Simple key level detection (placeholder - improve later)
function detectKeyLevels(priceData) {
  if (priceData.length < 3) return { isKeyLevel: false, keyType: null };
  
  const prices = priceData.map(p => p.close);
  const currentPrice = prices[prices.length - 1];
  const max = Math.max(...prices);
  const min = Math.min(...prices);
  
  // Simple logic: if current price is near max/min, it's a key level
  if (currentPrice >= max * 0.95) {
    return { isKeyLevel: true, keyType: 'resistance' };
  } else if (currentPrice <= min * 1.05) {
    return { isKeyLevel: true, keyType: 'support' };
  }
  
  return { isKeyLevel: false, keyType: null };
}

// Main conversion function
function convertToHistoricalJSON() {
  console.log('🔄 Converting CSV data to historical JSON...');
  
  const dates = getAnchorDates();
  console.log(`📅 Found ${dates.length} anchor dates`);
  
  // Process all categories
  const equities = processEquities(dates);
  const commodities = processCommodities(dates);
  const crypto = processCrypto(dates);
  const forex = processForex(dates);
  const ratesMacro = processRatesMacro(dates);
  const stress = processStress(dates);
  
  console.log(`📊 Processed: ${Object.keys(equities).length} equities, ${Object.keys(commodities).length} commodities, ${Object.keys(crypto).length} crypto, ${Object.keys(forex).length} forex, ${Object.keys(ratesMacro).length} rates-macro, ${Object.keys(stress).length} stress`);
  
  // Combine all data by date
  const quarters = dates.map(date => {
    const quarter = {
      date,  // CRITICAL: Add the date field here
      type: "solstice_equinox",
      tickers: {}
    };
    
    // Combine all ticker maps
    const allTickerMaps = {...equities, ...commodities, ...crypto, ...forex, ...ratesMacro, ...stress};
    
    console.log(`\n📅 Processing date: ${date}`);
    console.log(`   Total ticker symbols: ${Object.keys(allTickerMaps).length}`);
    
    // Add all tickers for this date
    Object.entries(allTickerMaps).forEach(([symbol, priceArray]) => {
      const pricePoint = priceArray.find(p => p.date === date);
      if (pricePoint) {
        const allPricesUpToNow = priceArray.slice(0, priceArray.findIndex(p => p.date === date) + 1);
        const keyLevel = detectKeyLevels(allPricesUpToNow);
        quarter.tickers[symbol] = {
          close: pricePoint.close,
          volume: pricePoint.volume,
          isKeyLevel: keyLevel.isKeyLevel,
          keyType: keyLevel.keyType
        };
      }
    });
    
    console.log(`   Tickers found for this date: ${Object.keys(quarter.tickers).length}`);
    if (Object.keys(quarter.tickers).length > 0) {
      console.log(`   First 5 tickers:`, Object.keys(quarter.tickers).slice(0, 5));
    }
    
    return quarter;
  });
  
  const output = { quarters };
  
  // Debug: Check first quarter structure
  console.log('\n🔍 Checking first quarter with data:');
  const firstQuarterWithData = quarters.find(q => Object.keys(q.tickers).length > 0);
  if (firstQuarterWithData) {
    console.log('   Date:', firstQuarterWithData.date);
    console.log('   Type:', firstQuarterWithData.type);
    console.log('   Ticker count:', Object.keys(firstQuarterWithData.tickers).length);
    console.log('   First ticker:', Object.keys(firstQuarterWithData.tickers)[0]);
    console.log('   First ticker data:', firstQuarterWithData.tickers[Object.keys(firstQuarterWithData.tickers)[0]]);
  }
  
  // Write to file - navigate up from csv-pull/market-data to project root, then to destination
  const outputPath = path.join(__dirname, 'Users/jamalcarr/Dev/Workspaces/Dec-2025/4castr/src/app/(dashboard)/data/tickers/historical-quarterly.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  
  console.log(`\n✅ Converted ${quarters.length} quarterly snapshots`);
  console.log(`📁 Saved to: ${outputPath}`);
}

// Run conversion
try {
  convertToHistoricalJSON();
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
}