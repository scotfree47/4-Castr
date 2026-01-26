// app/api/convergence-forecasts/route.ts
import { detectConvergenceForecastedSwings } from "@/lib/services/confluenceEngine"
import { getSupabaseAdmin } from "@/lib/supabase"
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const revalidate = 0

interface CachedForecast {
  symbol: string
  category: string
  current_price: number
  forecastedSwing: {
    type: "high" | "low"
    price: number
    date: string
    finalConfidence: number
    convergingMethods?: string[]
  }
  lastSwing?: {
    type: "high" | "low"
    price: number
    date: string
  }
  atr14?: number
  rank?: number
}

async function getFeaturedTickersFromCache(category?: string): Promise<CachedForecast[]> {
  try {
    let query = getSupabaseAdmin()
      .from("featured_tickers")
      .select("*")
      .order("rank", { ascending: true })

    if (category) query = query.eq("category", category)

    const { data, error } = await query
    if (error) return []

    // Map cached data to forecast format
    return (data || []).map((cached: any) => ({
      symbol: cached.symbol,
      category: cached.category,
      current_price: cached.current_price || 0,
      forecastedSwing: {
        type: cached.next_key_level_type === "resistance" ? "high" : "low",
        price: cached.next_key_level_price || 0,
        date: new Date(Date.now() + (cached.days_until || 14) * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
        finalConfidence: (cached.confluence_score || 0) / 100,
        convergingMethods: cached.reason ? [cached.reason] : [],
      },
      lastSwing: {
        type: cached.next_key_level_type === "resistance" ? "low" : "high",
        price: cached.current_price * (cached.next_key_level_type === "resistance" ? 0.98 : 1.02),
        date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      },
      atr14: 0,
      rank: cached.rank || 0,
    }))
  } catch {
    return []
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category") || "equity"
    const limit = parseInt(searchParams.get("limit") || "10")
    const forceRefresh = searchParams.get("refresh") === "true"

    console.log(`🔮 Convergence forecast: ${category} (cache-first)`)

    // Try cache first (FAST - 50-200ms)
    if (!forceRefresh) {
      const cached = await getFeaturedTickersFromCache(category)

      if (cached.length > 0) {
        console.log(`✅ Cache hit: ${cached.length} forecasts`)

        const avgConfidence =
          cached.reduce(
            (sum: number, f: CachedForecast) => sum + f.forecastedSwing.finalConfidence,
            0
          ) / cached.length
        const highConfidenceCount = cached.filter(
          (f: CachedForecast) => f.forecastedSwing.finalConfidence >= 0.75
        ).length

        return NextResponse.json({
          success: true,
          data: {
            category,
            forecasts: cached.slice(0, limit),
            summary: {
              totalAnalyzed: cached.length,
              forecastsFound: cached.length,
              avgConfidence,
              highConfidenceCount,
            },
            source: "cache",
            timestamp: new Date().toISOString(),
          },
        })
      }
    }

    // Cache miss - run live analysis (SLOW - 3-8s)
    console.log(`⚠️ Cache miss, running live analysis...`)

    // Get all tickers for category from ticker_universe
    const { data: tickers } = await getSupabaseAdmin()
      .from("ticker_universe")
      .select("symbol")
      .eq("category", category)
      .eq("active", true)
      .limit(50)

    if (!tickers || tickers.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          category,
          forecasts: [],
          summary: {
            totalAnalyzed: 0,
            forecastsFound: 0,
            avgConfidence: 0,
            highConfidenceCount: 0,
          },
          source: "live",
          timestamp: new Date().toISOString(),
        },
      })
    }

    const symbols = tickers.map((t: { symbol: string }) => t.symbol)
    const forecasts = await detectConvergenceForecastedSwings(symbols, category)

    const avgConfidence =
      forecasts.length > 0
        ? forecasts.reduce((sum, f) => sum + f.forecastedSwing.finalConfidence, 0) /
          forecasts.length
        : 0

    const highConfidenceCount = forecasts.filter(
      (f) => f.forecastedSwing.finalConfidence >= 0.75
    ).length

    console.log(`✅ Live analysis: ${forecasts.length} forecasts found`)

    return NextResponse.json({
      success: true,
      data: {
        category,
        forecasts: forecasts.slice(0, limit),
        summary: {
          totalAnalyzed: symbols.length,
          forecastsFound: forecasts.length,
          avgConfidence,
          highConfidenceCount,
        },
        source: "live",
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error: any) {
    console.error("❌ Convergence forecast error:", error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
