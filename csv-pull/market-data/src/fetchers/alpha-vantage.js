import https from 'https';

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

// Alpha Vantage: 25 calls/day free, 75/min premium
// Best for: Forex (excellent historical coverage)
export async function fetchAlphaVantageForex(fromCurrency, toCurrency, pairName, targetDates) {
  if (!ALPHA_VANTAGE_API_KEY) {
    throw new Error('ALPHA_VANTAGE_API_KEY not set');
  }

  // Get full historical data (daily)
  const url = `https://www.alphavantage.co/query?function=FX_DAILY&from_symbol=${fromCurrency}&to_symbol=${toCurrency}&outputsize=full&apikey=${ALPHA_VANTAGE_API_KEY}`;

  try {
    const data = await new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(body);
            resolve(json);
          } catch (err) {
            reject(err);
          }
        });
      }).on('error', reject);
    });

    if (!data['Time Series FX (Daily)']) {
      return [];
    }

    const timeSeries = data['Time Series FX (Daily)'];
    const targetSet = new Set(targetDates);
    
    return Object.entries(timeSeries)
      .filter(([date]) => targetSet.has(date))
      .map(([date, values]) => ({
        pair: pairName,
        date: date,
        rate: parseFloat(values['4. close']),
        change: 0
      }));
  } catch (err) {
    console.error(`  Alpha Vantage error for ${pairName}:`, err.message);
    return [];
  }
}
