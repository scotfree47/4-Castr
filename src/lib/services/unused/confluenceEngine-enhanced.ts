// lib/services/confluenceEngine.enhanced.ts
// ENHANCED VERSION: Adds batch rating capabilities for unified ticker scoring
// Works alongside existing confluenceEngine.ts functions

import {
  calculateEnhancedLevels,
  getAllFutureLevels,
  getUpcomingSeasonalDates,
  type OHLCVBar,
} from "@/lib/indicators/keyLevels"
import { supabaseAdmin } from "@/lib/supabase"

// ============================================================================
// ENHANCED RATING INTERFACE
// ============================================================================

export interface EnhancedTickerRating {
  symbol: string
  category: string
  sector: string
  
  // Price data
  currentPrice: number
  priceDate: string
  dataPoints: number
  
  // Next key level
  nextKeyLevel: {
    price: number
    type: "support" | "resistance"
    distancePercent: number
    distancePoints: number
    daysUntilEstimate: number
    confidence: number
  }
  
  // Detailed scoring breakdown
  scores: {
    // Core components (0-100)
    confluence: number          // # of overlapping indicators
    proximity: number           // Distance to next level
    momentum: number            // Recent price momentum
    seasonal: number            // Astrological alignment
    volatility: number          // ATR/volatility conducive to move
    trend: number               // Longer-term trend alignment
    volume: number              // Volume supporting move
    
    // Composite scores
    technical: number           // Average of technical factors
    fundamental: number         // Seasonal + trend
    total: number               // Weighted total
  }
  
  // Classification
  rating: "A+" | "A" | "B+" | "B" | "C+" | "C" | "D" | "F"
  confidence: "very_high" | "high" | "medium" | "low" | "very_low"
  recommendation: "strong_buy" | "buy" | "hold" | "sell" | "strong_sell"
  
  // Contextual info
  ingressAlignment: {
    sign: string
    daysRemaining: number
    favorability: "very_favorable" | "favorable" | "neutral" | "unfavorable"
  }
  
  // Reasoning
  reasons: string[]
  warnings: string[]
  
  // Projections
  projections: {
    reachDate: string
    probability: number
    confidenceInterval: {
      earliest: string
      mostLikely: string
      latest: string
    }
  }
}

// ============================================================================
// BATCH RATING CONFIGURATION
// ============================================================================

export interface BatchRatingOptions {
  // Filtering
  categories?: string[]
  symbols?: string[]
  minScore?: number
  maxResults?: number
  
  // Analysis depth
  lookbackDays?: number          // How much history to analyze
  includeProjections?: boolean   // Calculate future projections
  includeSeasonalData?: boolean  // Factor in astro events
  
  // Performance
  parallelism?: number           // How many concurrent analyses
  cacheResults?: boolean         // Store in database
  refreshCache?: boolean         // Force recalculation
}

// ============================================================================
// ENHANCED CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate trend score (longer-term momentum)
 */
function calculateTrendScore(bars: OHLCVBar[]): number {
  if (bars.length < 50) return 50
  
  const recent = bars.slice(-50)
  const sma20 = recent.slice(-20).reduce((sum, b) => sum + b.close, 0) / 20
  const sma50 = recent.reduce((sum, b) => sum + b.close, 0) / 50
  const currentPrice = recent[recent.length - 1].close
  
  // Score based on price position relative to moving averages
  let score = 50
  
  // Above both = bullish
  if (currentPrice > sma20 && currentPrice > sma50) {
    score += 25
  }
  
  // SMA20 above SMA50 = uptrend
  if (sma20 > sma50) {
    score += 25
  }
  
  // Below both = bearish (lower score)
  if (currentPrice < sma20 && currentPrice < sma50) {
    score -= 25
  }
  
  // SMA20 below SMA50 = downtrend
  if (sma20 < sma50) {
    score -= 25
  }
  
  return Math.max(0, Math.min(100, score))
}

/**
 * Calculate volume score (is volume supporting the move?)
 */
function calculateVolumeScore(
  bars: OHLCVBar[],
  targetType: "support" | "resistance"
): number {
  if (bars.length < 20) return 50
  
  const recent = bars.slice(-20)
  const avgVolume = recent.reduce((sum, b) => sum + b.volume, 0) / 20
  const lastVolume = recent[recent.length - 1].volume
  
  // Recent volume vs average
  const volumeRatio = lastVolume / avgVolume
  
  // Higher volume is generally better
  if (volumeRatio > 1.5) return 90
  if (volumeRatio > 1.2) return 75
  if (volumeRatio > 0.8) return 60
  
  return 40
}

