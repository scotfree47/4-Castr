import { detectPostReversalMomentum } from "@/lib/services/confluenceEngine"
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const revalidate = 0

const ALL_TICKERS = {
  equity: ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "JPM", "V", "UNH", "WMT", "MA", "HD", "PG", "KO"],
  commodity: ["GLD", "USO", "HG", "COPPER", "WHEAT", "CORN"],
  crypto: ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "AVAX", "DOT"],
  forex: ["EURUSD", "USDJPY", "GBPUSD", "GBPJPY", "AUDUSD", "USDCAD"],
  "rates-macro": ["TLT", "IEF", "SHY", "DXY", "TNX"],
  stress: ["VIX", "MOVE", "TRIN", "SKEW"],
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category") || "equity"
    const limit = parseInt(searchParams.get("limit") || "10")

    console.log(`🎯 Post-reversal detection for ${category}...`)

    // Get symbols for category
    const symbols = ALL_TICKERS[category as keyof typeof ALL_TICKERS] || []

    if (symbols.length === 0) {
      return NextResponse.json({
        success: false,
        error: `Unknown category: ${category}`,
      }, { status: 400 })
    }

    // Detect post-reversal momentum opportunities
    const opportunities = await detectPostReversalMomentum(symbols, category)

    // Sort by entry timing score (hot entries first)
    opportunities.sort((a, b) => b.entryTimingScore - a.entryTimingScore)

    // Limit results
    const limitedOpportunities = opportunities.slice(0, limit)

    console.log(`✅ Found ${opportunities.length} post-reversal opportunities in ${category}`)
    console.log(`   Hot entries (score >= 85): ${opportunities.filter((o) => o.entryTimingScore >= 85).length}`)
    console.log(`   Bullish momentum: ${opportunities.filter((o) => o.momentum === "bullish").length}`)
    console.log(`   Bearish momentum: ${opportunities.filter((o) => o.momentum === "bearish").length}`)

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
          avgEntryScore: opportunities.length > 0
            ? Math.round(
                opportunities.reduce((sum, o) => sum + o.entryTimingScore, 0) / opportunities.length
              )
            : 0,
          avgPercentToNext: opportunities.length > 0
            ? Math.round(
                (opportunities.reduce((sum, o) => sum + o.percentToNext, 0) / opportunities.length) * 100
              ) / 100
            : 0,
        },
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
