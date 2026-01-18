// scripts/populate-featured-tickers.js
// Run from project root: node scripts/populate-featured-tickers.js

import fs from "fs"
import path from "path"
import Papa from "papaparse"
import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, "..", ".env.local") })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// CSV paths
const SCORES_CSV = path.join(
  __dirname,
  "..",
  "csv-pull",
  "market-data",
  "data",
  "scores",
  "confidence_scores_20251231.csv"
)
const PRICE_CSVS = {
  equity: path.join(
    __dirname,
    "..",
    "csv-pull",
    "market-data",
    "data",
    "unintegrated",
    "equities",
    "equities_solstice_equinox.csv"
  ),
  commodities: path.join(
    __dirname,
    "..",
    "csv-pull",
    "market-data",
    "data",
    "unintegrated",
    "commodities",
    "commodities_solstice_equinox.csv"
  ),
  crypto: path.join(
    __dirname,
    "..",
    "csv-pull",
    "market-data",
    "data",
    "unintegrated",
    "crypto",
    "crypto_solstice_equinox.csv"
  ),
  forex: path.join(
    __dirname,
    "..",
    "csv-pull",
    "market-data",
    "data",
    "unintegrated",
    "forex",
    "forex_solstice_equinox.csv"
  ),
}

// Category mappings
const CATEGORY_MAP = {
  equity: ["SPY", "QQQ", "XLY"],
  commodities: ["GLD", "USO", "HG1!", "GC1!", "CL1!", "COTTON", "WHEAT", "CORN", "SUGAR", "COFFEE"],
  crypto: ["Bitcoin", "Ethereum", "Solana", "BNB", "XRP"],
  forex: ["EUR/USD", "USD/JPY", "GBP/USD", "GBP/JPY", "AUD/USD"],
  "rates-macro": ["TLT", "FEDFUNDS", "CPI"],
  stress: ["VIX", "MOVE", "TRIN"],
}

function parseCSV(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  CSV not found: ${filePath}`)
    return []
  }

  const content = fs.readFileSync(filePath, "utf-8")
  const parsed = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
    comments: "//",
  })

  return parsed.data.filter((row) => row.symbol || row.Symbol)
}

// Get latest price for a symbol from CSV
function getLatestPrice(symbol, category) {
  const categoryKey = category === "commodities" ? "commodities" : category
  const csvPath = PRICE_CSVS[categoryKey]

  if (!csvPath || !fs.existsSync(csvPath)) {
    console.warn(`⚠️  No price CSV for ${category}`)
    return null
  }

  const data = parseCSV(csvPath)

  // Find all records for this symbol
  const symbolData = data.filter((row) => {
    const rowSymbol = row.Symbol || row.Commodity || row.Pair
    return rowSymbol === symbol
  })

  if (symbolData.length === 0) return null

  // Get most recent date
  const sorted = symbolData.sort((a, b) => new Date(b.Date) - new Date(a.Date))
  const latest = sorted[0]

  return {
    price: latest.Close || latest.Price || latest.Rate || 0,
    date: latest.Date,
  }
}

async function populateFeaturedTickers() {
  console.log("🚀 Starting featured tickers population...\n")

  // 1. Read confidence scores
  const scores = parseCSV(SCORES_CSV)
  console.log(`✓ Loaded ${scores.length} confidence scores\n`)

  if (scores.length === 0) {
    console.error("❌ No scores found in CSV")
    return
  }

  // 2. Clear existing data
  console.log("🗑️  Clearing old featured_tickers data...")
  const { error: deleteError } = await supabase.from("featured_tickers").delete().neq("id", 0) // Delete all

  if (deleteError) console.warn("⚠️  Delete warning:", deleteError.message)

  // 3. Process each category
  const allRecords = []

  for (const [category, symbols] of Object.entries(CATEGORY_MAP)) {
    console.log(`\n📊 Processing ${category}...`)

    // Filter scores for this category
    const categoryScores = scores
      .filter((row) => {
        const symbol = row.symbol
        return symbols.includes(symbol)
      })
      .sort((a, b) => (b.total_score || 0) - (a.total_score || 0))
      .slice(0, 10) // Top 10

    console.log(`  Found ${categoryScores.length} symbols`)

    for (let i = 0; i < categoryScores.length; i++) {
      const score = categoryScores[i]
      const priceData = getLatestPrice(score.symbol, category)

      if (!priceData) {
        console.warn(`  ⚠️  No price for ${score.symbol}`)
        continue
      }

      // Mock key level data (you'll replace this with real Fibonacci levels later)
      const mockNextLevel = {
        price: priceData.price * 1.05, // 5% above current
        type: "resistance",
        distancePercent: 5.0,
      }

      const record = {
        symbol: score.symbol,
        category: category,
        sector: score.sector || "Unknown",
        current_price: priceData.price,
        next_key_level_price: mockNextLevel.price,
        next_key_level_type: mockNextLevel.type,
        distance_percent: mockNextLevel.distancePercent,
        confluence_score: score.total_score || 0,
        tradeability_score: (score.total_score || 0) * 0.8, // Mock calc
        reason: `Top ${i + 1} by confluence`,
        rank: i + 1,
        last_updated: new Date().toISOString(),
      }

      allRecords.push(record)
      console.log(
        `  ✓ ${score.symbol}: $${priceData.price.toFixed(2)} | Score: ${score.total_score}`
      )
    }
  }

  // 4. Insert into Supabase
  console.log(`\n📥 Inserting ${allRecords.length} records into Supabase...`)

  const { data, error } = await supabase.from("featured_tickers").insert(allRecords).select()

  if (error) {
    console.error("❌ Insert error:", error)
    return
  }

  console.log(`\n✅ Successfully inserted ${data.length} featured tickers!`)

  // Show sample
  console.log("\n📋 Sample records:")
  data.slice(0, 3).forEach((r) => {
    console.log(`  ${r.symbol} (${r.category}): $${r.current_price} → Rank ${r.rank}`)
  })
}

// Run it
populateFeaturedTickers()
  .then(() => {
    console.log("\n🎉 Done!")
    process.exit(0)
  })
  .catch((err) => {
    console.error("\n❌ Fatal error:", err)
    process.exit(1)
  })
