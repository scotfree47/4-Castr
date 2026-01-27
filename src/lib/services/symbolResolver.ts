// src/lib/services/symbolResolver.ts
// CENTRALIZED SYMBOL NORMALIZATION & API FALLBACK SYSTEM

import { getSupabaseAdmin } from "@/lib/supabase"

// ============================================================================
// SYMBOL VARIATION MAPPINGS
// ============================================================================

/**
 * Maps ticker symbol variations to canonical format
 * Use UPPERCASE as canonical (matches most API providers)
 */
const SYMBOL_VARIATIONS: Record<string, string[]> = {
  // Crypto - multiple variations
  BTC: ["Bitcoin", "bitcoin", "BTC", "btc", "BTC-USD", "BTCUSD"],
  ETH: ["Ethereum", "ethereum", "ETH", "eth", "ETH-USD", "ETHUSD"],
  SOL: ["Solana", "solana", "SOL", "sol", "SOL-USD", "SOLUSD"],
  BNB: ["binancecoin", "BNB", "bnb", "BNB-USD"],
  XRP: ["ripple", "XRP", "xrp", "XRP-USD"],

  // Forex - slash vs no-slash variations
  "EUR/USD": ["EURUSD", "EUR/USD", "EUR-USD", "eurusd"],
  "USD/JPY": ["USDJPY", "USD/JPY", "USD-JPY", "usdjpy"],
  "GBP/USD": ["GBPUSD", "GBP/USD", "GBP-USD", "gbpusd"],
  "GBP/JPY": ["GBPJPY", "GBP/JPY", "GBP-JPY", "gbpjpy"],
  "AUD/USD": ["AUDUSD", "AUD/USD", "AUD-USD", "audusd"],
  "USD/CAD": ["USDCAD", "USD/CAD", "USD-CAD", "usdcad"],
  "NZD/USD": ["NZDUSD", "NZD/USD", "NZD-USD", "nzdusd"],
  "EUR/GBP": ["EURGBP", "EUR/GBP", "EUR-GBP", "eurgbp"],

  // Commodities - futures notation
  "GC1!": ["GC", "GC=F", "GC1!", "GOLD"],
  "CL1!": ["CL", "CL=F", "CL1!", "CRUDEOIL"],
  "HG1!": ["HG", "HG=F", "HG1!", "COPPER"],

  // Add more as needed...
}

/**
 * Reverse lookup: variation -> canonical
 * Auto-generated from SYMBOL_VARIATIONS
 */
const VARIATION_TO_CANONICAL = new Map<string, string>()
Object.entries(SYMBOL_VARIATIONS).forEach(([canonical, variations]) => {
  variations.forEach((variant) => {
    VARIATION_TO_CANONICAL.set(variant.toLowerCase(), canonical)
  })
  // Also map canonical to itself
  VARIATION_TO_CANONICAL.set(canonical.toLowerCase(), canonical)
})

// ============================================================================
// SYMBOL NORMALIZATION
// ============================================================================

/**
 * Resolves symbol variation to canonical format
 * @param symbol - Any symbol variation
 * @returns Canonical symbol (uppercase)
 */
export function resolveSymbol(symbol: string): string {
  const canonical = VARIATION_TO_CANONICAL.get(symbol.toLowerCase())
  return canonical || symbol.toUpperCase() // Default to uppercase if not in map
}

/**
 * Gets all variations for a canonical symbol
 */
export function getSymbolVariations(canonical: string): string[] {
  return SYMBOL_VARIATIONS[canonical] || [canonical]
}

/**
 * Batch resolve symbols
 */
export function resolveSymbols(symbols: string[]): string[] {
  return symbols.map(resolveSymbol)
}

// ============================================================================
// DATABASE QUERY WITH VARIATION FALLBACK
// ============================================================================

/**
 * Queries financial_data with automatic variation fallback
 * Tries canonical symbol first, then all variations
 */
export async function queryPriceData(
  symbol: string,
  startDate: string,
  endDate: string
): Promise<any[]> {
  const canonical = resolveSymbol(symbol)
  const variations = getSymbolVariations(canonical)

  // Try each variation until we get data
  for (const variant of variations) {
    const { data, error } = await getSupabaseAdmin()
      .from("financial_data")
      .select("*")
      .eq("symbol", variant)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true })

    if (!error && data && data.length > 0) {
      console.log(`   ✅ Found ${data.length} bars for ${symbol} (matched as: ${variant})`)
      return data
    }
  }

  console.log(`   ⚠️  No data found for ${symbol} (tried: ${variations.join(", ")})`)
  return []
}

/**
 * Batch query with variation fallback
 */
export async function batchQueryPriceData(
  symbols: string[],
  startDate: string,
  endDate: string
): Promise<Map<string, any[]>> {
  const results = new Map<string, any[]>()

  for (const symbol of symbols) {
    const data = await queryPriceData(symbol, startDate, endDate)
    results.set(symbol, data)
  }

  return results
}

// ============================================================================
// API PROVIDER WATERFALL
// ============================================================================

interface APIProvider {
  name: string
  categories: string[]
  priority: number
  fetch: (symbol: string, category: string) => Promise<number | null>
}

