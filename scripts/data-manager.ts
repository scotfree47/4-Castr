// scripts/data-manager.ts
// COMPLETE CONSOLIDATED VERSION - All features unified
// Usage: npx tsx scripts/data-manager.ts [command] [options]

import { createClient } from "@supabase/supabase-js"
import axios from "axios"
import { parse } from "csv-parse/sync"
import dotenv from "dotenv"
import * as fs from "fs"
import Papa from "papaparse"
import path from "path"
import { fileURLToPath } from "url"

// ============================================================================
// ENVIRONMENT SETUP
// ============================================================================

// Get project root directory (ESM compatibility)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, "..")

// Load environment variables in order (later files override earlier ones)
dotenv.config({ path: path.join(projectRoot, ".env.scripts") }) // Local paths/config
dotenv.config({ path: path.join(projectRoot, ".env.local") }) // Local secrets
dotenv.config({ path: path.join(projectRoot, ".env") }) // Shared defaults

// Data directory - use from .env.scripts or default to relative path
const DATA_DIR = process.env.DATA_DIR || path.join(projectRoot, "csv-pull/market-data/data")

// Validate required environment variables
const requiredEnvVars = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`)
    console.error(`   Make sure it's set in .env.local or .env`)
    process.exit(1)
  }
}

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ... rest of your existing data-manager.ts code continues here ...

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface CSVMapping {
  csvPath: string
  tableName: string
  columnMapping: Record<string, string>
  transform?: (row: any) => any
}

