import https from 'https';

const FRED_API_KEY = process.env.FRED_API_KEY;

export async function fetchFREDData(seriesId, indicatorName, targetDates) {
  if (!FRED_API_KEY) {
    throw new Error('FRED_API_KEY not set');
  }

  const minDate = Math.min(...targetDates.map(d => new Date(d)));
  const maxDate = Math.max(...targetDates.map(d => new Date(d)));
  const startDate = new Date(minDate).toISOString().split('T')[0];
  const endDate = new Date(maxDate).toISOString().split('T')[0];

  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&observation_start=${startDate}&observation_end=${endDate}&api_key=${FRED_API_KEY}&file_type=json`;

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

    if (!data.observations) {
      return [];
    }

    const targetSet = new Set(targetDates);
    return data.observations
      .filter(obs => targetSet.has(obs.date) && obs.value !== '.')
      .map(obs => ({
        indicator: indicatorName,
        date: obs.date,
        value: parseFloat(obs.value),
        unit: 'index'
      }));
  } catch (err) {
    console.error(`  FRED error for ${indicatorName}:`, err.message);
    return [];
  }
}