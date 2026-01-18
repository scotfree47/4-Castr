// scripts/centralDataManager.mjs
import dotenv from "dotenv"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

// Load .env.local
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, "../.env.local") })

import fs from "fs"
import { parse } from "csv-parse/sync"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase credentials")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// ============================================================================
// CONFIGURATION - All data sources in one place
// ============================================================================

const DATA_SOURCES = {
  astro: {
    aspects: "./csv-pull/market-data/data/astro/aspects.csv",
    ingresses: "./csv-pull/market-data/data/astro/ingresses.csv",
    lunar_phases: "./csv-pull/market-data/data/astro/lunar_phases.csv",
    retrogrades: "./csv-pull/market-data/data/astro/retrogrades.csv",
    seasonal_anchors: "./csv-pull/market-data/data/astro/seasonal_anchors.csv",
    lunar_cycle: "./csv-pull/market-data/data/astro/lunar_cycle_18yr.csv",
  },
  market: {
    equities: "./csv-pull/market-data/data/equities/equities_solstice_equinox.csv",
    commodities: "./csv-pull/market-data/data/commodities/commodities_solstice_equinox.csv",
    forex: "./csv-pull/market-data/data/forex/forex_solstice_equinox.csv",
    crypto: "./csv-pull/market-data/data/crypto/crypto_solstice_equinox.csv",
    rates_macro: "./csv-pull/market-data/data/rates-macro/rates_macro_solstice_equinox.csv",
    stress: "./csv-pull/market-data/data/stress/stress_solstice_equinox.csv",
  },
  analysis: {
    fibonacci: "./csv-pull/market-data/data/fibonacci/fibonacci_levels.csv",
    confidence: "./csv-pull/market-data/data/scores/confidence_scores_20251231.csv",
  },
}

// ============================================================================
// CORE FUNCTIONS - All data operations
// ============================================================================

/**
 * Load and parse CSV file
 */
function loadCSV(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`   ⏭️  File not found: ${filePath}`)
    return null
  }

  const content = fs
    .readFileSync(filePath, "utf-8")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n")

  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  })
}

/**
 * Insert data in batches to Supabase
 */
async function insertBatch(tableName, rows, conflictColumns = null) {
  if (!rows || rows.length === 0) return 0

  const batchSize = 500
  let inserted = 0

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)

    const upsertOptions = conflictColumns
      ? { onConflict: conflictColumns, ignoreDuplicates: false }
      : {}

    const { error } = await supabase.from(tableName).upsert(batch, upsertOptions)

    if (error) {
      console.error(`   ❌ Batch ${i}-${i + batch.length}:`, error.message)
    } else {
      inserted += batch.length
    }
  }

  return inserted
}

// ============================================================================
// ASTRO DATA LOADERS
// ============================================================================

async function loadAstroAspects() {
  console.log("\n📂 Loading planetary aspects...")
  const records = loadCSV(DATA_SOURCES.astro.aspects)
  if (!records) return

  const rows = records.map((r) => ({
    date: r.date,
    event_type: "aspect",
    body: r.body1,
    sign: r.body1_sign,
    event_data: {
      body2: r.body2,
      body2_sign: r.body2_sign,
      aspect_type: r.aspect_type,
      aspect_nature: r.aspect_nature,
      orb: parseFloat(r.orb) || null,
      exact: r.exact === "True",
    },
    primary_scoring: r.primary_scoring === "True",
    bonus_eligible: r.bonus_eligible === "True",
    influence_weight: r.influence_weight ? parseFloat(r.influence_weight) : null,
  }))

  // Insert without upsert to avoid conflicts (aspects can have multiple per day)
  const count = await insertBatchSimple("astro_events", rows)
  console.log(`   ✅ Loaded ${count} aspect events`)
}

// Add this new helper function
async function insertBatchSimple(tableName, rows) {
  if (!rows || rows.length === 0) return 0

  const batchSize = 500
  let inserted = 0

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)

    // Simple insert, ignore duplicates
    const { error } = await supabase.from(tableName).insert(batch).select() // Don't use upsert

    if (error && !error.message.includes("duplicate key")) {
      console.error(`   ❌ Batch ${i}-${i + batch.length}:`, error.message)
    } else {
      inserted += batch.length
    }
  }

  return inserted
}

async function loadAstroIngresses() {
  console.log("\n📂 Loading sign ingresses...")
  const records = loadCSV(DATA_SOURCES.astro.ingresses)
  if (!records) return

  const rows = records.map((r) => ({
    date: r.date,
    event_type: "ingress",
    body: r.body,
    sign: r.sign,
    event_data: {
      from_sign: r.from_sign,
      ruler: r.ruler,
      element: r.element,
    },
  }))

  const count = await insertBatch("astro_events", rows, "date,event_type,body")
  console.log(`   ✅ Loaded ${count} ingress events`)
}