interface APIProvider {
  name: string
  categories: string[]
  priority: number
  rateLimit: { calls: number; period: number }
  enabled: () => boolean
  fetch: (symbol: string, category: string) => Promise<number | null>
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const CATEGORY_MAP = {
  equity: ["SPY", "QQQ", "XLY"],
  commodity: ["GLD", "USO", "HG1!", "GC1!", "CL1!", "COTTON", "WHEAT", "CORN", "SUGAR", "COFFEE"],
  crypto: ["Bitcoin", "Ethereum", "Solana", "BNB", "XRP"],
  forex: ["EUR/USD", "USD/JPY", "GBP/USD", "GBP/JPY", "AUD/USD"],
  "rates-macro": ["TLT", "FEDFUNDS", "CPI"],
  stress: ["VIX", "MOVE", "TRIN"],
}

const PRICE_CSVS = {
  equity: "./csv-pull/market-data/data/unintegrated/equities/equities_solstice_equinox.csv",
  commodity:
    "./csv-pull/market-data/data/unintegrated/commodities/commodities_solstice_equinox.csv",
  crypto: "./csv-pull/market-data/data/unintegrated/crypto/crypto_solstice_equinox.csv",
  forex: "./csv-pull/market-data/data/unintegrated/forex/forex_solstice_equinox.csv",
}

const CSV_MAPPINGS: CSVMapping[] = [
  {
    csvPath: "./csv-pull/market-data/data/astro/aspects.csv",
    tableName: "astro_aspects",
    columnMapping: {
      date: "date",
      body1: "body1",
      body2: "body2",
      aspect_type: "aspect_type",
      aspect_nature: "aspect_nature",
      orb: "orb",
      exact: "exact",
      body1_sign: "body1_sign",
      body2_sign: "body2_sign",
      primary_scoring: "primary_scoring",
      bonus_eligible: "bonus_eligible",
      influence_weight: "influence_weight",
    },
  },
  {
    csvPath: "./csv-pull/market-data/data/astro/ingresses.csv",
    tableName: "astro_events",
    columnMapping: {
      date: "date",
      body: "body",
      sign: "sign",
      from_sign: "from_sign",
      ruler: "ruler",
      element: "element",
    },
    transform: (row: any) => ({
      date: row.date,
      event_type: "ingress",
      body: row.body,
      sign: row.sign,
      event_data: {
        from_sign: row.from_sign,
        ruler: row.ruler,
        element: row.element,
      },
      primary_scoring: row.body === "Sun",
      bonus_eligible: false,
    }),
  },
  {
    csvPath: "./csv-pull/market-data/data/equities/equities_solstice_equinox.csv",
    tableName: "financial_data",
    columnMapping: {
      Symbol: "symbol",
      Date: "date",
      Open: "open",
      High: "high",
      Low: "low",
      Close: "close",
      Volume: "volume",
    },
    transform: (row: any) => ({
      ...row,
      volume: row.volume ? parseInt(parseFloat(row.volume).toString()) : null,
      category: "equity",
      asset_type: "equity",
    }),
  },
  {
    csvPath: "./csv-pull/market-data/data/commodities/commodities_solstice_equinox.csv",
    tableName: "financial_data",
    columnMapping: {
      Commodity: "symbol",
      Date: "date",
      Price: "close",
      Unit: "unit",
    },
    transform: (row: any) => ({
      symbol: row.symbol,
      date: row.date,
      close: row.close,
      category: "commodity",
      asset_type: "commodity",
      metadata: { unit: row.unit },
    }),
  },
  {
    csvPath:
      "./csv-pull/market-data/data/forex-node_fetched/forex_solstice_equinox_node-fetched.csv",
    tableName: "financial_data",
    columnMapping: {
      Pair: "symbol",
      Date: "date",
      Rate: "close",
    },
    transform: (row: any) => ({
      symbol: row.symbol,
      date: row.date,
      close: row.close,
      category: "forex",
      asset_type: "forex",
    }),
  },
]

// ============================================================================
// API PROVIDERS
// ============================================================================

function mapCryptoSymbol(symbol: string): string {
  const map: Record<string, string> = {
    Bitcoin: "bitcoin",
    BTC: "bitcoin",
    Ethereum: "ethereum",
    ETH: "ethereum",
    Solana: "solana",
    SOL: "solana",
    BNB: "binancecoin",
    XRP: "ripple",
    BCH: "bitcoin-cash",
    Cardano: "cardano",
    ADA: "cardano",
    Polkadot: "polkadot",
    DOT: "polkadot",
    Chainlink: "chainlink",
    LINK: "chainlink",
    Stellar: "stellar",
    XLM: "stellar",
  }
  return map[symbol] || symbol.toLowerCase()
}

const API_PROVIDERS: APIProvider[] = [
  {
    name: "polygon",
    categories: ["equity", "stress"],
    priority: 1,
    rateLimit: { calls: 5, period: 60000 },
    enabled: () => !!process.env.POLYGON_API_KEY,
    fetch: async (symbol: string) => {
      const url = `https://api.polygon.io/v2/aggs/ticker/${symbol}/prev?adjusted=true&apiKey=${process.env.POLYGON_API_KEY}`
      const res = await axios.get(url, { timeout: 10000 })
      return res.data?.results?.[0]?.c || null
    },
  },
  {
    name: "alpha_vantage",
    categories: ["equity", "forex", "commodity"],
    priority: 2,
    rateLimit: { calls: 5, period: 60000 },
    enabled: () => !!process.env.ALPHA_VANTAGE_API_KEY,
    fetch: async (symbol: string, category: string) => {
      if (category === "forex" && symbol.includes("/")) {
        const [from, to] = symbol.split("/")
        const url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${from}&to_currency=${to}&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`
        const res = await axios.get(url, { timeout: 10000 })
        return (
          parseFloat(res.data?.["Realtime Currency Exchange Rate"]?.["5. Exchange Rate"]) || null
        )
      }
      const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`
      const res = await axios.get(url, { timeout: 10000 })
      return parseFloat(res.data?.["Global Quote"]?.["05. price"]) || null
    },
  },
  {
    name: "coingecko",
    categories: ["crypto"],
    priority: 1,
    rateLimit: { calls: 10, period: 60000 },
    enabled: () => !!process.env.COINGECKO_API_KEY,
    fetch: async (symbol: string) => {
      const coinId = mapCryptoSymbol(symbol)
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&x_cg_demo_api_key=${process.env.COINGECKO_API_KEY}`
      const res = await axios.get(url, { timeout: 10000 })
      return res.data?.[coinId]?.usd || null
    },
  },
  {
    name: "coinmarketcap",
    categories: ["crypto"],
    priority: 2,
    rateLimit: { calls: 30, period: 60000 },
    enabled: () => !!process.env.COINMARKETCAP_API_KEY,
    fetch: async (symbol: string) => {
      const coinSymbol = symbol === "Bitcoin" ? "BTC" : symbol === "Ethereum" ? "ETH" : symbol
      const url = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${coinSymbol}`
      const res = await axios.get(url, {
        timeout: 10000,
        headers: { "X-CMC_PRO_API_KEY": process.env.COINMARKETCAP_API_KEY },
      })
      return res.data?.data?.[coinSymbol]?.quote?.USD?.price || null
    },
  },
  {
    name: "twelve_data",
    categories: ["equity", "forex", "commodity"],
    priority: 3,
    rateLimit: { calls: 8, period: 60000 },
    enabled: () => !!process.env.TWELVE_DATA_API_KEY,
    fetch: async (symbol: string, category: string) => {
      const url = `https://api.twelvedata.com/price?symbol=${symbol}&apikey=${process.env.TWELVE_DATA_API_KEY}`
      const res = await axios.get(url, { timeout: 10000 })
      return parseFloat(res.data?.price) || null
    },
  },
  {
    name: "fmp",
    categories: ["equity"],
    priority: 4,
    rateLimit: { calls: 5, period: 60000 },
    enabled: () => !!process.env.FMP_API_KEY,
    fetch: async (symbol: string) => {
      const url = `https://financialmodelingprep.com/api/v3/quote/${symbol}?apikey=${process.env.FMP_API_KEY}`
      const res = await axios.get(url, { timeout: 10000 })
      return res.data?.[0]?.price || null
    },
  },
  {
    name: "exchangerate",
    categories: ["forex"],
    priority: 3,
    rateLimit: { calls: 10, period: 60000 },
    enabled: () => !!process.env.EXCHANGERATE_API_KEY,
    fetch: async (symbol: string) => {
      if (!symbol.includes("/")) return null
      const [from, to] = symbol.split("/")
      const url = `https://v6.exchangerate-api.com/v6/${process.env.EXCHANGERATE_API_KEY}/pair/${from}/${to}`
      const res = await axios.get(url, { timeout: 10000 })
      return res.data?.conversion_rate || null
    },
  },
  {
    name: "fred",
    categories: ["rates-macro"],
    priority: 1,
    rateLimit: { calls: 10, period: 60000 },
    enabled: () => !!process.env.FRED_API_KEY,
    fetch: async (symbol: string) => {
      // Map symbols to FRED series IDs
      const seriesMap: Record<string, string> = {
        FEDFUNDS: "DFF",
        CPI: "CPIAUCSL",
      }
      const seriesId = seriesMap[symbol]
      if (!seriesId) return null

      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${process.env.FRED_API_KEY}&file_type=json&sort_order=desc&limit=1`
      const res = await axios.get(url, { timeout: 10000 })
      return parseFloat(res.data?.observations?.[0]?.value) || null
    },
  },
]

// ============================================================================
// RATE LIMITER
// ============================================================================

class RateLimiter {
  private callHistory: Map<string, number[]> = new Map()

  async throttle(provider: APIProvider): Promise<void> {
    const now = Date.now()
    const history = this.callHistory.get(provider.name) || []
    const validCalls = history.filter((time) => now - time < provider.rateLimit.period)

    if (validCalls.length >= provider.rateLimit.calls) {
      const oldestCall = validCalls[0]
      const waitTime = provider.rateLimit.period - (now - oldestCall) + 100
      if (waitTime > 0) {
        console.log(`   ⏳ Rate limit: waiting ${Math.ceil(waitTime / 1000)}s for ${provider.name}`)
        await new Promise((resolve) => setTimeout(resolve, waitTime))
      }
    }

    validCalls.push(Date.now())
    this.callHistory.set(provider.name, validCalls)
  }

  reset(): void {
    this.callHistory.clear()
  }
}

const rateLimiter = new RateLimiter()

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function parseCSV(filePath: string): any[] {
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  CSV not found: ${filePath}`)
    return []
  }

  const content = fs.readFileSync(filePath, "utf-8")
  const cleanedContent = content
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n")

  const parsed = Papa.parse<any>(cleanedContent, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  })

  return (parsed.data as any[]).filter(
    (row: any) => row.symbol || row.Symbol || row.Commodity || row.Pair || row.Indicator
  )
}

function getLatestPrice(symbol: string, category: string): { price: number; date: string } | null {
  const categoryKey = category === "commodity" ? "commodity" : category
  const csvPath = PRICE_CSVS[categoryKey as keyof typeof PRICE_CSVS]

  if (!csvPath || !fs.existsSync(csvPath)) return null

  const data = parseCSV(csvPath)
  const symbolData = data.filter((row: any) => {
    const rowSymbol = row.Symbol || row.Commodity || row.Pair
    return rowSymbol === symbol
  })

  if (symbolData.length === 0) return null

  const sorted = symbolData.sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime())
  const latest = sorted[0]

