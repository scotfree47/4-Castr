import https from 'https';

// Nasdaq Data Link (formerly Quandl) - use for commodities
const NASDAQ_API_KEY = process.env.NASDAQ_DATA_LINK_API_KEY || process.env.QUANDL_API_KEY;

export async function fetchQuandlData(quandlCode, commodityName, targetDates) {
  if (!NASDAQ_API_KEY) {
    throw new Error('NASDAQ_DATA_LINK_API_KEY not set');
  }

  const minDate = Math.min(...targetDates.map(d => new Date(d)));
  const maxDate = Math.max(...targetDates.map(d => new Date(d)));
  const startDate = new Date(minDate).toISOString().split('T')[0];
  const endDate = new Date(maxDate).toISOString().split('T')[0];

  const url = `https://data.nasdaq.com/api/v3/datasets/${quandlCode}/data.json?start_date=${startDate}&end_date=${endDate}&api_key=${NASDAQ_API_KEY}`;

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

    if (!data.dataset_data?.data) {
      return [];
    }

    const targetSet = new Set(targetDates);
    const filtered = data.dataset_data.data
      .filter(row => targetSet.has(row[0]))
      .map(row => ({
        commodity: commodityName,
        date: row[0],
        price: row[1],
        unit: 'USD'
      }));

    return filtered;
  } catch (err) {
    console.error(`  Quandl error for ${commodityName}:`, err.message);
    return [];
  }
}