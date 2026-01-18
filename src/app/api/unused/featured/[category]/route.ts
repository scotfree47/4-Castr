import { supabaseAdmin } from "@/lib/supabase" // ✅ Use the admin client
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const revalidate = 0

const CATEGORY_SYMBOLS: Record<string, string[]> = {
  equity: ["SPY", "QQQ", "XLY", "AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "GOOGL", "META"],
  commodity: ["GLD", "USO", "HG1!", "GC1!", "CL1!", "SI1!", "NG1!"],
  forex: ["EUR/USD", "USD/JPY", "GBP/USD", "GBP/JPY", "AUD/USD"],
  crypto: ["Bitcoin", "Ethereum", "Solana", "BNB", "XRP"],
  "rates-macro": ["TLT", "FEDFUNDS", "CPI", "TNX", "DXY"],
  stress: ["VIX", "MOVE", "TRIN", "VVIX", "BVOL"],
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ category: string }> }
) {
  try {
    const { category } = await params

    console.log("🔍 Fetching featured tickers for category:", category)

    // Validate category
    if (!CATEGORY_SYMBOLS[category]) {
      return NextResponse.json({ success: false, error: "Invalid category" }, { status: 400 })
    }

    // ✅ Query Supabase for featured tickers
    const { data, error } = await supabaseAdmin
      .from("featured_tickers")
      .select("*")
      .eq("category", category)
      .order("rank", { ascending: true })
      .limit(10)

    if (error) {
      console.error("❌ Supabase query error:", error)
      return NextResponse.json(
        {
          success: false,
          error: error.message || "Database query failed",
        },
        { status: 500 }
      )
    }

    // ✅ Handle empty results
    if (!data || data.length === 0) {
      console.log("⚠️  No featured tickers found for category:", category)
      console.log("💡 Run the cron job to populate data: /api/cron-refresh-featured")

      return NextResponse.json(
        {
          success: true,
          data: [],
          metadata: {
            category,
            totalSymbols: CATEGORY_SYMBOLS[category].length,
            featuredCount: 0,
            timestamp: new Date().toISOString(),
            message: "No data available. Run /api/cron-refresh-featured to populate.",
          },
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        }
      )
    }

    console.log("✅ Found featured tickers:", data.length)

    // ✅ Transform Supabase data to match frontend interface
    const transformedData = data.map((ticker: any) => ({
      symbol: ticker.symbol,
      category: ticker.category,
      sector: ticker.sector || "Unknown",
      currentPrice: parseFloat(ticker.current_price) || 0,
      nextKeyLevel: {
        price: parseFloat(ticker.next_key_level_price) || 0,
        type: ticker.next_key_level_type as "support" | "resistance",
        distancePercent: parseFloat(ticker.distance_percent) || 0,
        daysUntil: ticker.days_until || null,
      },
      confluenceScore: ticker.confluence_score || 0,
      tradeabilityScore: ticker.tradeability_score || 0,
      reason: ticker.reason || "",
      rank: ticker.rank || 0,
    }))

    return NextResponse.json(
      {
        success: true,
        data: transformedData,
        metadata: {
          category,
          totalSymbols: CATEGORY_SYMBOLS[category].length,
          featuredCount: transformedData.length,
          timestamp: new Date().toISOString(),
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    )
  } catch (error: any) {
    console.error("❌ Server error in /api/featured/[category]:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Internal server error",
      },
      { status: 500 }
    )
  }
}