  return {
    price: latest.Close || latest.Price || latest.Rate || 0,
    date: latest.Date,
  }
}

async function fetchPriceWithFallback(
  symbol: string,
  category: string
): Promise<{ price: number; provider: string } | null> {
  const providers = API_PROVIDERS.filter(
    (p) => p.categories.includes(category) && p.enabled()
  ).sort((a, b) => a.priority - b.priority)

  if (providers.length === 0) return null

  for (const provider of providers) {
    try {
      await rateLimiter.throttle(provider)
      const price = await provider.fetch(symbol, category)
      if (price && price > 0) {
        return { price, provider: provider.name }
      }
    } catch (error: any) {
      continue
    }
  }
  return null
}

// ============================================================================
// CORE COMMANDS
// ============================================================================

async function loadAllCSVs(): Promise<void> {
  console.log("🚀 Starting CSV data load...\n")
  for (const mapping of CSV_MAPPINGS) {
    try {
      await loadCSV(mapping)
    } catch (error: any) {
      console.error(`❌ Error loading ${mapping.csvPath}:`, error.message)
    }
  }
  console.log("✅ CSV data load complete!")
}

async function loadCSV(mapping: CSVMapping): Promise<void> {
  const { csvPath, tableName, columnMapping, transform } = mapping

  if (!fs.existsSync(csvPath)) {
    console.log(`   ⚠️  File not found, skipping: ${csvPath}`)
    return
  }

  const fileContent = fs.readFileSync(csvPath, "utf-8")
  const cleanedContent = fileContent
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n")

  const records = parse(cleanedContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  })

  const transformedRecords = records
    .map((record: any) => {
      const mapped: any = {}
      for (const [csvCol, dbCol] of Object.entries(columnMapping)) {
        if (record[csvCol] !== undefined && record[csvCol] !== "") {
          mapped[dbCol] = record[csvCol]
        }
      }
      return transform ? transform(mapped) : mapped
    })
    .filter((r: any) => Object.keys(r).length > 0)

  if (transformedRecords.length === 0) return

  const batchSize = 500
  for (let i = 0; i < transformedRecords.length; i += batchSize) {
    const batch = transformedRecords.slice(i, i + batchSize)
    const conflictKey =
      tableName === "astro_aspects"
        ? "date,body1,body2,aspect_type"
        : tableName === "astro_events"
          ? "date,event_type,body"
          : "symbol,date"

    const { error } = await supabase.from(tableName).upsert(batch, { onConflict: conflictKey })
    if (error) {
      console.error(`   ❌ Error inserting batch:`, error.message)
    }
  }
}

