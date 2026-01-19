import https from 'https';

const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;

export async function fetchCoinGeckoData(coinId, targetDates) {
  // CoinGecko Pro has better rate limits and historical data
  const results = [];
  const headers = COINGECKO_API_KEY 
    ? { 'x-cg-pro-api-key': COINGECKO_API_KEY }
    : {};

  for (const date of targetDates) {
    const dateObj = new Date(date);
    
    // Skip dates before Bitcoin existed (2009) or before specific coins launched
    if (dateObj < new Date('2009-01-03') && coinId === 'bitcoin') continue;
    if (dateObj < new Date('2015-07-30') && coinId === 'ethereum') continue;
    if (dateObj < new Date('2017-01-01') && !['bitcoin', 'ethereum'].includes(coinId)) continue;

    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    const formattedDate = `${day}-${month}-${year}`;

    const baseUrl = COINGECKO_API_KEY 
      ? 'https://pro-api.coingecko.com/api/v3'
      : 'https://api.coingecko.com/api/v3';
    const url = `${baseUrl}/coins/${coinId}/history?date=${formattedDate}`;

    try {
      const data = await new Promise((resolve, reject) => {
        const options = { headers };
        https.get(url, options, (res) => {
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

      if (data.market_data) {
        results.push({
          symbol: coinId.toUpperCase(),
          date: date,
          price: data.market_data.current_price?.usd || null,
          volume: data.market_data.total_volume?.usd || null,
          market_cap: data.market_data.market_cap?.usd || null
        });
      }
    } catch (err) {
      console.error(`  Failed ${coinId} for ${date}:`, err.message);
    }

    // Rate limit: Free = 10-50/min, Pro = 500/min
    await new Promise(resolve => setTimeout(resolve, COINGECKO_API_KEY ? 200 : 1500));
  }

  return results;
}