/**
 * Enhanced rating calculation with all factors
 */
export async function calculateEnhancedRating(
  symbol: string,
  category: string,
  options: {
    lookbackDays?: number
    includeProjections?: boolean
    includeSeasonalData?: boolean
  } = {}
): Promise<EnhancedTickerRating | null> {
  try {
    const {
      lookbackDays = 1095,  // 3 years default
      includeProjections = true,
      includeSeasonalData = true,
    } = options
    
    // 1. Fetch ingress period
    const ingressPeriod = await getCurrentIngressPeriod()
    
    // 2. Fetch price data
    const endDate = new Date().toISOString().split("T")[0]
    const startDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000)
      .toISOString().split("T")[0]
    
    const symbolVariants = mapSymbolToDBFormat(symbol)
    let priceRecords = null
    
    for (const variant of symbolVariants) {
      const result = await supabaseAdmin
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
    
    if (!priceRecords || priceRecords.length === 0) {
      return null
    }
    
    // 3. Convert to bars
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
    
    // 4. Calculate levels
    const analysis = calculateEnhancedLevels(bars, currentPrice, {
      swingLength: 20,
      pivotBars: 5,
      currentTime: Date.now(),
      includeGannSquare144: false,
      includeSeasonalDates: includeSeasonalData,
    })
    
    // 5. Find all levels
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
    
    // 6. Find next key level
    const resistances = allLevels
      .filter(l => l.price > currentPrice)
      .sort((a, b) => a.price - b.price)
    
    const supports = allLevels
      .filter(l => l.price < currentPrice)
      .sort((a, b) => b.price - a.price)
    
    const nextLevel = !resistances[0] ? supports[0] :
                     !supports[0] ? resistances[0] :
                     Math.abs(resistances[0].price - currentPrice) < 
                     Math.abs(supports[0].price - currentPrice)
                       ? resistances[0] : supports[0]
    
    if (!nextLevel) return null
    
    const distancePoints = Math.abs(nextLevel.price - currentPrice)
    const distancePercent = (distancePoints / currentPrice) * 100
    const levelType = nextLevel.price > currentPrice ? "resistance" : "support"
    
    // 7. Calculate all scores
    
    // Confluence
    const nearbyLevels = allLevels.filter(l =>
      Math.abs(l.price - nextLevel.price) < currentPrice * 0.005
    )
    const confluenceScore = Math.min(100, nearbyLevels.length * 15)
    
    // Proximity
    const proximityScore = Math.max(0, 100 - distancePercent * 10)
    
    // Momentum
    const momentumScore = calculateMomentumScore(bars, nextLevel.price, levelType)
    
    // Volatility
    const volatilityScore = calculateVolatilityScore(bars)
    
    // Trend
    const trendScore = calculateTrendScore(bars)
    
    // Volume
    const volumeScore = calculateVolumeScore(bars, levelType)
    
    // Seasonal (if enabled)
    let seasonalScore = 50
    if (includeSeasonalData) {
      seasonalScore = await calculateSeasonalScore(
        Date.now(),
        ingressPeriod.end
      )
    }
    
    // 8. Calculate composite scores
    const technicalScore = (
      confluenceScore * 0.3 +
      proximityScore * 0.25 +
      momentumScore * 0.2 +
      trendScore * 0.15 +
      volatilityScore * 0.1
    )
    
    const fundamentalScore = (
      seasonalScore * 0.6 +
      volumeScore * 0.4
    )
    
    const totalScore = (
      technicalScore * 0.7 +
      fundamentalScore * 0.3
    )
    
    // 9. Determine rating letter grade
    const rating = 
      totalScore >= 95 ? "A+" :
      totalScore >= 90 ? "A" :
      totalScore >= 85 ? "B+" :
      totalScore >= 80 ? "B" :
      totalScore >= 70 ? "C+" :
      totalScore >= 60 ? "C" :
      totalScore >= 50 ? "D" : "F"
    
    // 10. Confidence level
    const confidence =
      totalScore >= 90 ? "very_high" :
      totalScore >= 75 ? "high" :
      totalScore >= 60 ? "medium" :
      totalScore >= 40 ? "low" : "very_low"
    
    // 11. Recommendation
    const recommendation =
      totalScore >= 85 && levelType === "resistance" ? "strong_buy" :
      totalScore >= 70 && levelType === "resistance" ? "buy" :
      totalScore >= 85 && levelType === "support" ? "strong_sell" :
      totalScore >= 70 && levelType === "support" ? "sell" :
      "hold"
    
    // 12. Generate reasons
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
    
    // 13. Calculate projections
    let projections = {
      reachDate: "",
      probability: totalScore / 100,
      confidenceInterval: {
        earliest: "",
        mostLikely: "",
        latest: "",
      }
    }
    
    if (includeProjections) {
      const avgDailyMove = bars.slice(-20).reduce((sum, bar, idx, arr) => {
        if (idx === 0) return 0
        return sum + Math.abs(bar.close - arr[idx - 1].close)
      }, 0) / 19
      
      const daysUntil = Math.ceil(distancePoints / avgDailyMove)
      
      projections = {
        reachDate: new Date(Date.now() + daysUntil * 24 * 60 * 60 * 1000)
          .toISOString().split("T")[0],
        probability: totalScore / 100,
        confidenceInterval: {
          earliest: new Date(Date.now() + (daysUntil * 0.5) * 24 * 60 * 60 * 1000)
            .toISOString().split("T")[0],
          mostLikely: new Date(Date.now() + daysUntil * 24 * 60 * 60 * 1000)
            .toISOString().split("T")[0],
          latest: new Date(Date.now() + (daysUntil * 2) * 24 * 60 * 60 * 1000)
            .toISOString().split("T")[0],
        }
      }
    }
    
    // 14. Ingress alignment
    const ingressAlignment = {
      sign: ingressPeriod.sign,
      daysRemaining: ingressPeriod.daysRemaining,
      favorability: 
        seasonalScore >= 80 ? "very_favorable" :
        seasonalScore >= 65 ? "favorable" :
        seasonalScore >= 45 ? "neutral" : "unfavorable" as
        "very_favorable" | "favorable" | "neutral" | "unfavorable"
    }
    
    // 15. Return complete rating
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
        daysUntilEstimate: Math.ceil(distancePoints / (bars.slice(-20).reduce((sum, bar, idx, arr) => {
          if (idx === 0) return 0
          return sum + Math.abs(bar.close - arr[idx - 1].close)
        }, 0) / 19)),
        confidence: totalScore / 100,
      },
      scores: {
        confluence: Math.round(confluenceScore),
        proximity: Math.round(proximityScore),
        momentum: Math.round(momentumScore),
        seasonal: Math.round(seasonalScore),
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
    }
    
  } catch (error) {
    console.error(`Error calculating enhanced rating for ${symbol}:`, error)
    return null
  }
}