async function updatePricesFromCSV(csvPath?: string): Promise<void> {
  console.log("📊 Updating prices from CSV...\n")

  const targetPath = csvPath || "./public/data/tickers/price_data_dec22_20260107.csv"
  if (!fs.existsSync(targetPath)) {
    console.error("❌ CSV file not found:", targetPath)
    return
  }

  const csvContent = fs.readFileSync(targetPath, "utf8")
  const parsed = Papa.parse<any>(csvContent, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  })

  const symbolData: Record<string, any[]> = {}
  ;(parsed.data as any[]).forEach((row: any) => {
    const symbol = row.symbol || row.Symbol
    if (!symbol) return

    if (!symbolData[symbol]) symbolData[symbol] = []
    symbolData[symbol].push({
      symbol,
      date: row.date || row.Date,
      open: parseFloat(row.open || row.Open) || null,
      high: parseFloat(row.high || row.High) || null,
      low: parseFloat(row.low || row.Low) || null,
      close: parseFloat(row.close || row.Close),
      volume: parseFloat(row.volume || row.Volume) || 0,
    })
  })

  let updated = 0
  for (const symbol of Object.keys(symbolData)) {
    const records = symbolData[symbol]
    for (let i = 0; i < records.length; i += 1000) {
      const batch = records.slice(i, i + 1000)
      const { error } = await supabase
        .from("financial_data")
        .upsert(batch, { onConflict: "symbol,date" })
      if (!error) updated++
    }
    console.log(`✅ Updated ${symbol}`)
  }
}

