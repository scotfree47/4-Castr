// app/api/cron-refresh-ratings/route.ts
import { batchCalculateRatings, type TickerRating } from "@/lib/services/confluenceEngine"
import { getSupabaseAdmin } from "@/lib/supabase"
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const revalidate = 0

async function storeFeaturedTickers(ratings: TickerRating[]): Promise<void> {
  if (!ratings || ratings.length === 0) return

  try {
    const rows = ratings.map((r) => ({
      symbol: r.symbol,
      category: r.category,
      sector: r.sector,
      current_price: r.currentPrice,
      next_key_level_price: r.nextKeyLevel.price,
      next_key_level_type: r.nextKeyLevel.type,
      distance_percent: r.nextKeyLevel.distancePercent,
      days_until: r.nextKeyLevel.daysUntilEstimate,
      confluence_score: r.scores.confluence,
      tradeability_score: r.scores.total,
      reason: r.reasons.join("; "),
      rank: r.rank || 0,
      updated_at: new Date().toISOString(),
    }))

    // Delete old entries for affected categories
    const categories = [...new Set(ratings.map((r) => r.category))]
    for (const category of categories) {
      await getSupabaseAdmin().from("featured_tickers").delete().eq("category", category)
    }

    // Insert new entries
    for (const row of rows) {
      await getSupabaseAdmin().from("featured_tickers").insert([row])
    }

    console.log(`✅ Stored ${ratings.length} featured tickers`)
  } catch (error) {
    console.error("❌ Failed to store featured tickers:", error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    console.log("🔄 CRON: Starting featured tickers refresh...")

    const categories = ["equity", "commodity", "forex", "crypto", "rates-macro", "stress"]
    const allRatings: TickerRating[] = []

    for (const category of categories) {
      console.log(`📊 Processing ${category}...`)

      const ratings = await batchCalculateRatings({
        categories: [category],
        minScore: 50,
        maxResults: 10,
        lookbackDays: 1095,
        includeProjections: true,
        includeSeasonalData: true,
        parallelism: 5,
      })

      const rankedRatings = ratings.map((r, idx) => ({
        ...r,
        rank: idx + 1,
      }))

      allRatings.push(...rankedRatings)
      console.log(`✅ ${category}: ${rankedRatings.length} tickers`)
    }

    // Store all ratings
    await storeFeaturedTickers(allRatings)

    // Build summary
    const summary = {
      totalStored: allRatings.length,
      byCategory: {} as Record<string, number>,
    }

    for (const cat of categories) {
      const items = allRatings.filter((r) => r.category === cat)
      summary.byCategory[cat] = items.length
    }

    console.log(`✅ CRON complete: ${allRatings.length} featured tickers refreshed`)

    return NextResponse.json({
      success: true,
      data: {
        summary,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error: any) {
    console.error("❌ CRON refresh error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}