/**
 * Batch calculate ratings for multiple symbols
 */
export async function batchCalculateRatings(
  options: BatchRatingOptions = {}
): Promise<EnhancedTickerRating[]> {
  const {
    categories,
    symbols,
    minScore = 0,
    maxResults = 1000,
    lookbackDays = 1095,
    includeProjections = true,
    includeSeasonalData = true,
    parallelism = 5,
    cacheResults = false,
  } = options
  
  // 1. Determine which symbols to analyze
  let tickersToAnalyze: Array<{ symbol: string; category: string }> = []
  
  if (symbols && symbols.length > 0) {
    // Use provided symbol list
    for (const symbol of symbols) {
      // Determine category
      const category = Object.entries(ALL_TICKERS).find(([cat, syms]) =>
        syms.includes(symbol)
      )?.[0] || "unknown"
      
      tickersToAnalyze.push({ symbol, category })
    }
  } else if (categories && categories.length > 0) {
    // Use provided categories
    for (const category of categories) {
      const syms = ALL_TICKERS[category as keyof typeof ALL_TICKERS] || []
      tickersToAnalyze.push(...syms.map(s => ({ symbol: s, category })))
    }
  } else {
    // Default: all tickers
    for (const [category, syms] of Object.entries(ALL_TICKERS)) {
      tickersToAnalyze.push(...syms.map(s => ({ symbol: s, category })))
    }
  }
  
  console.log(`📊 Batch rating ${tickersToAnalyze.length} tickers...`)
  
  // 2. Process in parallel batches
  const results: EnhancedTickerRating[] = []
  
  for (let i = 0; i < tickersToAnalyze.length; i += parallelism) {
    const batch = tickersToAnalyze.slice(i, i + parallelism)
    
    const batchResults = await Promise.all(
      batch.map(({ symbol, category }) =>
        calculateEnhancedRating(symbol, category, {
          lookbackDays,
          includeProjections,
          includeSeasonalData,
        })
      )
    )
    
    results.push(...batchResults.filter((r): r is EnhancedTickerRating => r !== null))
    
    console.log(`   Progress: ${Math.min(i + parallelism, tickersToAnalyze.length)}/${tickersToAnalyze.length}`)
  }
  
  // 3. Filter and sort
  const filtered = results
    .filter(r => r.scores.total >= minScore)
    .sort((a, b) => b.scores.total - a.scores.total)
    .slice(0, maxResults)
  
  // 4. Optionally cache results
  if (cacheResults) {
    await cacheTickerRatings(filtered)
  }
  
  console.log(`✅ Completed: ${filtered.length} ratings`)
  
  return filtered
}