async function loadLunarPhases() {
  console.log("\n📂 Loading lunar phases...")
  const records = loadCSV(DATA_SOURCES.astro.lunar_phases)
  if (!records) return

  const rows = records.map((r) => ({
    date: r.date,
    event_type: "lunar_phase",
    body: "Moon",
    sign: r.sign,
    event_data: {
      phase: r.phase,
      illumination: parseFloat(r.illumination),
      ruler: r.ruler,
    },
  }))

  const count = await insertBatch("astro_events", rows, "date,event_type,body")
  console.log(`   ✅ Loaded ${count} lunar phase events`)
}

async function loadRetrogrades() {
  console.log("\n📂 Loading retrogrades...")
  const records = loadCSV(DATA_SOURCES.astro.retrogrades)
  if (!records) return

  const rows = records.map((r) => ({
    date: r.date,
    event_type: "retrograde",
    body: r.body,
    sign: r.sign,
    event_data: {
      status: r.status,
      stationary: r.stationary === "True",
    },
    primary_scoring: r.primary_scoring === "True",
    bonus_eligible: r.bonus_eligible === "True",
    influence_weight: r.influence_weight ? parseFloat(r.influence_weight) : null,
  }))

  const count = await insertBatch("astro_events", rows, "date,event_type,body")
  console.log(`   ✅ Loaded ${count} retrograde events`)
}

async function loadSeasonalAnchors() {
  console.log("\n📂 Loading seasonal anchors...")
  const records = loadCSV(DATA_SOURCES.astro.seasonal_anchors)
  if (!records) return

  const rows = records.map((r) => ({
    date: r.date,
    event_type: "seasonal_anchor",
    body: "Sun",
    sign: r.sign,
    event_data: {
      type: r.type,
      fibonacci_anchor: r.fibonacci_anchor === "True",
      anchor_type: r.anchor_type,
    },
  }))

  const count = await insertBatch("astro_events", rows, "date,event_type,body")
  console.log(`   ✅ Loaded ${count} seasonal anchor events`)
}

// ============================================================================
// MARKET DATA LOADERS
// ============================================================================

async function loadEquities() {
  console.log("\n📊 Loading equities...")
  const records = loadCSV(DATA_SOURCES.market.equities)
  if (!records) return

  const rows = records.map((r) => ({
    symbol: r.Symbol,
    date: r.Date,
    open: parseFloat(r.Open),
    high: parseFloat(r.High),
    low: parseFloat(r.Low),
    close: parseFloat(r.Close),
    volume: r.Volume ? parseInt(r.Volume) : null,
    category: "equity",
  }))

  const count = await insertBatch("financial_data", rows, "symbol,date")
  console.log(`   ✅ Loaded ${count} equity records`)
}

async function loadCommodities() {
  console.log("\n📊 Loading commodities...")
  const records = loadCSV(DATA_SOURCES.market.commodities)
  if (!records) return

  const rows = records.map((r) => ({
    symbol: r.Commodity,
    date: r.Date,
    close: parseFloat(r.Price),
    category: "commodity",
    metadata: { unit: r.Unit },
  }))

  const count = await insertBatch("financial_data", rows, "symbol,date")
  console.log(`   ✅ Loaded ${count} commodity records`)
}

async function loadForex() {
  console.log("\n📊 Loading forex...")
  const records = loadCSV(DATA_SOURCES.market.forex)
  if (!records) return

  const rows = records.map((r) => ({
    symbol: r.Pair,
    date: r.Date,
    close: parseFloat(r.Rate),
    category: "forex",
  }))

  const count = await insertBatch("financial_data", rows, "symbol,date")
  console.log(`   ✅ Loaded ${count} forex records`)
}

async function loadCrypto() {
  console.log("\n📊 Loading crypto...")
  const records = loadCSV(DATA_SOURCES.market.crypto)
  if (!records) return

  const rows = records.map((r) => ({
    symbol: r.Symbol,
    date: r.Date,
    close: parseFloat(r.Price),
    volume: r.Volume ? parseInt(r.Volume) : null,
    category: "crypto",
    metadata: r["Market Cap"] ? { market_cap: r["Market Cap"] } : null,
  }))

  const count = await insertBatch("financial_data", rows, "symbol,date")
  console.log(`   ✅ Loaded ${count} crypto records`)
}

