import axios from 'axios';

// Rate limiting helper
let lastPolygonCall = 0;
const POLYGON_DELAY = 500; // 500ms = 2 calls/second

async function rateLimitedFetch(fetchFn) {
  const now = Date.now();
  const timeSinceLastCall = now - lastPolygonCall;
  if (timeSinceLastCall < POLYGON_DELAY) {
    await new Promise(resolve => setTimeout(resolve, POLYGON_DELAY - timeSinceLastCall));
  }
  lastPolygonCall = Date.now();
  return fetchFn();
}

const SYMBOL_MAPS = {
  polygon: {
    'TNX': 'I:TNX',      // Changed from X:TNX
    'DXY': 'I:DXY',      // Changed from C:DXY
    'VIX': 'I:VIX',
    'VVIX': 'I:VVIX',
    'VXN': 'I:VXN',
    'RVX': 'I:RVX',
    'TYX': 'I:TYX',
    'MOVE': 'I:MOVE',
    'TRIN': 'I:TRIN',
    'CL1!': 'CL=F',
    'GC1!': 'GC=F',
    'HG1!': 'HG=F',
    'ZW1!': 'ZW=F',
    'ZC1!': 'ZC=F',
    'CT1!': 'CT=F',
    'SB1!': 'SB=F',
    'KC1!': 'KC=F',
    'NG1!': 'NG=F',
    'SI1!': 'SI=F',
    'ZS1!': 'ZS=F',
    'ZL1!': 'ZL=F',
    'LE1!': 'LE=F',
  },
  twelve: {
    'TNX': '^TNX',
    'DXY': 'DXY',
    'VIX': 'VIX',
    'VVIX': 'VVIX',
    'VXN': 'VXN',
    'RVX': 'RVX',
    'TYX': 'TYX',
    'BVOL': 'BVOL',
    'CL1!': 'CL',
    'GC1!': 'GC',
    'HG1!': 'HG',
    'ZW1!': 'ZW',
    'ZC1!': 'ZC',
    'CT1!': 'CT',
    'SB1!': 'SB',
    'KC1!': 'KC',
    'NG1!': 'NG',
    'SI1!': 'SI',
    'ZS1!': 'ZS',
    'ZL1!': 'ZL',
    'LE1!': 'LE',
    'EUR/USD': 'EUR/USD',
    'USD/JPY': 'USD/JPY',
    'GBP/JPY': 'GBP/JPY',
    'GBP/NZD': 'GBP/NZD',
    'EUR/NZD': 'EUR/NZD',
    'GBP/AUD': 'GBP/AUD',
    'GBP/CAD': 'GBP/CAD',
    'NZD/CAD': 'NZD/CAD',
    'NZD/CHF': 'NZD/CHF',
    'AUD/NZD': 'AUD/NZD',
  }
};

// Get mapped symbol for provider
export function getMappedSymbol(symbol, provider) {
  return SYMBOL_MAPS[provider]?.[symbol] || symbol;
}

// Polygon.io adapter
export async function fetchFromPolygon(symbol, startDate, endDate) {
  return rateLimitedFetch(async () => {
    try {
      const mappedSymbol = getMappedSymbol(symbol, 'polygon');
      const url = `https://api.polygon.io/v2/aggs/ticker/${mappedSymbol}/range/1/day/${startDate}/${endDate}`;
      
      const response = await axios.get(url, {
        params: { apiKey: process.env.POLYGON_API_KEY }
      });
      
      if (response.data.results && response.data.results.length > 0) {
        return response.data.results.map(bar => ({
          symbol,
          date: new Date(bar.t).toISOString().split('T')[0],
          open: bar.o,
          high: bar.h,
          low: bar.l,
          close: bar.c,
          volume: bar.v,
          source: 'polygon'
        }));
      }
      return null;
    } catch (error) {
      console.error(`Polygon error for ${symbol}:`, error.message);
      return null;
    }
  });
}

