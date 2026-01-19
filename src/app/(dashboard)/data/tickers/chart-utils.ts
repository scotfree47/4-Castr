// src/app/(dashboard)/data/tickers/chart-utils.ts
// Chart utilities - supports trend-path.tsx and ttm-return.tsx
// Featured/Previously Featured use /api/ticker-ratings directly

import { Ticker } from "./ticker-schema"
import { getAllTickers } from "./utils"

// Sentinel definitions per category
export const SENTINELS = {
  equity: ["SPY", "QQQ", "XLY"],
  commodity: ["GOLD", "CRUDE_OIL", "COPPER"],
  forex: ["EURUSD", "USDJPY", "GBPJPY"],
  crypto: ["BTC", "ETH", "SOL"],
  "rates-macro": ["TLT"],
  stress: ["VIX", "TNX", "DXY"],
} as const

export type CategoryType = keyof typeof SENTINELS

// Color palette for featured tickers (by confidence rank)
export const FEATURED_COLORS = [
  "#33ff33",
  "#2962ff",
  "#26c6da",
  "#f57f17",
  "#ffee58",
  "#76ff03",
  "#00bcd4",
  "#ffa726",
  "#ffeb3b",
  "#cddc39",
]

// Sentinel colors (muted, for dashed lines)
export const SENTINEL_COLORS = [
  "rgba(156, 163, 175, 0.7)",
  "rgba(107, 114, 128, 0.7)",
  "rgba(75, 85, 99, 0.7)",
]

// ============================================================================
// CATEGORY HELPERS
// ============================================================================

export const getFeaturedByCategory = (category: CategoryType, limit = 10): Ticker[] => {
  const allTickers = getAllTickers()

  const typeMap: Record<CategoryType, string[]> = {
    equity: ["equity", "stock"],
    commodity: ["commodity"],
    forex: ["forex"],
    crypto: ["crypto"],
    "rates-macro": ["rates-macro"],
    stress: ["stress"],
  }

  const categoryTickers = allTickers.filter((t) => {
    return typeMap[category]?.includes(t.type.toLowerCase())
  })

  const sorted = categoryTickers.sort((a, b) => {
    const scoreA = a.confidenceScore ?? 0
    const scoreB = b.confidenceScore ?? 0
    return scoreB - scoreA
  })

  return sorted.slice(0, limit)
}

export const getSentinelsByCategory = (category: CategoryType): string[] => {
  return [...SENTINELS[category]]
}

export const getAllCategories = (): CategoryType[] => {
  return Object.keys(SENTINELS) as CategoryType[]
}

export const formatCategoryName = (category: CategoryType): string => {
  const names: Record<CategoryType, string> = {
    equity: "Equity",
    commodity: "Commodity",
    forex: "Forex",
    crypto: "Crypto",
    "rates-macro": "Rates & Macro",
    stress: "Stress",
  }
  return names[category] || category
}

// ============================================================================
// DEPRECATED - Use /api/ticker-ratings for featured tickers
// ============================================================================
// These functions are kept for backward compatibility but should migrate to API

export const calculateGrowthMetrics = (
  category: CategoryType,
  months: number
): Array<{
  ticker: string
  dollarChange: number
  percentChange: number
  currentPrice: number
}> => {
  console.warn("calculateGrowthMetrics is deprecated. Use /api/ticker-ratings instead.")
  return []
}
