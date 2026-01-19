import https from 'https';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

// Yahoo Finance API - completely free, no key needed
export async function fetchYahooFinance(symbol, targetDates, assetType = 'equity') {
  // Get date range
  const minDate = Math.min(...targetDates.map(d => new Date(d).getTime()));
  const maxDate = Math.max(...targetDates.map(d => new Date(d).getTime()));
  
  // Yahoo uses Unix timestamps
  const period1 = Math.floor(minDate / 1000);
  const period2 = Math.floor(maxDate / 1000);

  // Yahoo Finance symbol format
  let yahooSymbol = symbol;
  if (assetType === 'crypto') {
    yahooSymbol = `${symbol}-USD`;
  } else if (assetType === 'forex') {
    yahooSymbol = `${symbol}=X`;
  }

  const url = `https://query1.finance.yahoo.com/v7/finance/download/${yahooSymbol}?period1=${period1}&period2=${period2}&interval=1d&events=history`;

  try {
    const csvData = await new Promise((resolve, reject) => {
      const options = {
        headers: { 'User-Agent': USER_AGENT }
      };

      https.get(url, options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}: ${body.substring(0, 100)}`));
          } else {
            resolve(body);
          }
        });
      }).on('error', reject);
    });

    // Parse CSV manually
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

        if (assetType === 'crypto') {
          results.push({
            symbol: symbol,
            date: date,
            price: parseFloat(row.close) || null,
            volume: parseFloat(row.volume) || null,
            market_cap: null // Yahoo doesn't provide this
          });
        } else if (assetType === 'forex') {
          results.push({
            pair: symbol,
            date: date,
            rate: parseFloat(row.close) || null,
            change: 0
          });
        } else {
          // Equity
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
    throw new Error(`Yahoo Finance error: ${err.message}`);
  }
}

// Commodity-specific fetcher (Yahoo has futures data)
export async function fetchYahooCommodity(commodity, targetDates) {
  // Yahoo Finance commodity futures symbols
  const commodityMap = {
    'COTTON': 'CT=F',
    'WHEAT': 'ZW=F',
    'CORN': 'ZC=F',
    'SUGAR': 'SB=F',
    'COFFEE': 'KC=F',
    'GOLD': 'GC=F',
    'SILVER': 'SI=F',
    'OIL': 'CL=F'
  };

  const yahooSymbol = commodityMap[commodity];
  if (!yahooSymbol) {
    throw new Error(`Unknown commodity: ${commodity}`);
  }

  const minDate = Math.min(...targetDates.map(d => new Date(d).getTime()));
  const maxDate = Math.max(...targetDates.map(d => new Date(d).getTime()));
  
  const period1 = Math.floor(minDate / 1000);
  const period2 = Math.floor(maxDate / 1000);

  const url = `https://query1.finance.yahoo.com/v7/finance/download/${yahooSymbol}?period1=${period1}&period2=${period2}&interval=1d&events=history`;

  try {
    const csvData = await new Promise((resolve, reject) => {
      const options = {
        headers: { 'User-Agent': USER_AGENT }
      };

      https.get(url, options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}`));
          } else {
            resolve(body);
          }
        });
      }).on('error', reject);
    });

    const lines = csvData.trim().split('\n');
    if (lines.length < 2) return [];

    const targetSet = new Set(targetDates);
    const results = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const date = values[0];

      if (targetSet.has(date)) {
        results.push({
          commodity: commodity,
          date: date,
          price: parseFloat(values[4]) || null, // Close price
          unit: 'USD'
        });
      }
    }

    return results;
  } catch (err) {
    throw new Error(`Yahoo commodity error: ${err.message}`);
  }
}

// VIX and stress indicators
export async function fetchYahooStress(indicator, targetDates) {
  const stressMap = {
    'VIX': '^VIX',
    'MOVE': '^MOVE', // Not always available
    'DXY': 'DX-Y.NYB', // Dollar index
    'TNX': '^TNX' // 10-year Treasury yield
  };

  const yahooSymbol = stressMap[indicator];
  if (!yahooSymbol) {
    throw new Error(`Unknown indicator: ${indicator}`);
  }

  const minDate = Math.min(...targetDates.map(d => new Date(d).getTime()));
  const maxDate = Math.max(...targetDates.map(d => new Date(d).getTime()));
  
  const period1 = Math.floor(minDate / 1000);
  const period2 = Math.floor(maxDate / 1000);

  const url = `https://query1.finance.yahoo.com/v7/finance/download/${yahooSymbol}?period1=${period1}&period2=${period2}&interval=1d&events=history`;

  try {
    const csvData = await new Promise((resolve, reject) => {
      const options = {
        headers: { 'User-Agent': USER_AGENT }
      };

      https.get(url, options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}`));
          } else {
            resolve(body);
          }
        });
      }).on('error', reject);
    });

    const lines = csvData.trim().split('\n');
    if (lines.length < 2) return [];

    const targetSet = new Set(targetDates);
    const results = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const date = values[0];

      if (targetSet.has(date)) {
        results.push({
          indicator: indicator,
          date: date,
          value: parseFloat(values[4]) || null, // Close
          unit: 'index'
        });
      }
    }

    return results;
  } catch (err) {
    throw new Error(`Yahoo stress error: ${err.message}`);
  }
}