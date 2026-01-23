// app/api/cron-refresh-ratings/route.ts
// UNIFIED CRON: Uses consolidated confluenceEngine

import {
  calculateAllFeaturedTickers,
  shouldRefreshFeatured,
  storeFeaturedTickers,
} from "@/lib/services/confluenceEngine"
import { getSupabaseAdmin } from "@/lib/supabase"
import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

const CRON_SECRET = process.env.CRON_SECRET

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (with or without quotes)
    const authHeader = request.headers.get("authorization")
    const cleanSecret = CRON_SECRET?.replace(/^["']|["']$/g, "") // Remove quotes if present

    if (authHeader !== `Bearer ${cleanSecret}`) {
      console.error("❌ Unauthorized cron attempt")
      console.log("Expected:", `Bearer ${cleanSecret}`)
      console.log("Received:", authHeader)
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    console.log("🔄 Cron job triggered: Checking if refresh needed...")

    // Check if refresh needed
    const { shouldRefresh, reason } = await shouldRefreshFeatured()

    if (!shouldRefresh) {
      console.log(`⏭️  Skipping refresh: ${reason}`)
      return NextResponse.json({
        success: true,
        message: `No refresh needed: ${reason}`,
        refreshed: false,
      })
    }

    console.log(`✅ Refresh triggered: ${reason}`)
    console.log("📊 Calculating featured tickers across all categories...")

    // Calculate featured tickers for all categories
    const featuredByCategory = await calculateAllFeaturedTickers()

    // Flatten to single array for storage
    const allFeatured = Object.values(featuredByCategory).flat()

    console.log(`📝 Storing ${allFeatured.length} featured tickers...`)

    // Store to database
    await storeFeaturedTickers(allFeatured)

    // Optionally cache high-confidence ratings
    const highConfidenceRatings = allFeatured.filter((r) => r.scores.total >= 70)

    if (highConfidenceRatings.length > 0) {
      console.log(`💾 Caching ${highConfidenceRatings.length} high-confidence ratings...`)
      await cacheRatingsToSupabase(highConfidenceRatings)
    }

    // Generate summary
    const summary = {
      totalFeatured: allFeatured.length,
      byCategory: Object.fromEntries(
        Object.entries(featuredByCategory).map(([cat, items]) => [cat, items.length])
      ),
      highConfidence: highConfidenceRatings.length,
      averageScore:
        allFeatured.length > 0
          ? Math.round(allFeatured.reduce((sum, r) => sum + r.scores.total, 0) / allFeatured.length)
          : 0,
    }

    console.log("✅ Refresh completed successfully")
    console.log(`   Total featured: ${summary.totalFeatured}`)
    console.log(`   Average score: ${summary.averageScore}`)
    console.log(`   Categories: ${Object.keys(summary.byCategory).join(", ")}`)

    return NextResponse.json({
      success: true,
      message: `Refreshed: ${reason}`,
      refreshed: true,
      summary,
    })
  } catch (error) {
    console.error("❌ Cron error:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * Cache high-confidence ratings to ticker_ratings_cache table
 */
async function cacheRatingsToSupabase(ratings: any[]) {
  try {
    // Batch upsert all ratings in a single query (50-100x faster than sequential)
    const calculatedAt = new Date().toISOString();
    const records = ratings.map((rating) => ({
      symbol: rating.symbol,
      category: rating.category,
      rating_data: rating,
      calculated_at: calculatedAt,
    }));

    const { error } = await getSupabaseAdmin()
      .from("ticker_ratings_cache")
      .upsert(records, { onConflict: "symbol" });

    if (error) throw error;

    console.log(`✅ Cached ${ratings.length} ratings to ticker_ratings_cache (batch operation)`)
  } catch (error) {
    console.error("❌ Error caching ratings:", error)
  }
}
