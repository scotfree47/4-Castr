import { getAllTickers, getTickersByType } from './utils'
import { Ticker } from './ticker-schema'
import historicalData from './historical-quarterly.json'
import Papa from 'papaparse'

// Sentinel definitions per category
export const SENTINELS = {
  equity: ['SPY', 'QQQ', 'XLY'],
  commodity: ['GOLD', 'CRUDE_OIL', 'COPPER'],
  forex: ['EURUSD', 'USDJPY', 'GBPJPY'],
  crypto: ['BTC', 'ETH', 'SOL'],
  'rates-macro': ['TLT'],
  stress: ['VIX', 'TNX', 'DXY']
} as const

export type CategoryType = keyof typeof SENTINELS

// Color palette for featured tickers (by confidence rank)
export const FEATURED_COLORS = [
  '#33ff33', // 1. Highest - Green
  '#2962ff', // 2. Blue
  '#26c6da', // 3. Light blue
  '#f57f17', // 4. Golden/orange
  '#ffee58', // 5. Yellow
  '#76ff03', // 6. Interpolated lime
  '#00bcd4', // 7. Interpolated cyan
  '#ffa726', // 8. Interpolated orange
  '#ffeb3b', // 9. Interpolated yellow
  '#cddc39', // 10. Yellow-green
]

// Sentinel colors (muted, for dashed lines)
export const SENTINEL_COLORS = [
  'rgba(156, 163, 175, 0.7)', // Gray 1
  'rgba(107, 114, 128, 0.7)', // Gray 2
  'rgba(75, 85, 99, 0.7)',    // Gray 3
]

// Type for historical quarterly data
interface HistoricalQuarter {
  date: string
  type: string
  tickers: Record<string, {
    close: number
    volume: number
    isKeyLevel: boolean
    keyType: string | null
  }>
}

interface HistoricalData {
  quarters: HistoricalQuarter[]
}

const historicalQuarters = (historicalData as HistoricalData).quarters

// Cache for parsed CSV data
let dailyPriceData: Map<string, Array<{ date: string; price: number }>> | null = null
let csvLoadPromise: Promise<void> | null = null

// Load and parse the daily price CSV
const loadDailyPriceData = async (): Promise<void> => {
  if (dailyPriceData) return // Already loaded
  if (csvLoadPromise) return csvLoadPromise // Loading in progress
  
  csvLoadPromise = (async () => {
    try {
      console.log('🔄 Attempting to load CSV from: /data/tickers/price_data_dec22_20260107.csv')
      
      // Fetch the CSV file
      const response = await fetch('/data/tickers/price_data_dec22_20260107.csv')
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const csvText = await response.text()
      console.log(`📄 CSV loaded, size: ${csvText.length} characters`)
      
      // Parse CSV with PapaParse
      const parsed = Papa.parse(csvText, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim()
      })
      
      console.log(`📊 Parsed ${parsed.data.length} rows`)
      
      const dataMap = new Map<string, Array<{ date: string; price: number }>>()
      
      // CSV format: Date,Ticker,Open,High,Low,Close,Volume
      // We'll use the Close price
      let rowsProcessed = 0
      parsed.data.forEach((row: any) => {
        const date = row.Date || row.date
        const ticker = row.Ticker || row.ticker
        const close = parseFloat(row.Close || row.close)
        
        if (!date || !ticker || isNaN(close)) {
          if (rowsProcessed < 5) {
            console.warn('Skipping invalid row:', row)
          }
          return
        }
        
        if (!dataMap.has(ticker)) {
          dataMap.set(ticker, [])
        }
        
        dataMap.get(ticker)!.push({ 
          date: date.toString(), 
          price: close 
        })
        rowsProcessed++
      })
      
      console.log(`✅ Processed ${rowsProcessed} valid rows`)
      
      // Sort all ticker data by date
      dataMap.forEach((data, ticker) => {
        data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      })
      
      dailyPriceData = dataMap
      console.log(`✅ Loaded daily price data for ${dataMap.size} tickers`)
      
      if (dataMap.size > 0) {
        const firstTicker = Array.from(dataMap.values())[0]
        console.log('📊 Date range:', `${firstTicker[0]?.date} to ${firstTicker.slice(-1)[0]?.date}`)
        console.log('🎯 Sample tickers:', Array.from(dataMap.keys()).slice(0, 10).join(', '))
        console.log('💰 Sample SPY data:', dataMap.get('SPY')?.slice(0, 3))
      }
    } catch (error) {
      console.error('❌ Error loading daily price data:', error)
      dailyPriceData = new Map() // Set empty map to prevent retry loops
    }
  })()
  
  return csvLoadPromise
}

