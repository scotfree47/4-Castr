// lib/services/confluenceEngine.ts
// COMPLETE FRAMEWORK: ATR% + Fib + Gann + Lunar (Gann-inspired systematic trading)

import {
  calculateEnhancedLevels,
  getUpcomingSeasonalDates,
  type OHLCVBar,
} from "@/lib/indicators/keyLevels"
import { getSupabaseAdmin } from "@/lib/supabase"
import { ATR, BollingerBands, EMA, MACD, OBV, RSI } from "technicalindicators"
import { getCurrentIngressPeriod } from "../utils"

// ============================================================================
// FRAMEWORK CONFIGURATION
// ============================================================================

interface ATRHorizon {
  bars: number
  minATR: number
  maxATR: number
  function: string
}

const ATR_HORIZONS: Record<string, ATRHorizon> = {
  weekly: { bars: 5, minATR: 1, maxATR: 1.5, function: "Reaction / probe" },
  biweekly: { bars: 10, minATR: 2, maxATR: 3, function: "Normal swing" },
  monthly: { bars: 20, minATR: 3, maxATR: 5, function: "Primary leg" },
  quarterly: { bars: 60, minATR: 6, maxATR: 10, function: "Exhaustion / regime shift" },
}

export function getATRThreshold(category: string, symbol?: string): number {
  switch (category) {
    case "equity":
      return 2
    case "commodity":
      return 2.5
    case "forex":
      return 2
    case "crypto":
      return symbol && ["BTC", "ETH", "Bitcoin", "Ethereum"].includes(symbol) ? 3 : 3.5
    case "rates-macro":
      return 2
    case "stress":
      return 2
    default:
      return 2
  }
}

export function meetsATRThreshold(
  currentPrice: number,
  targetPrice: number,
  atr14: number,
  category: string,
  symbol?: string
): boolean {
  if (!atr14 || atr14 === 0) return false
  const priceDiff = Math.abs(targetPrice - currentPrice)
  const atrMultiple = priceDiff / atr14
  return atrMultiple >= getATRThreshold(category, symbol)
}

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
    confidenceInterval: { earliest: string; mostLikely: string; latest: string }
  }
  rank?: number
  confluenceScore?: number
  tradeabilityScore?: number
  reason?: string
  atr14?: number
  atrMultiple?: number
}

interface ATRAnalysis {
  current: number
  currentPercent: number
  average: number
  state: "compression" | "expansion" | "neutral"
  strength: number
}

interface FibATROverlap {
  fibLevel: number
  fibRatio: number
  atrMultiple: number
  quality: "excellent" | "good" | "fair" | "poor"
  score: number
}

interface GannValidation {
  timeSymmetry: boolean
  priceSquare: boolean
  angleHolding: boolean
  quality: "excellent" | "good" | "fair" | "poor"
  score: number
}

interface LunarTiming {
  phase: string
  daysToPhase: number
  entryFavorability: number
  exitFavorability: number
  recommendation: "favorable_entry" | "favorable_exit" | "neutral" | "caution"
}

export interface ForecastedSwing {
  type: "high" | "low"
  price: number
  date: string
  convergingMethods: string[]
  baseConfidence: number
  astroBoost: number
  finalConfidence: number
  atrHorizon?: string
  fibOverlap?: FibATROverlap
  gannValidation?: GannValidation
  lunarTiming?: LunarTiming
  atrAnalysis?: ATRAnalysis
}

interface SwingPoint {
  type: "high" | "low"
  price: number
  date: string
  barIndex: number
}

interface MethodForecast {
  method: string
  price: number
  date: string
  confidence: number
  horizon?: string
}

