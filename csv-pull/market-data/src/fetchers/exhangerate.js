import https from 'https';

const EXCHANGE_RATE_API_KEY = process.env.EXCHANGE_RATE_API_KEY;

export async function fetchExchangeRateData(base, quote, pairName, targetDates) {
  const results = [];

  // exchangerate-api.com supports historical data
  // Free tier: 1500 requests/month
  for (const date of targetDates) {
    const url = EXCHANGE_RATE_API_KEY 
      ? `https://v6.exchangerate-api.com/v6/${EXCHANGE_RATE_API_KEY}/history/${base}/${date.split('-')[0]}/${date.split('-')[1]}/${date.split('-')[2]}`
      : `https://api.exchangerate-api.com/v4/history/${base}/${date}`;

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

      const rate = data.rates?.[quote] || data.conversion_rates?.[quote];
      if (rate) {
        results.push({
          pair: pairName,
          date: date,
          rate: rate,
          change: 0 // Would need previous day data to calculate
        });
      }
    } catch (err) {
      console.error(`  Failed to fetch ${pairName} for ${date}:`, err.message);
    }
  }

  return results;
}