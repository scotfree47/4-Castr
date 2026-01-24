import { detectConvergenceForecastedSwings } from "@/lib/services/confluenceEngine"
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const revalidate = 0

const ALL_TICKERS = {
  equity: ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "JPM", "V", "UNH", "WMT", "MA", "HD", "PG", "KO"],
  commodity: ["GLD", "USO", "HG", "GC1!", "CL1!"],
  crypto: ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA"],
  forex: ["EUR/USD", "USD/JPY", "GBP/USD", "GBP/JPY", "AUD/USD"],
  "rates-macro": ["TLT", "IEF", "SHY", "DXY"],
  stress: ["VIX", "MOVE", "TRIN"],
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category") || "equity"
    const limit = parseInt(searchParams.get("limit") || "10")

    console.log(`🔮 Convergence forecast request for ${category}...`)

    // Get symbols for category
    const symbols = ALL_TICKERS[category as keyof typeof ALL_TICKERS] || []

    if (symbols.length === 0) {
      return NextResponse.json({
        success: false,
        error: `Unknown category: ${category}`,
      }, { status: 400 })
    }

    // Detect convergence forecasts
    const forecasts = await detectConvergenceForecastedSwings(symbols, category)

    // Sort by final confidence (best forecasts first)
    forecasts.sort((a, b) => b.forecastedSwing.finalConfidence - a.forecastedSwing.finalConfidence)

    // Limit results
    const limitedForecasts = forecasts.slice(0, limit)

    console.log(`✅ Returning ${limitedForecasts.length} convergence forecasts for ${category}`)

    return NextResponse.json({
      success: true,
      data: {
        category,
        forecasts: limitedForecasts,
        summary: {
          totalAnalyzed: symbols.length,
          forecastsFound: forecasts.length,
          avgConfidence: forecasts.length > 0
            ? Math.round(
                forecasts.reduce((sum, f) => sum + f.forecastedSwing.finalConfidence, 0) /
                forecasts.length * 100
              ) / 100
            : 0,
          highConfidenceCount: forecasts.filter(f => f.forecastedSwing.finalConfidence >= 0.75).length,
        },
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error: any) {
    console.error("❌ Convergence forecast error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to generate convergence forecasts",
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}
