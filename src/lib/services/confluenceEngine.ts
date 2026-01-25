// lib/services/confluenceEngine.ts
// UNIFIED VERSION: Combines featured ticker selection + comprehensive rating

import {
  calculateEnhancedLevels,
  getUpcomingSeasonalDates,
  type OHLCVBar,
} from "@/lib/indicators/keyLevels"
import { getSupabaseAdmin } from "@/lib/supabase"
import { RSI, MACD, BollingerBands, EMA, ATR, OBV } from "technicalindicators"

// ============================================================================
// CONFIGURATION
// ============================================================================

const ALL_TICKERS = {
  equity: ["SPY", "QQQ", "XLY", "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA"],
  commodity: ["GLD", "USO", "HG1!", "GC1!", "CL1!", "COTTON", "WHEAT", "CORN", "SUGAR", "COFFEE"],
  crypto: ["Bitcoin", "Ethereum", "Solana", "BNB", "XRP"],
  forex: ["EUR/USD", "USD/JPY", "GBP/USD", "GBP/JPY", "AUD/USD"],
  "rates-macro": ["TLT", "FEDFUNDS", "CPI"],
  stress: ["VIX", "MOVE", "TRIN"],
}

const SENTINELS = new Set([
  "SPY",
  "QQQ",
  "XLY",
  "GLD",
  "USO",
  "HG1!",
  "EUR/USD",
  "USD/JPY",
  "GBP/USD",
  "Bitcoin",
  "Ethereum",
  "Solana",
  "TLT",
  "FEDFUNDS",
  "CPI",
  "MOVE",
  "TRIN",
])

// ============================================================================
// TYPES
// ============================================================================

export interface TickerRating {
  symbol: string
  category: string
  sector: string
  currentPrice: number
  priceDate: string
  dataPoints: number
  nextKeyLevel: {
    price: number
    type: "support" | "resistance"
    distancePercent: number
    distancePoints: number
    daysUntilEstimate: number
    confidence: number
  }
  scores: {
    confluence: number
    proximity: number
    momentum: number
    seasonal: number
    aspectAlignment: number
    volatility: number
    trend: number
    volume: number
    technical: number
    fundamental: number
    total: number
  }
  rating: "A+" | "A" | "B+" | "B" | "C+" | "C" | "D" | "F"
  confidence: "very_high" | "high" | "medium" | "low" | "very_low"
  recommendation: "strong_buy" | "buy" | "hold" | "sell" | "strong_sell"
  ingressAlignment: {
    sign: string
    daysRemaining: number
    favorability: "very_favorable" | "favorable" | "neutral" | "unfavorable"
  }
  reasons: string[]
  warnings: string[]
  projections: {
    reachDate: string
    probability: number
    confidenceInterval: {
      earliest: string
      mostLikely: string
      latest: string
    }
  }
  rank?: number
  confluenceScore?: number
  tradeabilityScore?: number
  reason?: string
}

// ============================================================================
// CORE CALCULATION
// ============================================================================