async function loadRatesMacro() {
  console.log("\n📊 Loading rates/macro...")
  const records = loadCSV(DATA_SOURCES.market.rates_macro)
  if (!records) return

  const rows = records.map((r) => ({
    symbol: r.Symbol,
    date: r.Date,
    open: parseFloat(r.Open),
    high: parseFloat(r.High),
    low: parseFloat(r.Low),
    close: parseFloat(r.Close),
    volume: r.Volume ? parseInt(r.Volume) : null,
    category: "rates-macro",
  }))

  const count = await insertBatch("financial_data", rows, "symbol,date")
  console.log(`   ✅ Loaded ${count} rates/macro records`)
}

async function loadStress() {
  console.log("\n📊 Loading stress indicators...")
  const records = loadCSV(DATA_SOURCES.market.stress)
  if (!records) return

  const rows = records.map((r) => ({
    symbol: r.Indicator,
    date: r.Date,
    close: parseFloat(r.Value),
    category: "stress",
    metadata: { unit: r.Unit },
  }))

  const count = await insertBatch("financial_data", rows, "symbol,date")
  console.log(`   ✅ Loaded ${count} stress indicator records`)
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

async function getDatabaseStats() {
  const { count: astroCount } = await supabase
    .from("astro_events")
    .select("*", { count: "exact", head: true })

  const { count: financialCount } = await supabase
    .from("financial_data")
    .select("*", { count: "exact", head: true })

  const { count: featuredCount } = await supabase
    .from("featured_tickers")
    .select("*", { count: "exact", head: true })

  return { astroCount, financialCount, featuredCount }
}

async function listAvailableSymbols() {
  const { data } = await supabase.from("financial_data").select("symbol, category").order("symbol")

  if (!data) return

  const byCategory = data.reduce((acc, { symbol, category }) => {
    if (!acc[category]) acc[category] = []
    if (!acc[category].includes(symbol)) acc[category].push(symbol)
    return acc
  }, {})

  console.log("\n📊 Available Symbols by Category:")
  for (const [category, symbols] of Object.entries(byCategory)) {
    console.log(`\n${category.toUpperCase()}:`)
    console.log(`  ${symbols.join(", ")}`)
  }
}

// ============================================================================
// CLI COMMANDS
// ============================================================================

const COMMANDS = {
  "load-all": async () => {
    console.log("🚀 Loading all data...\n")
    await loadAstroAspects()
    await loadAstroIngresses()
    await loadLunarPhases()
    await loadRetrogrades()
    await loadSeasonalAnchors()
    await loadEquities()
    await loadCommodities()
    await loadForex()
    await loadCrypto()
    await loadRatesMacro()
    await loadStress()
  },

  "load-astro": async () => {
    console.log("🌟 Loading astro data...\n")
    await loadAstroAspects()
    await loadAstroIngresses()
    await loadLunarPhases()
    await loadRetrogrades()
    await loadSeasonalAnchors()
  },

  "load-market": async () => {
    console.log("📈 Loading market data...\n")
    await loadEquities()
    await loadCommodities()
    await loadForex()
    await loadCrypto()
    await loadRatesMacro()
    await loadStress()
  },

  stats: async () => {
    const stats = await getDatabaseStats()
    console.log("\n📊 Database Statistics:")
    console.log(`   astro_events: ${stats.astroCount} rows`)
    console.log(`   financial_data: ${stats.financialCount} rows`)
    console.log(`   featured_tickers: ${stats.featuredCount} rows`)
  },

  "list-symbols": async () => {
    await listAvailableSymbols()
  },

  help: () => {
    console.log("\n📖 Available Commands:")
    console.log("   node scripts/centralDataManager.mjs load-all       - Load all CSV data")
    console.log("   node scripts/centralDataManager.mjs load-astro     - Load astro data only")
    console.log("   node scripts/centralDataManager.mjs load-market    - Load market data only")
    console.log("   node scripts/centralDataManager.mjs stats          - Show database stats")
    console.log("   node scripts/centralDataManager.mjs list-symbols   - List available symbols")
    console.log("   node scripts/centralDataManager.mjs help           - Show this help")
  },
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const command = process.argv[2] || "help"

  if (!COMMANDS[command]) {
    console.error(`❌ Unknown command: ${command}`)
    COMMANDS.help()
    process.exit(1)
  }

  console.log("=".repeat(60))
  await COMMANDS[command]()

  if (command !== "help" && command !== "stats" && command !== "list-symbols") {
    const stats = await getDatabaseStats()
    console.log("\n" + "=".repeat(60))
    console.log("✅ Complete!")
    console.log(`\n📊 Final Stats:`)
    console.log(`   astro_events: ${stats.astroCount}`)
    console.log(`   financial_data: ${stats.financialCount}`)
    console.log(`   featured_tickers: ${stats.featuredCount}`)
  }

  console.log("=".repeat(60) + "\n")
}

main().catch(console.error)
