// Ticker exports
export * from './tickers/ticker-schema'
export * from './tickers/utils'
export * from './tickers/chart-utils'

// Astro exports
export * from './astro/astro-schema'

// Direct data exports for convenience
export { default as tickerData } from './tickers/data.json'
export { default as astroEvents } from './astro/events.json'

// Re-export commonly used functions for easy imports
export {
  getAllTickers,
  getH1Tickers,
  getETFTickers,
  getBullishTickers,
  getBearishTickers,
  getHighConfidenceTickers,
  getTopConfidenceTickers,
  getTickerBySymbol,
  getFilteredTickers,
} from './tickers/utils'

// Re-export chart utilities
export {
  getFeaturedByCategory,
  getSentinelsByCategory,
  formatChartData, // Now async
  calculateGrowthMetrics,
  getAllCategories,
  formatCategoryName,
  FEATURED_COLORS,
  SENTINEL_COLORS,
  type CategoryType,
} from './tickers/chart-utils'