export async function calculateTickerRating(
  symbol: string,
  category: string,
  options: {
    lookbackDays?: number
    includeProjections?: boolean
    includeSeasonalData?: boolean
  } = {}
): Promise<TickerRating | null> {
  try {
    const { lookbackDays = 1095, includeProjections = true, includeSeasonalData = true } = options

    const ingressPeriod = await getCurrentIngressPeriod()
    const endDate = new Date().toISOString().split("T")[0]
    const startDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0]

    const symbolVariants = mapSymbolToDBFormat(symbol)
    let priceRecords = null

    for (const variant of symbolVariants) {
      const result = await getSupabaseAdmin()
        .from("financial_data")
        .select("*")
        .eq("symbol", variant)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: true })

      if (result.data && result.data.length > 0) {
        priceRecords = result.data
        break
      }
    }

    if (!priceRecords || priceRecords.length === 0) return null

    const bars: OHLCVBar[] = priceRecords.map((d: any) => ({
      time: new Date(d.date).getTime(),
      open: d.open || d.close,
      high: d.high || d.close,
      low: d.low || d.close,
      close: d.close,
      volume: d.volume || 0,
    }))

    const currentPrice = bars[bars.length - 1].close
    const priceDate = priceRecords[priceRecords.length - 1].date

    const analysis = calculateEnhancedLevels(bars, currentPrice, {
      swingLength: 20,
      pivotBars: 5,
      currentTime: Date.now(),
      includeGannSquare144: false,
      includeSeasonalDates: includeSeasonalData,
    })

    const allLevels = [
      ...analysis.gannOctaves,
      ...analysis.fibonacci,
      ...analysis.supportResistance.map((sr) => ({
        price: sr.price,
        type: sr.type,
        label: sr.type,
        strength: sr.strength / 10,
      })),
    ]

    const resistances = allLevels
      .filter((l) => l.price > currentPrice)
      .sort((a, b) => a.price - b.price)

    const supports = allLevels
      .filter((l) => l.price < currentPrice)
      .sort((a, b) => b.price - a.price)

    const nextLevel = !resistances[0]
      ? supports[0]
      : !supports[0]
        ? resistances[0]
        : Math.abs(resistances[0].price - currentPrice) < Math.abs(supports[0].price - currentPrice)
          ? resistances[0]
          : supports[0]

    if (!nextLevel) return null

    const distancePoints = Math.abs(nextLevel.price - currentPrice)
    const distancePercent = (distancePoints / currentPrice) * 100
    const levelType = nextLevel.price > currentPrice ? "resistance" : "support"

    const nearbyLevels = allLevels.filter(
      (l) => Math.abs(l.price - nextLevel.price) < currentPrice * 0.005
    )
    const confluenceScore = Math.min(100, nearbyLevels.length * 15)
    const proximityScore = Math.max(0, 100 - distancePercent * 10)
    const momentumScore = calculateMomentumScore(bars, nextLevel.price, levelType)
    const volatilityScore = calculateVolatilityScore(bars)
    const trendScore = calculateTrendScore(bars)
    const volumeScore = calculateVolumeScore(bars, levelType)

    let seasonalScore = 50
    let aspectScore = 50
    if (includeSeasonalData) {
      seasonalScore = await calculateSeasonalScore(Date.now(), ingressPeriod.end)
      const lastBarDate = new Date(bars[bars.length - 1].time).toISOString().split("T")[0]
      aspectScore = await calculateAspectScore(lastBarDate, 30)
    }

    const technicalScore =
      confluenceScore * 0.3 +
      proximityScore * 0.25 +
      momentumScore * 0.2 +
      trendScore * 0.15 +
      volatilityScore * 0.1

    const fundamentalScore = seasonalScore * 0.35 + aspectScore * 0.45 + volumeScore * 0.2
    const totalScore = technicalScore * 0.7 + fundamentalScore * 0.3

    const rating =
      totalScore >= 95
        ? "A+"
        : totalScore >= 90
          ? "A"
          : totalScore >= 85
            ? "B+"
            : totalScore >= 80
              ? "B"
              : totalScore >= 70
                ? "C+"
                : totalScore >= 60
                  ? "C"
                  : totalScore >= 50
                    ? "D"
                    : "F"

    const confidence =
      totalScore >= 90
        ? "very_high"
        : totalScore >= 75
          ? "high"
          : totalScore >= 60
            ? "medium"
            : totalScore >= 40
              ? "low"
              : "very_low"

    const recommendation =
      totalScore >= 85 && levelType === "resistance"
        ? "strong_buy"
        : totalScore >= 70 && levelType === "resistance"
          ? "buy"
          : totalScore >= 85 && levelType === "support"
            ? "strong_sell"
            : totalScore >= 70 && levelType === "support"
              ? "sell"
              : "hold"

    const reasons: string[] = []
    const warnings: string[] = []

    if (confluenceScore >= 75) reasons.push(`Strong confluence (${nearbyLevels.length} indicators)`)
    if (proximityScore >= 75) reasons.push(`Close proximity (${distancePercent.toFixed(1)}%)`)
    if (momentumScore >= 75) reasons.push("Favorable momentum")
    if (trendScore >= 75) reasons.push("Aligned with trend")
    if (seasonalScore >= 75) reasons.push("Strong seasonal alignment")
    if (volumeScore >= 75) reasons.push("Volume supporting move")

    if (distancePercent > 5) warnings.push("Target is relatively far")
    if (volatilityScore < 40) warnings.push("Low volatility may slow movement")
    if (trendScore < 40) warnings.push("Moving against trend")

    const avgDailyMove =
      bars.slice(-20).reduce((sum, bar, idx, arr) => {
        if (idx === 0) return 0
        return sum + Math.abs(bar.close - arr[idx - 1].close)
      }, 0) / 19

    const daysUntil = Math.ceil(distancePoints / avgDailyMove)

    const projections = {
      reachDate: new Date(Date.now() + daysUntil * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      probability: totalScore / 100,
      confidenceInterval: {
        earliest: new Date(Date.now() + daysUntil * 0.5 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
        mostLikely: new Date(Date.now() + daysUntil * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
        latest: new Date(Date.now() + daysUntil * 2 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
      },
    }

    const favorability: "very_favorable" | "favorable" | "neutral" | "unfavorable" =
      seasonalScore >= 80
        ? "very_favorable"
        : seasonalScore >= 65
          ? "favorable"
          : seasonalScore >= 45
            ? "neutral"
            : "unfavorable"

    const ingressAlignment = {
      sign: ingressPeriod.sign,
      daysRemaining: ingressPeriod.daysRemaining,
      favorability,
    }

    return {
      symbol,
      category,
      sector: determineSector(symbol, category),
      currentPrice,
      priceDate,
      dataPoints: bars.length,
      nextKeyLevel: {
        price: nextLevel.price,
        type: levelType,
        distancePercent,
        distancePoints,
        daysUntilEstimate: daysUntil,
        confidence: totalScore / 100,
      },
      scores: {
        confluence: Math.round(confluenceScore),
        proximity: Math.round(proximityScore),
        momentum: Math.round(momentumScore),
        seasonal: Math.round(seasonalScore),
        aspectAlignment: Math.round(aspectScore),
        volatility: Math.round(volatilityScore),
        trend: Math.round(trendScore),
        volume: Math.round(volumeScore),
        technical: Math.round(technicalScore),
        fundamental: Math.round(fundamentalScore),
        total: Math.round(totalScore),
      },
      rating,
      confidence,
      recommendation,
      ingressAlignment,
      reasons,
      warnings,
      projections,
      rank: 0,
      confluenceScore: Math.round(confluenceScore),
      tradeabilityScore: Math.round(totalScore),
      reason: reasons.length > 0 ? reasons.join("; ") : "Standard technical setup",
    }
  } catch (error) {
    console.error(`Error calculating rating for ${symbol}:`, error)
    return null
  }
}

// ============================================================================
// BULK DATA FETCHING (Consolidated from dataService)
// ============================================================================

export interface PriceDataPoint {
  symbol: string
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

/**
 * Fetch price history for multiple symbols in ONE query
 * Use this for chart-data optimization
 */
export async function fetchBulkPriceHistory(
  symbols: string[],
  startDate: string,
  endDate: string
): Promise<Map<string, PriceDataPoint[]>> {
  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase
    .from("financial_data")
    .select("symbol, date, open, high, low, close, volume")
    .in("symbol", symbols)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true })

  if (error) throw new Error(`Price fetch failed: ${error.message}`)

  // Group by symbol
  const priceMap = new Map<string, PriceDataPoint[]>()

  data?.forEach((point: PriceDataPoint) => {
    if (!priceMap.has(point.symbol)) {
      priceMap.set(point.symbol, [])
    }
    priceMap.get(point.symbol)!.push(point)
  })

  return priceMap
}

/**
 * Get latest price for each symbol (used by sentinels)
 */
export async function fetchLatestPrices(symbols: string[]): Promise<Map<string, number>> {
  const supabase = getSupabaseAdmin()

  const { data } = await supabase
    .from("financial_data")
    .select("symbol, close, date")
    .in("symbol", symbols)
    .order("date", { ascending: false })

  const priceMap = new Map<string, number>()

  data?.forEach((point: { symbol: string; close: number; date: string }) => {
    if (!priceMap.has(point.symbol)) {
      priceMap.set(point.symbol, point.close)
    }
  })

  return priceMap
}

/**
 * Get active tickers from ticker_universe
 */
export async function fetchTickersByCategory(
  category?: string,
  limit: number = 100
): Promise<any[]> {
  const supabase = getSupabaseAdmin()

  let query = supabase.from("ticker_universe").select("*").eq("active", true)

  if (category) {
    query = query.eq("category", category)
  }

  const { data, error } = await query.limit(limit)

  if (error) throw new Error(`Ticker fetch failed: ${error.message}`)

  return data || []
}

// ============================================================================
// BATCH PROCESSING
// ============================================================================

export async function batchCalculateRatings(
  options: {
    categories?: string[]
    symbols?: string[]
    minScore?: number
    maxResults?: number
    lookbackDays?: number
    includeProjections?: boolean
    includeSeasonalData?: boolean
    parallelism?: number
  } = {}
): Promise<TickerRating[]> {
  const {
    categories,
    symbols,
    minScore = 0,
    maxResults = 1000,
    lookbackDays = 1095,
    includeProjections = true,
    includeSeasonalData = true,
    parallelism = 5,
  } = options

  let tickersToAnalyze: Array<{ symbol: string; category: string }> = []

  if (symbols && symbols.length > 0) {
    // Specific symbols provided - look up category from database or fallback to ALL_TICKERS
    for (const symbol of symbols) {
      let category =
        Object.entries(ALL_TICKERS).find(([cat, syms]) => syms.includes(symbol))?.[0] || "unknown"

      // Try to get category from ticker_universe table
      try {
        const { data } = await getSupabaseAdmin()
          .from("ticker_universe")
          .select("category")
          .eq("symbol", symbol)
          .single()

        if (data?.category) {
          category = data.category
        }
      } catch (e) {
        // Fallback to hardcoded category or "unknown"
      }

      tickersToAnalyze.push({ symbol, category })
    }
  } else if (categories && categories.length > 0) {
    // Categories provided - fetch from database
    for (const category of categories) {
      try {
        const tickersFromDb = await fetchTickersByCategory(category, maxResults)
        const dbSymbols = tickersFromDb.map((t: any) => ({ symbol: t.symbol, category }))
        tickersToAnalyze.push(...dbSymbols)
        console.log(`   Loaded ${dbSymbols.length} ${category} tickers from database`)
      } catch (error) {
        console.warn(`   Failed to load ${category} from database, using fallback`)
        // Fallback to hardcoded list if database query fails
        const syms = ALL_TICKERS[category as keyof typeof ALL_TICKERS] || []
        tickersToAnalyze.push(...syms.map((s: string) => ({ symbol: s, category })))
      }
    }
  } else {
    // No filters - get all tickers from database
    const allCategories = ["equity", "commodity", "forex", "crypto", "rates-macro", "stress"]
    for (const category of allCategories) {
      try {
        const tickersFromDb = await fetchTickersByCategory(category, maxResults)
        const dbSymbols = tickersFromDb.map((t: any) => ({ symbol: t.symbol, category }))
        tickersToAnalyze.push(...dbSymbols)
        console.log(`   Loaded ${dbSymbols.length} ${category} tickers from database`)
      } catch (error) {
        console.warn(`   Failed to load ${category} from database, using fallback`)
        const syms = ALL_TICKERS[category as keyof typeof ALL_TICKERS] || []
        tickersToAnalyze.push(...syms.map((s: string) => ({ symbol: s, category })))
      }
    }
  }

  console.log(`📊 Batch rating ${tickersToAnalyze.length} tickers from ticker_universe...`)

  const results: TickerRating[] = []

  for (let i = 0; i < tickersToAnalyze.length; i += parallelism) {
    const batch = tickersToAnalyze.slice(i, i + parallelism)

    const batchResults = await Promise.all(
      batch.map(({ symbol, category }) =>
        calculateTickerRating(symbol, category, {
          lookbackDays,
          includeProjections,
          includeSeasonalData,
        })
      )
    )

    results.push(...batchResults.filter((r): r is TickerRating => r !== null))

    console.log(
      `   Progress: ${Math.min(i + parallelism, tickersToAnalyze.length)}/${tickersToAnalyze.length}`
    )
  }

  const filtered = results
    .filter((r) => r.scores.total >= minScore)
    .sort((a, b) => b.scores.total - a.scores.total)
    .slice(0, maxResults)

  console.log(`✅ Completed: ${filtered.length} ratings`)

  return filtered
}

// ============================================================================
// FEATURED TICKERS
// ============================================================================

export async function calculateAllFeaturedTickers(): Promise<{
  equity: TickerRating[]
  commodity: TickerRating[]
  forex: TickerRating[]
  crypto: TickerRating[]
  "rates-macro": TickerRating[]
  stress: TickerRating[]
}> {
  console.log("🚀 Calculating featured tickers across all categories from ticker_universe...")

  const results: Record<string, TickerRating[]> = {}
  const categories = ["equity", "commodity", "forex", "crypto", "rates-macro", "stress"]

  for (const category of categories) {
    try {
      // Fetch tickers from database instead of hardcoded list
      const tickersFromDb = await fetchTickersByCategory(category, 1000)

      // Get symbols and filter out sentinels
      const symbols = tickersFromDb.map((t: any) => t.symbol)
      const nonSentinels = symbols.filter((s: string) => !SENTINELS.has(s))

      if (nonSentinels.length === 0) {
        console.log(`\n⚠️ ${category}: No active tickers in database`)
        results[category] = []
        continue
      }

      console.log(`\n📈 Processing ${category}: ${nonSentinels.length} symbols from database`)

      const ratings = await batchCalculateRatings({
        symbols: nonSentinels,
        minScore: 50,
        maxResults: 10,
        parallelism: 5,
      })

      results[category] = ratings.map((r, index) => ({
        ...r,
        rank: index + 1,
      }))

      console.log(`   ✅ ${category}: ${ratings.length} qualified`)
    } catch (error: any) {
      console.error(`   ❌ ${category} failed:`, error.message)
      results[category] = []
    }
  }

  return results as any
}

/**
 * Fetch pre-computed featured tickers from database
 */
export async function fetchFeaturedTickersFromCache(category?: string): Promise<any[]> {
  try {
    let query = getSupabaseAdmin()
      .from("featured_tickers")
      .select("*")
      .order("rank", { ascending: true })

    if (category) {
      query = query.eq("category", category)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching cached featured tickers:", error)
      return []
    }

    return data || []
  } catch (error) {
    console.error("Error fetching featured tickers from cache:", error)
    return []
  }
}

export async function storeFeaturedTickers(featured: TickerRating[]): Promise<void> {
  if (!featured || featured.length === 0) return

  try {
    const rows = featured.map((f) => ({
      symbol: f.symbol,
      category: f.category,
      sector: f.sector,
      current_price: f.currentPrice,
      next_key_level_price: f.nextKeyLevel.price,
      next_key_level_type: f.nextKeyLevel.type,
      distance_percent: f.nextKeyLevel.distancePercent,
      days_until: f.nextKeyLevel.daysUntilEstimate,
      confluence_score: f.scores.confluence,
      tradeability_score: f.scores.total,
      reason: f.reason || f.reasons.join("; "),
      rank: f.rank || 0,
      updated_at: new Date().toISOString(),
    }))

    const categories = [...new Set(featured.map((f) => f.category))]

    for (const category of categories) {
      await getSupabaseAdmin().from("featured_tickers").delete().eq("category", category)
    }

    for (const row of rows) {
      await getSupabaseAdmin().from("featured_tickers").insert([row])
    }

    console.log(`✅ Stored ${rows.length} featured tickers`)
  } catch (error) {
    console.error("Error storing featured tickers:", error)
    throw error
  }
}

export async function shouldRefreshFeatured(): Promise<{
  shouldRefresh: boolean
  reason: string
}> {
  try {
    const today = new Date().toISOString().split("T")[0]

    const { data: ingressData, error } = await getSupabaseAdmin()
      .from("astro_events")
      .select("*")
      .eq("event_type", "ingress")
      .eq("body", "Sun")
      .lte("date", today)
      .order("date", { ascending: false })
      .limit(2)

    if (error || !ingressData || ingressData.length === 0) {
      return { shouldRefresh: false, reason: "No ingress data" }
    }

    const currentIngress = ingressData[0]
    const now = new Date()
    const periodStart = new Date(currentIngress.date)
    const daysSincePeriodStart = Math.floor(
      (now.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
    )

    if (daysSincePeriodStart === 0) {
      return { shouldRefresh: true, reason: "New ingress period started" }
    }

    if (daysSincePeriodStart % 7 === 0 && daysSincePeriodStart > 0) {
      return { shouldRefresh: true, reason: "Weekly refresh" }
    }

    const { data: lastUpdate } = await getSupabaseAdmin()
      .from("featured_tickers")
      .select("updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single()

    if (!lastUpdate) {
      return { shouldRefresh: true, reason: "No existing data" }
    }

    const lastUpdateDate = new Date(lastUpdate.updated_at)
    const hoursSinceUpdate = Math.floor(
      (now.getTime() - lastUpdateDate.getTime()) / (1000 * 60 * 60)
    )

    if (hoursSinceUpdate >= 24) {
      return { shouldRefresh: true, reason: "Data older than 24 hours" }
    }

    return { shouldRefresh: false, reason: "No refresh needed" }
  } catch (error) {
    console.error("Error checking refresh:", error)
    return { shouldRefresh: false, reason: "Error checking" }
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function mapSymbolToDBFormat(symbol: string): string[] {
  const cryptoMap: Record<string, string> = {
    BTC: "bitcoin",
    ETH: "ethereum",
    BNB: "binancecoin",
    XRP: "ripple",
    BCH: "bitcoin-cash",
    SOL: "solana",
    ADA: "cardano",
    DOT: "polkadot",
    LINK: "chainlink",
    XLM: "stellar",
    Bitcoin: "bitcoin",
    Ethereum: "ethereum",
    Solana: "solana",
  }

  if (cryptoMap[symbol]) return [cryptoMap[symbol], symbol]
  if (symbol.includes("/")) return [symbol, symbol.replace("/", "")]
  if (symbol.length === 6 && /^[A-Z]{6}$/.test(symbol)) {
    return [symbol, `${symbol.slice(0, 3)}/${symbol.slice(3, 6)}`]
  }

  return [symbol]
}

function determineSector(symbol: string, category: string): string {
  const SECTOR_MAP: Record<string, string> = {
    AAPL: "technology",
    MSFT: "technology",
    NVDA: "technology",
    JPM: "finance",
    BAC: "finance",
    GS: "finance",
    JNJ: "healthcare",
    UNH: "healthcare",
    PFE: "healthcare",
    XOM: "energy",
    CVX: "energy",
    AMZN: "consumer",
    TSLA: "consumer",
    WMT: "consumer",
  }

  if (SECTOR_MAP[symbol]) return SECTOR_MAP[symbol]
  if (category === "commodity") return "commodities"
  if (category === "crypto") return "cryptocurrency"
  if (category === "forex") return "currency"
  if (category === "rates-macro") return "macro"
  if (category === "stress") return "volatility"

  return "unknown"
}

async function getCurrentIngressPeriod() {
  const today = new Date().toISOString().split("T")[0]

  const { data } = await getSupabaseAdmin()
    .from("astro_events")
    .select("*")
    .eq("event_type", "ingress")
    .eq("body", "Sun")
    .lte("date", today)
    .order("date", { ascending: false })
    .limit(1)

  if (!data || data.length === 0) {
    const now = new Date()
    const future = new Date(now)
    future.setDate(now.getDate() + 30)

    return {
      start: now.toISOString().split("T")[0],
      end: future.toISOString().split("T")[0],
      sign: "Unknown",
      daysRemaining: 30,
    }
  }

  const current = data[0]
  const currentDate = new Date(current.date)
  const nextDate = new Date(currentDate)
  nextDate.setDate(currentDate.getDate() + 30)

  const now = new Date()
  const daysRemaining = Math.floor((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  return {
    start: current.date,
    end: nextDate.toISOString().split("T")[0],
    sign: current.sign || "Unknown",
    daysRemaining,
  }
}

function calculateMomentumScore(
  bars: OHLCVBar[],
  targetPrice: number,
  targetType: "support" | "resistance"
): number {
  // Minimum bars check: 26 for MACD, fallback to simple logic if insufficient
  if (bars.length < 26) {
    if (bars.length < 5) return 50

    // Fallback: Use original simple momentum logic
    const recent = bars.slice(-5)
    const currentPrice = recent[recent.length - 1].close
    const startPrice = recent[0].close
    const priceChange = currentPrice - startPrice
    const direction = priceChange > 0 ? "up" : "down"

    if (
      (targetType === "resistance" && direction === "up") ||
      (targetType === "support" && direction === "down")
    ) {
      const momentum = Math.abs(priceChange / startPrice) * 100
      return Math.min(100, 50 + momentum * 10)
    }

    const momentum = Math.abs(priceChange / startPrice) * 100
    return Math.max(0, 50 - momentum * 10)
  }

  try {
    const closes = bars.map((b) => b.close)
    const currentPrice = closes[closes.length - 1]

    // RSI: 0-100 scale (directly usable)
    // 50 = neutral, >70 = overbought, <30 = oversold
    const rsiValues = RSI.calculate({ values: closes, period: 14 })
    if (!rsiValues || rsiValues.length === 0) {
      console.warn("[Momentum] RSI calculation failed - using fallback")
      return 50
    }
    const rsi = rsiValues[rsiValues.length - 1]

    // MACD histogram: normalize to 0-100
    const macdValues = MACD.calculate({
      values: closes,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    })
    if (!macdValues || macdValues.length === 0) {
      console.warn("[Momentum] MACD calculation failed - using RSI only")
      return Math.round(Math.max(0, Math.min(100, rsi)))
    }

    const macdLast = macdValues[macdValues.length - 1]
    const histogram = macdLast.histogram ?? 0

    // Normalize histogram to -2 to +2 range (as percentage of price)
    const normalizedHist = Math.max(-2, Math.min(2, histogram / (currentPrice * 0.01)))
    const macdScore = 50 + normalizedHist * 25 // Maps -2→0, 0→50, +2→100

    // Combine: RSI 70% + MACD 30%
    let rawScore = rsi * 0.7 + macdScore * 0.3

    // Apply directional adjustment based on target type
    const movingTowardTarget =
      (targetType === "resistance" && currentPrice < targetPrice) ||
      (targetType === "support" && currentPrice > targetPrice)

    if (movingTowardTarget) {
      rawScore = Math.min(100, rawScore * 1.15)
    } else {
      rawScore = Math.max(0, rawScore * 0.85)
    }

    return Math.round(Math.max(0, Math.min(100, rawScore)))
  } catch (error) {
    console.error("[Momentum] Calculation error:", error)
    return 50 // Neutral fallback on error
  }
}

function calculateVolatilityScore(bars: OHLCVBar[]): number {
  // Minimum bars check: 20 for Bollinger Bands, fallback if insufficient
  if (bars.length < 20) {
    if (bars.length < 10) return 50

    // Fallback: Use original simple high-low averaging
    const recent = bars.slice(-10)
    const avgTrueRange = recent.reduce((sum, bar) => sum + (bar.high - bar.low), 0) / recent.length
    const currentPrice = recent[recent.length - 1].close
    const atrPercent = (avgTrueRange / currentPrice) * 100

    if (atrPercent < 0.5) return 30
    if (atrPercent > 5) return 30

    return Math.min(100, 50 + atrPercent * 20)
  }

  try {
    const highs = bars.map((b) => b.high)
    const lows = bars.map((b) => b.low)
    const closes = bars.map((b) => b.close)
    const currentPrice = closes[closes.length - 1]

    // True ATR with gap/overnight handling
    const atrValues = ATR.calculate({ high: highs, low: lows, close: closes, period: 14 })
    if (!atrValues || atrValues.length === 0) {
      console.warn("[Volatility] ATR calculation failed - using fallback")
      return 50
    }
    const atr = atrValues[atrValues.length - 1]
    const atrPercent = (atr / currentPrice) * 100

    // ATR sweet spot: 0.5-5% optimal (existing logic)
    let atrScore: number
    if (atrPercent < 0.5 || atrPercent > 5) {
      atrScore = 30
    } else {
      // Optimal range: 2.75% ± tolerance
      atrScore = 100 - Math.abs(atrPercent - 2.75) * 22.2
    }

    // Bollinger %B: position within bands
    const bbValues = BollingerBands.calculate({ values: closes, period: 20, stdDev: 2 })
    if (!bbValues || bbValues.length === 0) {
      console.warn("[Volatility] Bollinger Bands calculation failed - using ATR only")
      return Math.round(Math.max(0, Math.min(100, atrScore)))
    }

    const bbLast = bbValues[bbValues.length - 1]
    const bbWidth = bbLast.upper - bbLast.lower
    const bbPercent = bbWidth / bbLast.middle

    // %B score: extremes (near bands) = higher volatility opportunity
    // Neutral (mid-range) = moderate score
    let bbScore: number
    if (bbPercent < 0.2 || bbPercent > 0.8) {
      bbScore = 80 // Near bands = potential reversal opportunity
    } else if (bbPercent >= 0.4 && bbPercent <= 0.6) {
      bbScore = 50 // Neutral/consolidation
    } else {
      bbScore = 65 // Moderate volatility
    }

    // Combine: ATR 70% + BB 30%
    const finalScore = atrScore * 0.7 + bbScore * 0.3

    return Math.round(Math.max(0, Math.min(100, finalScore)))
  } catch (error) {
    console.error("[Volatility] Calculation error:", error)
    return 50 // Neutral fallback on error
  }
}

function calculateTrendScore(bars: OHLCVBar[]): number {
  // Minimum bars check: 50 for EMA history + slope analysis, fallback if insufficient
  if (bars.length < 50) {
    return 50 // Neutral if insufficient data
  }

  try {
    const closes = bars.map((b) => b.close)
    const currentPrice = closes[closes.length - 1]

    // EMA crossover logic (replaces SMA)
    const ema12Values = EMA.calculate({ values: closes, period: 12 })
    const ema26Values = EMA.calculate({ values: closes, period: 26 })

    if (!ema12Values || ema12Values.length === 0 || !ema26Values || ema26Values.length === 0) {
      console.warn("[Trend] EMA calculation failed - using fallback")
      // Fallback to original SMA logic
      const recent = bars.slice(-50)
      const sma20 = recent.slice(-20).reduce((sum, b) => sum + b.close, 0) / 20
      const sma50 = recent.reduce((sum, b) => sum + b.close, 0) / 50

      let score = 50
      if (currentPrice > sma20 && currentPrice > sma50) score += 25
      if (sma20 > sma50) score += 25
      if (currentPrice < sma20 && currentPrice < sma50) score -= 25
      if (sma20 < sma50) score -= 25

      return Math.max(0, Math.min(100, score))
    }

    const ema12 = ema12Values[ema12Values.length - 1]
    const ema26 = ema26Values[ema26Values.length - 1]

    let crossoverScore = 50

    // Price position relative to EMAs
    if (currentPrice > ema12 && currentPrice > ema26) crossoverScore += 20
    if (currentPrice < ema12 && currentPrice < ema26) crossoverScore -= 20

    // EMA crossover direction
    if (ema12 > ema26) crossoverScore += 20
    if (ema12 < ema26) crossoverScore -= 20

    // EMA26 slope strength (measures trend momentum)
    if (ema26Values.length >= 5) {
      const ema26_5ago = ema26Values[ema26Values.length - 5]
      const slope = ((ema26 - ema26_5ago) / ema26_5ago) * 100

      let slopeScore: number
      if (slope > 1.5) {
        slopeScore = 85 // Strong uptrend
      } else if (slope > 0.5) {
        slopeScore = 70 // Moderate uptrend
      } else if (slope > -0.5) {
        slopeScore = 50 // Neutral/sideways
      } else if (slope > -1.5) {
        slopeScore = 30 // Moderate downtrend
      } else {
        slopeScore = 15 // Strong downtrend
      }

      // Combine: Crossover 60% + Slope 40%
      const finalScore = crossoverScore * 0.6 + slopeScore * 0.4
      return Math.round(Math.max(0, Math.min(100, finalScore)))
    }

    // If insufficient data for slope, use crossover only
    return Math.round(Math.max(0, Math.min(100, crossoverScore)))
  } catch (error) {
    console.error("[Trend] Calculation error:", error)
    return 50 // Neutral fallback on error
  }
}

function calculateVolumeScore(bars: OHLCVBar[], targetType: "support" | "resistance"): number {
  // Minimum bars check: 20 for OBV trend + averaging, fallback if insufficient
  if (bars.length < 20) return 50

  try {
    const recent = bars.slice(-20)
    const closes = recent.map((b) => b.close)
    const volumes = recent.map((b) => b.volume)

    const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length
    const lastVolume = volumes[volumes.length - 1]
    const volumeRatio = lastVolume / avgVolume

    // Volume spike ratio (EXISTING logic)
    let ratioScore: number
    if (volumeRatio > 1.5) {
      ratioScore = 90
    } else if (volumeRatio > 1.2) {
      ratioScore = 75
    } else if (volumeRatio > 0.8) {
      ratioScore = 60
    } else {
      ratioScore = 40
    }

    // OBV trend analysis (NEW)
    const obvValues = OBV.calculate({ close: closes, volume: volumes })

    if (!obvValues || obvValues.length < 10) {
      console.warn("[Volume] OBV calculation failed - using ratio only")
      return Math.round(ratioScore)
    }

    // Calculate OBV trend over last 10 bars
    const obvCurrent = obvValues[obvValues.length - 1]
    const obv10ago = obvValues[obvValues.length - 10]
    const obvTrend = ((obvCurrent - obv10ago) / Math.abs(obv10ago || 1)) * 100

    let obvScore: number
    if (obvTrend > 5) {
      obvScore = 85 // Strong accumulation
    } else if (obvTrend > 2) {
      obvScore = 70 // Moderate accumulation
    } else if (obvTrend > -2) {
      obvScore = 50 // Neutral
    } else if (obvTrend > -5) {
      obvScore = 30 // Moderate distribution
    } else {
      obvScore = 15 // Strong distribution
    }

    // Directional adjustment for target type
    // For resistance levels, distribution (negative OBV) is actually favorable
    if (targetType === "resistance" && obvScore < 50) {
      obvScore = 100 - obvScore // Invert for resistance + distribution scenario
    }

    // Combine: OBV 60% + Ratio 40%
    const finalScore = obvScore * 0.6 + ratioScore * 0.4

    return Math.round(Math.max(0, Math.min(100, finalScore)))
  } catch (error) {
    console.error("[Volume] Calculation error:", error)
    return 50 // Neutral fallback on error
  }
}

async function calculateSeasonalScore(currentTime: number, ingressEnd: string): Promise<number> {
  try {
    const endTime = new Date(ingressEnd).getTime()
    const daysUntilEnd = Math.floor((endTime - currentTime) / (1000 * 60 * 60 * 24))
    const seasonalDates = getUpcomingSeasonalDates(currentTime, daysUntilEnd)

    if (seasonalDates.length === 0) return 50

    const avgStrength = seasonalDates.reduce((sum, s) => sum + s.strength, 0) / seasonalDates.length
    return Math.min(100, avgStrength * 10)
  } catch {
    return 50
  }
}

/**
 * ENHANCED: Calculate astrological aspect score with forward-looking confluence analysis
 *
 * Uses same mathematical principles as Gann fans/Fibonacci to measure timing influence:
 * - Aspect clustering: Multiple aspects on same date = confluence (like Gann angle convergence)
 * - Planetary body importance: Sun/Moon > inner planets > outer planets (market impact hierarchy)
 * - Time-to-aspect proximity: Closer aspects = higher influence (exponential decay)
 * - Exact date weighting: Precise alignments score higher than ranges
 *
 * Harmonious aspects (bullish):
 * - Conjunction (0°): Planets amplify each other = high energy
 * - Trine (120°): Easy flow of energy = opportunity
 * - Sextile (60°): Cooperative energy = mild positive
 *
 * Challenging aspects (volatile/bearish):
 * - Square (90°): Tension/conflict = high volatility
 * - Opposition (180°): Polarity/extremes = trend reversals
 *
 * @returns Score 0-100 where:
 *   90-100 = Very harmonious (multiple trines/sextiles, high confluence)
 *   75-89 = Harmonious (favorable aspects dominate)
 *   50-74 = Neutral (mixed aspects, moderate confluence)
 *   25-49 = Challenging (squares/oppositions dominate)
 *   0-24 = Very challenging (multiple hard aspects with high confluence)
 */
async function calculateAspectScore(
  currentDate: string,
  lookAheadDays: number = 30
): Promise<number> {
  try {
    // Defensive date parsing
    const startDateObj = new Date(currentDate)
    if (isNaN(startDateObj.getTime())) {
      console.error(`Invalid start date: ${currentDate}`)
      return 50
    }

    const endDate = new Date(startDateObj)
    endDate.setDate(endDate.getDate() + lookAheadDays)

    if (isNaN(endDate.getTime())) {
      console.error(`Invalid end date calculation from: ${currentDate}`)
      return 50
    }

    const endDateStr = endDate.toISOString().split("T")[0]

    // Query all aspects in the date range
    let { data: aspects, error } = await getSupabaseAdmin()
      .from("astro_aspects")
      .select("*")
      .gte("date", currentDate)
      .lte("date", endDateStr)

    // ENHANCED: If no future data exists, use historical patterns from same time period last year
    if (error || !aspects || aspects.length === 0) {
      console.warn(`No aspect data for ${currentDate}, using historical proxy from previous year`)

      // Calculate same period from previous year
      const historyStartObj = new Date(startDateObj)
      historyStartObj.setFullYear(historyStartObj.getFullYear() - 1)
      const historyEndObj = new Date(endDate)
      historyEndObj.setFullYear(historyEndObj.getFullYear() - 1)

      const historyStart = historyStartObj.toISOString().split("T")[0]
      const historyEnd = historyEndObj.toISOString().split("T")[0]

      const { data: historicalAspects, error: histError } = await getSupabaseAdmin()
        .from("astro_aspects")
        .select("*")
        .gte("date", historyStart)
        .lte("date", historyEnd)

      if (histError || !historicalAspects || historicalAspects.length === 0) {
        console.warn("No historical aspect data found either, returning neutral score")
        return 50
      }

      aspects = historicalAspects
      console.log(`📅 Using ${aspects.length} aspects from ${historyStart} to ${historyEnd} as proxy`)
    }

    // Weighted scoring for aspect types
    const aspectWeights: Record<string, { score: number; impact: number }> = {
      // Harmonious (bullish)
      conjunction: { score: 8, impact: 1.5 }, // High energy, amplification
      trine: { score: 10, impact: 1.3 }, // Best aspect, easy flow
      sextile: { score: 7, impact: 1.1 }, // Mild positive, opportunities

      // Challenging (volatile/bearish)
      square: { score: 2, impact: 1.4 }, // Tension, volatility
      opposition: { score: 3, impact: 1.3 }, // Extremes, reversals
    }

    // ENHANCED: Planetary body importance weights (Sun/Moon most influential)
    const planetaryWeights: Record<string, number> = {
      sun: 1.5,
      moon: 1.4,
      mercury: 1.1,
      venus: 1.1,
      mars: 1.2,
      jupiter: 1.3,
      saturn: 1.2,
      uranus: 1.0,
      neptune: 1.0,
      pluto: 1.0,
    }

    // ENHANCED: Group aspects by date to detect confluence (multiple aspects same day)
    const aspectsByDate: Record<string, any[]> = {}
    aspects.forEach((aspect: any) => {
      if (!aspectsByDate[aspect.date]) {
        aspectsByDate[aspect.date] = []
      }
      aspectsByDate[aspect.date].push(aspect)
    })

    let totalScore = 0
    let totalImpact = 0

    // Process each unique date for confluence analysis
    Object.entries(aspectsByDate).forEach(([date, dayAspects]) => {
      // ENHANCED: Confluence multiplier - multiple aspects on same day (like Gann fan convergence)
      const confluenceMultiplier = 1 + Math.log10(dayAspects.length) * 0.3

      // ENHANCED: Time proximity - closer aspects have higher influence (exponential decay)
      const daysUntilAspect = Math.max(
        0,
        (new Date(date).getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)
      )
      const proximityMultiplier = Math.max(0.5, 1 - daysUntilAspect / (lookAheadDays * 2))

      dayAspects.forEach((aspect: any) => {
        const weight = aspectWeights[aspect.aspect_type]
        if (!weight) return

        // Exact aspects have stronger influence
        const exactMultiplier = aspect.exact ? 1.5 : 1.0

        // Closer orbs = stronger (inverse of orb)
        const orbMultiplier = aspect.orb !== null ? Math.max(0.5, 1 - aspect.orb / 10) : 1.0

        // ENHANCED: Planetary body importance (Sun/Moon = highest market impact)
        const body1Weight = planetaryWeights[aspect.body1?.toLowerCase()] || 1.0
        const body2Weight = planetaryWeights[aspect.body2?.toLowerCase()] || 1.0
        const planetaryMultiplier = (body1Weight + body2Weight) / 2

        // Influence weight from aspects table (if provided)
        const influenceWeight = aspect.influence_weight || 1.0

        // ENHANCED: Combined impact with confluence, proximity, and planetary weights
        const impactValue =
          weight.impact *
          exactMultiplier *
          orbMultiplier *
          influenceWeight *
          planetaryMultiplier *
          confluenceMultiplier *
          proximityMultiplier

        totalScore += weight.score * impactValue
        totalImpact += impactValue
      })
    })

    // Calculate weighted average score
    const avgScore = totalImpact > 0 ? totalScore / totalImpact : 5

    // Convert to 0-100 scale (avgScore range is 0-10)
    const normalizedScore = Math.min(100, Math.max(0, avgScore * 10))

    // ENHANCED: Log confluence details for debugging
    const confluenceDates = Object.entries(aspectsByDate)
      .filter(([_, aspects]) => aspects.length > 1)
      .map(([date, aspects]) => `${date}(${aspects.length})`)

    if (confluenceDates.length > 0) {
      console.log(
        `📅 Aspect Score: ${normalizedScore.toFixed(0)} (${aspects.length} aspects, ${confluenceDates.length} confluence dates: ${confluenceDates.join(", ")})`
      )
    } else {
      console.log(
        `📅 Aspect Score: ${normalizedScore.toFixed(0)} (${aspects.length} aspects analyzed)`
      )
    }

    return normalizedScore
  } catch (error) {
    console.error("Error calculating aspect score:", error)
    return 50 // Neutral on error
  }
}

// ============================================================================
// TRADING WINDOW DETECTOR - "WEATHER FORECAST" CORE
// ============================================================================

export interface TradingWindow {
  startDate: string
  endDate: string
  type: "high_probability" | "moderate" | "avoid" | "extreme_volatility"
  technicalConfluence: number // Avg technical score in window
  astrologicalAlignment: number // Avg astrological score in window
  combinedScore: number // Weighted combination
  daysInWindow: number
  keyLevels: number[] // Price targets with high confluence
  reasons: string[]
  emoji: string // 🌞 | ⛅ | 🌧️ | ⚡
}

/**
 * Detect optimal trading windows by combining technical + astrological analysis
 * This is the "weather forecast" that tells users WHEN to trade
 *
 * Algorithm:
 * 1. Calculate daily scores for next 90 days (technical + astrological)
 * 2. Find consecutive days where combined score >= threshold
 * 3. Group into windows and classify by quality
 * 4. Return sorted by combined score (best first)
 *
 * @param symbol - Ticker to analyze
 * @param category - Asset category
 * @param daysAhead - How far to project (default 90)
 * @returns Array of trading windows sorted by quality
 */
export async function detectTradingWindows(
  symbol: string,
  category: string,
  daysAhead: number = 90
): Promise<TradingWindow[]> {
  try {
    console.log(`🔮 Detecting trading windows for ${symbol} (next ${daysAhead} days)`)

    // Get price data for technical analysis
    const { data: priceData } = await getSupabaseAdmin()
      .from("financial_data")
      .select("date, open, high, low, close, volume")
      .eq("symbol", symbol)
      .order("date", { ascending: false })
      .limit(500)

    if (!priceData || priceData.length < 30) {
      throw new Error(`Insufficient price data for ${symbol}`)
    }

    const bars: OHLCVBar[] = priceData.reverse()
    const currentPrice = bars[bars.length - 1].close

    // Calculate technical levels once (these don't change day-to-day)
    const levels = calculateEnhancedLevels(bars, currentPrice, { swingLength: 10, pivotBars: 5 })

    // Extract key support/resistance levels
    const supportLevels = levels.supportResistance
      .filter((sr) => sr.type === "support")
      .slice(0, 3)
      .map((sr) => sr.price)

    const resistanceLevels = levels.supportResistance
      .filter((sr) => sr.type === "resistance")
      .slice(0, 3)
      .map((sr) => sr.price)

    const keyLevels = [...supportLevels, ...resistanceLevels]

    // Get current ingress period
    const ingressPeriod = await getCurrentIngressPeriod()

    // Daily scoring for next N days
    interface DailyScore {
      date: string
      technical: number
      astrological: number
      combined: number
    }

    const dailyScores: DailyScore[] = []
    const startDate = new Date()

    for (let i = 0; i < daysAhead; i++) {
      const futureDate = new Date(startDate)
      futureDate.setDate(futureDate.getDate() + i)
      const dateStr = futureDate.toISOString().split("T")[0]

      // Technical score (based on proximity to key levels)
      const proximityScores = keyLevels.map((level) => {
        const distance = Math.abs((level - currentPrice) / currentPrice) * 100
        if (distance < 1) return 95
        if (distance < 2) return 85
        if (distance < 3) return 75
        if (distance < 5) return 65
        return 50
      })
      const technicalScore = Math.max(...proximityScores)

      // Astrological score (aspects + seasonal)
      const aspectScore = await calculateAspectScore(dateStr, 1) // Check just this day
      const seasonalScore = await calculateSeasonalScore(
        futureDate.getTime(),
        ingressPeriod.end
      )
      const astrologicalScore = aspectScore * 0.7 + seasonalScore * 0.3

      // Combined score (70% technical, 30% astrological)
      const combinedScore = technicalScore * 0.7 + astrologicalScore * 0.3

      dailyScores.push({
        date: dateStr,
        technical: technicalScore,
        astrological: astrologicalScore,
        combined: combinedScore,
      })
    }

    // Group consecutive high-score days into windows
    const windows: TradingWindow[] = []
    let windowStart: DailyScore | null = null
    let windowDays: DailyScore[] = []

    for (const day of dailyScores) {
      const isHighScore = day.combined >= 70

      if (isHighScore) {
        if (!windowStart) {
          windowStart = day
          windowDays = [day]
        } else {
          windowDays.push(day)
        }
      } else {
        // End of window
        if (windowStart && windowDays.length >= 2) {
          const avgTechnical =
            windowDays.reduce((sum, d) => sum + d.technical, 0) / windowDays.length
          const avgAstrological =
            windowDays.reduce((sum, d) => sum + d.astrological, 0) / windowDays.length
          const avgCombined =
            windowDays.reduce((sum, d) => sum + d.combined, 0) / windowDays.length

          // Classify window type
          let type: TradingWindow["type"]
          let emoji: string
          let reasons: string[] = []

          if (avgCombined >= 85) {
            type = "high_probability"
            emoji = "🌞"
            reasons.push("Exceptional alignment of technical + astrological factors")
            if (avgTechnical >= 90) reasons.push("Price near critical confluence zone")
            if (avgAstrological >= 85) reasons.push("Highly harmonious planetary aspects")
          } else if (avgCombined >= 75) {
            type = "moderate"
            emoji = "⛅"
            reasons.push("Good alignment, favorable conditions")
            if (avgTechnical >= 80) reasons.push("Approaching key technical level")
          } else if (avgTechnical < 50 && avgAstrological < 50) {
            type = "avoid"
            emoji = "🌧️"
            reasons.push("Low technical + low astrological alignment")
          } else if (avgAstrological < 40) {
            type = "extreme_volatility"
            emoji = "⚡"
            reasons.push("Challenging planetary aspects indicate volatility")
          } else {
            type = "moderate"
            emoji = "⛅"
            reasons.push("Mixed signals, proceed with caution")
          }

          windows.push({
            startDate: windowStart.date,
            endDate: windowDays[windowDays.length - 1].date,
            type,
            technicalConfluence: Math.round(avgTechnical),
            astrologicalAlignment: Math.round(avgAstrological),
            combinedScore: Math.round(avgCombined),
            daysInWindow: windowDays.length,
            keyLevels,
            reasons,
            emoji,
          })
        }

        windowStart = null
        windowDays = []
      }
    }

    // Handle final window if still open
    if (windowStart && windowDays.length >= 2) {
      const avgTechnical =
        windowDays.reduce((sum, d) => sum + d.technical, 0) / windowDays.length
      const avgAstrological =
        windowDays.reduce((sum, d) => sum + d.astrological, 0) / windowDays.length
      const avgCombined =
        windowDays.reduce((sum, d) => sum + d.combined, 0) / windowDays.length

      windows.push({
        startDate: windowStart.date,
        endDate: windowDays[windowDays.length - 1].date,
        type: avgCombined >= 85 ? "high_probability" : "moderate",
        technicalConfluence: Math.round(avgTechnical),
        astrologicalAlignment: Math.round(avgAstrological),
        combinedScore: Math.round(avgCombined),
        daysInWindow: windowDays.length,
        keyLevels,
        reasons: ["Trading window detected"],
        emoji: avgCombined >= 85 ? "🌞" : "⛅",
      })
    }

    // Sort by combined score (best first)
    windows.sort((a, b) => b.combinedScore - a.combinedScore)

    console.log(`✅ Found ${windows.length} trading windows for ${symbol}`)

    return windows
  } catch (error) {
    console.error("Error detecting trading windows:", error)
    return []
  }
}

/**
 * Detect tickers that have confirmed reversals at key Gann/Fib levels
 * Returns tickers in post-reversal momentum with distance to next level
 */
export async function detectPostReversalMomentum(
  symbols: string[],
  category: string
): Promise<
  Array<{
    symbol: string
    reversalLevel: number
    reversalType: "support" | "resistance"
    reversalConfidence: number
    currentPrice: number
    nextLevel: number
    nextLevelType: "support" | "resistance"
    percentToNext: number
    daysFromReversal: number
    momentum: "bullish" | "bearish"
    lunarPhase: string
    lunarScore: number
    aspectScore: number
    entryTimingScore: number
    heatMapColor: string
  }>
> {
  console.log(`🎯 Detecting post-reversal momentum for ${symbols.length} symbols...`)

  const results = []

  for (const symbol of symbols) {
    try {
      // Get recent price data (last 120 days for reversal detection + S/R calculation)
      const { data: priceData } = await getSupabaseAdmin()
        .from("financial_data")
        .select("date, open, high, low, close, volume")
        .eq("symbol", symbol)
        .order("date", { ascending: false })
        .limit(120)

      if (!priceData || priceData.length < 30) {
        console.log(`   ⚠️ ${symbol}: Insufficient data (${priceData?.length || 0} bars)`)
        continue
      }

      const bars: OHLCVBar[] = priceData.reverse().map((bar: any) => ({
        time: new Date(bar.date).getTime() / 1000,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume || 0
      }))

      const currentPrice = bars[bars.length - 1].close
      const currentDate = priceData[priceData.length - 1].date

      console.log(`   📊 ${symbol}: $${currentPrice.toFixed(2)} | ${bars.length} bars`)

      // Calculate key levels
      const levels = calculateEnhancedLevels(bars, currentPrice, { swingLength: 10, pivotBars: 5 })
      console.log(`      S/R levels: ${levels.supportResistance.length}`)

      // Check if price recently reversed at a key level
      const reversalDetection = detectReversalAtKeyLevel(bars, levels, currentPrice)

      if (!reversalDetection) {
        console.log(`      ❌ No reversal detected`)
        continue
      }

      console.log(`      ✅ Reversal at ${reversalDetection.type} $${reversalDetection.level.toFixed(2)}, ${reversalDetection.momentum} momentum`)

      // Find next key level in direction of momentum
      const nextLevel = findNextKeyLevel(
        currentPrice,
        reversalDetection.momentum,
        levels.supportResistance
      )

      if (!nextLevel) {
        console.log(`      ❌ No next level found`)
        continue
      }

      // Calculate % to next level
      const percentToNext = Math.abs((nextLevel.price - currentPrice) / currentPrice) * 100

      console.log(`      📍 Next ${nextLevel.type}: $${nextLevel.price.toFixed(2)} (${percentToNext.toFixed(2)}% away)`)

      // Skip if next level is too far (> 10%)
      if (percentToNext > 10) {
        console.log(`      ⚠️ Next level too far (${percentToNext.toFixed(2)}% > 10%)`)
        continue
      }

      // Calculate lunar phase score
      const lunarPhase = getCurrentLunarPhase()
      const lunarScore = calculateLunarEntryScore(lunarPhase, reversalDetection.momentum)

      // Calculate astrological aspect score
      const aspectScore = await calculateAspectScore(currentDate, 7)

      // Combined entry timing score (70% lunar, 30% aspects)
      const entryTimingScore = Math.round(lunarScore * 0.7 + aspectScore * 0.3)

      // Calculate heat map color based on entry timing
      const heatMapColor = getHeatMapColor(entryTimingScore)

      results.push({
        symbol,
        reversalLevel: reversalDetection.level,
        reversalType: reversalDetection.type,
        reversalConfidence: reversalDetection.confidence,
        currentPrice,
        nextLevel: nextLevel.price,
        nextLevelType: nextLevel.type,
        percentToNext,
        daysFromReversal: reversalDetection.daysAgo,
        momentum: reversalDetection.momentum,
        lunarPhase,
        lunarScore,
        aspectScore,
        entryTimingScore,
        heatMapColor,
      })
    } catch (error) {
      console.error(`Error processing ${symbol}:`, error)
    }
  }

  // Sort by entry timing score (best opportunities first)
  results.sort((a, b) => b.entryTimingScore - a.entryTimingScore)

  console.log(`✅ Found ${results.length} post-reversal opportunities`)

  return results
}

/**
 * Detect if price has recently reversed at a key Gann/Fib level
 */
function detectReversalAtKeyLevel(
  bars: OHLCVBar[],
  levels: any,
  currentPrice: number
): {
  level: number
  type: "support" | "resistance"
  confidence: number
  daysAgo: number
  momentum: "bullish" | "bearish"
} | null {
  // Look back 5-15 days for reversal
  const lookbackStart = Math.max(0, bars.length - 15)
  const lookbackEnd = bars.length - 5

  for (let i = lookbackStart; i < lookbackEnd; i++) {
    const bar = bars[i]
    const price = bar.close

    // Check if price touched a key support level and reversed up
    for (const sr of levels.supportResistance) {
      if (sr.type === "support") {
        const distanceToLevel = Math.abs((price - sr.price) / price) * 100

        // Price touched support (within 0.5%)
        if (distanceToLevel < 0.5 && bar.low <= sr.price * 1.005) {
          // Check if price has since bounced up at least 2%
          const bouncePercent = ((currentPrice - bar.low) / bar.low) * 100

          if (bouncePercent >= 2 && currentPrice > sr.price) {
            // Confirmed bullish reversal at support
            return {
              level: sr.price,
              type: "support",
              confidence: Math.min(95, 70 + bouncePercent * 3),
              daysAgo: bars.length - 1 - i,
              momentum: "bullish",
            }
          }
        }
      }

      // Check if price touched a key resistance level and reversed down
      if (sr.type === "resistance") {
        const distanceToLevel = Math.abs((price - sr.price) / price) * 100

        // Price touched resistance (within 0.5%)
        if (distanceToLevel < 0.5 && bar.high >= sr.price * 0.995) {
          // Check if price has since dropped at least 2%
          const dropPercent = ((bar.high - currentPrice) / bar.high) * 100

          if (dropPercent >= 2 && currentPrice < sr.price) {
            // Confirmed bearish reversal at resistance
            return {
              level: sr.price,
              type: "resistance",
              confidence: Math.min(95, 70 + dropPercent * 3),
              daysAgo: bars.length - 1 - i,
              momentum: "bearish",
            }
          }
        }
      }
    }
  }

  return null
}

/**
 * Find next key level in direction of momentum
 */
function findNextKeyLevel(
  currentPrice: number,
  momentum: "bullish" | "bearish",
  supportResistanceLevels: any[]
): { price: number; type: "support" | "resistance" } | null {
  if (momentum === "bullish") {
    // Looking for next resistance above current price
    const resistances = supportResistanceLevels
      .filter((sr) => sr.type === "resistance" && sr.price > currentPrice)
      .sort((a, b) => a.price - b.price)

    return resistances.length > 0
      ? { price: resistances[0].price, type: "resistance" }
      : null
  } else {
    // Looking for next support below current price
    const supports = supportResistanceLevels
      .filter((sr) => sr.type === "support" && sr.price < currentPrice)
      .sort((a, b) => b.price - a.price)

    return supports.length > 0 ? { price: supports[0].price, type: "support" } : null
  }
}

/**
 * Get current lunar phase
 */
function getCurrentLunarPhase(): string {
  const now = new Date()
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
  )
  const lunarCycle = 29.53 // days
  const phasePosition = (dayOfYear % lunarCycle) / lunarCycle

  if (phasePosition < 0.125) return "New Moon"
  if (phasePosition < 0.375) return "Waxing Crescent"
  if (phasePosition < 0.625) return "Full Moon"
  if (phasePosition < 0.875) return "Waning Crescent"
  return "New Moon"
}

/**
 * Calculate lunar entry score based on phase and momentum
 */
function calculateLunarEntryScore(phase: string, momentum: "bullish" | "bearish"): number {
  // Bullish trades favor waxing moon, bearish trades favor waning moon
  if (momentum === "bullish") {
    switch (phase) {
      case "New Moon":
        return 95 // Best for bullish entries
      case "Waxing Crescent":
        return 85
      case "Full Moon":
        return 50 // Neutral
      case "Waning Crescent":
        return 40 // Not ideal for bullish
      default:
        return 50
    }
  } else {
    switch (phase) {
      case "Full Moon":
        return 95 // Best for bearish entries
      case "Waning Crescent":
        return 85
      case "New Moon":
        return 50 // Neutral
      case "Waxing Crescent":
        return 40 // Not ideal for bearish
      default:
        return 50
    }
  }
}

/**
 * Get heat map color based on entry timing score
 */
function getHeatMapColor(score: number): string {
  if (score >= 85) {
    // Hot zone: #33ff33 (bright green)
    return "rgba(51, 255, 51, 0.8)"
  } else if (score >= 70) {
    // Medium-hot: lime green
    return "rgba(120, 255, 120, 0.6)"
  } else if (score >= 55) {
    // Medium: gray-green
    return "rgba(160, 160, 160, 0.5)"
  } else if (score >= 40) {
    // Cool: light gray
    return "rgba(200, 200, 200, 0.3)"
  } else {
    // Cold: transparent/background
    return "rgba(255, 255, 255, 0.1)"
  }
}

// ============================================================================
// GANN/FIB CONVERGENCE FORECASTING SYSTEM
// ============================================================================

/**
 * Forecast structure for a predicted swing high/low
 */
export interface ForecastedSwing {
  type: "high" | "low"
  price: number
  date: string
  convergingMethods: string[]
  baseConfidence: number  // 0-1 based on # of converging methods
  astroBoost: number      // 0-0.3 boost from lunar/planetary alignment
  finalConfidence: number // baseConfidence + astroBoost
}

/**
 * Last confirmed swing point
 */
interface SwingPoint {
  type: "high" | "low"
  price: number
  date: string
  barIndex: number
}

/**
 * Individual forecast from a specific method
 */
interface MethodForecast {
  method: string
  price: number
  date: string
  confidence: number
}

/**
 * Find the last confirmed swing high or low in price data
 */
function findLastSwing(bars: OHLCVBar[]): SwingPoint | null {
  if (bars.length < 10) return null

  const swingBars = 5 // lookback for swing confirmation
  let lastSwing: SwingPoint | null = null

  // Start from the end and look back for swings
  for (let i = bars.length - swingBars - 1; i >= swingBars; i--) {
    const bar = bars[i]
    
    // Check for swing high
    let isSwingHigh = true
    for (let j = i - swingBars; j <= i + swingBars; j++) {
      if (j === i) continue
      if (bars[j].high >= bar.high) {
        isSwingHigh = false
        break
      }
    }
    
    if (isSwingHigh) {
      const date = new Date(bar.time * 1000).toISOString().split("T")[0]
      return {
        type: "high",
        price: bar.high,
        date,
        barIndex: i
      }
    }
    
    // Check for swing low
    let isSwingLow = true
    for (let j = i - swingBars; j <= i + swingBars; j++) {
      if (j === i) continue
      if (bars[j].low <= bar.low) {
        isSwingLow = false
        break
      }
    }
    
    if (isSwingLow) {
      const date = new Date(bar.time * 1000).toISOString().split("T")[0]
      return {
        type: "low",
        price: bar.low,
        date,
        barIndex: i
      }
    }
  }

  return lastSwing
}

/**
 * Forecast using Gann angles (1x1, 2x1)
 * Projects from last swing based on time/price relationship
 */
function forecastGannAngles(
  lastSwing: SwingPoint,
  bars: OHLCVBar[],
  currentPrice: number,
  ingressEnd: string
): MethodForecast[] {
  const forecasts: MethodForecast[] = []
  const lastSwingDate = new Date(lastSwing.date)
  const ingressEndDate = new Date(ingressEnd)
  
  // Calculate ATR for scaling
  const atr = calculateATR(bars, 14)
  
  // 1x1 angle: Time = Price (1 day = 1 ATR)
  const daysToIngress = Math.floor((ingressEndDate.getTime() - lastSwingDate.getTime()) / (1000 * 60 * 60 * 24))
  const angle1x1Price = lastSwing.type === "low" 
    ? lastSwing.price + (daysToIngress * atr * 0.5)
    : lastSwing.price - (daysToIngress * atr * 0.5)
  
  // Only forecast if within ingress period and reasonable
  if (daysToIngress > 0 && daysToIngress <= 90) {
    const angle1x1Date = new Date(lastSwingDate)
    angle1x1Date.setDate(angle1x1Date.getDate() + Math.floor(daysToIngress / 2))
    
    if (angle1x1Date <= ingressEndDate) {
      forecasts.push({
        method: "Gann 1x1",
        price: angle1x1Price,
        date: angle1x1Date.toISOString().split("T")[0],
        confidence: 0.7
      })
    }
  }
  
  // 2x1 angle: 2 time units = 1 price unit (faster move)
  const angle2x1Price = lastSwing.type === "low"
    ? lastSwing.price + (daysToIngress * atr * 0.75)
    : lastSwing.price - (daysToIngress * atr * 0.75)
  
  if (daysToIngress > 0 && daysToIngress <= 90) {
    const angle2x1Date = new Date(lastSwingDate)
    angle2x1Date.setDate(angle2x1Date.getDate() + Math.floor(daysToIngress / 3))
    
    if (angle2x1Date <= ingressEndDate) {
      forecasts.push({
        method: "Gann 2x1",
        price: angle2x1Price,
        date: angle2x1Date.toISOString().split("T")[0],
        confidence: 0.6
      })
    }
  }
  
  return forecasts
}

/**
 * Calculate ATR (Average True Range) for volatility
 */
function calculateATR(bars: OHLCVBar[], period: number): number {
  if (bars.length < period + 1) return 0
  
  const trueRanges: number[] = []
  
  for (let i = 1; i < bars.length; i++) {
    const high = bars[i].high
    const low = bars[i].low
    const prevClose = bars[i - 1].close
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    )
    trueRanges.push(tr)
  }
  
  // Average the last 'period' true ranges
  const recentTR = trueRanges.slice(-period)
  return recentTR.reduce((sum, tr) => sum + tr, 0) / recentTR.length
}

/**
 * Forecast using Square of 9
 * Based on spiral geometry and 90°/180°/270° rotations
 */
function forecastSquareOf9(
  lastSwing: SwingPoint,
  currentPrice: number,
  ingressEnd: string
): MethodForecast[] {
  const forecasts: MethodForecast[] = []
  const lastSwingDate = new Date(lastSwing.date)
  const ingressEndDate = new Date(ingressEnd)
  
  // Calculate square root and next rotation levels
  const sqrt = Math.sqrt(lastSwing.price)
  
  // 90° rotation (1/4 turn)
  const rotation90 = Math.pow(sqrt + 0.25, 2)
  // 180° rotation (1/2 turn)
  const rotation180 = Math.pow(sqrt + 0.5, 2)
  // 270° rotation (3/4 turn)  
  const rotation270 = Math.pow(sqrt + 0.75, 2)
  
  // Estimate dates based on natural cycle (30-45 days per quarter)
  const daysPerQuarter = 35
  
  const dates = [
    new Date(lastSwingDate.getTime() + daysPerQuarter * 24 * 60 * 60 * 1000),
    new Date(lastSwingDate.getTime() + daysPerQuarter * 2 * 24 * 60 * 60 * 1000),
    new Date(lastSwingDate.getTime() + daysPerQuarter * 3 * 24 * 60 * 60 * 1000),
  ]
  
  const prices = [rotation90, rotation180, rotation270]
  const methods = ["Square of 9 (90°)", "Square of 9 (180°)", "Square of 9 (270°)"]
  
  for (let i = 0; i < 3; i++) {
    if (dates[i] <= ingressEndDate) {
      forecasts.push({
        method: methods[i],
        price: prices[i],
        date: dates[i].toISOString().split("T")[0],
        confidence: 0.65
      })
    }
  }
  
  return forecasts
}

/**
 * Forecast using Time Squared principle
 * When price moves X points, reversal expected in X time units
 */
function forecastTimeSquared(
  lastSwing: SwingPoint,
  bars: OHLCVBar[],
  currentPrice: number,
  ingressEnd: string
): MethodForecast[] {
  const forecasts: MethodForecast[] = []
  const lastSwingDate = new Date(lastSwing.date)
  const ingressEndDate = new Date(ingressEnd)
  
  // Calculate price move since last swing
  const priceMove = Math.abs(currentPrice - lastSwing.price)
  const avgDailyMove = priceMove / Math.max(1, bars.length - lastSwing.barIndex)
  
  // Time squared: if price moved X, expect reversal in X days from last swing
  const timeUnits = Math.round(priceMove / avgDailyMove)
  const forecastDate = new Date(lastSwingDate)
  forecastDate.setDate(forecastDate.getDate() + timeUnits)
  
  if (forecastDate <= ingressEndDate && timeUnits > 0) {
    // Forecast opposite type swing
    const forecastPrice = lastSwing.type === "low"
      ? lastSwing.price + priceMove * 1.5
      : lastSwing.price - priceMove * 1.5
    
    forecasts.push({
      method: "Time Squared",
      price: forecastPrice,
      date: forecastDate.toISOString().split("T")[0],
      confidence: 0.6
    })
  }
  
  return forecasts
}

/**
 * Forecast using Fibonacci extensions
 * Projects common ratios: 61.8%, 100%, 161.8%
 */
function forecastFibonacciExtensions(
  lastSwing: SwingPoint,
  bars: OHLCVBar[],
  currentPrice: number,
  ingressEnd: string
): MethodForecast[] {
  const forecasts: MethodForecast[] = []
  const lastSwingDate = new Date(lastSwing.date)
  const ingressEndDate = new Date(ingressEnd)
  
  // Find previous swing before last swing
  let prevSwing: SwingPoint | null = null
  for (let i = lastSwing.barIndex - 5; i >= 5; i--) {
    const bar = bars[i]
    
    // Look for opposite type swing
    if (lastSwing.type === "high") {
      // Look for swing low
      let isSwingLow = true
      for (let j = i - 5; j <= Math.min(i + 5, lastSwing.barIndex - 1); j++) {
        if (j === i) continue
        if (bars[j].low <= bar.low) {
          isSwingLow = false
          break
        }
      }
      if (isSwingLow) {
        prevSwing = {
          type: "low",
          price: bar.low,
          date: new Date(bar.time * 1000).toISOString().split("T")[0],
          barIndex: i
        }
        break
      }
    } else {
      // Look for swing high
      let isSwingHigh = true
      for (let j = i - 5; j <= Math.min(i + 5, lastSwing.barIndex - 1); j++) {
        if (j === i) continue
        if (bars[j].high >= bar.high) {
          isSwingHigh = false
          break
        }
      }
      if (isSwingHigh) {
        prevSwing = {
          type: "high",
          price: bar.high,
          date: new Date(bar.time * 1000).toISOString().split("T")[0],
          barIndex: i
        }
        break
      }
    }
  }
  
  if (!prevSwing) return forecasts
  
  // Calculate swing range
  const swingRange = Math.abs(lastSwing.price - prevSwing.price)
  const swingDays = lastSwing.barIndex - prevSwing.barIndex
  
  // Fibonacci extension levels
  const fibLevels = [
    { ratio: 0.618, label: "Fib 61.8%" },
    { ratio: 1.0, label: "Fib 100%" },
    { ratio: 1.618, label: "Fib 161.8%" }
  ]
  
  for (const fib of fibLevels) {
    const extension = lastSwing.type === "low"
      ? lastSwing.price + (swingRange * fib.ratio)
      : lastSwing.price - (swingRange * fib.ratio)
    
    // Estimate time based on swing duration
    const timeDays = Math.round(swingDays * fib.ratio)
    const forecastDate = new Date(lastSwingDate)
    forecastDate.setDate(forecastDate.getDate() + timeDays)
    
    if (forecastDate <= ingressEndDate) {
      forecasts.push({
        method: fib.label,
        price: extension,
        date: forecastDate.toISOString().split("T")[0],
        confidence: fib.ratio === 1.618 ? 0.75 : 0.65
      })
    }
  }
  
  return forecasts
}

/**
 * Forecast using natural cycles
 * 30, 45, 60, 90-day intervals from last swing
 */
function forecastNaturalCycles(
  lastSwing: SwingPoint,
  bars: OHLCVBar[],
  currentPrice: number,
  ingressEnd: string
): MethodForecast[] {
  const forecasts: MethodForecast[] = []
  const lastSwingDate = new Date(lastSwing.date)
  const ingressEndDate = new Date(ingressEnd)
  
  const cycles = [30, 45, 60, 90]
  const atr = calculateATR(bars, 14)
  
  for (const cycleDays of cycles) {
    const forecastDate = new Date(lastSwingDate)
    forecastDate.setDate(forecastDate.getDate() + cycleDays)
    
    if (forecastDate <= ingressEndDate) {
      // Project price based on cycle length
      const priceMove = atr * (cycleDays / 30) * 2
      const forecastPrice = lastSwing.type === "low"
        ? lastSwing.price + priceMove
        : lastSwing.price - priceMove
      
      forecasts.push({
        method: `${cycleDays}-day Cycle`,
        price: forecastPrice,
        date: forecastDate.toISOString().split("T")[0],
        confidence: cycleDays === 30 || cycleDays === 45 ? 0.6 : 0.5
      })
    }
  }
  
  return forecasts
}

/**
 * Detect convergence: 3+ forecasting methods agreeing within tolerances
 * Price tolerance: ±2%
 * Time tolerance: ±3 days
 */
function detectForecastConvergence(
  forecasts: MethodForecast[],
  priceTolerance: number = 0.02,
  timeTolerance: number = 3,
  minLevels: number = 2
): Array<{
  price: number
  date: string
  methods: string[]
  confidence: number
}> {
  const convergences: Array<{
    price: number
    date: string
    methods: string[]
    confidence: number
  }> = []
  
  // Group forecasts by proximity
  for (let i = 0; i < forecasts.length; i++) {
    const cluster: MethodForecast[] = [forecasts[i]]
    
    for (let j = i + 1; j < forecasts.length; j++) {
      const forecast1 = forecasts[i]
      const forecast2 = forecasts[j]
      
      // Check price proximity (±2%)
      const priceDiff = Math.abs(forecast1.price - forecast2.price) / forecast1.price
      
      // Check time proximity (±3 days)
      const date1 = new Date(forecast1.date)
      const date2 = new Date(forecast2.date)
      const timeDiff = Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24)
      
      if (priceDiff <= priceTolerance && timeDiff <= timeTolerance) {
        cluster.push(forecast2)
      }
    }
    
    // Convergence requires minLevels+ methods
    if (cluster.length >= minLevels) {
      const avgPrice = cluster.reduce((sum, f) => sum + f.price, 0) / cluster.length
      const avgConfidence = cluster.reduce((sum, f) => sum + f.confidence, 0) / cluster.length

      // Use the most common date in cluster
      const dates = cluster.map(f => f.date)
      const dateCount = dates.reduce((acc, d) => {
        acc[d] = (acc[d] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      const mostCommonDate = Object.keys(dateCount).reduce((a, b) =>
        dateCount[a] > dateCount[b] ? a : b
      )

      convergences.push({
        price: avgPrice,
        date: mostCommonDate,
        methods: cluster.map(f => f.method),
        confidence: Math.min(1, avgConfidence + (cluster.length - minLevels) * 0.05) // Bonus for each additional method
      })
    }
  }
  
  // Remove duplicate convergences
  return convergences.filter((conv, index) => {
    return convergences.findIndex(c => 
      c.date === conv.date && Math.abs(c.price - conv.price) / c.price < 0.01
    ) === index
  })
}

/**
 * Main function: Detect Gann/Fib convergence forecasts for tickers
 * Returns forecasted swings within current ingress period
 */
export async function detectConvergenceForecastedSwings(
  symbols: string[],
  category: string
): Promise<
  Array<{
    symbol: string
    currentPrice: number
    lastSwing: SwingPoint
    forecastedSwing: ForecastedSwing
    ingressValidity: boolean
  }>
> {
  console.log(`🔮 Detecting convergence forecasts for ${symbols.length} symbols...`)

  // Fetch current and next ingress periods from database
  const today = new Date().toISOString().split("T")[0]

  // Get current ingress (most recent one on or before today)
  const { data: currentIngressData } = await getSupabaseAdmin()
    .from("astro_events")
    .select("*")
    .eq("event_type", "solar_ingress")
    .lte("date", today)
    .order("date", { ascending: false })
    .limit(1)

  // Get next ingress (first one after today)
  const { data: nextIngressData } = await getSupabaseAdmin()
    .from("astro_events")
    .select("*")
    .eq("event_type", "solar_ingress")
    .gt("date", today)
    .order("date", { ascending: true })
    .limit(1)

  if (!currentIngressData || currentIngressData.length === 0) {
    console.error("❌ Failed to fetch current ingress data from database")
    return []
  }

  const currentIngress = currentIngressData[0]
  const nextIngress = nextIngressData && nextIngressData.length > 0
    ? nextIngressData[0]
    : null

  // Calculate end date (use next ingress date or add 30 days as fallback)
  let endDate: string
  if (nextIngress) {
    endDate = nextIngress.date
  } else {
    const currentDate = new Date(currentIngress.date)
    currentDate.setDate(currentDate.getDate() + 30)
    endDate = currentDate.toISOString().split("T")[0]
  }

  const ingress = {
    sign: currentIngress.sign || currentIngress.zodiac_sign || "Unknown",
    start: currentIngress.date,
    end: endDate,
    month: new Date(currentIngress.date).toLocaleString('default', { month: 'long' })
  }
  const ingressEnd = ingress.end

  console.log(`📅 Current ingress: ${ingress.sign} (${ingress.start} → ${ingress.end})`)
  
  const results = []
  
  for (const symbol of symbols) {
    try {
      // Fetch price history (120 bars for swing detection)
      const { data: priceData } = await getSupabaseAdmin()
        .from("financial_data")
        .select("date, open, high, low, close, volume")
        .eq("symbol", symbol)
        .order("date", { ascending: false })
        .limit(120)
      
      if (!priceData || priceData.length < 30) {
        console.log(`   ⚠️ ${symbol}: Insufficient data`)
        continue
      }
      
      const bars: OHLCVBar[] = priceData.reverse().map((bar: any) => ({
        time: new Date(bar.date).getTime() / 1000,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume || 0
      }))
      
      const currentPrice = bars[bars.length - 1].close
      
      // Find last swing
      const lastSwing = findLastSwing(bars)
      if (!lastSwing) {
        console.log(`   ⚠️ ${symbol}: No swing found`)
        continue
      }
      
      console.log(`   📊 ${symbol}: Last ${lastSwing.type} at $${lastSwing.price.toFixed(2)} on ${lastSwing.date}`)
      
      // Generate forecasts from all methods
      const gannForecasts = forecastGannAngles(lastSwing, bars, currentPrice, ingressEnd)
      const sq9Forecasts = forecastSquareOf9(lastSwing, currentPrice, ingressEnd)
      const timeSqForecasts = forecastTimeSquared(lastSwing, bars, currentPrice, ingressEnd)
      const fibForecasts = forecastFibonacciExtensions(lastSwing, bars, currentPrice, ingressEnd)
      const cycleForecasts = forecastNaturalCycles(lastSwing, bars, currentPrice, ingressEnd)

      const allForecasts: MethodForecast[] = [
        ...gannForecasts,
        ...sq9Forecasts,
        ...timeSqForecasts,
        ...fibForecasts,
        ...cycleForecasts,
      ]

      console.log(`      Forecasts: Gann=${gannForecasts.length}, Sq9=${sq9Forecasts.length}, TimeSq=${timeSqForecasts.length}, Fib=${fibForecasts.length}, Cycles=${cycleForecasts.length}, Total=${allForecasts.length}`)

      if (allForecasts.length === 0) {
        console.log(`   ⚠️ ${symbol}: No forecasts within ingress period`)
        continue
      }

      // Detect convergence (require 2+ methods instead of 3 for more results)
      const convergences = detectForecastConvergence(allForecasts, 0.02, 3, 2)
      
      if (convergences.length === 0) {
        console.log(`   ❌ ${symbol}: No convergence detected`)
        continue
      }
      
      // Use the strongest convergence (most methods agreeing)
      const bestConvergence = convergences.reduce((best, conv) => 
        conv.methods.length > best.methods.length ? conv : best
      )
      
      console.log(`   ✅ ${symbol}: Convergence at $${bestConvergence.price.toFixed(2)} on ${bestConvergence.date}`)
      console.log(`      Methods: ${bestConvergence.methods.join(", ")}`)
      
      // Calculate astro boost
      const lunarPhase = getCurrentLunarPhase()
      const expectedSwingType = lastSwing.type === "high" ? "low" : "high"
      const momentum = expectedSwingType === "high" ? "bullish" : "bearish"
      const lunarScore = calculateLunarEntryScore(lunarPhase, momentum)
      const aspectScore = await calculateAspectScore(bestConvergence.date, 7)
      
      // Astro boost: 0 to 0.3 based on alignment
      const normalizedLunar = (lunarScore - 40) / 55 // Maps 40-95 to 0-1
      const normalizedAspect = aspectScore / 100 // Maps 0-100 to 0-1
      const astroBoost = Math.max(0, Math.min(0.3, (normalizedLunar * 0.7 + normalizedAspect * 0.3) * 0.3))
      
      const forecastedSwing: ForecastedSwing = {
        type: expectedSwingType,
        price: bestConvergence.price,
        date: bestConvergence.date,
        convergingMethods: bestConvergence.methods,
        baseConfidence: bestConvergence.confidence,
        astroBoost,
        finalConfidence: Math.min(1, bestConvergence.confidence + astroBoost)
      }
      
      results.push({
        symbol,
        currentPrice,
        lastSwing,
        forecastedSwing,
        ingressValidity: new Date(bestConvergence.date) <= new Date(ingressEnd)
      })
      
    } catch (error) {
      console.error(`   ❌ Error processing ${symbol}:`, error)
    }
  }
  
  console.log(`✅ Found ${results.length} convergence forecasts`)
  return results
}
