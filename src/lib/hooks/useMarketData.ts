// hooks/useMarketData.ts
// Unified hook for all market data fetching (levels, tickers, ratings)

import { api } from "@/lib/api/client"
import { handleApiError } from "@/lib/api/errors"
import { useCallback, useEffect, useState } from "react"

// ============================================================================
// TYPES
// ============================================================================

export interface ComprehensiveLevels {
  support: number[]
  resistance: number[]
  fibonacci: {
    level: number
    ratio: string
    type: "support" | "resistance"
  }[]
  pivots: {
    price: number
    type: "high" | "low"
    date: string
  }[]
}

export interface FutureLevelProjection {
  date: string
  projectedSupport: number[]
  projectedResistance: number[]
  confidence: number
}

export interface TickerData {
  id: number
  ticker: string
  sector: string
  trend: string
  next: string
  last: string
  compare: string
  type: string
}

interface UseLevelsOptions {
  symbol: string
  startDate?: string
  endDate?: string
  includeFuture?: boolean
  barsToProject?: number
  swingLength?: number
  pivotBars?: number
  enabled?: boolean
}

interface UseLevelsReturn {
  levels: ComprehensiveLevels | null
  futureLevels: FutureLevelProjection[] | null
  isLoading: boolean
  error: string | null
  refetch: () => void
}

interface UseTickersReturn {
  data: TickerData[]
  loading: boolean
  error: string | null
  refresh: () => void
}

// ============================================================================
// LEVELS HOOK
// ============================================================================

export function useLevels(options: UseLevelsOptions): UseLevelsReturn {
  const {
    symbol,
    startDate,
    endDate,
    includeFuture = false,
    barsToProject = 50,
    swingLength = 10,
    pivotBars = 5,
    enabled = true,
  } = options

  const [levels, setLevels] = useState<ComprehensiveLevels | null>(null)
  const [futureLevels, setFutureLevels] = useState<FutureLevelProjection[] | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchLevels = useCallback(async () => {
    if (!enabled || !symbol) return

    setIsLoading(true)
    setError(null)

    try {
      const data = await api.levels.get(symbol, {
        startDate,
        endDate,
        includeFuture,
        barsToProject,
        swingLength,
        pivotBars,
      })

      setLevels(data.current)
      setFutureLevels(data.future || null)
    } catch (err) {
      setError(handleApiError(err))
    } finally {
      setIsLoading(false)
    }
  }, [symbol, startDate, endDate, includeFuture, barsToProject, swingLength, pivotBars, enabled])

  useEffect(() => {
    fetchLevels()
  }, [fetchLevels])

  return {
    levels,
    futureLevels,
    isLoading,
    error,
    refetch: fetchLevels,
  }
}

// ============================================================================
// TICKERS HOOK
// ============================================================================

export function useTickersData(): UseTickersReturn {
  const [data, setData] = useState<TickerData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadTickersData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      console.log("📄 Loading all tickers data...")

      const result = await api.tickers.ratings({
        mode: "batch",
        minScore: 0,
      })

      const ratings = result.ratings || []
      const transformedData: TickerData[] = ratings.map((rating: any, index: number) => ({
        id: index + 1,
        ticker: rating.symbol,
        sector: rating.sector,
        trend:
          rating.recommendation === "strong_buy" || rating.recommendation === "buy"
            ? "bullish"
            : rating.recommendation === "strong_sell" || rating.recommendation === "sell"
              ? "bearish"
              : "neutral",
        next: rating.nextKeyLevel.price.toFixed(2),
        last: rating.currentPrice.toFixed(2),
        compare: "Ticker(s)",
        type: rating.category,
      }))

      console.log(`✅ Loaded ${transformedData.length} tickers`)
      setData(transformedData)
    } catch (err: any) {
      console.error("❌ Error loading tickers:", err)
      setError(handleApiError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTickersData()
  }, [loadTickersData])

  return {
    data,
    loading,
    error,
    refresh: loadTickersData,
  }
}

// ============================================================================
// UNIFIED MARKET DATA HOOK (ADVANCED)
// ============================================================================

interface UseMarketDataOptions {
  symbols?: string[]
  category?: string
  minScore?: number
  includeHistorical?: boolean
  includeFutureLevels?: boolean
}

interface UseMarketDataReturn {
  tickers: TickerData[]
  levels: Record<string, ComprehensiveLevels>
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export function useMarketData(options: UseMarketDataOptions = {}): UseMarketDataReturn {
  const {
    symbols = [],
    category,
    minScore = 0,
    includeHistorical = false,
    includeFutureLevels = false,
  } = options

  const [tickers, setTickers] = useState<TickerData[]>([])
  const [levels, setLevels] = useState<Record<string, ComprehensiveLevels>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMarketData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Fetch ticker ratings
      const result = await api.tickers.ratings({
        mode: "batch",
        minScore,
        category,
      })

      const ratings = result.ratings || []

      // Transform to ticker data
      const tickerData: TickerData[] = ratings.map((rating: any, index: number) => ({
        id: index + 1,
        ticker: rating.symbol,
        sector: rating.sector,
        trend:
          rating.recommendation === "strong_buy" || rating.recommendation === "buy"
            ? "bullish"
            : rating.recommendation === "strong_sell" || rating.recommendation === "sell"
              ? "bearish"
              : "neutral",
        next: rating.nextKeyLevel.price.toFixed(2),
        last: rating.currentPrice.toFixed(2),
        compare: "Ticker(s)",
        type: rating.category,
      }))

      setTickers(tickerData)

      // Optionally fetch levels for each symbol
      if (symbols.length > 0 || includeHistorical) {
        const levelsData: Record<string, ComprehensiveLevels> = {}

        const symbolsToFetch =
          symbols.length > 0 ? symbols : ratings.slice(0, 10).map((r: any) => r.symbol)

        await Promise.all(
          symbolsToFetch.map(async (symbol: string) => {
            try {
              const levelsResult = await api.levels.get(symbol, {
                includeFuture: includeFutureLevels,
              })

              levelsData[symbol] = levelsResult.current
            } catch (err) {
              console.warn(`Failed to fetch levels for ${symbol}:`, err)
            }
          })
        )

        setLevels(levelsData)
      }
    } catch (err: any) {
      console.error("❌ Error loading market data:", err)
      setError(handleApiError(err))
    } finally {
      setIsLoading(false)
    }
  }, [symbols, category, minScore, includeHistorical, includeFutureLevels])

  useEffect(() => {
    fetchMarketData()
  }, [fetchMarketData])

  return {
    tickers,
    levels,
    isLoading,
    error,
    refetch: fetchMarketData,
  }
}
