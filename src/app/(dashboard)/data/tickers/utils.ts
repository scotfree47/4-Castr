import tickerData from './data.json'
import { Ticker, TickerType, isFavorable, isUnfavorable, getConfidenceScore } from './ticker-schema'

// Get all tickers - data.json is directly an array
export const getAllTickers = (): Ticker[] => {
  return tickerData as Ticker[]
}

// Filter by type
export const getTickersByType = (type: TickerType | string): Ticker[] => {
  return getAllTickers().filter(ticker => ticker.type.toLowerCase() === type.toLowerCase())
}

// Get specific types
export const getStockTickers = (): Ticker[] => {
  return getTickersByType('stock')
}

export const getEquityTickers = (): Ticker[] => {
  return getTickersByType('equity')
}

export const getH1Tickers = (): Ticker[] => {
  // For now, return all tickers - you can filter more specifically later
  return getAllTickers()
}

export const getETFTickers = (): Ticker[] => {
  return getTickersByType('etf')
}

export const getCommodityTickers = (): Ticker[] => {
  return getTickersByType('commodity')
}

export const getCryptoTickers = (): Ticker[] => {
  return getTickersByType('crypto')
}

export const getForexTickers = (): Ticker[] => {
  return getTickersByType('forex')
}

export const getRatesMacroTickers = (): Ticker[] => {
  return getTickersByType('rates-macro')
}

export const getStressTickers = (): Ticker[] => {
  return getTickersByType('stress')
}

// Get tickers by category (for chart-utils compatibility)
export const getTickersByCategory = (category: string): Ticker[] => {
  const categoryMap: Record<string, string[]> = {
    equity: ['equity', 'stock'],
    commodity: ['commodity'],
    forex: ['forex'],
    crypto: ['crypto'],
    'rates-macro': ['rates-macro'],
    stress: ['stress']
  }
  
  const types = categoryMap[category.toLowerCase()] || []
  return getAllTickers().filter(ticker => 
    types.includes(ticker.type.toLowerCase())
  )
}

// Get tickers by trend
export const getFavorableTickers = (): Ticker[] => {
  return getAllTickers().filter(ticker => isFavorable(ticker))
}

export const getUnfavorableTickers = (): Ticker[] => {
  return getAllTickers().filter(ticker => isUnfavorable(ticker))
}

// Alias for compatibility
export const getBullishTickers = getFavorableTickers
export const getBearishTickers = getUnfavorableTickers

// Get high confidence tickers (for watchlist/charts)
export const getHighConfidenceTickers = (minScore = 70): Ticker[] => {
  return getAllTickers().filter(ticker => getConfidenceScore(ticker) >= minScore)
}

// Get tickers by sector
export const getTickersBySector = (sector: string): Ticker[] => {
  return getAllTickers().filter(ticker => 
    ticker.sector.toLowerCase() === sector.toLowerCase()
  )
}

// Get top N tickers by confidence
export const getTopConfidenceTickers = (limit = 10): Ticker[] => {
  return getAllTickers()
    .sort((a, b) => getConfidenceScore(b) - getConfidenceScore(a))
    .slice(0, limit)
}

// Get ticker by symbol
export const getTickerBySymbol = (symbol: string): Ticker | undefined => {
  return getAllTickers().find(ticker => 
    ticker.ticker.toLowerCase() === symbol.toLowerCase()
  )
}

// Combined filters for complex queries
export const getFilteredTickers = (filters: {
  type?: TickerType | string
  trend?: 'favorable' | 'unfavorable' | 'bullish' | 'bearish'
  minConfidence?: number
  sector?: string
}): Ticker[] => {
  let tickers = getAllTickers()

  if (filters.type !== undefined) {
    tickers = tickers.filter(t => t.type.toLowerCase() === filters.type!.toLowerCase())
  }

  if (filters.trend !== undefined) {
    tickers = tickers.filter(t => t.trend === filters.trend)
  }

  if (filters.minConfidence !== undefined) {
    tickers = tickers.filter(t => getConfidenceScore(t) >= filters.minConfidence!)
  }

  if (filters.sector !== undefined) {
    tickers = tickers.filter(t => 
      t.sector.toLowerCase() === filters.sector!.toLowerCase()
    )
  }

  return tickers
}

// Get all unique sectors
export const getAllSectors = (): string[] => {
  const sectors = new Set(getAllTickers().map(t => t.sector))
  return Array.from(sectors).sort()
}

// Get all unique types
export const getAllTypes = (): string[] => {
  const types = new Set(getAllTickers().map(t => t.type))
  return Array.from(types).sort()
}