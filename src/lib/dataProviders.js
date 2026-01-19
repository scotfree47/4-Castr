// src/lib/dataProviders.js
// Consolidated data providers: API adapters + CSV readers

import axios from 'axios'
import fs from 'fs'
import path from 'path'
import Papa from 'papaparse'

// ============================================================================
// CONFIGURATION
// ============================================================================

const CSV_BASE = path.join(process.cwd(), 'csv-pull', 'market-data', 'data')
const POLYGON_DELAY = 500 // 500ms = 2 calls/second
let lastPolygonCall = 0

// Symbol mappings for different providers
const SYMBOL_MAPS = {
  polygon: {
    'TNX': 'I:TNX',
    'DXY': 'I:DXY',
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
}

// ============================================================================
// UTILITIES
// ============================================================================

async function rateLimitedFetch(fetchFn) {
  const now = Date.now()
  const timeSinceLastCall = now - lastPolygonCall
  if (timeSinceLastCall < POLYGON_DELAY) {
    await new Promise(resolve => setTimeout(resolve, POLYGON_DELAY - timeSinceLastCall))
  }
  lastPolygonCall = Date.now()
  return fetchFn()
}

export function getMappedSymbol(symbol, provider) {
  return SYMBOL_MAPS[provider]?.[symbol] || symbol
}

// ============================================================================
// API ADAPTERS
// ============================================================================

export async function fetchFromPolygon(symbol, startDate, endDate) {
  return rateLimitedFetch(async () => {
    try {
      const mappedSymbol = getMappedSymbol(symbol, 'polygon')
      const url = `https://api.polygon.io/v2/aggs/ticker/${mappedSymbol}/range/1/day/${startDate}/${endDate}`
      
      const response = await axios.get(url, {
        params: { apiKey: process.env.POLYGON_API_KEY }
      })
      
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
        }))
      }
      return null
    } catch (error) {
      console.error(`Polygon error for ${symbol}:`, error.message)
      return null
    }
  })
}

export async function fetchFromTwelveData(symbol, startDate, endDate) {
  try {
    const mappedSymbol = getMappedSymbol(symbol, 'twelve')
    const url = 'https://api.twelvedata.com/time_series'
    
    console.log(`Twelve Data: Fetching ${mappedSymbol} (original: ${symbol})`)
    
    const response = await axios.get(url, {
      params: {
        symbol: mappedSymbol,
        interval: '1day',
        start_date: startDate,
        end_date: endDate,
        apikey: process.env.TWELVE_DATA_API_KEY
      }
    })
    
    if (response.data.status === 'error') {
      console.error(`Twelve Data error for ${symbol}:`, response.data.message)
      return null
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
      }))
    }
    return null
  } catch (error) {
    console.error(`Twelve Data error for ${symbol}:`, error.message)
    return null
  }
}

export async function fetchFromAlphaVantage(symbol, startDate, endDate) {
  try {
    const url = 'https://www.alphavantage.co/query'
    
    const response = await axios.get(url, {
      params: {
        function: 'TIME_SERIES_DAILY',
        symbol: symbol,
        outputsize: 'full',
        apikey: process.env.ALPHA_VANTAGE_API_KEY
      }
    })
    
    const timeSeries = response.data['Time Series (Daily)']
    if (!timeSeries) return null
    
    const results = []
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
        })
      }
    }
    
    return results.length > 0 ? results : null
  } catch (error) {
    console.error(`Alpha Vantage error for ${symbol}:`, error.message)
    return null
  }
}