export interface PriceDataPoint {
  symbol: string
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface TradingWindow {
  startDate: string
  endDate: string
  type: "high_probability" | "moderate" | "avoid" | "extreme_volatility"
  technicalConfluence: number
  astrologicalAlignment: number
  combinedScore: number
  daysInWindow: number
  keyLevels: number[]
  reasons: string[]
  emoji: string
  atrState?: "compression" | "expansion" | "neutral"
  lunarPhase?: string
}

// ============================================================================
// ATR VOLATILITY ANALYSIS (Step 1)
// ============================================================================

function analyzeATRVolatility(bars: OHLCVBar[], currentPrice: number): ATRAnalysis {
  const highs = bars.map((b) => b.high),
    lows = bars.map((b) => b.low),
    closes = bars.map((b) => b.close)
  const atrValues = ATR.calculate({ high: highs, low: lows, close: closes, period: 14 })

  if (!atrValues || atrValues.length < 20)
    return { current: 0, currentPercent: 0, average: 0, state: "neutral", strength: 50 }

  const currentATR = atrValues[atrValues.length - 1]
  const currentPercent = (currentATR / currentPrice) * 100
  const recentATRPercents = atrValues
    .slice(-20)
    .map((atr, idx) => (atr / closes[closes.length - 20 + idx]) * 100)
  const avgATRPercent = recentATRPercents.reduce((a, b) => a + b, 0) / recentATRPercents.length
  const ratio = currentPercent / avgATRPercent

  let state: "compression" | "expansion" | "neutral", strength: number
  if (ratio < 0.85) {
    state = "compression"
    strength = Math.max(0, Math.min(100, (1 - ratio) * 200))
  } else if (ratio > 1.15) {
    state = "expansion"
    strength = Math.max(0, Math.min(100, (ratio - 1) * 200))
  } else {
    state = "neutral"
    strength = 50
  }

  return { current: currentATR, currentPercent, average: avgATRPercent, state, strength }
}

// ============================================================================
// FIB + ATR OVERLAP VALIDATION (Step 4)
// ============================================================================

function validateFibATROverlap(
  currentPrice: number,
  targetPrice: number,
  atr14: number,
  lastSwingPrice: number,
  lastSwingType: "high" | "low"
): FibATROverlap | null {
  if (!atr14 || atr14 === 0) return null

  const swingRange = Math.abs(currentPrice - lastSwingPrice)
  const fibRatios = [
    { ratio: 0.382, quality: "fair" as const, baseScore: 60 },
    { ratio: 0.5, quality: "fair" as const, baseScore: 65 },
    { ratio: 0.618, quality: "excellent" as const, baseScore: 90 },
    { ratio: 1.0, quality: "good" as const, baseScore: 75 },
    { ratio: 1.618, quality: "excellent" as const, baseScore: 95 },
  ]

  const fibLevels = fibRatios.map((fib) => ({
    price:
      lastSwingType === "low"
        ? lastSwingPrice + swingRange * fib.ratio
        : lastSwingPrice - swingRange * fib.ratio,
    ratio: fib.ratio,
    quality: fib.quality,
    baseScore: fib.baseScore,
  }))

  const priceDiff = Math.abs(targetPrice - currentPrice)
  const atrMultiple = priceDiff / atr14

  for (const fib of fibLevels) {
    if (Math.abs(targetPrice - fib.price) / currentPrice < 0.02) {
      return {
        fibLevel: fib.price,
        fibRatio: fib.ratio,
        atrMultiple,
        quality: fib.quality,
        score: fib.baseScore,
      }
    }
  }
  return null
}

// ============================================================================
// GANN STRUCTURE VALIDATION (Step 5)
// ============================================================================

function validateGannStructure(
  currentPrice: number,
  targetPrice: number,
  forecastDate: string,
  lastSwingDate: string,
  lastSwingPrice: number,
  lastSwingType: "high" | "low",
  atr14: number
): GannValidation {
  const currentDate = new Date(),
    lastSwing = new Date(lastSwingDate),
    forecast = new Date(forecastDate)
  const priorSwingDuration = Math.floor(
    (currentDate.getTime() - lastSwing.getTime()) / (1000 * 60 * 60 * 24)
  )
  const forecastDuration = Math.floor(
    (forecast.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
  )
  const timeRatio = forecastDuration / Math.max(1, priorSwingDuration)
  const timeSymmetry = timeRatio >= 0.7 && timeRatio <= 1.3
  const gannBars = [5, 10, 20, 60]
  const priceSquare = gannBars.some((bars) => Math.abs(forecastDuration - bars) <= 2)
  const priceMove = Math.abs(targetPrice - lastSwingPrice)
  const pricePerDay = priceMove / Math.max(1, forecastDuration)
  const atrPerDay = atr14 / 14
  const angleRatio = pricePerDay / atrPerDay
  const angleHolding = angleRatio >= 0.8 && angleRatio <= 1.2

  let score = 40
  if (timeSymmetry) score += 20
  if (priceSquare) score += 25
  if (angleHolding) score += 15

  const quality: "excellent" | "good" | "fair" | "poor" =
    score >= 85 ? "excellent" : score >= 70 ? "good" : score >= 55 ? "fair" : "poor"
  return { timeSymmetry, priceSquare, angleHolding, quality, score }
}

// ============================================================================
// LUNAR TIMING REFINEMENT (Step 6)
// ============================================================================

function getLunarPhase(date?: Date): { phase: string; dayInCycle: number } {
  const referenceNewMoon = new Date("2025-01-13")
  const targetDate = date || new Date()
  const daysSinceReference = Math.floor(
    (targetDate.getTime() - referenceNewMoon.getTime()) / (1000 * 60 * 60 * 24)
  )
  const lunarCycle = 29.53
  const dayInCycle = ((daysSinceReference % lunarCycle) + lunarCycle) % lunarCycle

  let phase: string
  if (dayInCycle < 1) phase = "New Moon"
  else if (dayInCycle < 7.4) phase = "Waxing Crescent"
  else if (dayInCycle < 8.4) phase = "First Quarter"
  else if (dayInCycle < 14.8) phase = "Waxing Gibbous"
  else if (dayInCycle < 15.8) phase = "Full Moon"
  else if (dayInCycle < 22.2) phase = "Waning Gibbous"
  else if (dayInCycle < 23.2) phase = "Last Quarter"
  else phase = "Waning Crescent"

  return { phase, dayInCycle }
}

function analyzeLunarTiming(
  forecastDate: string,
  swingType: "high" | "low",
  atrState: "compression" | "expansion" | "neutral"
): LunarTiming {
  const forecast = new Date(forecastDate)
  const { phase, dayInCycle } = getLunarPhase(forecast)

  const daysToNewMoon = dayInCycle < 14.8 ? 0 - dayInCycle : 29.53 - dayInCycle
  const daysToFullMoon = dayInCycle < 14.8 ? 14.8 - dayInCycle : 14.8 + (29.53 - dayInCycle)
  const daysToPhase = Math.min(Math.abs(daysToNewMoon), Math.abs(daysToFullMoon))

  let entryFavorability = 50
  if (phase === "New Moon" || phase === "Waxing Crescent")
    entryFavorability = swingType === "high" ? 90 : 40
  else if (phase === "First Quarter" || phase === "Waxing Gibbous")
    entryFavorability = swingType === "high" ? 85 : 45
  else if (phase === "Last Quarter" || phase === "Waning Crescent")
    entryFavorability = swingType === "low" ? 85 : 40

  if (atrState === "expansion" && (phase === "First Quarter" || phase === "Waxing Gibbous"))
    entryFavorability = Math.min(100, entryFavorability + 10)

  let exitFavorability = 50
  if (phase === "Full Moon" || Math.abs(daysToFullMoon) <= 2) exitFavorability = 95
  else if (phase === "Last Quarter") exitFavorability = 75

  let recommendation: "favorable_entry" | "favorable_exit" | "neutral" | "caution"
  if (entryFavorability >= 80 && atrState === "compression") recommendation = "favorable_entry"
  else if (exitFavorability >= 85) recommendation = "favorable_exit"
  else if (entryFavorability < 45) recommendation = "caution"
  else recommendation = "neutral"

  return { phase, daysToPhase, entryFavorability, exitFavorability, recommendation }
}

export async function calculateAstroConfirmation(
  forecastDate: string,
  currentPrice: number,
  keyLevels: Array<{ price: number; type: string; strength: number }>
): Promise<{ score: number; reasons: string[] }> {
  const reasons: string[] = []
  let totalScore = 0

  // 1. Proximity to key levels (40% weight)
  if (keyLevels.length > 0) {
    const proximityScores = keyLevels.map((level) => {
      const distance = Math.abs((level.price - currentPrice) / currentPrice) * 100
      let score = 0
      if (distance < 1) score = 95
      else if (distance < 2) score = 85
      else if (distance < 3) score = 75
      else if (distance < 5) score = 65
      else score = 50
      return score * (level.strength / 10) // Weight by level strength
    })
    const proximityScore = Math.max(...proximityScores)
    totalScore += proximityScore * 0.4

    if (proximityScore >= 85) reasons.push("Near critical confluence zone")
  } else {
    totalScore += 50 * 0.4 // Neutral if no levels provided
  }

  // 2. Aspect score (40% weight) - 1-day window around forecast
  const aspectScore = await calculateAspectScore(forecastDate, 1)
  totalScore += aspectScore * 0.4

  if (aspectScore >= 85) reasons.push("Highly harmonious aspects")
  else if (aspectScore >= 75) reasons.push("Favorable planetary aspects")
  else if (aspectScore < 40) reasons.push("Challenging aspect configuration")

  // 3. Seasonal score (20% weight)
  const ingressPeriod = await getCurrentIngressPeriod()
  const seasonalScore = await calculateSeasonalScore(
    new Date(forecastDate).getTime(),
    ingressPeriod.end
  )
  totalScore += seasonalScore * 0.2

  if (seasonalScore >= 75) reasons.push("Strong seasonal alignment")

  return {
    score: Math.round(totalScore),
    reasons: reasons.length > 0 ? reasons : ["Standard astrological conditions"],
  }
}

// ============================================================================
// CORE TICKER RATING
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

    // Validate bars have valid timestamps
    const validBars = bars.filter((bar) => !isNaN(bar.time) && bar.time > 0)
    if (validBars.length < 30) {
      console.warn(`Insufficient valid data for ${symbol}: ${validBars.length} bars`)
      return null
    }

    const currentPrice = validBars[validBars.length - 1].close
    const lastValidDate = priceRecords[priceRecords.length - 1].date

    // Validate date before converting to ISO string
    const priceDate =
      lastValidDate && !isNaN(new Date(lastValidDate).getTime())
        ? lastValidDate
        : new Date().toISOString().split("T")[0]

    const atrAnalysis = analyzeATRVolatility(validBars, currentPrice)
    const analysis = calculateEnhancedLevels(validBars, currentPrice, {
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
    const momentumScore = calculateMomentumScore(validBars, nextLevel.price, levelType)
    const volatilityScore = calculateVolatilityScore(validBars)
    const trendScore = calculateTrendScore(validBars)
    const volumeScore = calculateVolumeScore(validBars, levelType)

    let seasonalScore = 50,
      aspectScore = 50
    if (includeSeasonalData) {
      seasonalScore = await calculateSeasonalScore(Date.now(), ingressPeriod.end)
      aspectScore = await calculateAspectScore(
        new Date(bars[bars.length - 1].time).toISOString().split("T")[0],
        30
      )
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

    const reasons: string[] = [],
      warnings: string[] = []
    if (confluenceScore >= 75) reasons.push(`Strong confluence (${nearbyLevels.length} indicators)`)
    if (proximityScore >= 75) reasons.push(`Close proximity (${distancePercent.toFixed(1)}%)`)
    if (momentumScore >= 75) reasons.push("Favorable momentum")
    if (trendScore >= 75) reasons.push("Aligned with trend")
    if (seasonalScore >= 75) reasons.push("Strong seasonal alignment")
    if (volumeScore >= 75) reasons.push("Volume supporting move")
    if (atrAnalysis.state === "compression") reasons.push("ATR compression - setup phase")
    if (atrAnalysis.state === "expansion" && atrAnalysis.strength > 75)
      warnings.push("High ATR expansion - potential exhaustion")
    if (distancePercent > 5) warnings.push("Target is relatively far")
    if (volatilityScore < 40) warnings.push("Low volatility may slow movement")
    if (trendScore < 40) warnings.push("Moving against trend")

    const avgDailyMove =
      validBars
        .slice(-20)
        .reduce(
          (sum, bar, idx, arr) => (idx === 0 ? 0 : sum + Math.abs(bar.close - arr[idx - 1].close)),
          0
        ) / 19
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

    const highs = validBars.map((b) => b.high),
      lows = validBars.map((b) => b.low),
      closes = validBars.map((b) => b.close)
    const atrValues = ATR.calculate({ high: highs, low: lows, close: closes, period: 14 })
    const atr14 = atrValues.length > 0 ? atrValues[atrValues.length - 1] : 0
    const atrMultiple = atr14 > 0 ? distancePoints / atr14 : 0

    return {
      symbol,
      category,
      sector: determineSector(symbol, category),
      currentPrice,
      priceDate,
      dataPoints: validBars.length,
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
      atr14,
      atrMultiple,
    }
  } catch (error) {
    console.error(`Error calculating rating for ${symbol}:`, error)
    return null
  }
}

// ============================================================================
// BULK OPERATIONS & HELPERS
// ============================================================================

export async function fetchBulkPriceHistory(
  symbols: string[],
  startDate: string,
  endDate: string
): Promise<Map<string, PriceDataPoint[]>> {
  const { data, error } = await getSupabaseAdmin()
    .from("financial_data")
    .select("symbol, date, open, high, low, close, volume")
    .in("symbol", symbols)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true })
  if (error) throw new Error(`Price fetch failed: ${error.message}`)
  const priceMap = new Map<string, PriceDataPoint[]>()
  data?.forEach((point: PriceDataPoint) => {
    if (!priceMap.has(point.symbol)) priceMap.set(point.symbol, [])
    priceMap.get(point.symbol)!.push(point)
  })
  return priceMap
}

export async function fetchLatestPrices(symbols: string[]): Promise<Map<string, number>> {
  const { data } = await getSupabaseAdmin()
    .from("financial_data")
    .select("symbol, close, date")
    .in("symbol", symbols)
    .order("date", { ascending: false })
  const priceMap = new Map<string, number>()
  data?.forEach((point: { symbol: string; close: number; date: string }) => {
    if (!priceMap.has(point.symbol)) priceMap.set(point.symbol, point.close)
  })
  return priceMap
}

export async function fetchTickersByCategory(
  category?: string,
  limit: number = 100
): Promise<any[]> {
  let query = getSupabaseAdmin().from("ticker_universe").select("*").eq("active", true)
  if (category) query = query.eq("category", category)
  const { data, error } = await query.limit(limit)
  if (error) throw new Error(`Ticker fetch failed: ${error.message}`)
  return data || []
}

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
      let category =
        Object.entries(ALL_TICKERS).find(([cat, syms]) => syms.includes(symbol))?.[0] || "unknown"
      try {
        const { data } = await getSupabaseAdmin()
          .from("ticker_universe")
          .select("category")
          .eq("symbol", symbol)
          .single()
        if (data?.category) category = data.category
      } catch (e) {}
      tickersToAnalyze.push({ symbol, category })
    }
  } else if (categories && categories.length > 0) {
    for (const category of categories) {
      try {
        const tickersFromDb = await fetchTickersByCategory(category, maxResults)
        tickersToAnalyze.push(...tickersFromDb.map((t: any) => ({ symbol: t.symbol, category })))
      } catch (error) {
        const syms = ALL_TICKERS[category as keyof typeof ALL_TICKERS] || []
        tickersToAnalyze.push(...syms.map((s: string) => ({ symbol: s, category })))
      }
    }
  } else {
    const allCategories = ["equity", "commodity", "forex", "crypto", "rates-macro", "stress"]
    for (const category of allCategories) {
      try {
        const tickersFromDb = await fetchTickersByCategory(category, maxResults)
        tickersToAnalyze.push(...tickersFromDb.map((t: any) => ({ symbol: t.symbol, category })))
      } catch (error) {
        const syms = ALL_TICKERS[category as keyof typeof ALL_TICKERS] || []
        tickersToAnalyze.push(...syms.map((s: string) => ({ symbol: s, category })))
      }
    }
  }

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
  }

  const scoreFiltered = results.filter((r) => r.scores.total >= minScore)
  const atrFiltered = scoreFiltered.filter(
    (r) =>
      r.atr14 &&
      r.atr14 > 0 &&
      meetsATRThreshold(r.currentPrice, r.nextKeyLevel.price, r.atr14, r.category, r.symbol)
  )
  return atrFiltered.sort((a, b) => b.scores.total - a.scores.total).slice(0, maxResults)
}

