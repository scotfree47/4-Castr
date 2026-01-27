// src/lib/dataProviders.js
// Consolidated data providers: API adapters + CSV readers
// ENHANCED VERSION with comprehensive symbol mappings

import axios from "axios"
import fs from "fs"
import path from "path"
import Papa from "papaparse"
import yahooFinance from "yahoo-finance2"
import { normalizeSymbol, getSymbolVariants } from "../utils.js"

// ============================================================================
// CONFIGURATION
// ============================================================================

const CSV_BASE = path.join(process.cwd(), "csv-pull", "market-data", "data")
const POLYGON_DELAY = 500 // 500ms = 2 calls/second
let lastPolygonCall = 0

// ============================================================================
// COMPREHENSIVE SYMBOL MAPPINGS
// ============================================================================

const SYMBOL_MAPS = {
  // ---------------------------------------------------------------------------
  // POLYGON API MAPPINGS
  // ---------------------------------------------------------------------------
  polygon: {
    // Indices (Polygon uses I: prefix)
    TNX: "I:TNX",
    TYX: "I:TYX",
    FVX: "I:FVX",
    IRX: "I:IRX",
    DXY: "I:DXY",
    VIX: "I:VIX",
    VXN: "I:VXN",
    VVIX: "I:VVIX",
    MOVE: "I:MOVE",
    TRIN: "I:TRIN",
    SPX: "I:SPX",
    NDX: "I:NDX",

    // Futures (Polygon format)
    "CL1!": "CL=F",    // Crude Oil
    "GC1!": "GC=F",    // Gold
    "HG1!": "HG=F",    // Copper
    "SI1!": "SI=F",    // Silver
    "NG1!": "NG=F",    // Natural Gas
    "ZW1!": "ZW=F",    // Wheat
    "ZC1!": "ZC=F",    // Corn
    "KC1!": "KC=F",    // Coffee
    "SB1!": "SB=F",    // Sugar
    "LE1!": "LE=F",    // Live Cattle
    "ZS1!": "ZS=F",    // Soybeans

    // Forex (Polygon uses C: prefix)
    "EUR/USD": "C:EURUSD",
    "GBP/USD": "C:GBPUSD",
    "USD/JPY": "C:USDJPY",
    "USD/CAD": "C:USDCAD",
    "USD/CHF": "C:USDCHF",
    "AUD/USD": "C:AUDUSD",
    "NZD/USD": "C:NZDUSD",
    "EUR/GBP": "C:EURGBP",
    "EUR/JPY": "C:EURJPY",
    "GBP/JPY": "C:GBPJPY",
    "AUD/JPY": "C:AUDJPY",
    "AUD/CAD": "C:AUDCAD",
    "AUD/CHF": "C:AUDCHF",
    "AUD/NZD": "C:AUDNZD",
    "AUD/SGD": "C:AUDSGD",
    "CAD/CHF": "C:CADCHF",
    "CAD/JPY": "C:CADJPY",
    "CHF/JPY": "C:CHFJPY",
    "EUR/AUD": "C:EURAUD",
    "EUR/CAD": "C:EURCAD",
    "EUR/CHF": "C:EURCHF",
    "EUR/NOK": "C:EURNOK",
    "EUR/NZD": "C:EURNZD",
    "EUR/PLN": "C:EURPLN",
    "EUR/SEK": "C:EURSEK",
    "EUR/TRY": "C:EURTRY",
    "GBP/AUD": "C:GBPAUD",
    "GBP/CAD": "C:GBPCAD",
    "GBP/CHF": "C:GBPCHF",
    "GBP/NZD": "C:GBPNZD",
    "GBP/ZAR": "C:GBPZAR",
    "NZD/CAD": "C:NZDCAD",
    "NZD/CHF": "C:NZDCHF",
    "NZD/JPY": "C:NZDJPY",
    "USD/BRL": "C:USDBRL",
    "USD/CNY": "C:USDCNY",
    "USD/DKK": "C:USDDKK",
    "USD/HKD": "C:USDHKD",
    "USD/IDR": "C:USDIDR",
    "USD/INR": "C:USDINR",
    "USD/KRW": "C:USDKRW",
    "USD/MXN": "C:USDMXN",
    "USD/NOK": "C:USDNOK",
    "USD/PLN": "C:USDPLN",
    "USD/RUB": "C:USDRUB",
    "USD/SEK": "C:USDSEK",
    "USD/SGD": "C:USDSGD",
    "USD/THB": "C:USDTHB",
    "USD/TRY": "C:USDTRY",
    "USD/ZAR": "C:USDZAR",

    // Crypto (Polygon uses X: prefix)
    BTC: "X:BTCUSD",
    BITCOIN: "X:BTCUSD",
    ETH: "X:ETHUSD",
    ETHEREUM: "X:ETHUSD",
    BNB: "X:BNBUSD",
    SOL: "X:SOLUSD",
    SOLANA: "X:SOLUSD",
    ADA: "X:ADAUSD",
    CARDANO: "X:ADAUSD",
    XRP: "X:XRPUSD",
    DOT: "X:DOTUSD",
    POLKADOT: "X:DOTUSD",
    LINK: "X:LINKUSD",
    CHAINLINK: "X:LINKUSD",
    XLM: "X:XLMUSD",
    STELLAR: "X:XLMUSD",
    BCH: "X:BCHUSD",

    // Commodities (ETFs)
    GOLD_ETF: "GLD",
    SILVER_ETF: "SLV",
    CRUDE_OIL_ETF: "USO",
    COPPER_ETF: "COPX",
    NAT_GAS: "UNG",
  },

  // ---------------------------------------------------------------------------
  // YAHOO FINANCE MAPPINGS
  // ---------------------------------------------------------------------------
  yahoo: {
    // Indices (Yahoo uses ^ prefix)
    TNX: "^TNX",
    TYX: "^TYX",
    FVX: "^FVX",
    IRX: "^IRX",
    DXY: "DX-Y.NYB",
    VIX: "^VIX",
    VXN: "^VXN",
    VVIX: "^VVIX",
    SPX: "^GSPC",
    NDX: "^NDX",

    // Futures (Yahoo uses =F suffix)
    "CL1!": "CL=F",
    "GC1!": "GC=F",
    "HG1!": "HG=F",
    "SI1!": "SI=F",
    "NG1!": "NG=F",
    "ZW1!": "ZW=F",
    "ZC1!": "ZC=F",
    "KC1!": "KC=F",
    "SB1!": "SB=F",
    "LE1!": "LE=F",
    "ZS1!": "ZS=F",

    // Forex (Yahoo uses =X suffix)
    "EUR/USD": "EURUSD=X",
    "GBP/USD": "GBPUSD=X",
    "USD/JPY": "JPY=X",
    "USD/CAD": "CAD=X",
    "USD/CHF": "CHF=X",
    "AUD/USD": "AUDUSD=X",
    "NZD/USD": "NZDUSD=X",
    "EUR/GBP": "EURGBP=X",
    "EUR/JPY": "EURJPY=X",
    "GBP/JPY": "GBPJPY=X",
    "AUD/JPY": "AUDJPY=X",

    // Crypto (Yahoo uses -USD suffix)
    BTC: "BTC-USD",
    BITCOIN: "BTC-USD",
    ETH: "ETH-USD",
    ETHEREUM: "ETH-USD",
    BNB: "BNB-USD",
    SOL: "SOL-USD",
    SOLANA: "SOL-USD",
    ADA: "ADA-USD",
    CARDANO: "ADA-USD",
    XRP: "XRP-USD",
    DOT: "DOT-USD",
    POLKADOT: "DOT-USD",
    LINK: "LINK-USD",
    CHAINLINK: "LINK-USD",
    XLM: "XLM-USD",
    STELLAR: "XLM-USD",
    BCH: "BCH-USD",

    // Class shares (Yahoo uses hyphen instead of period)
    "BRK.B": "BRK-B",
    "BF.B": "BF-B",
    "LEN.B": "LEN.B", // Actually uses period
  },

  // ---------------------------------------------------------------------------
  // TWELVE DATA MAPPINGS
  // ---------------------------------------------------------------------------
  twelve_data: {
    // Forex (TwelveData uses slash format)
    "EUR/USD": "EUR/USD",
    "GBP/USD": "GBP/USD",
    "USD/JPY": "USD/JPY",
    "USD/CAD": "USD/CAD",
    "USD/CHF": "USD/CHF",
    "AUD/USD": "AUD/USD",
    "NZD/USD": "NZD/USD",
    "EUR/GBP": "EUR/GBP",
    "EUR/JPY": "EUR/JPY",
    "GBP/JPY": "GBP/JPY",
    "AUD/JPY": "AUD/JPY",
    "AUD/CAD": "AUD/CAD",
    "AUD/CHF": "AUD/CHF",
    "AUD/NZD": "AUD/NZD",
    "AUD/SGD": "AUD/SGD",
    "EUR/AUD": "EUR/AUD",
    "EUR/NOK": "EUR/NOK",
    "EUR/PLN": "EUR/PLN",
    "EUR/SEK": "EUR/SEK",
    "EUR/TRY": "EUR/TRY",
    "GBP/CAD": "GBP/CAD",
    "GBP/CHF": "GBP/CHF",
    "GBP/ZAR": "GBP/ZAR",
    "USD/BRL": "USD/BRL",
    "USD/CNY": "USD/CNY",
    "USD/IDR": "USD/IDR",
    "USD/INR": "USD/INR",
    "USD/KRW": "USD/KRW",
    "USD/PLN": "USD/PLN",
    "USD/RUB": "USD/RUB",
    "USD/TRY": "USD/TRY",

    // Crypto (TwelveData uses pair format)
    BTC: "BTC/USD",
    BITCOIN: "BTC/USD",
    ETH: "ETH/USD",
    ETHEREUM: "ETH/USD",

    // Stocks (standard format)
    SQ: "SQ",
  },

  // ---------------------------------------------------------------------------
  // ALPHA VANTAGE MAPPINGS
  // ---------------------------------------------------------------------------
  alpha_vantage: {
    // Forex pairs (AlphaVantage uses slash format)
    "EUR/USD": { from: "EUR", to: "USD" },
    "GBP/USD": { from: "GBP", to: "USD" },
    "USD/JPY": { from: "USD", to: "JPY" },
    "USD/CAD": { from: "USD", to: "CAD" },
    "USD/CHF": { from: "USD", to: "CHF" },
    "AUD/USD": { from: "AUD", to: "USD" },
    "NZD/USD": { from: "NZD", to: "USD" },
    "EUR/GBP": { from: "EUR", to: "GBP" },
    "EUR/JPY": { from: "EUR", to: "JPY" },
    "EUR/CAD": { from: "EUR", to: "CAD" },
    "EUR/CHF": { from: "EUR", to: "CHF" },
    "EUR/NZD": { from: "EUR", to: "NZD" },
    "GBP/AUD": { from: "GBP", to: "AUD" },
    "GBP/NZD": { from: "GBP", to: "NZD" },
    "AUD/CAD": { from: "AUD", to: "CAD" },
    "AUD/NZD": { from: "AUD", to: "NZD" },
    "CAD/CHF": { from: "CAD", to: "CHF" },
    "CAD/JPY": { from: "CAD", to: "JPY" },
    "CHF/JPY": { from: "CHF", to: "JPY" },
    "NZD/CAD": { from: "NZD", to: "CAD" },
    "NZD/CHF": { from: "NZD", to: "CHF" },
    "NZD/JPY": { from: "NZD", to: "JPY" },
    "USD/DKK": { from: "USD", to: "DKK" },
    "USD/HKD": { from: "USD", to: "HKD" },
    "USD/MXN": { from: "USD", to: "MXN" },
    "USD/NOK": { from: "USD", to: "NOK" },
    "USD/SEK": { from: "USD", to: "SEK" },
    "USD/SGD": { from: "USD", to: "SGD" },
    "USD/THB": { from: "USD", to: "THB" },
    "USD/ZAR": { from: "USD", to: "ZAR" },
  },

  // ---------------------------------------------------------------------------
  // COINGECKO MAPPINGS
  // ---------------------------------------------------------------------------
  coingecko: {
    // Crypto: canonical -> CoinGecko ID
    BTC: "bitcoin",
    BITCOIN: "bitcoin",
    bitcoin: "bitcoin",

    ETH: "ethereum",
    ETHEREUM: "ethereum",
    ethereum: "ethereum",

    BNB: "binancecoin",
    binancecoin: "binancecoin",

    SOL: "solana",
    SOLANA: "solana",
    solana: "solana",

    ADA: "cardano",
    CARDANO: "cardano",
    cardano: "cardano",

    XRP: "ripple",
    ripple: "ripple",

    DOT: "polkadot",
    POLKADOT: "polkadot",
    polkadot: "polkadot",

    LINK: "chainlink",
    CHAINLINK: "chainlink",
    chainlink: "chainlink",

    XLM: "stellar",
    STELLAR: "stellar",
    stellar: "stellar",

    BCH: "bitcoin-cash",
  },

  // ---------------------------------------------------------------------------
  // EXCHANGE RATE API MAPPINGS
  // ---------------------------------------------------------------------------
  exchangerate: {
    // Forex (uses slash format)
    "EUR/USD": "EUR/USD",
    "GBP/USD": "GBP/USD",
    "USD/JPY": "USD/JPY",
    "USD/CAD": "USD/CAD",
    "AUD/USD": "AUD/USD",
    "NZD/USD": "NZD/USD",
    "EUR/GBP": "EUR/GBP",
    "EUR/JPY": "EUR/JPY",
    "GBP/JPY": "GBP/JPY",
    "AUD/JPY": "AUD/JPY",
  },

  // ---------------------------------------------------------------------------
  // FRED (Federal Reserve Economic Data) MAPPINGS
  // ---------------------------------------------------------------------------
  fred: {
    // These are direct series IDs - no mapping needed
    // Just documenting them here for reference
    CPI: "CPIAUCSL",           // Consumer Price Index
    GDP: "GDP",                // Gross Domestic Product
    FEDFUNDS: "FEDFUNDS",      // Federal Funds Rate
    UNRATE: "UNRATE",          // Unemployment Rate
    M1: "M1SL",                // M1 Money Supply
    M2: "M2SL",                // M2 Money Supply
    DGS2: "DGS2",              // 2-Year Treasury
    DGS5: "DGS5",              // 5-Year Treasury
    DGS10: "DGS10",            // 10-Year Treasury
    DGS30: "DGS30",            // 30-Year Treasury
    HOUST: "HOUST",            // Housing Starts
    INDPRO: "INDPRO",          // Industrial Production
    PAYEMS: "PAYEMS",          // Nonfarm Payrolls
    PERMIT: "PERMIT",          // Building Permits
    PPI: "PPIACO",             // Producer Price Index
    PCE: "PCE",                // Personal Consumption Expenditure
  },
}

