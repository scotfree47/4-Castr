import https from 'https';

const FMP_API_KEY = process.env.FMP_API_KEY;

export async function fetchFMPData(symbol, targetDates) {
  if (!FMP_API_KEY) {
    throw new Error('FMP_API_KEY not set in environment');
  }

  // FMP has full historical data back to 2005+ for most equities
  const url = `https://financialmodelingprep.com/api/v3/historical-price-full/${symbol}?from=2005-01-01&to=2025-12-31&apikey=${FMP_API_KEY}`;

  const allData = await new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.historical) {
            resolve(json.historical);
          } else {
            reject(new Error(`No historical data for ${symbol}`));
          }
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });

  // Filter to only target dates
  const targetSet = new Set(targetDates);
  const filtered = allData
    .filter(day => targetSet.has(day.date))
    .map(day => ({
      symbol,
      date: day.date,
      open: day.open,
      high: day.high,
      low: day.low,
      close: day.close,
      volume: day.volume
    }));

  return filtered;
}