// ============================================================================
// HELPER FUNCTIONS (Imported from main route)
// ============================================================================

function mapSymbolToDBFormat(symbol: string): string[] {
  const cryptoMap: Record<string, string> = {
    BTC: "bitcoin", ETH: "ethereum", BNB: "binancecoin",
    XRP: "ripple", BCH: "bitcoin-cash", SOL: "solana",
    ADA: "cardano", DOT: "polkadot", LINK: "chainlink", XLM: "stellar",
    Bitcoin: "bitcoin", Ethereum: "ethereum", Solana: "solana",
  }
  
  if (cryptoMap[symbol]) return [cryptoMap[symbol], symbol]
  
  if (symbol.includes("/")) {
    return [symbol, symbol.replace("/", "")]
  }
  
  if (symbol.length === 6 && /^[A-Z]{6}$/.test(symbol)) {
    return [symbol, `${symbol.slice(0, 3)}/${symbol.slice(3, 6)}`]
  }
  
  return [symbol]
}

function determineSector(symbol: string, category: string): string {
  // [Same as main route - use your existing sector map]
  return category
}

async function getCurrentIngressPeriod() {
  // [Same as main route]
  const today = new Date().toISOString().split("T")[0]
  
  const { data } = await supabaseAdmin
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

async function cacheTickerRatings(ratings: EnhancedTickerRating[]): Promise<void> {
  // Optional: store in database for caching
  // Implementation depends on your schema
  console.log(`💾 Caching ${ratings.length} ratings...`)
}

// All tickers constant
const ALL_TICKERS = {
  equity: ['SPY', 'QQQ', 'XLY', 'AAL', 'AIG', 'AMZN', 'AXP', 'BA', 'BABA', 'BAC', 'C', 'CLF', 'CLSK', 'COST', 'CSCO', 'CVX', 'DIS', 'DKNG', 'EQT', 'F', 'GE', 'GS', 'HLT', 'HP', 'IBM', 'IBIT', 'ILMN', 'INTC', 'JNJ', 'JPM', 'KO', 'LYV', 'MRVL', 'NKE', 'NUE', 'NVDA', 'PG', 'PTON', 'QCOM', 'RACE', 'RIOT', 'RKT', 'SPCE', 'T', 'TEVA', 'TSLA', 'V', 'WKHS', 'WMG'],
  commodity: ['USO', 'CL1!', 'NG1!', 'GLD', 'GC1!', 'SLV', 'SI1!', 'COPX', 'HG1!', 'WEAT', 'ZW1!', 'CORN', 'ZC1!', 'CT1!', 'SB1!', 'KC1!', 'ZS1!', 'ZL1!', 'LE1!'],
  forex: ['EUR/USD', 'USD/JPY', 'GBP/JPY', 'GBP/NZD', 'EUR/NZD', 'GBP/AUD', 'GBP/CAD', 'NZD/CAD', 'NZD/CHF', 'AUD/NZD'],
  crypto: ['Bitcoin', 'Ethereum', 'BNB', 'XRP', 'BCH', 'Solana', 'Cardano', 'Polkadot', 'Chainlink', 'Stellar'],
  'rates-macro': ['TNX', 'TLT', 'DXY', 'UNRATE', 'FEDFUNDS', 'CPI', 'PCE', 'NFP'],
  stress: ['VIX', 'VVIX', 'MOVE', 'VXN', 'RVX', 'TRIN', 'TYX', 'BVOL'],
}
