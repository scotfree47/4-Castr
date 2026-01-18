// hooks/useTickersData.ts
// NEW HOOK: Fetches ticker data for the table

import { useEffect, useState } from "react"

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

export function useTickersData() {
  const [data, setData] = useState<TickerData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadTickersData()
  }, [])

  const loadTickersData = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log("🔄 Loading all tickers data...")

      // ✅ NEW: Fetch from unified ticker-ratings API
      const response = await fetch(
        `/api/ticker-ratings?mode=batch&minScore=0`,
        {
          headers: {
            "Cache-Control": "no-cache",
          },
        }
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || "Failed to load tickers")
      }

      // ✅ Transform ratings into table format
      const ratings = result.data.ratings || []
      const transformedData: TickerData[] = ratings.map((rating: any, index: number) => ({
        id: index + 1,
        ticker: rating.symbol,
        sector: rating.sector,
        trend: rating.recommendation === 'strong_buy' || rating.recommendation === 'buy' 
          ? 'bullish' 
          : rating.recommendation === 'strong_sell' || rating.recommendation === 'sell'
          ? 'bearish'
          : 'neutral',
        next: rating.nextKeyLevel.price.toFixed(2),
        last: rating.currentPrice.toFixed(2),
        compare: 'Ticker(s)', // Default - user can change via UI
        type: rating.category,
      }))

      console.log(`✅ Loaded ${transformedData.length} tickers`)
      setData(transformedData)
    } catch (err: any) {
      console.error("❌ Error loading tickers:", err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return {
    data,
    loading,
    error,
    refresh: loadTickersData,
  }
}