export async function fetchFromCoinGecko(coinId, days = 30) {
  try {
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart`
    
    const response = await axios.get(url, {
      params: {
        vs_currency: 'usd',
        days: days,
        x_cg_demo_api_key: process.env.COINGECKO_API_KEY
      }
    })
    
    if (response.data.prices && response.data.prices.length > 0) {
      return response.data.prices.map(([timestamp, price]) => ({
        symbol: coinId,
        date: new Date(timestamp).toISOString().split('T')[0],
        close: price,
        source: 'coingecko'
      }))
    }
    return null
  } catch (error) {
    console.error(`CoinGecko error for ${coinId}:`, error.message)
    return null
  }
}

export async function fetchFromCoinMarketCap(symbol) {
  try {
    const url = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest'
    
    const response = await axios.get(url, {
      params: { symbol },
      headers: {
        'X-CMC_PRO_API_KEY': process.env.COINMARKETCAP_API_KEY
      }
    })
    
    const data = response.data.data[symbol]
    if (data) {
      return [{
        symbol,
        date: new Date().toISOString().split('T')[0],
        close: data.quote.USD.price,
        volume: data.quote.USD.volume_24h,
        percent_change_24h: data.quote.USD.percent_change_24h,
        source: 'coinmarketcap'
      }]
    }
    return null
  } catch (error) {
    console.error(`CoinMarketCap error for ${symbol}:`, error.message)
    return null
  }
}

export async function fetchFromFRED(seriesId, startDate, endDate) {
  try {
    const url = 'https://api.stlouisfed.org/fred/series/observations'
    
    const response = await axios.get(url, {
      params: {
        series_id: seriesId,
        api_key: process.env.FRED_API_KEY,
        file_type: 'json',
        observation_start: startDate,
        observation_end: endDate
      }
    })
    
    if (response.data.observations && response.data.observations.length > 0) {
      return response.data.observations.map(obs => ({
        symbol: seriesId,
        date: obs.date,
        value: parseFloat(obs.value),
        source: 'fred'
      }))
    }
    return null
  } catch (error) {
    console.error(`FRED error for ${seriesId}:`, error.message)
    return null
  }
}

export async function fetchWithFallback(symbol, startDate, endDate, adapters) {
  for (const adapter of adapters) {
    const data = await adapter(symbol, startDate, endDate)
    if (data && data.length > 0) {
      return data
    }
  }
  return null
}

// ============================================================================
// CSV READERS - MARKET DATA
// ============================================================================

async function readAndFilterCSV(csvPath, symbolKey, symbolValue, startDate, endDate) {
  if (!fs.existsSync(csvPath)) {
    console.warn(`⚠ CSV not found: ${csvPath}`)
    return null
  }

  const fileContent = fs.readFileSync(csvPath, 'utf8')
  const parsed = Papa.parse(fileContent, { header: true, dynamicTyping: true })

  const filtered = parsed.data
    .filter(row => row[symbolKey] === symbolValue)
    .filter(row => {
      const rowDate = row.Date
      return rowDate >= startDate && rowDate <= endDate
    })
    .map(row => ({
      symbol: row[symbolKey],
      date: row.Date,
      open: row.Open || null,
      high: row.High || null,
      low: row.Low || null,
      close: row.Close || row.Price || row.Rate || row.Value,
      volume: row.Volume || null,
    }))

  return filtered.length > 0 ? filtered : null
}

export async function readEquityCSV(symbol, startDate, endDate) {
  const csvPath = path.join(CSV_BASE, 'equities', 'equities_solstice_equinox.csv')
  return readAndFilterCSV(csvPath, 'Symbol', symbol, startDate, endDate)
}

export async function readCryptoCSV(symbol, startDate, endDate) {
  const csvPath = path.join(CSV_BASE, 'crypto', 'crypto_solstice_equinox.csv')
  return readAndFilterCSV(csvPath, 'Symbol', symbol, startDate, endDate)
}

export async function readForexCSV(pair, startDate, endDate) {
  const csvPath = path.join(CSV_BASE, 'forex', 'forex_solstice_equinox.csv')
  return readAndFilterCSV(csvPath, 'Pair', pair, startDate, endDate)
}

export async function readCommodityCSV(commodity, startDate, endDate) {
  const csvPath = path.join(CSV_BASE, 'commodities', 'commodities_solstice_equinox.csv')
  return readAndFilterCSV(csvPath, 'Commodity', commodity, startDate, endDate)
}

export async function readStressCSV(indicator, startDate, endDate) {
  const csvPath = path.join(CSV_BASE, 'stress', 'stress_solstice_equinox.csv')
  return readAndFilterCSV(csvPath, 'Indicator', indicator, startDate, endDate)
}

export async function readRatesMacroCSV(symbol, startDate, endDate) {
  const csvPath = path.join(CSV_BASE, 'rates-macro', 'rates_macro_solstice_equinox.csv')
  return readAndFilterCSV(csvPath, 'Symbol', symbol, startDate, endDate)
}

// ============================================================================
// CSV READERS - FIBONACCI & ASTRO
// ============================================================================

export async function readFibonacciCSV(symbol, startDate, endDate) {
  try {
    const fibDir = path.join(CSV_BASE, 'fibonacci')

    // Try CSV first
    const csvPath = path.join(fibDir, 'fibonacci_levels.csv')
    if (fs.existsSync(csvPath)) {
      const csvContent = fs.readFileSync(csvPath, 'utf-8')
      const parsed = Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
      })

      const filtered = parsed.data.filter(row => {
        const matchesSymbol = row.symbol === symbol || row.Symbol === symbol
        const rowDate = row.date || row.Date
        const matchesDate = (!startDate || rowDate >= startDate) && (!endDate || rowDate <= endDate)
        return matchesSymbol && matchesDate
      })

      if (filtered.length > 0) {
        console.log(`✓ Fibonacci CSV hit for ${symbol}: ${filtered.length} records`)
        return filtered
      }
    }

    // Fallback to JSON
    const jsonPath = path.join(fibDir, 'fibonacci_levels.json')
    if (fs.existsSync(jsonPath)) {
      const jsonContent = fs.readFileSync(jsonPath, 'utf-8')
      const jsonData = JSON.parse(jsonContent)

      const dataArray = Array.isArray(jsonData) ? jsonData : Object.values(jsonData)

      const filtered = dataArray.filter(item => {
        const matchesSymbol = item.symbol === symbol || item.Symbol === symbol
        const rowDate = item.date || item.Date
        const matchesDate = (!startDate || rowDate >= startDate) && (!endDate || rowDate <= endDate)
        return matchesSymbol && matchesDate
      })

      if (filtered.length > 0) {
        console.log(`✓ Fibonacci JSON hit for ${symbol}: ${filtered.length} records`)
        return filtered
      }
    }

    console.log(`⚠ No Fibonacci CSV/JSON data for ${symbol}`)
    return null
  } catch (error) {
    console.warn(`⚠ Error reading Fibonacci data for ${symbol}:`, error.message)
    return null
  }
}

export async function readAstroAlignmentCSV(startDate, endDate, eventType = null) {
  try {
    const astroDir = path.join(CSV_BASE, 'astro')

    const files = {
      seasonal: {
        filename: 'seasonal_anchors.csv',
        eventField: 'type',
        dateField: 'date',
      },
      aspects: {
        filename: 'aspects.csv',
        eventField: 'aspect_type',
        dateField: 'date',
      },
      ingresses: {
        filename: 'ingresses.csv',
        eventField: 'sign',
        dateField: 'date',
      },
      retrogrades: {
        filename: 'retrogrades.csv',
        eventField: 'status',
        dateField: 'date',
      },
      lunar_phases: {
        filename: 'lunar_phases.csv',
        eventField: 'phase',
        dateField: 'date',
      },
      lunar_cycle: {
        filename: 'lunar_cycle_18yr.csv',
        eventField: 'key_phase',
        dateField: 'date',
      },
    }

    const results = []

    for (const [type, config] of Object.entries(files)) {
      if (eventType && type !== eventType) continue

      const filePath = path.join(astroDir, config.filename)

      if (!fs.existsSync(filePath)) {
        console.log(`⚠ Skipping ${config.filename} (not found)`)
        continue
      }

      try {
        const content = fs.readFileSync(filePath, 'utf-8')
        const parsed = Papa.parse(content, {
          header: true,
          skipEmptyLines: true,
        })

        const filtered = parsed.data
          .filter(row => {
            const rowDate = row[config.dateField]
            if (!rowDate) return false

            return (!startDate || rowDate >= startDate) && (!endDate || rowDate <= endDate)
          })
          .map(row => ({
            ...row,
            event_type: type,
            date: row[config.dateField],
            event: row[config.eventField] || type,
            ...(type === 'seasonal' && {
              event: row.type,
              sign: row.sign,
              fibonacci_anchor: row.fibonacci_anchor === 'True',
              anchor_type: row.anchor_type,
            }),
            ...(type === 'aspects' && {
              event: `${row.body1} ${row.aspect_type} ${row.body2}`,
              body1: row.body1,
              body2: row.body2,
              aspect_nature: row.aspect_nature,
              orb: parseFloat(row.orb),
              exact: row.exact === 'True',
            }),
            ...(type === 'retrogrades' && {
              event: `${row.body} ${row.status} retrograde`,
              body: row.body,
              sign: row.sign,
              stationary: row.stationary === 'True',
            }),
            ...(type === 'ingresses' && {
              event: `${row.body} enters ${row.sign}`,
              body: row.body,
              sign: row.sign,
              from_sign: row.from_sign,
            }),
          }))

        if (filtered.length > 0) {
          console.log(`✓ Found ${filtered.length} ${type} events`)
          results.push(...filtered)
        }
      } catch (fileError) {
        console.warn(`⚠ Error reading ${config.filename}:`, fileError.message)
      }
    }

    return results.length > 0 ? results : null
  } catch (error) {
    console.warn('⚠ Error reading astro alignment data:', error.message)
    return null
  }
}

export async function readPriceTouchCSV(symbol, startDate, endDate) {
  try {
    const touchPath = path.join(CSV_BASE, 'price-touches', `${symbol.toLowerCase()}_touches.csv`)

    if (!fs.existsSync(touchPath)) {
      return null
    }

    const content = fs.readFileSync(touchPath, 'utf-8')
    const parsed = Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
    })

    const filtered = parsed.data.filter(row => {
      return (!startDate || row.date >= startDate) && (!endDate || row.date <= endDate)
    })

    if (filtered.length > 0) {
      console.log(`✓ Price touch CSV hit for ${symbol}: ${filtered.length} touches`)
      return filtered
    }

    return null
  } catch (error) {
    console.log(`⚠ No price touch CSV for ${symbol} (will calculate):`, error.message)
    return null
  }
}
