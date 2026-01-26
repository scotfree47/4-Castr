// app/api/chart-data/route.ts
import type { CategoryType } from "@/app/(dashboard)/data"
import { createErrorResponse } from "@/lib/api/errors"
import { fetchBulkPriceHistory, type PriceDataPoint } from "@/lib/services/confluenceEngine"
import { getSupabaseAdmin } from "@/lib/supabase"
import { NextRequest, NextResponse } from "next/server"

const SENTINELS: Record<CategoryType, string[]> = {
  equity: ["SPY", "QQQ", "XLY"],
  commodity: ["GLD", "USO", "HG1!"],
  forex: ["EUR/USD", "USD/JPY", "GBP/USD"],
  crypto: ["Bitcoin", "Ethereum", "Solana"],
  "rates-macro": ["TLT", "TNX", "DXY"],
  stress: ["VIX", "MOVE", "TRIN"],
}

const FEATURED_COLORS = [
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

const SENTINEL_COLORS = [
  "rgba(156, 163, 175, 0.7)",
  "rgba(107, 114, 128, 0.7)",
  "rgba(75, 85, 99, 0.7)",
]

interface CachedTicker {
  symbol: string
  category: string
  [key: string]: any
}

async function getFeaturedTickersFromCache(category?: string): Promise<CachedTicker[]> {
  try {
    let query = getSupabaseAdmin()
      .from("featured_tickers")
      .select("*")
      .order("rank", { ascending: true })

    if (category) query = query.eq("category", category)

    const { data, error } = await query
    if (error) return []
    return data || []
  } catch {
    return []
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = (searchParams.get("category") || "equity") as CategoryType
    const days = parseInt(searchParams.get("days") || "30")

    console.log(`📊 Chart Data: category=${category}, days=${days}`)

    // Generate date range
    const endDate = new Date()
    const startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - days + 1)

    const dates: string[] = []
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate)
      date.setDate(date.getDate() + i)
      dates.push(date.toISOString().split("T")[0])
    }

    const startDateStr = dates[0]
    const endDateStr = dates[dates.length - 1]

    // Get featured tickers from cache
    const featuredTickers = await getFeaturedTickersFromCache(category)
    const featuredSymbols = featuredTickers.map((t: CachedTicker) => t.symbol)

    // Get sentinels
    const sentinels = SENTINELS[category] || []

    // Remove duplicates
    const sentinelSet = new Set(sentinels)
    const uniqueFeatured = featuredSymbols.filter((s: string) => !sentinelSet.has(s)).slice(0, 10)
    const allSymbols = [...sentinels, ...uniqueFeatured]

    console.log(`📊 Fetching prices for: ${allSymbols.length} symbols`)

    // Single bulk query
    const priceDataMap = await fetchBulkPriceHistory(allSymbols, startDateStr, endDateStr)

    // Fill gaps
    const fillPriceGaps = (prices: PriceDataPoint[]): number[] => {
      const priceMap = new Map(prices.map((p) => [p.date, p.close]))
      const filled: number[] = []
      let lastPrice = 0

      for (const date of dates) {
        const price = priceMap.get(date)
        if (price !== undefined) {
          lastPrice = price
          filled.push(price)
        } else {
          filled.push(lastPrice)
        }
      }

      return filled
    }

    // Build series
    const featuredSeries = uniqueFeatured.map((symbol: string, idx: number) => {
      const prices = priceDataMap.get(symbol) || []
      const data = fillPriceGaps(prices)

      return {
        ticker: symbol,
        data,
        color: FEATURED_COLORS[idx] || FEATURED_COLORS[4],
        isSentinel: false,
        isVisible: true,
        anchorPrice: data[0] || 0,
      }
    })

    const sentinelSeries = sentinels.map((ticker: string, idx: number) => {
      const prices = priceDataMap.get(ticker) || []
      const data = fillPriceGaps(prices)

      return {
        ticker,
        data,
        color: SENTINEL_COLORS[idx] || SENTINEL_COLORS[2],
        isSentinel: true,
        isVisible: true,
        anchorPrice: data[0] || 0,
      }
    })

    console.log(
      `✅ Chart data: ${sentinelSeries.length} sentinels, ${featuredSeries.length} featured`
    )

    return NextResponse.json({
      success: true,
      data: {
        dates,
        series: [...sentinelSeries, ...featuredSeries],
      },
    })
  } catch (error) {
    console.error("❌ Chart data error:", error)
    const errorResponse = createErrorResponse(error, "Failed to load chart data")
    return NextResponse.json(errorResponse, { status: errorResponse.status })
  }
}