// ============================================================================
// FEATURED TICKERS - SEE data-manager.ts FOR CRON-SAFE IMPLEMENTATION
// ============================================================================
// The calculateAllFeaturedTickers() function has been removed because:
// 1. It attempts to process 1000+ symbols sequentially
// 2. Each symbol requires 120 bars of historical data
// 3. This exceeds GitHub Actions 15-minute timeout
//
// Instead, use the optimized populateFeaturedTickers() in data-manager.ts which:
// - Limits to 50 symbols per category
// - Uses batchCalculateRatings with disabled expensive features
// - Falls back to ratings when convergence detection times out
// ============================================================================

export async function fetchFeaturedTickersFromCache(category?: string): Promise<any[]> {
  try {
    let query = getSupabaseAdmin()
      .from("featured_tickers")
      .select("*")
      .order("rank", { ascending: true })
    if (category) query = query.eq("category", category)
    const { data, error } = await query
    if (error) return []
    return data || []
  } catch (error) {
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
    for (const category of categories)
      await getSupabaseAdmin().from("featured_tickers").delete().eq("category", category)
    for (const row of rows) await getSupabaseAdmin().from("featured_tickers").insert([row])
  } catch (error) {
    throw error
  }
}

export async function shouldRefreshFeatured(): Promise<{ shouldRefresh: boolean; reason: string }> {
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
    if (error || !ingressData || ingressData.length === 0)
      return { shouldRefresh: false, reason: "No ingress data" }

    const currentIngress = ingressData[0]
    const daysSincePeriodStart = Math.floor(
      (new Date().getTime() - new Date(currentIngress.date).getTime()) / (1000 * 60 * 60 * 24)
    )
    if (daysSincePeriodStart === 0)
      return { shouldRefresh: true, reason: "New ingress period started" }
    if (daysSincePeriodStart % 7 === 0 && daysSincePeriodStart > 0)
      return { shouldRefresh: true, reason: "Weekly refresh" }

    const { data: lastUpdate } = await getSupabaseAdmin()
      .from("featured_tickers")
      .select("updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single()
    if (!lastUpdate) return { shouldRefresh: true, reason: "No existing data" }

    const hoursSinceUpdate = Math.floor(
      (new Date().getTime() - new Date(lastUpdate.updated_at).getTime()) / (1000 * 60 * 60)
    )
    if (hoursSinceUpdate >= 24) return { shouldRefresh: true, reason: "Data older than 24 hours" }

    return { shouldRefresh: false, reason: "No refresh needed" }
  } catch (error) {
    return { shouldRefresh: false, reason: "Error checking" }
  }
}

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
  if (symbol.length === 6 && /^[A-Z]{6}$/.test(symbol))
    return [symbol, `${symbol.slice(0, 3)}/${symbol.slice(3, 6)}`]
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

