// src/app/api/chart-data/route.ts
// Orchestrates data from /api/ticker-ratings + /api/finance for charts

import type { CategoryType } from "@/app/(dashboard)/data"
import { NextRequest, NextResponse } from "next/server"

interface ChartSeries {
  ticker: string
  data: number[]
  color: string
  isSentinel: boolean
  isVisible: boolean
  anchorPrice: number
}

interface ChartDataResponse {
  success: boolean
  data?: {
    dates: string[]
    series: ChartSeries[]
  }
  error?: string
}

const SENTINELS: Record<CategoryType, string[]> = {
  equity: ["SPY", "QQQ", "XLY"],
  commodity: ["GLD", "USO", "HG1!"],
  forex: ["EURUSD", "USDJPY", "GBPJPY"],
  crypto: ["BTC", "ETH", "SOL"],
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

export async function GET(request: NextRequest): Promise<NextResponse<ChartDataResponse>> {
  try {
    const { searchParams } = new URL(request.url)
    const category = (searchParams.get("category") || "equity") as CategoryType
    const days = parseInt(searchParams.get("days") || "30")

    console.log(`📊 Chart Data: category=${category}, days=${days}`)

    // Generate date range
    const dates: string[] = []
    const endDate = new Date()
    const startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - days + 1)

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate)
      date.setDate(date.getDate() + i)
      dates.push(date.toISOString().split("T")[0])
    }

    const startDateStr = dates[0]
    const endDateStr = dates[dates.length - 1]

    // Step 1: Get featured tickers
    const featuredResponse = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/ticker-ratings?mode=featured&category=${category}`,
      { cache: "no-store" }
    )

    const featuredData = await featuredResponse.json()
    const featuredTickers = featuredData.success
      ? featuredData.data.ratings.slice(0, 10).map((r: any) => r.symbol)
      : []

    // Step 2: Get sentinels
    const sentinels = SENTINELS[category] || []

    // Step 3: Remove duplicates
    const sentinelSet = new Set(sentinels)
    const uniqueFeatured = featuredTickers.filter((s: string) => !sentinelSet.has(s))
    const allSymbols = [...sentinels, ...uniqueFeatured]

    console.log(`📊 Fetching prices for: ${allSymbols.length} symbols`)

    // Step 4: Fetch price data for each symbol
    const priceDataMap = new Map<string, number[]>()

    await Promise.all(
      allSymbols.map(async (symbol) => {
        try {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/finance?symbol=${symbol}&startDate=${startDateStr}&endDate=${endDateStr}`,
            { cache: "no-store" }
          )

          const result = await response.json()

          if (result.success && result.data && Array.isArray(result.data)) {
            const priceMap = new Map<string, number>()
            result.data.forEach((item: any) => {
              priceMap.set(item.date, item.close)
            })

            const prices: number[] = []
            let lastPrice = 0

            for (const date of dates) {
              const price = priceMap.get(date)
              if (price !== undefined) {
                lastPrice = price
                prices.push(price)
              } else {
                prices.push(lastPrice)
              }
            }

            priceDataMap.set(symbol, prices)
          }
        } catch (err) {
          console.error(`❌ Error fetching ${symbol}:`, err)
        }
      })
    )

    // Step 5: Build featured series
    const featuredSeries: ChartSeries[] = uniqueFeatured.map((symbol: string, index: number) => {
      const data = priceDataMap.get(symbol) || Array(days).fill(0)
      return {
        ticker: symbol,
        data,
        color: FEATURED_COLORS[index] || FEATURED_COLORS[4],
        isSentinel: false,
        isVisible: true,
        anchorPrice: data[0] || 0,
      }
    })

    // Step 6: Build sentinel series
    const sentinelSeries: ChartSeries[] = sentinels.map((ticker, index) => {
      const data = priceDataMap.get(ticker) || Array(days).fill(0)
      return {
        ticker,
        data,
        color: SENTINEL_COLORS[index] || SENTINEL_COLORS[2],
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
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
