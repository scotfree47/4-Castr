// lib/services/confluenceEngine.ts
// UNIFIED VERSION: Combines featured ticker selection + comprehensive rating

import {
  calculateEnhancedLevels,
  getUpcomingSeasonalDates,
  type OHLCVBar,
} from "@/lib/indicators/keyLevels"
import { getSupabaseAdmin } from "@/lib/supabase"

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
      aspectScore = await calculateAspectScore(bars[bars.length - 1].date, 30)
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
    for (const symbol of symbols) {
      const category =
        Object.entries(ALL_TICKERS).find(([cat, syms]) => syms.includes(symbol))?.[0] || "unknown"
      tickersToAnalyze.push({ symbol, category })
    }
  } else if (categories && categories.length > 0) {
    for (const category of categories) {
      const syms = ALL_TICKERS[category as keyof typeof ALL_TICKERS] || []
      tickersToAnalyze.push(...syms.map((s: string) => ({ symbol: s, category })))
    }
  } else {
    for (const [category, syms] of Object.entries(ALL_TICKERS)) {
      tickersToAnalyze.push(...syms.map((s: string) => ({ symbol: s, category })))
    }
  }

  console.log(`📊 Batch rating ${tickersToAnalyze.length} tickers...`)

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
  console.log("🚀 Calculating featured tickers across all categories...")

  const results: Record<string, TickerRating[]> = {}

  for (const [category, symbols] of Object.entries(ALL_TICKERS)) {
    const nonSentinels = symbols.filter((s: string) => !SENTINELS.has(s))

    if (nonSentinels.length === 0) {
      results[category] = []
      continue
    }

    console.log(`\n📈 Processing ${category}: ${nonSentinels.length} symbols`)

    const ratings = await batchCalculateRatings({
      symbols: nonSentinels,
      minScore: 75,
      maxResults: 10,
      parallelism: 5,
    })

    results[category] = ratings.map((r, index) => ({
      ...r,
      rank: index + 1,
    }))

    console.log(`   ✅ ${category}: ${ratings.length} qualified`)
  }

  return results as any
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
  if (bars.length < 5) return 50

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

function calculateVolatilityScore(bars: OHLCVBar[]): number {
  if (bars.length < 10) return 50

  const recent = bars.slice(-10)
  const avgTrueRange = recent.reduce((sum, bar) => sum + (bar.high - bar.low), 0) / recent.length
  const currentPrice = recent[recent.length - 1].close
  const atrPercent = (avgTrueRange / currentPrice) * 100

  if (atrPercent < 0.5) return 30
  if (atrPercent > 5) return 30

  return Math.min(100, 50 + atrPercent * 20)
}

function calculateTrendScore(bars: OHLCVBar[]): number {
  if (bars.length < 50) return 50

  const recent = bars.slice(-50)
  const sma20 = recent.slice(-20).reduce((sum, b) => sum + b.close, 0) / 20
  const sma50 = recent.reduce((sum, b) => sum + b.close, 0) / 50
  const currentPrice = recent[recent.length - 1].close

  let score = 50

  if (currentPrice > sma20 && currentPrice > sma50) score += 25
  if (sma20 > sma50) score += 25
  if (currentPrice < sma20 && currentPrice < sma50) score -= 25
  if (sma20 < sma50) score -= 25

  return Math.max(0, Math.min(100, score))
}

function calculateVolumeScore(bars: OHLCVBar[], targetType: "support" | "resistance"): number {
  if (bars.length < 20) return 50

  const recent = bars.slice(-20)
  const avgVolume = recent.reduce((sum, b) => sum + b.volume, 0) / 20
  const lastVolume = recent[recent.length - 1].volume

  const volumeRatio = lastVolume / avgVolume

  if (volumeRatio > 1.5) return 90
  if (volumeRatio > 1.2) return 75
  if (volumeRatio > 0.8) return 60

  return 40
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