{
  /*
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
    const now = new Date(),
      future = new Date(now)
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
  const daysRemaining = Math.floor(
    (nextDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  )
  return {
    start: current.date,
    end: nextDate.toISOString().split("T")[0],
    sign: current.sign || "Unknown",
    daysRemaining,
  }
}
*/
}

function calculateMomentumScore(
  bars: OHLCVBar[],
  targetPrice: number,
  targetType: "support" | "resistance"
): number {
  if (bars.length < 26) {
    if (bars.length < 5) return 50
    const recent = bars.slice(-5)
    const currentPrice = recent[recent.length - 1].close
    const priceChange = currentPrice - recent[0].close
    const direction = priceChange > 0 ? "up" : "down"
    if (
      (targetType === "resistance" && direction === "up") ||
      (targetType === "support" && direction === "down")
    ) {
      const momentum = Math.abs(priceChange / recent[0].close) * 100
      return Math.min(100, 50 + momentum * 10)
    }
    return Math.max(0, 50 - Math.abs(priceChange / recent[0].close) * 100 * 10)
  }

  try {
    const closes = bars.map((b) => b.close)
    const currentPrice = closes[closes.length - 1]
    const rsiValues = RSI.calculate({ values: closes, period: 14 })
    if (!rsiValues || rsiValues.length === 0) return 50
    const rsi = rsiValues[rsiValues.length - 1]

    const macdValues = MACD.calculate({
      values: closes,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    })
    if (!macdValues || macdValues.length === 0) return Math.round(Math.max(0, Math.min(100, rsi)))

    const histogram = macdValues[macdValues.length - 1].histogram ?? 0
    const normalizedHist = Math.max(-2, Math.min(2, histogram / (currentPrice * 0.01)))
    const macdScore = 50 + normalizedHist * 25
    let rawScore = rsi * 0.7 + macdScore * 0.3
    const movingTowardTarget =
      (targetType === "resistance" && currentPrice < targetPrice) ||
      (targetType === "support" && currentPrice > targetPrice)
    if (movingTowardTarget) rawScore = Math.min(100, rawScore * 1.15)
    else rawScore = Math.max(0, rawScore * 0.85)
    return Math.round(Math.max(0, Math.min(100, rawScore)))
  } catch (error) {
    return 50
  }
}

function calculateVolatilityScore(bars: OHLCVBar[]): number {
  if (bars.length < 20) {
    if (bars.length < 10) return 50
    const recent = bars.slice(-10)
    const avgTrueRange = recent.reduce((sum, bar) => sum + (bar.high - bar.low), 0) / recent.length
    const atrPercent = (avgTrueRange / recent[recent.length - 1].close) * 100
    if (atrPercent < 0.5) return 30
    if (atrPercent > 5) return 30
    return Math.min(100, 50 + atrPercent * 20)
  }

  try {
    const highs = bars.map((b) => b.high),
      lows = bars.map((b) => b.low),
      closes = bars.map((b) => b.close)
    const atrValues = ATR.calculate({ high: highs, low: lows, close: closes, period: 14 })
    if (!atrValues || atrValues.length === 0) return 50
    const atr = atrValues[atrValues.length - 1]
    const atrPercent = (atr / closes[closes.length - 1]) * 100
    let atrScore: number
    if (atrPercent < 0.5 || atrPercent > 5) atrScore = 30
    else atrScore = 100 - Math.abs(atrPercent - 2.75) * 22.2

    const bbValues = BollingerBands.calculate({ values: closes, period: 20, stdDev: 2 })
    if (!bbValues || bbValues.length === 0) return Math.round(Math.max(0, Math.min(100, atrScore)))
    const bbLast = bbValues[bbValues.length - 1]
    const bbPercent = (bbLast.upper - bbLast.lower) / bbLast.middle
    let bbScore: number
    if (bbPercent < 0.2 || bbPercent > 0.8) bbScore = 80
    else if (bbPercent >= 0.4 && bbPercent <= 0.6) bbScore = 50
    else bbScore = 65

    return Math.round(Math.max(0, Math.min(100, atrScore * 0.7 + bbScore * 0.3)))
  } catch (error) {
    return 50
  }
}

function calculateTrendScore(bars: OHLCVBar[]): number {
  if (bars.length < 50) return 50

  try {
    const closes = bars.map((b) => b.close)
    const ema12Values = EMA.calculate({ values: closes, period: 12 })
    const ema26Values = EMA.calculate({ values: closes, period: 26 })

    if (!ema12Values || ema12Values.length === 0 || !ema26Values || ema26Values.length === 0) {
      const recent = bars.slice(-50)
      const sma20 = recent.slice(-20).reduce((sum, b) => sum + b.close, 0) / 20
      const sma50 = recent.reduce((sum, b) => sum + b.close, 0) / 50
      let score = 50
      if (closes[closes.length - 1] > sma20 && closes[closes.length - 1] > sma50) score += 25
      if (sma20 > sma50) score += 25
      if (closes[closes.length - 1] < sma20 && closes[closes.length - 1] < sma50) score -= 25
      if (sma20 < sma50) score -= 25
      return Math.max(0, Math.min(100, score))
    }

    const ema12 = ema12Values[ema12Values.length - 1]
    const ema26 = ema26Values[ema26Values.length - 1]
    let crossoverScore = 50

    if (closes[closes.length - 1] > ema12 && closes[closes.length - 1] > ema26) crossoverScore += 20
    if (closes[closes.length - 1] < ema12 && closes[closes.length - 1] < ema26) crossoverScore -= 20
    if (ema12 > ema26) crossoverScore += 20
    if (ema12 < ema26) crossoverScore -= 20

    if (ema26Values.length >= 5) {
      const ema26_5ago = ema26Values[ema26Values.length - 5]
      const slope = ((ema26 - ema26_5ago) / ema26_5ago) * 100
      let slopeScore: number
      if (slope > 1.5) slopeScore = 85
      else if (slope > 0.5) slopeScore = 70
      else if (slope > -0.5) slopeScore = 50
      else if (slope > -1.5) slopeScore = 30
      else slopeScore = 15
      return Math.round(Math.max(0, Math.min(100, crossoverScore * 0.6 + slopeScore * 0.4)))
    }

    return Math.round(Math.max(0, Math.min(100, crossoverScore)))
  } catch (error) {
    return 50
  }
}