// Initialize CSV loading immediately when module loads (client-side only)
if (typeof window !== 'undefined') {
  console.log('🚀 Initializing CSV data load on module import')
  loadDailyPriceData()
}

// Get historical price data for a ticker (modified to use daily data)
export const getTickerHistory = (ticker: string, startDate?: string, endDate?: string): Array<{ date: string; price: number }> => {
  // Try daily data first
  if (dailyPriceData?.has(ticker)) {
    let history = dailyPriceData.get(ticker)!
    
    // Filter by date range if provided
    if (startDate || endDate) {
      history = history.filter(item => {
        if (startDate && item.date < startDate) return false
        if (endDate && item.date > endDate) return false
        return true
      })
    }
    
    return history
  }
  
  // Fallback to quarterly data
  const history: Array<{ date: string; price: number }> = []
  
  historicalQuarters.forEach(quarter => {
    // Filter by date range if provided
    if (startDate && quarter.date < startDate) return
    if (endDate && quarter.date > endDate) return
    
    const tickerData = quarter.tickers[ticker]
    if (tickerData) {
      history.push({
        date: quarter.date,
        price: tickerData.close
      })
    }
  })
  
  return history
}

// Get the most recent N quarters of data
export const getRecentQuarters = (count: number): HistoricalQuarter[] => {
  return historicalQuarters.slice(-count)
}

// Get featured tickers for a category, sorted by confidence
export const getFeaturedByCategory = (category: CategoryType, limit = 10): Ticker[] => {
  const allTickers = getAllTickers()
  
  // Map category names to ticker types
  const typeMap: Record<CategoryType, string[]> = {
    equity: ['equity', 'stock'],
    commodity: ['commodity'],
    forex: ['forex'],
    crypto: ['crypto'],
    'rates-macro': ['rates-macro'],
    stress: ['stress']
  }
  
  // Filter by category type
  const categoryTickers = allTickers.filter(t => {
    return typeMap[category]?.includes(t.type.toLowerCase())
  })
  
  // Sort by confidence score (highest first)
  const sorted = categoryTickers.sort((a, b) => {
    const scoreA = a.confidenceScore ?? 0
    const scoreB = b.confidenceScore ?? 0
    return scoreB - scoreA
  })
  
  return sorted.slice(0, limit)
}

// Get sentinels for a category (convert readonly array to mutable)
export const getSentinelsByCategory = (category: CategoryType): string[] => {
  return [...SENTINELS[category]]
}

// Interpolate historical data to daily values for smoother charts
const interpolateDates = (
  history: Array<{ date: string; price: number }>,
  days: number,
  targetDates: string[]
): Array<{ date: string; price: number }> => {
  console.log(`Interpolating ${history.length} data points for ${days} days`)
  
  if (history.length === 0) {
    console.warn('No history data provided')
    return targetDates.map(date => ({ date, price: 0 }))
  }
  
  if (history.length === 1) {
    // If only one data point, repeat it
    console.warn('Only one data point - repeating across all dates')
    return targetDates.map(date => ({ date, price: history[0].price }))
  }
  
  // Sort by date
  const sorted = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  console.log('Date range in data:', sorted[0].date, 'to', sorted[sorted.length - 1].date)
  console.log('Target date range:', targetDates[0], 'to', targetDates[targetDates.length - 1])
  
  const interpolated: Array<{ date: string; price: number }> = []
  
  // Interpolate for each target date
  for (const dateStr of targetDates) {
    const currentTime = new Date(dateStr).getTime()
    
    // Find surrounding data points
    let beforeIdx = -1
    let afterIdx = -1
    
    for (let j = 0; j < sorted.length; j++) {
      const dataTime = new Date(sorted[j].date).getTime()
      if (dataTime <= currentTime) {
        beforeIdx = j
      }
      if (dataTime >= currentTime && afterIdx === -1) {
        afterIdx = j
      }
    }
    
    // Interpolate price
    let price: number
    if (beforeIdx === -1) {
      // Current date is before all data - use first price
      price = sorted[0].price
    } else if (afterIdx === -1) {
      // Current date is after all data - use last price
      price = sorted[sorted.length - 1].price
    } else if (beforeIdx === afterIdx) {
      // Exact match
      price = sorted[beforeIdx].price
    } else {
      // Linear interpolation between two points
      const before = sorted[beforeIdx]
      const after = sorted[afterIdx]
      const beforeTime = new Date(before.date).getTime()
      const afterTime = new Date(after.date).getTime()
      const ratio = (currentTime - beforeTime) / (afterTime - beforeTime)
      price = before.price + (after.price - before.price) * ratio
    }
    
    interpolated.push({ date: dateStr, price })
  }
  
  console.log('Interpolated to', interpolated.length, 'points')
  console.log('Sample prices:', interpolated.slice(0, 3).map(p => `${p.date}: ${p.price.toFixed(2)}`))
  
  return interpolated
}

