import https from 'https';

const POLYGON_API_KEY = process.env.POLYGON_API_KEY;

export async function fetchPolygonData(symbol, targetDates) {
  if (!POLYGON_API_KEY) {
    throw new Error('POLYGON_API_KEY not set');
  }

  const results = [];
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  
  const recentDates = targetDates.filter(d => new Date(d) >= twoYearsAgo);

  for (const date of recentDates) {
    const url = `https://api.polygon.io/v1/open-close/${symbol}/${date}?adjusted=true&apiKey=${POLYGON_API_KEY}`;

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

      if (data.status === 'OK') {
        results.push({
          symbol,
          date: date,
          open: data.open,
          high: data.high,
          low: data.low,
          close: data.close,
          volume: data.volume
        });
      }
    } catch (err) {
      console.error(`  Polygon error for ${symbol} on ${date}:`, err.message);
    }

    await new Promise(resolve => setTimeout(resolve, 12000));
  }

  return results;
}