function calculateVolumeScore(bars: OHLCVBar[], targetType: "support" | "resistance"): number {
  if (bars.length < 20) return 50

  try {
    const recent = bars.slice(-20)
    const closes = recent.map((b) => b.close),
      volumes = recent.map((b) => b.volume)
    const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length
    const volumeRatio = volumes[volumes.length - 1] / avgVolume
    let ratioScore: number
    if (volumeRatio > 1.5) ratioScore = 90
    else if (volumeRatio > 1.2) ratioScore = 75
    else if (volumeRatio > 0.8) ratioScore = 60
    else ratioScore = 40

    const obvValues = OBV.calculate({ close: closes, volume: volumes })
    if (!obvValues || obvValues.length < 10) return Math.round(ratioScore)

    const obvCurrent = obvValues[obvValues.length - 1]
    const obv10ago = obvValues[obvValues.length - 10]
    const obvTrend = ((obvCurrent - obv10ago) / Math.abs(obv10ago || 1)) * 100
    let obvScore: number
    if (obvTrend > 5) obvScore = 85
    else if (obvTrend > 2) obvScore = 70
    else if (obvTrend > -2) obvScore = 50
    else if (obvTrend > -5) obvScore = 30
    else obvScore = 15

    if (targetType === "resistance" && obvScore < 50) obvScore = 100 - obvScore
    return Math.round(Math.max(0, Math.min(100, obvScore * 0.6 + ratioScore * 0.4)))
  } catch (error) {
    return 50
  }
}

async function calculateSeasonalScore(currentTime: number, ingressEnd: string): Promise<number> {
  try {
    const daysUntilEnd = Math.floor(
      (new Date(ingressEnd).getTime() - currentTime) / (1000 * 60 * 60 * 24)
    )
    const seasonalDates = getUpcomingSeasonalDates(currentTime, daysUntilEnd)
    if (seasonalDates.length === 0) return 50
    const avgStrength = seasonalDates.reduce((sum, s) => sum + s.strength, 0) / seasonalDates.length
    return Math.min(100, avgStrength * 10)
  } catch {
    return 50
  }
}

async function calculateAspectScore(
  currentDate: string,
  lookAheadDays: number = 30
): Promise<number> {
  try {
    const startDateObj = new Date(currentDate)
    if (isNaN(startDateObj.getTime())) return 50
    const endDate = new Date(startDateObj)
    endDate.setDate(endDate.getDate() + lookAheadDays)
    if (isNaN(endDate.getTime())) return 50
    const endDateStr = endDate.toISOString().split("T")[0]

    let { data: aspects, error } = await getSupabaseAdmin()
      .from("astro_aspects")
      .select("*")
      .gte("date", currentDate)
      .lte("date", endDateStr)

    if (error || !aspects || aspects.length === 0) {
      const historyStartObj = new Date(startDateObj)
      historyStartObj.setFullYear(historyStartObj.getFullYear() - 1)
      const historyEndObj = new Date(endDate)
      historyEndObj.setFullYear(historyEndObj.getFullYear() - 1)
      const { data: historicalAspects, error: histError } = await getSupabaseAdmin()
        .from("astro_aspects")
        .select("*")
        .gte("date", historyStartObj.toISOString().split("T")[0])
        .lte("date", historyEndObj.toISOString().split("T")[0])
      if (histError || !historicalAspects || historicalAspects.length === 0) return 50
      aspects = historicalAspects
    }

    const aspectWeights: Record<string, { score: number; impact: number }> = {
      conjunction: { score: 8, impact: 1.5 },
      trine: { score: 10, impact: 1.3 },
      sextile: { score: 7, impact: 1.1 },
      square: { score: 2, impact: 1.4 },
      opposition: { score: 3, impact: 1.3 },
    }

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

    const aspectsByDate: Record<string, any[]> = {}
    aspects.forEach((aspect: any) => {
      if (!aspectsByDate[aspect.date]) aspectsByDate[aspect.date] = []
      aspectsByDate[aspect.date].push(aspect)
    })

    let totalScore = 0,
      totalImpact = 0

    Object.entries(aspectsByDate).forEach(([date, dayAspects]) => {
      const confluenceMultiplier = 1 + Math.log10(dayAspects.length) * 0.3
      const daysUntilAspect = Math.max(
        0,
        (new Date(date).getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)
      )
      const proximityMultiplier = Math.max(0.5, 1 - daysUntilAspect / (lookAheadDays * 2))

      dayAspects.forEach((aspect: any) => {
        const weight = aspectWeights[aspect.aspect_type]
        if (!weight) return
        const exactMultiplier = aspect.exact ? 1.5 : 1.0
        const orbMultiplier = aspect.orb !== null ? Math.max(0.5, 1 - aspect.orb / 10) : 1.0
        const body1Weight = planetaryWeights[aspect.body1?.toLowerCase()] || 1.0
        const body2Weight = planetaryWeights[aspect.body2?.toLowerCase()] || 1.0
        const planetaryMultiplier = (body1Weight + body2Weight) / 2
        const influenceWeight = aspect.influence_weight || 1.0
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

    const avgScore = totalImpact > 0 ? totalScore / totalImpact : 5
    return Math.min(100, Math.max(0, avgScore * 10))
  } catch (error) {
    return 50
  }
}

// ============================================================================
// CONVERGENCE FORECASTING
// ============================================================================

function findLastSwing(bars: OHLCVBar[]): SwingPoint | null {
  if (bars.length < 10) return null
  const swingBars = 5

  for (let i = bars.length - swingBars - 1; i >= swingBars; i--) {
    const bar = bars[i]
    let isSwingHigh = true
    for (let j = i - swingBars; j <= i + swingBars; j++) {
      if (j === i) continue
      if (bars[j].high >= bar.high) {
        isSwingHigh = false
        break
      }
    }
    if (isSwingHigh)
      return {
        type: "high",
        price: bar.high,
        date: new Date(bar.time).toISOString().split("T")[0],
        barIndex: i,
      }

    let isSwingLow = true
    for (let j = i - swingBars; j <= i + swingBars; j++) {
      if (j === i) continue
      if (bars[j].low <= bar.low) {
        isSwingLow = false
        break
      }
    }
    if (isSwingLow)
      return {
        type: "low",
        price: bar.low,
        date: new Date(bar.time).toISOString().split("T")[0],
        barIndex: i,
      }
  }
  return null
}

function calculateATR(bars: OHLCVBar[], period: number): number {
  if (bars.length < period + 1) return 0
  const trueRanges: number[] = []
  for (let i = 1; i < bars.length; i++) {
    const tr = Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - bars[i - 1].close),
      Math.abs(bars[i].low - bars[i - 1].close)
    )
    trueRanges.push(tr)
  }
  const recentTR = trueRanges.slice(-period)
  return recentTR.reduce((sum, tr) => sum + tr, 0) / recentTR.length
}

function forecastATRHorizons(
  lastSwing: SwingPoint,
  bars: OHLCVBar[],
  currentPrice: number,
  atr14: number,
  ingressEnd: string
): MethodForecast[] {
  const forecasts: MethodForecast[] = []
  const ingressEndDate = new Date(ingressEnd),
    lastSwingDate = new Date(lastSwing.date)

  Object.entries(ATR_HORIZONS).forEach(([horizonName, horizon]) => {
    const forecastDate = new Date(lastSwingDate)
    forecastDate.setDate(forecastDate.getDate() + horizon.bars)
    if (forecastDate > ingressEndDate) return

    const avgMove = (atr14 * horizon.minATR + atr14 * horizon.maxATR) / 2
    const forecastPrice =
      lastSwing.type === "low" ? lastSwing.price + avgMove : lastSwing.price - avgMove
    const confidence = horizonName === "biweekly" || horizonName === "monthly" ? 0.75 : 0.65

    forecasts.push({
      method: `ATR ${horizonName} (${horizon.bars}d)`,
      price: forecastPrice,
      date: forecastDate.toISOString().split("T")[0],
      confidence,
      horizon: horizonName,
    })
  })

  return forecasts
}

function forecastFibonacciExtensions(
  lastSwing: SwingPoint,
  bars: OHLCVBar[],
  currentPrice: number,
  atr14: number,
  ingressEnd: string
): MethodForecast[] {
  const forecasts: MethodForecast[] = []
  const lastSwingDate = new Date(lastSwing.date),
    ingressEndDate = new Date(ingressEnd)

  let prevSwing: SwingPoint | null = null
  for (let i = lastSwing.barIndex - 5; i >= 5; i--) {
    const bar = bars[i]
    if (lastSwing.type === "high") {
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
          date: new Date(bar.time).toISOString().split("T")[0],
          barIndex: i,
        }
        break
      }
    } else {
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
          date: new Date(bar.time).toISOString().split("T")[0],
          barIndex: i,
        }
        break
      }
    }
  }

  if (!prevSwing) return forecasts

  const swingRange = Math.abs(lastSwing.price - prevSwing.price)
  const swingDays = lastSwing.barIndex - prevSwing.barIndex
  const fibLevels = [
    { ratio: 0.618, label: "Fib 61.8%", confidence: 0.85 },
    { ratio: 1.0, label: "Fib 100%", confidence: 0.75 },
    { ratio: 1.618, label: "Fib 161.8%", confidence: 0.9 },
  ]

  for (const fib of fibLevels) {
    const extension =
      lastSwing.type === "low"
        ? lastSwing.price + swingRange * fib.ratio
        : lastSwing.price - swingRange * fib.ratio
    const forecastDate = new Date(lastSwingDate)
    forecastDate.setDate(forecastDate.getDate() + Math.round(swingDays * fib.ratio))

    if (forecastDate <= ingressEndDate) {
      const priceDiff = Math.abs(extension - currentPrice)
      const atrMultiple = priceDiff / atr14
      let adjustedConfidence = fib.confidence
      if (atrMultiple >= 2 && atrMultiple <= 5)
        adjustedConfidence = Math.min(0.95, adjustedConfidence + 0.1)
      forecasts.push({
        method: fib.label,
        price: extension,
        date: forecastDate.toISOString().split("T")[0],
        confidence: adjustedConfidence,
      })
    }
  }

  return forecasts
}