async function checkPriceFreshness(): Promise<void> {
  console.log("🔍 Checking price data freshness...\n")

  const symbols = ["SPY", "QQQ", "Bitcoin", "EUR/USD"]
  for (const symbol of symbols) {
    const { data } = await supabase
      .from("financial_data")
      .select("symbol, date, close")
      .eq("symbol", symbol)
      .order("date", { ascending: false })
      .limit(1)

    if (data && data.length > 0) {
      const latest = data[0]
      const daysOld = Math.floor(
        (Date.now() - new Date(latest.date).getTime()) / (1000 * 60 * 60 * 24)
      )
      console.log(
        `${symbol.padEnd(10)} | $${latest.close.toFixed(2).padStart(8)} | ${latest.date} (${daysOld}d old)`
      )
    } else {
      console.log(`${symbol.padEnd(10)} | NO DATA`)
    }
  }
}

async function populateFeaturedTickers(): Promise<void> {
  console.log("🚀 Populating featured tickers from API...\n")

  try {
    // Trigger the API endpoint that does the heavy lifting
    const categories = ["equity", "commodity", "forex", "crypto", "rates-macro", "stress"]

    for (const category of categories) {
      const url = `http://localhost:3000/api/ticker-ratings?mode=featured&category=${category}&minScore=75`
      console.log(`📊 Calculating ${category}...`)

      const response = await fetch(url)
      const data = await response.json()

      if (data.featured?.length > 0) {
        console.log(`   ✅ ${category}: ${data.featured.length} tickers`)
      }
    }

    console.log("\n✅ Featured tickers populated via API")
  } catch (error: any) {
    console.error("❌ Error:", error.message)
    console.log("\n💡 Make sure dev server is running: npm run dev")
  }
}

// ============================================================================
// CRON COMMANDS
// ============================================================================