// ============================================================================
// REVERSE MAPPINGS (for converting from API format back to canonical)
// ============================================================================

const REVERSE_MAPS = {
  polygon: {},
  yahoo: {},
  twelve_data: {},
  coingecko: {},
}

// Build reverse mappings
for (const [provider, mappings] of Object.entries(SYMBOL_MAPS)) {
  if (provider === 'alpha_vantage' || provider === 'fred') continue

  for (const [canonical, apiFormat] of Object.entries(mappings)) {
    REVERSE_MAPS[provider][apiFormat] = canonical
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

async function rateLimitedFetch(fetchFn) {
  const now = Date.now()
  const timeSinceLastCall = now - lastPolygonCall
  if (timeSinceLastCall < POLYGON_DELAY) {
    await new Promise((resolve) => setTimeout(resolve, POLYGON_DELAY - timeSinceLastCall))
  }
  lastPolygonCall = Date.now()
  return fetchFn()
}

export function getMappedSymbol(symbol, provider, category) {
  const normalized = normalizeSymbol(symbol, category)

  // Check if we have a mapping for this symbol
  const mapping = SYMBOL_MAPS[provider]?.[normalized]

  if (mapping) {
    console.log(`✓ Symbol mapping: ${symbol} → ${mapping} (${provider})`)
    return mapping
  }

  // No mapping found, return normalized symbol
  return normalized
}

export function getCanonicalSymbol(apiSymbol, provider) {
  // Try to convert from API format back to canonical format
  return REVERSE_MAPS[provider]?.[apiSymbol] || apiSymbol
}

// ============================================================================
// API ADAPTERS
// ============================================================================

export async function fetchFromPolygon(symbol, startDate, endDate) {
  return rateLimitedFetch(async () => {
    try {
      const mappedSymbol = getMappedSymbol(symbol, "polygon")
      const url = `https://api.polygon.io/v2/aggs/ticker/${mappedSymbol}/range/1/day/${startDate}/${endDate}`

      const response = await axios.get(url, {
        params: { apiKey: process.env.POLYGON_API_KEY },
      })

      if (response.data.results && response.data.results.length > 0) {
        return response.data.results.map((bar) => ({
          symbol, // Use original symbol
          date: new Date(bar.t).toISOString().split("T")[0],
          open: bar.o,
          high: bar.h,
          low: bar.l,
          close: bar.c,
          volume: bar.v,
          source: "polygon",
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
    const mappedSymbol = getMappedSymbol(symbol, "twelve_data")
    const url = "https://api.twelvedata.com/time_series"

    console.log(`Twelve Data: Fetching ${mappedSymbol} (original: ${symbol})`)

    const response = await axios.get(url, {
      params: {
        symbol: mappedSymbol,
        interval: "1day",
        start_date: startDate,
        end_date: endDate,
        apikey: process.env.TWELVE_DATA_API_KEY,
      },
    })

    if (response.data.status === "error") {
      console.error(`Twelve Data error for ${symbol}:`, response.data.message)
      return null
    }

    if (response.data.values && response.data.values.length > 0) {
      return response.data.values.map((bar) => ({
        symbol,
        date: bar.datetime,
        open: parseFloat(bar.open),
        high: parseFloat(bar.high),
        low: parseFloat(bar.low),
        close: parseFloat(bar.close),
        volume: parseInt(bar.volume) || 0,
        source: "twelve_data",
      }))
    }
    return null
  } catch (error) {
    console.error(`Twelve Data error for ${symbol}:`, error.message)
    return null
  }
}

export async function fetchFromYahooFinance(symbol, startDate, endDate) {
  try {
    const mappedSymbol = getMappedSymbol(symbol, "yahoo")

    console.log(`Yahoo Finance: Fetching ${mappedSymbol} (original: ${symbol})`)

    const result = await yahooFinance.historical(mappedSymbol, {
      period1: startDate,
      period2: endDate,
      interval: "1d",
    })

    if (!result || result.length === 0) {
      console.warn(`Yahoo Finance: No data for ${symbol}`)
      return null
    }

    return result.map((bar) => ({
      symbol, // Original symbol
      date: bar.date.toISOString().split("T")[0],
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume || 0,
      source: "yahoo_finance",
    }))
  } catch (error) {
    console.error(`Yahoo Finance error for ${symbol}:`, error.message)
    return null
  }
}

export async function fetchFromAlphaVantage(symbol, startDate, endDate) {
  try {
    // Check if this is a forex pair
    const forexMapping = SYMBOL_MAPS.alpha_vantage[symbol]

    if (forexMapping && forexMapping.from && forexMapping.to) {
      // Forex pair
      const url = "https://www.alphavantage.co/query"

      const response = await axios.get(url, {
        params: {
          function: "FX_DAILY",
          from_symbol: forexMapping.from,
          to_symbol: forexMapping.to,
          outputsize: "full",
          apikey: process.env.ALPHA_VANTAGE_API_KEY,
        },
      })

      const timeSeries = response.data["Time Series FX (Daily)"]
      if (!timeSeries) return null

      const results = []
      for (const [date, values] of Object.entries(timeSeries)) {
        if (date >= startDate && date <= endDate) {
          results.push({
            symbol,
            date,
            open: parseFloat(values["1. open"]),
            high: parseFloat(values["2. high"]),
            low: parseFloat(values["3. low"]),
            close: parseFloat(values["4. close"]),
            source: "alpha_vantage",
          })
        }
      }

      return results.length > 0 ? results : null
    } else {
      // Stock
      const url = "https://www.alphavantage.co/query"

      const response = await axios.get(url, {
        params: {
          function: "TIME_SERIES_DAILY",
          symbol: symbol,
          outputsize: "full",
          apikey: process.env.ALPHA_VANTAGE_API_KEY,
        },
      })

      const timeSeries = response.data["Time Series (Daily)"]
      if (!timeSeries) return null

      const results = []
      for (const [date, values] of Object.entries(timeSeries)) {
        if (date >= startDate && date <= endDate) {
          results.push({
            symbol,
            date,
            open: parseFloat(values["1. open"]),
            high: parseFloat(values["2. high"]),
            low: parseFloat(values["3. low"]),
            close: parseFloat(values["4. close"]),
            volume: parseInt(values["5. volume"]),
            source: "alpha_vantage",
          })
        }
      }

      return results.length > 0 ? results : null
    }
  } catch (error) {
    console.error(`Alpha Vantage error for ${symbol}:`, error.message)
    return null
  }
}

export async function fetchFromCoinGecko(coinId, days = 30) {
  try {
    // Get mapped CoinGecko ID
    const geckoId = getMappedSymbol(coinId, "coingecko")

    const url = `https://api.coingecko.com/api/v3/coins/${geckoId}/market_chart`

    const response = await axios.get(url, {
      params: {
        vs_currency: "usd",
        days: days,
        x_cg_demo_api_key: process.env.COINGECKO_API_KEY,
      },
    })

    if (response.data.prices && response.data.prices.length > 0) {
      return response.data.prices.map(([timestamp, price]) => ({
        symbol: coinId, // Original symbol
        date: new Date(timestamp).toISOString().split("T")[0],
        close: price,
        source: "coingecko",
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
    const url = "https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest"

    const response = await axios.get(url, {
      params: { symbol },
      headers: {
        "X-CMC_PRO_API_KEY": process.env.COINMARKETCAP_API_KEY,
      },
    })

    const data = response.data.data[symbol]
    if (data) {
      return [
        {
          symbol,
          date: new Date().toISOString().split("T")[0],
          close: data.quote.USD.price,
          volume: data.quote.USD.volume_24h,
          percent_change_24h: data.quote.USD.percent_change_24h,
          source: "coinmarketcap",
        },
      ]
    }
    return null
  } catch (error) {
    console.error(`CoinMarketCap error for ${symbol}:`, error.message)
    return null
  }
}

export async function fetchFromFRED(seriesId, startDate, endDate) {
  try {
    // Get proper FRED series ID
    const fredId = SYMBOL_MAPS.fred[seriesId] || seriesId

    const url = "https://api.stlouisfed.org/fred/series/observations"

    const response = await axios.get(url, {
      params: {
        series_id: fredId,
        api_key: process.env.FRED_API_KEY,
        file_type: "json",
        observation_start: startDate,
        observation_end: endDate,
      },
    })

    if (response.data.observations && response.data.observations.length > 0) {
      return response.data.observations.map((obs) => ({
        symbol: seriesId, // Original symbol
        date: obs.date,
        value: parseFloat(obs.value),
        source: "fred",
      }))
    }
    return null
  } catch (error) {
    console.error(`FRED error for ${seriesId}:`, error.message)
    return null
  }
}

export async function fetchWithFallback(symbol, startDate, endDate, adapters, category) {
  // Try normalized symbol first
  const normalized = normalizeSymbol(symbol, category)

  for (const adapter of adapters) {
    const data = await adapter(normalized, startDate, endDate)
    if (data && data.length > 0) {
      return data
    }
  }

  // If normalized fails, try all variants
  const variants = getSymbolVariants(symbol, category)
  for (const variant of variants) {
    if (variant === normalized) continue // Already tried

    for (const adapter of adapters) {
      const data = await adapter(variant, startDate, endDate)
      if (data && data.length > 0) {
        return data
      }
    }
  }

  return null
}

// ============================================================================
// CSV READERS - MARKET DATA (unchanged from original)
// ============================================================================

async function readAndFilterCSV(csvPath, symbolKey, symbolValue, startDate, endDate) {
  if (!fs.existsSync(csvPath)) {
    console.warn(`⚠ CSV not found: ${csvPath}`)
    return null
  }

  const fileContent = fs.readFileSync(csvPath, "utf8")
  const parsed = Papa.parse(fileContent, { header: true, dynamicTyping: true })

  const filtered = parsed.data
    .filter((row) => row[symbolKey] === symbolValue)
    .filter((row) => {
      const rowDate = row.Date
      return rowDate >= startDate && rowDate <= endDate
    })
    .map((row) => ({
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
  const csvPath = path.join(CSV_BASE, "equities", "equities_solstice_equinox.csv")
  return readAndFilterCSV(csvPath, "Symbol", symbol, startDate, endDate)
}

export async function readCryptoCSV(symbol, startDate, endDate) {
  const csvPath = path.join(CSV_BASE, "crypto", "crypto_solstice_equinox.csv")
  return readAndFilterCSV(csvPath, "Symbol", symbol, startDate, endDate)
}

export async function readForexCSV(pair, startDate, endDate) {
  const csvPath = path.join(CSV_BASE, "forex", "forex_solstice_equinox.csv")
  return readAndFilterCSV(csvPath, "Pair", pair, startDate, endDate)
}

export async function readCommodityCSV(commodity, startDate, endDate) {
  const csvPath = path.join(CSV_BASE, "commodities", "commodities_solstice_equinox.csv")
  return readAndFilterCSV(csvPath, "Commodity", commodity, startDate, endDate)
}

export async function readStressCSV(indicator, startDate, endDate) {
  const csvPath = path.join(CSV_BASE, "stress", "stress_solstice_equinox.csv")
  return readAndFilterCSV(csvPath, "Indicator", indicator, startDate, endDate)
}

export async function readRatesMacroCSV(symbol, startDate, endDate) {
  const csvPath = path.join(CSV_BASE, "rates-macro", "rates_macro_solstice_equinox.csv")
  return readAndFilterCSV(csvPath, "Symbol", symbol, startDate, endDate)
}

// ============================================================================
// CSV READERS - FIBONACCI & ASTRO (unchanged from original)
// ============================================================================

export async function readFibonacciCSV(symbol, startDate, endDate) {
  try {
    const fibDir = path.join(CSV_BASE, "fibonacci")

    // Try CSV first
    const csvPath = path.join(fibDir, "fibonacci_levels.csv")
    if (fs.existsSync(csvPath)) {
      const csvContent = fs.readFileSync(csvPath, "utf-8")
      const parsed = Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
      })

      const filtered = parsed.data.filter((row) => {
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
    const jsonPath = path.join(fibDir, "fibonacci_levels.json")
    if (fs.existsSync(jsonPath)) {
      const jsonContent = fs.readFileSync(jsonPath, "utf-8")
      const jsonData = JSON.parse(jsonContent)

      const dataArray = Array.isArray(jsonData) ? jsonData : Object.values(jsonData)

      const filtered = dataArray.filter((item) => {
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
    const astroDir = path.join(CSV_BASE, "astro")

    const files = {
      seasonal: {
        filename: "seasonal_anchors.csv",
        eventField: "type",
        dateField: "date",
      },
      aspects: {
        filename: "aspects.csv",
        eventField: "aspect_type",
        dateField: "date",
      },
      ingresses: {
        filename: "ingresses.csv",
        eventField: "sign",
        dateField: "date",
      },
      retrogrades: {
        filename: "retrogrades.csv",
        eventField: "status",
        dateField: "date",
      },
      lunar_phases: {
        filename: "lunar_phases.csv",
        eventField: "phase",
        dateField: "date",
      },
      lunar_cycle: {
        filename: "lunar_cycle_18yr.csv",
        eventField: "key_phase",
        dateField: "date",
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
        const content = fs.readFileSync(filePath, "utf-8")
        const parsed = Papa.parse(content, {
          header: true,
          skipEmptyLines: true,
        })

        const filtered = parsed.data
          .filter((row) => {
            const rowDate = row[config.dateField]
            if (!rowDate) return false

            return (!startDate || rowDate >= startDate) && (!endDate || rowDate <= endDate)
          })
          .map((row) => ({
            ...row,
            event_type: type,
            date: row[config.dateField],
            event: row[config.eventField] || type,
            ...(type === "seasonal" && {
              event: row.type,
              sign: row.sign,
              fibonacci_anchor: row.fibonacci_anchor === "True",
              anchor_type: row.anchor_type,
            }),
            ...(type === "aspects" && {
              event: `${row.body1} ${row.aspect_type} ${row.body2}`,
              body1: row.body1,
              body2: row.body2,
              aspect_nature: row.aspect_nature,
              orb: parseFloat(row.orb),
              exact: row.exact === "True",
            }),
            ...(type === "retrogrades" && {
              event: `${row.body} ${row.status} retrograde`,
              body: row.body,
              sign: row.sign,
              stationary: row.stationary === "True",
            }),
            ...(type === "ingresses" && {
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
    console.warn("⚠ Error reading astro alignment data:", error.message)
    return null
  }
}

export async function readPriceTouchCSV(symbol, startDate, endDate) {
  try {
    const touchPath = path.join(CSV_BASE, "price-touches", `${symbol.toLowerCase()}_touches.csv`)

    if (!fs.existsSync(touchPath)) {
      return null
    }

    const content = fs.readFileSync(touchPath, "utf-8")
    const parsed = Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
    })

    const filtered = parsed.data.filter((row) => {
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
