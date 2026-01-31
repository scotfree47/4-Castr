// src/lib/services/symbolResolver.ts
// CENTRALIZED SYMBOL NORMALIZATION & API FALLBACK SYSTEM

import { createClient } from "@supabase/supabase-js"

// Initialize Supabase client for server-side use
const getSupabaseAdmin = () => {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// ============================================================================
// SYMBOL VARIATION MAPPINGS
// ============================================================================

/**
 * Maps ticker symbol variations to canonical format
 * For crypto: Use CoinGecko ID as canonical (lowercase)
 * For forex: Use slash format as canonical
 * For commodities: Use futures notation as canonical
 */
const SYMBOL_VARIATIONS: Record<string, string[]> = {
  // Crypto - CoinGecko IDs are canonical
  bitcoin: ["Bitcoin", "bitcoin", "BTC", "btc", "BTC-USD", "BTCUSD"],
  ethereum: ["Ethereum", "ethereum", "ETH", "eth", "ETH-USD", "ETHUSD"],
  solana: ["Solana", "solana", "SOL", "sol", "SOL-USD", "SOLUSD"],
  binancecoin: ["binancecoin", "BNB", "bnb", "BNB-USD"],
  ripple: ["ripple", "XRP", "xrp", "XRP-USD"],
  cardano: ["Cardano", "cardano", "ADA", "ada", "ADA-USD"],
  polkadot: ["Polkadot", "polkadot", "DOT", "dot", "DOT-USD"],
  dogecoin: ["Dogecoin", "dogecoin", "DOGE", "doge", "DOGE-USD"],
  "avalanche-2": ["Avalanche", "avalanche-2", "AVAX", "avax", "AVAX-USD"],
  "matic-network": ["Polygon", "matic-network", "MATIC", "matic", "MATIC-USD"],
  chainlink: ["Chainlink", "chainlink", "LINK", "link", "LINK-USD"],
  uniswap: ["Uniswap", "uniswap", "UNI", "uni", "UNI-USD"],

  // Forex - slash format is canonical
  "EUR/USD": ["EURUSD", "EUR/USD", "EUR-USD", "eurusd"],
  "USD/JPY": ["USDJPY", "USD/JPY", "USD-JPY", "usdjpy"],
  "GBP/USD": ["GBPUSD", "GBP/USD", "GBP-USD", "gbpusd"],
  "GBP/JPY": ["GBPJPY", "GBP/JPY", "GBP-JPY", "gbpjpy"],
  "AUD/USD": ["AUDUSD", "AUD/USD", "AUD-USD", "audusd"],
  "USD/CAD": ["USDCAD", "USD/CAD", "USD-CAD", "usdcad"],
  "NZD/USD": ["NZDUSD", "NZD/USD", "NZD-USD", "nzdusd"],
  "EUR/GBP": ["EURGBP", "EUR/GBP", "EUR-GBP", "eurgbp"],

  // Commodities - futures notation is canonical
  "GC1!": ["GC", "GC=F", "GC1!", "GOLD"],
  "CL1!": ["CL", "CL=F", "CL1!", "CRUDEOIL"],
  "HG1!": ["HG", "HG=F", "HG1!", "COPPER"],
  "SI1!": ["SI", "SI=F", "SI1!", "SILVER"],
  "NG1!": ["NG", "NG=F", "NG1!", "NATGAS"],
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
 */
export function resolveSymbol(symbol: string): string {
  const canonical = VARIATION_TO_CANONICAL.get(symbol.toLowerCase())
  return canonical || symbol
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
 */
export async function queryPriceData(
  symbol: string,
  startDate: string,
  endDate: string
): Promise<any[]> {
  const supabase = getSupabaseAdmin()
  const canonical = resolveSymbol(symbol)
  const variations = getSymbolVariations(canonical)

  for (const variant of variations) {
    const { data, error } = await supabase
      .from("financial_data")
      .select("*")
      .eq("symbol", variant)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true })

    if (!error && data && data.length > 0) {
      return data
    }
  }

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
// TICKER UNIVERSE SYNC
// ============================================================================

/**
 * Syncs ticker_universe to match financial_data symbols
 */
export async function syncTickerUniverse(): Promise<void> {
  console.log("🔄 Syncing ticker_universe from financial_data...\n")
  const supabase = getSupabaseAdmin()

  const { data: priceSymbols, error } = await supabase
    .from("financial_data")
    .select("symbol, category")
    .limit(200000)

  if (error || !priceSymbols || priceSymbols.length === 0) {
    console.log("⚠️  No symbols found in financial_data")
    return
  }

  const uniqueSymbols = new Map<string, string>()
  priceSymbols.forEach((row: any) => {
    const canonical = resolveSymbol(row.symbol)
    if (!uniqueSymbols.has(canonical)) {
      uniqueSymbols.set(canonical, row.category)
    }
  })

  console.log(`📊 Found ${uniqueSymbols.size} unique symbols in financial_data`)

  const { data: existingTickers } = await supabase.from("ticker_universe").select("symbol")

  const existingSymbolSet = new Set(existingTickers?.map((t: any) => t.symbol) || [])

  const symbolsToAdd = Array.from(uniqueSymbols.entries())
    .filter(([symbol]) => !existingSymbolSet.has(symbol))
    .map(([symbol, category]) => ({
      symbol,
      category,
      name: symbol,
      exchange: category === "equity" ? "US" : category.toUpperCase(),
      asset_type: category,
      active: true,
      data_source: "financial_data",
      metadata: { variations: getSymbolVariations(symbol) },
    }))

  if (symbolsToAdd.length === 0) {
    console.log("✅ Ticker universe already in sync\n")
    return
  }

  console.log(`💾 Adding ${symbolsToAdd.length} new symbols to ticker_universe...`)
  for (let i = 0; i < symbolsToAdd.length; i += 500) {
    const batch = symbolsToAdd.slice(i, i + 500)
    await supabase.from("ticker_universe").upsert(batch, { onConflict: "symbol" })
    console.log(`   ✅ Batch ${Math.floor(i / 500) + 1}: ${batch.length} symbols`)
  }

  console.log(`\n✅ Ticker universe synced: ${symbolsToAdd.length} symbols added\n`)
}

// ============================================================================
// CATEGORY DETECTION
// ============================================================================

export function detectCategory(symbol: string): string {
  const normalized = symbol.toLowerCase()

  if (VARIATION_TO_CANONICAL.has(normalized)) {
    const canonical = VARIATION_TO_CANONICAL.get(normalized)!
    if (["bitcoin", "ethereum", "solana", "binancecoin"].includes(canonical)) {
      return "crypto"
    }
  }

  if (symbol.includes("/") || (symbol.length === 6 && /^[A-Z]{6}$/.test(symbol))) {
    return "forex"
  }

  if (symbol.includes("=F") || symbol.includes("1!")) {
    return "commodity"
  }

  if (["VIX", "MOVE", "TRIN", "SKEW"].includes(symbol.toUpperCase())) {
    return "stress"
  }

  if (["TLT", "TNX", "FEDFUNDS", "CPI"].includes(symbol.toUpperCase())) {
    return "rates-macro"
  }

  return "equity"
}

export { SYMBOL_VARIATIONS, VARIATION_TO_CANONICAL }