async function cronUpdatePricesDelayTolerant(): Promise<void> {
  console.log("🔄 Starting smart price update...\n")

  const args = process.argv.slice(3)
  const categoryArg = args.find((arg) => arg.startsWith("--categories="))
  const requestedCategories = categoryArg
    ? categoryArg.split("=")[1].split(",")
    : Object.keys(CATEGORY_MAP)

  for (const category of requestedCategories) {
    const symbols = CATEGORY_MAP[category as keyof typeof CATEGORY_MAP]
    if (!symbols) continue

    console.log(`\n📂 ${category.toUpperCase()} (${symbols.length} symbols)`)
    const records: any[] = []
    const today = new Date().toISOString().split("T")[0]

    for (const symbol of symbols) {
      const result = await fetchPriceWithFallback(symbol, category)
      if (result) {
        records.push({
          symbol,
          date: today,
          close: result.price,
          open: result.price,
          high: result.price,
          low: result.price,
          volume: 0,
        })
        console.log(
          `   ✅ ${symbol.padEnd(12)} $${result.price.toFixed(2).padStart(10)} (${result.provider})`
        )
      }
      await new Promise((resolve) => setTimeout(resolve, 200))
    }

    if (records.length > 0) {
      await supabase.from("financial_data").upsert(records, { onConflict: "symbol,date" })
      console.log(`   ✅ Database updated`)
    }
  }

  rateLimiter.reset()
  console.log("\n✅ Price update complete\n")
}

async function cronRefreshFeaturedDelayTolerant(): Promise<void> {
  console.log("🌞 Checking ingress status...\n")

  const today = new Date().toISOString().split("T")[0]
  const { data: currentIngress } = await supabase
    .from("astro_events")
    .select("*")
    .eq("event_type", "ingress")
    .eq("body", "Sun")
    .lte("date", today)
    .order("date", { ascending: false })
    .limit(1)
    .single()

  if (!currentIngress) {
    console.log("⚠️  No ingress data\n")
    return
  }

  const daysSinceIngress = Math.floor(
    (Date.now() - new Date(currentIngress.date).getTime()) / (1000 * 60 * 60 * 24)
  )

  if (daysSinceIngress <= 1 || (daysSinceIngress % 7 === 0 && daysSinceIngress <= 28)) {
    console.log(`✅ Refresh triggered (day ${daysSinceIngress})\n`)
    await populateFeaturedTickers()
  } else {
    console.log("⭐️  No refresh needed\n")
  }
}

// ============================================================================
// ENHANCEMENT COMMANDS
// ============================================================================

async function cleanOldPriceData(daysToKeep: number = 1095): Promise<void> {
  console.log(`🧹 Cleaning price data older than ${daysToKeep} days...\n`)

  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
  const cutoffDateStr = cutoffDate.toISOString().split("T")[0]

  const { data, error } = await supabase
    .from("financial_data")
    .delete()
    .lt("date", cutoffDateStr)
    .select()

  if (error) {
    console.error("❌ Error:", error.message)
  } else {
    console.log(`✅ Deleted ${data?.length || 0} old records\n`)
  }
}

async function getDataQualityReport(): Promise<void> {
  console.log("📊 DATA QUALITY REPORT\n")

  for (const [category, symbols] of Object.entries(CATEGORY_MAP)) {
    const { count } = await supabase
      .from("financial_data")
      .select("*", { count: "exact", head: true })
      .in("symbol", symbols)

    console.log(
      `   ${category.padEnd(15)} | ${symbols.length} symbols | ${(count || 0).toLocaleString()} data points`
    )
  }
}

async function verifyDatabaseSchema(): Promise<void> {
  console.log("🔍 Verifying Database Schema...\n")

  const expectedTables = [
    "financial_data",
    "featured_tickers",
    "astro_events",
    "ticker_ratings_cache",
  ]

  for (const table of expectedTables) {
    const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true })

    if (error) {
      console.log(`   ❌ ${table.padEnd(25)} | Error: ${error.message}`)
    } else {
      console.log(`   ✅ ${table.padEnd(25)} | ${(count || 0).toLocaleString()} rows`)
    }
  }
}

async function exportToCSV(category?: string, outputDir: string = "./backups"): Promise<void> {
  console.log("💾 Exporting data to CSV...\n")

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const categories = category ? [category] : Object.keys(CATEGORY_MAP)

  for (const cat of categories) {
    const symbols = CATEGORY_MAP[cat as keyof typeof CATEGORY_MAP]
    if (!symbols) continue

    const { data, error } = await supabase
      .from("financial_data")
      .select("*")
      .in("symbol", symbols)
      .order("symbol")
      .order("date")

    if (error || !data || data.length === 0) continue

    const csv = Papa.unparse(data)
    const timestamp = new Date().toISOString().split("T")[0]
    const filename = `${outputDir}/${cat}_${timestamp}.csv`

    fs.writeFileSync(filename, csv)
    console.log(`   ✅ Exported ${data.length} records to ${filename}`)
  }
}

