// src/app/(dashboard)/data/index.ts
// Centralized data exports

// ============================================================================
// TICKER EXPORTS
// ============================================================================
export * from "./tickers/chart-utils"
export * from "./tickers/ticker-schema"
export * from "./tickers/utils"

// Direct data exports
export { default as tickerData } from "./tickers/data.json"

// Commonly used ticker functions
export {
  getAllTickers,
  getBearishTickers,
  getBullishTickers,
  getCommodityTickers,
  getCryptoTickers,
  getEquityTickers,
  getETFTickers,
  getFilteredTickers,
  getForexTickers,
  getH1Tickers,
  getHighConfidenceTickers,
  getRatesMacroTickers,
  getStressTickers,
  getTickerBySymbol,
  getTickersByType,
  getTopConfidenceTickers,
} from "./tickers/utils"

// Chart utilities (for trend-path and ttm-return)
export {
  FEATURED_COLORS,
  formatCategoryName,
  getAllCategories,
  getFeaturedByCategory,
  getSentinelsByCategory,
  SENTINEL_COLORS,
  type CategoryType,
} from "./tickers/chart-utils"

// ============================================================================
// ASTRO EXPORTS
// ============================================================================
export * from "./astro/astro-schema"
export { default as astroEvents } from "./astro/events.json"

// ============================================================================
// TYPE RE-EXPORTS FOR CONVENIENCE
// ============================================================================
export type { AstroEvent, AstroEventType } from "./astro/astro-schema"
export type { Ticker } from "./tickers/ticker-schema"
