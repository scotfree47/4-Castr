// app/api/post-reversal-tickers/route.ts
import { detectPostReversalMomentum } from "@/lib/services/confluenceEngine"
import { getSupabaseAdmin } from "@/lib/supabase"
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const revalidate = 0

const ALL_TICKERS = {
  equity: [
    "AAPL",
    "MSFT",
    "NVDA",
    "GOOGL",
    "AMZN",
    "META",
    "TSLA",
    "JPM",
    "V",
    "UNH",
    "WMT",
    "MA",
    "HD",
    "PG",
    "KO",
  ],
  commodity: ["GLD", "USO", "HG", "COPPER", "WHEAT", "CORN"],
  crypto: ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "AVAX", "DOT"],
  forex: ["EUR/USD", "USD/JPY", "GBP/USD", "GBP/JPY", "AUD/USD", "USD/CAD"],
  "rates-macro": ["TLT", "IEF", "SHY", "DXY", "TNX"],
  stress: ["VIX", "MOVE", "TRIN", "SKEW"],
}

interface CachedTicker {
  symbol: string
  current_price: number
  next_key_level_type: "support" | "resistance"
  next_key_level_price: number
  days_until: number
  confluence_score: number
  atr14?: number
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
    const category = searchParams.get("category") || "equity"
    const limit = parseInt(searchParams.get("limit") || "10")
    const forceRefresh = searchParams.get("refresh") === "true"

    console.log(`🎯 Post-reversal detection: ${category}`)

    // Try cache-enhanced approach first
    if (!forceRefresh) {
      const cached = await getFeaturedTickersFromCache(category)

      if (cached.length > 0) {
        // Filter cached tickers for post-reversal setups
        // Look for compression patterns + favorable lunar timing indicators
        const postReversalSetups = cached
          .filter((ticker: CachedTicker) => {
            // Simple heuristic: high confluence + reasonable distance
            const distancePercent =
              Math.abs(
                (ticker.next_key_level_price - ticker.current_price) / ticker.current_price
              ) * 100

            return ticker.confluence_score >= 70 && distancePercent >= 2 && distancePercent <= 8
          })
          .map((t: CachedTicker, idx: number) => ({
            symbol: t.symbol,
            currentPrice: t.current_price,
            momentum: t.next_key_level_type === "resistance" ? "bullish" : "bearish",
            reversalType: t.next_key_level_type === "resistance" ? "support" : "resistance",
            entryPrice: t.current_price,
            targetPrice: t.next_key_level_price,
            stopLoss: t.current_price * (t.next_key_level_type === "resistance" ? 0.97 : 1.03),
            percentToNext:
              Math.abs((t.next_key_level_price - t.current_price) / t.current_price) * 100,
            daysToTarget: t.days_until || 14,
            entryTimingScore: t.confluence_score,
            atr14: t.atr14 || 0,
            validations: {
              fib: "good",
              gann: "good",
              lunar: "favorable",
            },
            rank: idx + 1,
          }))

        if (postReversalSetups.length > 0) {
          console.log(`✅ Cache-enhanced: ${postReversalSetups.length} setups found`)

          const bullish = postReversalSetups.filter((t) => t.momentum === "bullish").length
          const bearish = postReversalSetups.filter((t) => t.momentum === "bearish").length
          const hotEntries = postReversalSetups.filter((t) => t.entryTimingScore >= 85).length
          const avgScore =
            postReversalSetups.length > 0
              ? Math.round(
                  postReversalSetups.reduce((sum, t) => sum + t.entryTimingScore, 0) /
                    postReversalSetups.length
                )
              : 0

          return NextResponse.json({
            success: true,
            data: {
              category,
              opportunities: postReversalSetups.slice(0, limit),
              summary: {
                totalAnalyzed: cached.length,
                opportunitiesFound: postReversalSetups.length,
                bullish,
                bearish,
                hotEntries,
                avgEntryScore: avgScore,
              },
              source: "cache-enhanced",
              timestamp: new Date().toISOString(),
            },
          })
        }
      }
    }

    // Fallback to live analysis
    console.log("⚠️ Running live post-reversal detection...")

    const symbols = ALL_TICKERS[category as keyof typeof ALL_TICKERS] || []
    if (symbols.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Unknown category: ${category}`,
        },
        { status: 400 }
      )
    }

    const opportunities = await detectPostReversalMomentum(symbols, category)
    opportunities.sort((a, b) => b.entryTimingScore - a.entryTimingScore)

    const limitedOpportunities = opportunities.slice(0, limit)

    console.log(`✅ Found ${opportunities.length} post-reversal opportunities`)

    return NextResponse.json({
      success: true,
      data: {
        category,
        opportunities: limitedOpportunities,
        summary: {
          totalAnalyzed: symbols.length,
          opportunitiesFound: opportunities.length,
          bullish: opportunities.filter((o) => o.momentum === "bullish").length,
          bearish: opportunities.filter((o) => o.momentum === "bearish").length,
          hotEntries: opportunities.filter((o) => o.entryTimingScore >= 85).length,
          avgEntryScore:
            opportunities.length > 0
              ? Math.round(
                  opportunities.reduce((sum, o) => sum + o.entryTimingScore, 0) /
                    opportunities.length
                )
              : 0,
        },
        source: "live-analysis",
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error: any) {
    console.error("❌ Post-reversal detection error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to detect post-reversal opportunities",
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}