// Twelve Data adapter
export async function fetchFromTwelveData(symbol, startDate, endDate) {
  try {
    const mappedSymbol = getMappedSymbol(symbol, 'twelve');
    const url = `https://api.twelvedata.com/time_series`;
    
    console.log(`Twelve Data: Fetching ${mappedSymbol} (original: ${symbol})`); // ADD THIS
    
    const response = await axios.get(url, {
      params: {
        symbol: mappedSymbol,
        interval: '1day',
        start_date: startDate,
        end_date: endDate,
        apikey: process.env.TWELVE_DATA_API_KEY
      }
    });
    
    // ADD ERROR LOGGING
    if (response.data.status === 'error') {
      console.error(`Twelve Data error for ${symbol}:`, response.data.message);
      return null;
    }
    
    if (response.data.values && response.data.values.length > 0) {
      return response.data.values.map(bar => ({
        symbol,
        date: bar.datetime,
        open: parseFloat(bar.open),
        high: parseFloat(bar.high),
        low: parseFloat(bar.low),
        close: parseFloat(bar.close),
        volume: parseInt(bar.volume) || 0,
        source: 'twelve_data'
      }));
    }
    return null;
  } catch (error) {
    console.error(`Twelve Data error for ${symbol}:`, error.message);
    return null;
  }
}

// Alpha Vantage adapter
export async function fetchFromAlphaVantage(symbol, startDate, endDate) {
  try {
    const url = `https://www.alphavantage.co/query`;
    
    const response = await axios.get(url, {
      params: {
        function: 'TIME_SERIES_DAILY',
        symbol: symbol,
        outputsize: 'full',
        apikey: process.env.ALPHA_VANTAGE_API_KEY
      }
    });
    
    const timeSeries = response.data['Time Series (Daily)'];
    if (!timeSeries) return null;
    
    const results = [];
    for (const [date, values] of Object.entries(timeSeries)) {
      if (date >= startDate && date <= endDate) {
        results.push({
          symbol,
          date,
          open: parseFloat(values['1. open']),
          high: parseFloat(values['2. high']),
          low: parseFloat(values['3. low']),
          close: parseFloat(values['4. close']),
          volume: parseInt(values['5. volume']),
          source: 'alpha_vantage'
        });
      }
    }
    
    return results.length > 0 ? results : null;
  } catch (error) {
    console.error(`Alpha Vantage error for ${symbol}:`, error.message);
    return null;
  }
}

// CoinGecko adapter
export async function fetchFromCoinGecko(coinId, days = 30) {
  try {
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart`;
    
    const response = await axios.get(url, {
      params: {
        vs_currency: 'usd',
        days: days,
        x_cg_demo_api_key: process.env.COINGECKO_API_KEY
      }
    });
    
    if (response.data.prices && response.data.prices.length > 0) {
      return response.data.prices.map(([timestamp, price]) => ({
        symbol: coinId,
        date: new Date(timestamp).toISOString().split('T')[0],
        close: price,
        source: 'coingecko'
      }));
    }
    return null;
  } catch (error) {
    console.error(`CoinGecko error for ${coinId}:`, error.message);
    return null;
  }
}

// CoinMarketCap adapter
export async function fetchFromCoinMarketCap(symbol) {
  try {
    const url = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest`;
    
    const response = await axios.get(url, {
      params: { symbol },
      headers: {
        'X-CMC_PRO_API_KEY': process.env.COINMARKETCAP_API_KEY
      }
    });
    
    const data = response.data.data[symbol];
    if (data) {
      return [{
        symbol,
        date: new Date().toISOString().split('T')[0],
        close: data.quote.USD.price,
        volume: data.quote.USD.volume_24h,
        percent_change_24h: data.quote.USD.percent_change_24h,
        source: 'coinmarketcap'
      }];
    }
    return null;
  } catch (error) {
    console.error(`CoinMarketCap error for ${symbol}:`, error.message);
    return null;
  }
}

// FRED adapter
export async function fetchFromFRED(seriesId, startDate, endDate) {
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations`;
    
    const response = await axios.get(url, {
      params: {
        series_id: seriesId,
        api_key: process.env.FRED_API_KEY,
        file_type: 'json',
        observation_start: startDate,
        observation_end: endDate
      }
    });
    
    if (response.data.observations && response.data.observations.length > 0) {
      return response.data.observations.map(obs => ({
        symbol: seriesId,
        date: obs.date,
        value: parseFloat(obs.value),
        source: 'fred'
      }));
    }
    return null;
  } catch (error) {
    console.error(`FRED error for ${seriesId}:`, error.message);
    return null;
  }
}

// Master fetch with fallback chain
export async function fetchWithFallback(symbol, startDate, endDate, adapters) {
  for (const adapter of adapters) {
    const data = await adapter(symbol, startDate, endDate);
    if (data && data.length > 0) {
      return data;
    }
  }
  return null;
}