function forecastGannSquares(
  lastSwing: SwingPoint,
  bars: OHLCVBar[],
  currentPrice: number,
  atr14: number,
  ingressEnd: string
): MethodForecast[] {
  const forecasts: MethodForecast[] = []
  const lastSwingDate = new Date(lastSwing.date),
    ingressEndDate = new Date(ingressEnd)
  const gannBars = [5, 10, 20, 60]

  for (const bars_count of gannBars) {
    const forecastDate = new Date(lastSwingDate)
    forecastDate.setDate(forecastDate.getDate() + bars_count)
    if (forecastDate > ingressEndDate) continue

    const timeMultiplier = Math.sqrt(bars_count / 5)
    const priceMove = atr14 * timeMultiplier * 2
    const forecastPrice =
      lastSwing.type === "low" ? lastSwing.price + priceMove : lastSwing.price - priceMove
    const confidence = bars_count === 20 || bars_count === 60 ? 0.8 : 0.7

    forecasts.push({
      method: `Gann Square ${bars_count}`,
      price: forecastPrice,
      date: forecastDate.toISOString().split("T")[0],
      confidence,
    })
  }

  return forecasts
}

function detectForecastConvergence(
  forecasts: MethodForecast[],
  priceTolerance: number = 0.02,
  timeTolerance: number = 3,
  minLevels: number = 2
): Array<{ price: number; date: string; methods: string[]; confidence: number; horizon?: string }> {
  const convergences: Array<{
    price: number
    date: string
    methods: string[]
    confidence: number
    horizon?: string
  }> = []

  for (let i = 0; i < forecasts.length; i++) {
    const cluster: MethodForecast[] = [forecasts[i]]

    for (let j = i + 1; j < forecasts.length; j++) {
      const priceDiff = Math.abs(forecasts[i].price - forecasts[j].price) / forecasts[i].price
      const timeDiff =
        Math.abs(new Date(forecasts[i].date).getTime() - new Date(forecasts[j].date).getTime()) /
        (1000 * 60 * 60 * 24)
      if (priceDiff <= priceTolerance && timeDiff <= timeTolerance) cluster.push(forecasts[j])
    }

    if (cluster.length >= minLevels) {
      const avgPrice = cluster.reduce((sum, f) => sum + f.price, 0) / cluster.length
      const avgConfidence = cluster.reduce((sum, f) => sum + f.confidence, 0) / cluster.length
      const dates = cluster.map((f) => f.date)
      const dateCount = dates.reduce(
        (acc, d) => {
          acc[d] = (acc[d] || 0) + 1
          return acc
        },
        {} as Record<string, number>
      )
      const mostCommonDate = Object.keys(dateCount).reduce((a, b) =>
        dateCount[a] > dateCount[b] ? a : b
      )
      const horizonForecast = cluster.find((f) => f.horizon)

      convergences.push({
        price: avgPrice,
        date: mostCommonDate,
        methods: cluster.map((f) => f.method),
        confidence: Math.min(1, avgConfidence + (cluster.length - minLevels) * 0.05),
        horizon: horizonForecast?.horizon,
      })
    }
  }

  return convergences.filter(
    (conv, index) =>
      convergences.findIndex(
        (c) => c.date === conv.date && Math.abs(c.price - conv.price) / c.price < 0.01
      ) === index
  )
}

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
    atr14: number
    keyLevels: Array<{ price: number; type: string; strength: number }>
  }>