/**
 * Attempts to fetch current price with multi-provider fallback
 * @returns { price, provider } or null
 */
export async function fetchPriceWithFallback(
  symbol: string,
  category: string,
  providers: APIProvider[]
): Promise<{ price: number; provider: string } | null> {
  const canonical = resolveSymbol(symbol)
  const variations = getSymbolVariations(canonical)

  // Filter providers by category and sort by priority
  const availableProviders = providers
    .filter((p) => p.categories.includes(category))
    .sort((a, b) => a.priority - b.priority)

  // Try each provider with each variation
  for (const provider of availableProviders) {
    for (const variant of variations) {
      try {
        const price = await provider.fetch(variant, category)
        if (price && price > 0) {
          console.log(`   ✅ ${symbol}: $${price.toFixed(2)} (${provider.name} as ${variant})`)
          return { price, provider: provider.name }
        }
      } catch (error) {
        // Silent fail, try next provider
        continue
      }
    }
  }

  // Final fallback: check database
  console.log(`   🔍 API fallback failed, checking database for ${symbol}...`)
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  const today = new Date().toISOString().split("T")[0]

  const dbData = await queryPriceData(symbol, yesterday, today)
  if (dbData.length > 0) {
    const latestPrice = dbData[dbData.length - 1].close
    console.log(`   ✅ ${symbol}: $${latestPrice.toFixed(2)} (database)`)
    return { price: latestPrice, provider: "database" }
  }

  console.log(`   ❌ ${symbol}: No data available from any source`)
  return null
}

// ============================================================================
// TICKER UNIVERSE SYNC
// ============================================================================

/**
 * Syncs ticker_universe to match financial_data symbols
 * Ensures 1:1 mapping between tables
 */
export async function syncTickerUniverse(): Promise<void> {
  console.log("🔄 Syncing ticker_universe from financial_data...\n")

  // Get all unique symbols from financial_data
  const { data: priceSymbols, error } = await getSupabaseAdmin()
    .from("financial_data")
    .select("symbol, category")
    .limit(200000) // Increase limit to get all

  if (error) {
    console.error("❌ Error querying financial_data:", error)
    return
  }

  if (!priceSymbols || priceSymbols.length === 0) {
    console.log("⚠️  No symbols found in financial_data")
    return
  }

  // Deduplicate and group by symbol
  const uniqueSymbols = new Map<string, string>()
  priceSymbols.forEach((row: any) => {
    const canonical = resolveSymbol(row.symbol)
    if (!uniqueSymbols.has(canonical)) {
      uniqueSymbols.set(canonical, row.category)
    }
  })

  console.log(`📊 Found ${uniqueSymbols.size} unique symbols in financial_data`)

  // Clear ticker_universe (backup first!)
  console.log("🗑️  Clearing ticker_universe...")
  await getSupabaseAdmin().from("ticker_universe").delete().neq("symbol", "")

  // Build new records
  const records = Array.from(uniqueSymbols.entries()).map(([symbol, category]) => ({
    symbol,
    category,
    name: symbol,
    exchange: category === "equity" ? "US" : category.toUpperCase(),
    asset_type: category,
    active: true,
    data_source: "financial_data",
    metadata: {
      variations: getSymbolVariations(symbol),
    },
  }))

  // Batch insert
  console.log(`💾 Inserting ${records.length} symbols into ticker_universe...`)
  for (let i = 0; i < records.length; i += 500) {
    const batch = records.slice(i, i + 500)
    const { error: insertError } = await getSupabaseAdmin()
      .from("ticker_universe")
      .insert(batch)

    if (insertError) {
      console.error(`❌ Error inserting batch ${i / 500 + 1}:`, insertError.message)
    } else {
      console.log(`   ✅ Batch ${Math.floor(i / 500) + 1}: ${batch.length} symbols`)
    }
  }

  console.log(`\n✅ Ticker universe synced: ${records.length} symbols\n`)
}

// ============================================================================
// CATEGORY DETECTION
// ============================================================================

/**
 * Auto-detects category from symbol format
 */
export function detectCategory(symbol: string): string {
  const normalized = symbol.toUpperCase()

  // Crypto patterns
  if (
    ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "DOT", "AVAX", "MATIC"].includes(normalized) ||
    symbol.toLowerCase().includes("coin") ||
    VARIATION_TO_CANONICAL.get(symbol.toLowerCase())?.match(/^(BTC|ETH|SOL|BNB|XRP)$/)
  ) {
    return "crypto"
  }

  // Forex patterns (contains /)
  if (symbol.includes("/") || symbol.length === 6) {
    return "forex"
  }

  // Futures patterns (contains = or !)
  if (symbol.includes("=F") || symbol.includes("1!")) {
    return "commodity"
  }

  // Stress indicators
  if (["VIX", "MOVE", "TRIN", "SKEW"].includes(normalized)) {
    return "stress"
  }

  // Macro indicators
  if (["TLT", "DXY", "TNX", "FEDFUNDS", "CPI", "PPI"].includes(normalized)) {
    return "rates-macro"
  }

  // Default to equity
  return "equity"
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  SYMBOL_VARIATIONS,
  VARIATION_TO_CANONICAL,
}