// Format data for Recharts multi-line chart
export const formatChartData = async (
  category: CategoryType,
  days: number
): Promise<{
  dates: string[]
  series: Array<{
    ticker: string
    data: number[]
    color: string
    isSentinel: boolean
    isVisible: boolean
    anchorPrice: number
  }>
}> => {
  // Load daily price data first
  await loadDailyPriceData()
  
  const featured = getFeaturedByCategory(category, 10)
  const sentinels = getSentinelsByCategory(category)
  
  // Create Set of sentinel tickers for fast lookup
  const sentinelSet = new Set(sentinels)
  
  // Filter out any featured tickers that are also sentinels (to avoid duplicates)
  const featuredOnly = featured.filter(t => !sentinelSet.has(t.ticker))
  
  // Get the most recent data date from daily price data
  let lastDataDate = new Date().toISOString().split('T')[0]
  if (dailyPriceData && dailyPriceData.size > 0) {
    const firstTicker = Array.from(dailyPriceData.values())[0]
    if (firstTicker.length > 0) {
      lastDataDate = firstTicker[firstTicker.length - 1].date
    }
  }
  
  // Generate dates array - ending at last data date
  const dates: string[] = []
  const endDate = new Date(lastDataDate)
  const startDate = new Date(endDate)
  startDate.setDate(startDate.getDate() - days + 1)
  
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate)
    date.setDate(date.getDate() + i)
    dates.push(date.toISOString().split('T')[0])
  }
  
  console.log('Chart date range:', dates[0], 'to', dates[dates.length - 1])
  console.log('Last data available:', lastDataDate)
  
  // Create series for featured tickers using real historical data
  const featuredSeries = featuredOnly.map((ticker, index) => {
    const history = getTickerHistory(ticker.ticker)
    const interpolated = interpolateDates(history, days, dates)
    const anchorPrice = interpolated[0]?.price || 100
    
    return {
      ticker: ticker.ticker,
      data: interpolated.map(p => p.price),
      color: FEATURED_COLORS[index] || FEATURED_COLORS[4],
      isSentinel: false,
      isVisible: true,
      anchorPrice
    }
  })
  
  // Create series for sentinels using real historical data
  const sentinelSeries = sentinels.map((ticker, index) => {
    const history = getTickerHistory(ticker)
    const interpolated = interpolateDates(history, days, dates)
    const anchorPrice = interpolated[0]?.price || 100
    
    return {
      ticker,
      data: interpolated.map(p => p.price),
      color: SENTINEL_COLORS[index] || SENTINEL_COLORS[2],
      isSentinel: true,
      isVisible: true,
      anchorPrice
    }
  })
  
  return {
    dates,
    series: [...sentinelSeries, ...featuredSeries] // Sentinels first (behind)
  }
}

// Calculate growth metrics for pie chart
export const calculateGrowthMetrics = (
  category: CategoryType,
  months: number
): Array<{
  ticker: string
  dollarChange: number
  percentChange: number
  currentPrice: number
}> => {
  const featured = getFeaturedByCategory(category, 10)
  const daysAgo = months * 30
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - daysAgo)
  const startDateStr = startDate.toISOString().split('T')[0]
  
  return featured.map(ticker => {
    const history = getTickerHistory(ticker.ticker)
    
    if (history.length === 0) {
      return {
        ticker: ticker.ticker,
        dollarChange: 0,
        percentChange: 0,
        currentPrice: 0
      }
    }
    
    // Get current and previous price
    const currentPrice = history[history.length - 1].price
    
    // Find price closest to start date
    let previousPrice = history[0].price
    for (const point of history) {
      if (point.date >= startDateStr) {
        break
      }
      previousPrice = point.price
    }
    
    const dollarChange = currentPrice - previousPrice
    const percentChange = (dollarChange / previousPrice) * 100
    
    return {
      ticker: ticker.ticker,
      dollarChange: Math.round(dollarChange * 100) / 100,
      percentChange: Math.round(percentChange * 100) / 100,
      currentPrice: Math.round(currentPrice * 100) / 100,
    }
  })
}

// Get all categories
export const getAllCategories = (): CategoryType[] => {
  return Object.keys(SENTINELS) as CategoryType[]
}

// Format category name for display
export const formatCategoryName = (category: CategoryType): string => {
  const names: Record<CategoryType, string> = {
    equity: 'Equity',
    commodity: 'Commodity',
    forex: 'Forex',
    crypto: 'Crypto',
    'rates-macro': 'Rates & Macro',
    stress: 'Stress'
  }
  return names[category] || category
}