> {
  const today = new Date().toISOString().split("T")[0]
  const { data: currentIngressData } = await getSupabaseAdmin()
    .from("astro_events")
    .select("*")
    .eq("event_type", "solar_ingress")
    .lte("date", today)
    .order("date", { ascending: false })
    .limit(1)

  const { data: nextIngressData } = await getSupabaseAdmin()
    .from("astro_events")
    .select("*")
    .eq("event_type", "solar_ingress")
    .gt("date", today)
    .order("date", { ascending: true })
    .limit(1)

  if (!currentIngressData?.length) return []

  const ingressEnd = nextIngressData?.length
    ? nextIngressData[0].date
    : new Date(new Date(currentIngressData[0].date).getTime() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0]

  const results = []
  const threshold = getATRThreshold(category)

  for (const symbol of symbols) {
    try {
      const { data: priceData } = await getSupabaseAdmin()
        .from("financial_data")
        .select("date, open, high, low, close, volume")
        .eq("symbol", symbol)
        .order("date", { ascending: false })
        .limit(120)

      if (!priceData?.length || priceData.length < 30) continue

      const bars: OHLCVBar[] = priceData.reverse().map((bar: any) => ({
        time: new Date(bar.date).getTime() / 1000,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume || 0,
      }))

      const currentPrice = bars[bars.length - 1].close

      const analysis = calculateEnhancedLevels(bars, currentPrice, {
        swingLength: 20,
        pivotBars: 5,
        currentTime: Date.now(),
      })

      const keyLevels = analysis.supportResistance.map((sr) => ({
        price: sr.price,
        type: sr.type,
        strength: sr.strength,
      }))

      const lastSwing = findLastSwing(bars)
      if (!lastSwing) continue

      // Step 1: ATR Analysis
      const atrAnalysis = analyzeATRVolatility(bars, currentPrice)
      const highs = bars.map((b) => b.high)
      const lows = bars.map((b) => b.low)
      const closes = bars.map((b) => b.close)
      const atrValues = ATR.calculate({ high: highs, low: lows, close: closes, period: 14 })
      const atr14 = atrValues.length ? atrValues[atrValues.length - 1] : 0

      if (!atr14 || atr14 === 0) continue

      // Step 2: Generate forecasts from all methods
      const atrHorizonForecasts = forecastATRHorizons(
        lastSwing,
        bars,
        currentPrice,
        atr14,
        ingressEnd
      )
      const fibForecasts = forecastFibonacciExtensions(
        lastSwing,
        bars,
        currentPrice,
        atr14,
        ingressEnd
      )
      const gannForecasts = forecastGannSquares(lastSwing, bars, currentPrice, atr14, ingressEnd)

      // Step 3: Detect convergence (minimum 2 methods agreeing)
      const convergences = detectForecastConvergence(
        [...atrHorizonForecasts, ...fibForecasts, ...gannForecasts],
        0.02, // 2% price tolerance
        3, // 3-day time tolerance
        2 // minimum 2 methods
      )

      if (!convergences.length) continue

      // Filter convergences by ATR threshold FIRST
      const validConvergences = convergences.filter((conv) => {
        const priceDiff = Math.abs(conv.price - currentPrice)
        const atrMultiple = priceDiff / atr14
        return atrMultiple >= threshold
      })

      if (!validConvergences.length) continue

      // Select best convergence (most methods + highest confidence)
      const bestConvergence = validConvergences.reduce((best, conv) => {
        const bestScore = best.methods.length * best.confidence
        const convScore = conv.methods.length * conv.confidence
        return convScore > bestScore ? conv : best
      })

      const expectedSwingType = lastSwing.type === "high" ? "low" : "high"

      // Step 4: Fibonacci + ATR overlap validation
      const fibOverlap = validateFibATROverlap(
        currentPrice,
        bestConvergence.price,
        atr14,
        lastSwing.price,
        lastSwing.type
      )

      // Step 5: Gann structure validation
      const gannValidation = validateGannStructure(
        currentPrice,
        bestConvergence.price,
        bestConvergence.date,
        lastSwing.date,
        lastSwing.price,
        lastSwing.type,
        atr14
      )

      // Step 6: Lunar timing refinement
      const lunarTiming = analyzeLunarTiming(
        bestConvergence.date,
        expectedSwingType,
        atrAnalysis.state
      )

      // Calculate final confidence with all validations
      let baseConfidence = bestConvergence.confidence

      // Boost for excellent validations
      if (fibOverlap?.quality === "excellent") baseConfidence = Math.min(1, baseConfidence + 0.1)
      else if (fibOverlap?.quality === "good") baseConfidence = Math.min(1, baseConfidence + 0.05)

      if (gannValidation.quality === "excellent")
        baseConfidence = Math.min(1, baseConfidence + 0.08)
      else if (gannValidation.quality === "good")
        baseConfidence = Math.min(1, baseConfidence + 0.04)

      // Lunar timing adjustment (Â±5%)
      let lunarBoost = 0
      if (lunarTiming.recommendation === "favorable_entry") lunarBoost = 0.05
      else if (lunarTiming.recommendation === "caution") lunarBoost = -0.05

      const finalConfidence = Math.max(0, Math.min(1, baseConfidence + lunarBoost))

      // Only include if final confidence meets minimum threshold
      if (finalConfidence < 0.65) continue

      const forecastedSwing: ForecastedSwing = {
        type: expectedSwingType,
        price: bestConvergence.price,
        date: bestConvergence.date,
        convergingMethods: bestConvergence.methods,
        baseConfidence,
        astroBoost: lunarBoost,
        finalConfidence,
        atrHorizon: bestConvergence.horizon,
        fibOverlap: fibOverlap || undefined,
        gannValidation,
        lunarTiming,
        atrAnalysis,
      }

      results.push({
        symbol,
        currentPrice,
        lastSwing,
        forecastedSwing,
        ingressValidity: new Date(bestConvergence.date) <= new Date(ingressEnd),
        atr14,
        keyLevels,
      })
    } catch (error) {
      // Silent fail per ticker
    }
  }

  // Sort by final confidence descending
  return results.sort(
    (a, b) => b.forecastedSwing.finalConfidence - a.forecastedSwing.finalConfidence
  )
}

// ============================================================================
// TRADING WINDOWS & POST-REVERSAL MOMENTUM
// ============================================================================