async function testAPIProviders(): Promise<void> {
  console.log("🧪 Testing API Providers...\n")

  const testSymbols = { equity: "SPY", crypto: "Bitcoin", forex: "EUR/USD" }

  for (const provider of API_PROVIDERS) {
    console.log(`📡 ${provider.name.toUpperCase()}`)
    console.log(`   Enabled: ${provider.enabled() ? "✅" : "❌"}`)

    if (!provider.enabled()) continue

    let testSymbol = ""
    let testCategory = ""

    for (const [cat, sym] of Object.entries(testSymbols)) {
      if (provider.categories.includes(cat)) {
        testSymbol = sym
        testCategory = cat
        break
      }
    }

    try {
      const price = await provider.fetch(testSymbol, testCategory)
      if (price) {
        console.log(`   ✅ ${testSymbol} = $${price.toFixed(2)}\n`)
      }
    } catch (error: any) {
      console.log(`   ❌ ${error.message}\n`)
    }

    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
}

// ============================================================================
// MAIN CLI
// ============================================================================

async function main() {
  const command = process.argv[2]

  const commands: Record<string, () => Promise<void>> = {
    "load-all": loadAllCSVs,
    "update-prices": () => updatePricesFromCSV(process.argv[3]),
    "check-freshness": checkPriceFreshness,
    "populate-featured": populateFeaturedTickers,
    "cron-update-prices": cronUpdatePricesDelayTolerant,
    "cron-refresh-featured": cronRefreshFeaturedDelayTolerant,
    "clean-old-data": () => cleanOldPriceData(1095),
    "quality-report": getDataQualityReport,
    "verify-schema": verifyDatabaseSchema,
    "export-csv": () => exportToCSV(process.argv[3]),
    "test-providers": testAPIProviders,
    "check-ingress": async () => {
      const today = new Date().toISOString().split("T")[0]
      const { data } = await supabase
        .from("astro_events")
        .select("*")
        .eq("event_type", "ingress")
        .eq("body", "Sun")
        .lte("date", today)
        .order("date", { ascending: false })
        .limit(1)
        .single()

      if (data) {
        const days = Math.floor(
          (Date.now() - new Date(data.date).getTime()) / (1000 * 60 * 60 * 24)
        )
        console.log(`🌞 Current ingress: ${data.sign} (${data.date}, ${days} days ago)`)
      }
    },
  }

  if (!command || !commands[command]) {
    console.log(`
📊 Data Manager - Unified data operations tool

Usage: npx tsx scripts/data-manager.ts [command] [options]

Core Commands:
  load-all                       Load all CSV files into database
  update-prices [path]           Update prices from CSV file
  check-freshness                Check price data staleness
  populate-featured              Populate featured tickers from scores
  check-ingress                  Check current astrological ingress status

🔄 Cron Commands:
  cron-update-prices [--categories=equity,crypto,forex]
                                 Smart price update with API fallbacks
  cron-refresh-featured          Ingress-aware featured ticker refresh

🛠️  Maintenance Commands:
  quality-report                 Get comprehensive data quality report
  verify-schema                  Verify database tables exist
  export-csv [category]          Export data to CSV backups
  clean-old-data                 Clean price data older than 3 years
  test-providers                 Test all API provider connections

Examples:
  npx tsx scripts/data-manager.ts check-freshness
 t
  npx tsx scripts/data-manager.ts export-csv equity
    `)
    process.exit(1)
  }

  try {
    await commands[command]()
    console.log("\n✅ Operation complete")
    process.exit(0)
  } catch (error) {
    console.error("\n❌ Fatal error:", error)
    process.exit(1)
  }
}

main()
