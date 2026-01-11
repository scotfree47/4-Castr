import https from 'https';

const CMC_API_KEY = process.env.COINMARKETCAP_API_KEY;

export async function fetchCMCHistorical(symbol, targetDates) {
  if (!CMC_API_KEY) {
    throw new Error('COINMARKETCAP_API_KEY not set');
  }

  const symbolMap = {
    'bitcoin': 1,
    'ethereum': 1027,
    'binancecoin': 1839,
    'ripple': 52,
    'bitcoin-cash': 1831,
    'solana': 5426,
    'cardano': 2010,
    'polkadot': 6636,
    'chainlink': 1975,
    'stellar': 512
  };

  const id = symbolMap[symbol];
  if (!id) return [];

  const results = [];

  for (const date of targetDates) {
    const dateObj = new Date(date);
    if (dateObj < new Date('2009-01-03')) continue;

    const url = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/historical?id=${id}&time_start=${date}T00:00:00Z&time_end=${date}T23:59:59Z`;

    try {
      const data = await new Promise((resolve, reject) => {
        https.get(url, {
          headers: { 'X-CMC_PRO_API_KEY': CMC_API_KEY }
        }, (res) => {
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

      const quote = data.data?.quotes?.[0];
      if (quote) {
        results.push({
          symbol: symbol.toUpperCase(),
          date: date,
          price: quote.quote.USD.price,
          volume: quote.quote.USD.volume_24h,
          market_cap: quote.quote.USD.market_cap
        });
      }
    } catch (err) {
      console.error(`  CMC error for ${symbol} on ${date}:`, err.message);
    }

    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  return results;
}