export async function detectTradingWindows(
  symbol: string,
  category: string,
  daysAhead: number = 90
): Promise<TradingWindow[]> {
  try {
    const { data: priceData } = await getSupabaseAdmin()
      .from("financial_data")
      .select("date, open, high, low, close, volume")
      .eq("symbol", symbol)
      .order("date", { ascending: false })
      .limit(500)
    if (!priceData || priceData.length < 30)
      throw new Error(`Insufficient price data for ${symbol}`)

    const bars: OHLCVBar[] = priceData.reverse().map((d: any) => ({
      time: new Date(d.date).getTime() / 1000,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: d.volume || 0,
    }))
    const currentPrice = bars[bars.length - 1].close
    const levels = calculateEnhancedLevels(bars, currentPrice, { swingLength: 10, pivotBars: 5 })
    const keyLevels = [
      ...levels.supportResistance
        .filter((sr) => sr.type === "support")
        .slice(0, 3)
        .map((sr) => sr.price),
      ...levels.supportResistance
        .filter((sr) => sr.type === "resistance")
        .slice(0, 3)
        .map((sr) => sr.price),
    ]
    const ingressPeriod = await getCurrentIngressPeriod()

    interface DailyScore {
      date: string
      technical: number
      astrological: number
      combined: number
      atrState?: "compression" | "expansion" | "neutral"
      lunarPhase?: string
    }
    const dailyScores: DailyScore[] = []
    const startDate = new Date()

    for (let i = 0; i < daysAhead; i++) {
      const futureDate = new Date(startDate)
      futureDate.setDate(futureDate.getDate() + i)
      const dateStr = futureDate.toISOString().split("T")[0]

      const proximityScores = keyLevels.map((level) => {
        const distance = Math.abs((level - currentPrice) / currentPrice) * 100
        if (distance < 1) return 95
        if (distance < 2) return 85
        if (distance < 3) return 75
        if (distance < 5) return 65
        return 50
      })
      const technicalScore = Math.max(...proximityScores)
      const aspectScore = await calculateAspectScore(dateStr, 1)
      const seasonalScore = await calculateSeasonalScore(futureDate.getTime(), ingressPeriod.end)
      const astrologicalScore = aspectScore * 0.7 + seasonalScore * 0.3
      const combinedScore = technicalScore * 0.7 + astrologicalScore * 0.3
      const atrAnalysis = analyzeATRVolatility(bars, currentPrice)
      const { phase } = getLunarPhase(futureDate)

      dailyScores.push({
        date: dateStr,
        technical: technicalScore,
        astrological: astrologicalScore,
        combined: combinedScore,
        atrState: atrAnalysis.state,
        lunarPhase: phase,
      })
    }

    const windows: TradingWindow[] = []
    let windowStart: DailyScore | null = null
    let windowDays: DailyScore[] = []

    for (const day of dailyScores) {
      if (day.combined >= 70) {
        if (!windowStart) {
          windowStart = day
          windowDays = [day]
        } else windowDays.push(day)
      } else {
        if (windowStart && windowDays.length >= 2) {
          const avgTechnical =
            windowDays.reduce((sum, d) => sum + d.technical, 0) / windowDays.length
          const avgAstrological =
            windowDays.reduce((sum, d) => sum + d.astrological, 0) / windowDays.length
          const avgCombined = windowDays.reduce((sum, d) => sum + d.combined, 0) / windowDays.length

          let type: TradingWindow["type"],
            emoji: string,
            reasons: string[] = []
          if (avgCombined >= 85) {
            type = "high_probability"
            emoji = "ðŸŒž"
            reasons.push("Exceptional alignment of technical + astrological factors")
            if (avgTechnical >= 90) reasons.push("Price near critical confluence zone")
            if (avgAstrological >= 85) reasons.push("Highly harmonious planetary aspects")
          } else if (avgCombined >= 75) {
            type = "moderate"
            emoji = "â›…"
            reasons.push("Good alignment, favorable conditions")
            if (avgTechnical >= 80) reasons.push("Approaching key technical level")
          } else if (avgTechnical < 50 && avgAstrological < 50) {
            type = "avoid"
            emoji = "ðŸŒ§ï¸"
            reasons.push("Low technical + low astrological alignment")
          } else if (avgAstrological < 40) {
            type = "extreme_volatility"
            emoji = "âš¡"
            reasons.push("Challenging planetary aspects indicate volatility")
          } else {
            type = "moderate"
            emoji = "â›…"
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
            atrState: windowStart.atrState,
            lunarPhase: windowStart.lunarPhase,
          })
        }
        windowStart = null
        windowDays = []
      }
    }

    if (windowStart && windowDays.length >= 2) {
      const avgTechnical = windowDays.reduce((sum, d) => sum + d.technical, 0) / windowDays.length
      const avgAstrological =
        windowDays.reduce((sum, d) => sum + d.astrological, 0) / windowDays.length
      const avgCombined = windowDays.reduce((sum, d) => sum + d.combined, 0) / windowDays.length
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
        emoji: avgCombined >= 85 ? "ðŸŒž" : "â›…",
        atrState: windowStart.atrState,
        lunarPhase: windowStart.lunarPhase,
      })
    }
    windows.sort((a, b) => b.combinedScore - a.combinedScore)
    return windows
  } catch (error) {
    return []
  }
}
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
  const results = []
  for (const symbol of symbols) {
    try {
      const { data: priceData } = await getSupabaseAdmin()
        .from("financial_data")
        .select("date, open, high, low, close, volume")
        .eq("symbol", symbol)
        .order("date", { ascending: false })
        .limit(120)
      if (!priceData || priceData.length < 30) continue
      const bars: OHLCVBar[] = priceData.reverse().map((bar: any) => ({
        time: new Date(bar.date).getTime() / 1000,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume || 0,
      }))
      const currentPrice = bars[bars.length - 1].close
      const currentDate = priceData[priceData.length - 1].date
      const levels = calculateEnhancedLevels(bars, currentPrice, { swingLength: 10, pivotBars: 5 })
      const reversalDetection = detectReversalAtKeyLevel(bars, levels, currentPrice)
      if (!reversalDetection) continue

      const nextLevel = findNextKeyLevel(
        currentPrice,
        reversalDetection.momentum,
        levels.supportResistance
      )
      if (!nextLevel) continue

      const percentToNext = Math.abs((nextLevel.price - currentPrice) / currentPrice) * 100
      if (percentToNext > 10) continue

      const lunarPhase = getCurrentLunarPhase()
      const lunarScore = calculateLunarEntryScore(lunarPhase, reversalDetection.momentum)
      const aspectScore = await calculateAspectScore(currentDate, 7)
      const entryTimingScore = Math.round(lunarScore * 0.7 + aspectScore * 0.3)
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
    } catch (error) {}
  }
  results.sort((a, b) => b.entryTimingScore - a.entryTimingScore)
  return results
}
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
  const lookbackStart = Math.max(0, bars.length - 15),
    lookbackEnd = bars.length - 5
  for (let i = lookbackStart; i < lookbackEnd; i++) {
    const bar = bars[i],
      price = bar.close
    for (const sr of levels.supportResistance) {
      if (sr.type === "support") {
        const distanceToLevel = Math.abs((price - sr.price) / price) * 100
        if (distanceToLevel < 0.5 && bar.low <= sr.price * 1.005) {
          const bouncePercent = ((currentPrice - bar.low) / bar.low) * 100
          if (bouncePercent >= 2 && currentPrice > sr.price)
            return {
              level: sr.price,
              type: "support",
              confidence: Math.min(95, 70 + bouncePercent * 3),
              daysAgo: bars.length - 1 - i,
              momentum: "bullish",
            }
        }
      }

      if (sr.type === "resistance") {
        const distanceToLevel = Math.abs((price - sr.price) / price) * 100
        if (distanceToLevel < 0.5 && bar.high >= sr.price * 0.995) {
          const dropPercent = ((bar.high - currentPrice) / bar.high) * 100
          if (dropPercent >= 2 && currentPrice < sr.price)
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
  return null
}
function findNextKeyLevel(
  currentPrice: number,
  momentum: "bullish" | "bearish",
  supportResistanceLevels: any[]
): { price: number; type: "support" | "resistance" } | null {
  if (momentum === "bullish") {
    const resistances = supportResistanceLevels
      .filter((sr) => sr.type === "resistance" && sr.price > currentPrice)
      .sort((a, b) => a.price - b.price)
    return resistances.length > 0 ? { price: resistances[0].price, type: "resistance" } : null
  } else {
    const supports = supportResistanceLevels
      .filter((sr) => sr.type === "support" && sr.price < currentPrice)
      .sort((a, b) => b.price - a.price)
    return supports.length > 0 ? { price: supports[0].price, type: "support" } : null
  }
}
function getCurrentLunarPhase(): string {
  return getLunarPhase().phase
}
function calculateLunarEntryScore(phase: string, momentum: "bullish" | "bearish"): number {
  if (momentum === "bullish") {
    switch (phase) {
      case "New Moon":
        return 95
      case "Waxing Crescent":
        return 85
      case "Full Moon":
        return 50
      case "Waning Crescent":
        return 40
      default:
        return 50
    }
  } else {
    switch (phase) {
      case "Full Moon":
        return 95
      case "Waning Crescent":
        return 85
      case "New Moon":
        return 50
      case "Waxing Crescent":
        return 40
      default:
        return 50
    }
  }
}
function getHeatMapColor(score: number): string {
  if (score >= 85) return "rgba(51, 255, 51, 0.8)"
  else if (score >= 70) return "rgba(120, 255, 120, 0.6)"
  else if (score >= 55) return "rgba(160, 160, 160, 0.5)"
  else if (score >= 40) return "rgba(200, 200, 200, 0.3)"
  else return "rgba(255, 255, 255, 0.1)"
}
