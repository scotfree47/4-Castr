// app/api/ticker-ratings/route.ts
// UNIFIED ENDPOINT: Uses consolidated confluenceEngine

import {
  batchCalculateRatings,
  calculateAllFeaturedTickers,
  type TickerRating,
} from "@/lib/services/confluenceEngine"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Parsing options
    const mode = searchParams.get("mode") || "batch" // 'batch' or 'featured'
    const categoryFilter = searchParams.get("category")
    const minScore = parseInt(searchParams.get("minScore") || "75") // ✅ CHANGED: Default 75% (was 0)
    const maxResults = parseInt(searchParams.get("maxResults") || "1000")
    const symbols = searchParams.get("symbols")?.split(",").filter(Boolean)

    console.log(`🎯 Ticker ratings request: mode=${mode}`)

    let ratings: TickerRating[]
    let metadata: any = {
      timestamp: new Date().toISOString(),
      mode,
    }

    // MODE 1: Featured tickers (for dashboard)
    if (mode === "featured") {
      console.log("📊 Calculating featured tickers across all categories...")

      const featuredByCategory = await calculateAllFeaturedTickers()

      // Flatten to single array if category filter provided
      if (categoryFilter) {
        ratings = featuredByCategory[categoryFilter as keyof typeof featuredByCategory] || []
      } else {
        ratings = Object.values(featuredByCategory).flat()
      }

      metadata.categoriesProcessed = Object.keys(featuredByCategory)
      metadata.byCategory = Object.fromEntries(
        Object.entries(featuredByCategory).map(([cat, items]) => [cat, items.length])
      )
    }
    // MODE 2: Batch ratings (for comprehensive analysis)
    else {
      console.log("📊 Batch calculating ticker ratings...")

      const options: any = {
        minScore,
        maxResults,
        lookbackDays: 1095,
        includeProjections: true,
        includeSeasonalData: true,
        parallelism: 5,
      }

      if (categoryFilter) {
        options.categories = [categoryFilter]
      }

      if (symbols && symbols.length > 0) {
        options.symbols = symbols
      }

      ratings = await batchCalculateRatings(options)

      metadata.filters = {
        category: categoryFilter || "all",
        minScore,
        maxResults,
        symbolsRequested: symbols?.length || 0,
      }
    }

    // Generate summary statistics
    const summary = {
      totalRated: ratings.length,
      byCategory: {} as Record<string, number>,
      byConfidence: {
        very_high: ratings.filter((r) => r.confidence === "very_high").length,
        high: ratings.filter((r) => r.confidence === "high").length,
        medium: ratings.filter((r) => r.confidence === "medium").length,
        low: ratings.filter((r) => r.confidence === "low").length,
        very_low: ratings.filter((r) => r.confidence === "very_low").length,
      },
      byRating: {
        "A+": ratings.filter((r) => r.rating === "A+").length,
        A: ratings.filter((r) => r.rating === "A").length,
        "B+": ratings.filter((r) => r.rating === "B+").length,
        B: ratings.filter((r) => r.rating === "B").length,
        "C+": ratings.filter((r) => r.rating === "C+").length,
        C: ratings.filter((r) => r.rating === "C").length,
        D: ratings.filter((r) => r.rating === "D").length,
        F: ratings.filter((r) => r.rating === "F").length,
      },
      byRecommendation: {
        strong_buy: ratings.filter((r) => r.recommendation === "strong_buy").length,
        buy: ratings.filter((r) => r.recommendation === "buy").length,
        hold: ratings.filter((r) => r.recommendation === "hold").length,
        sell: ratings.filter((r) => r.recommendation === "sell").length,
        strong_sell: ratings.filter((r) => r.recommendation === "strong_sell").length,
      },
      averageScore:
        ratings.length > 0
          ? Math.round(ratings.reduce((sum, r) => sum + r.scores.total, 0) / ratings.length)
          : 0,
      scoreDistribution: {
        "90-100": ratings.filter((r) => r.scores.total >= 90).length,
        "80-89": ratings.filter((r) => r.scores.total >= 80 && r.scores.total < 90).length,
        "70-79": ratings.filter((r) => r.scores.total >= 70 && r.scores.total < 80).length,
        "60-69": ratings.filter((r) => r.scores.total >= 60 && r.scores.total < 70).length,
        "50-59": ratings.filter((r) => r.scores.total >= 50 && r.scores.total < 60).length,
        "<50": ratings.filter((r) => r.scores.total < 50).length,
      },
    }

    // Category breakdown
    const categories = ["equity", "commodity", "forex", "crypto", "rates-macro", "stress"]
    for (const category of categories) {
      summary.byCategory[category] = ratings.filter((r) => r.category === category).length
    }

    // Log summary
    console.log(`✅ Completed: ${ratings.length} ratings`)
    console.log(`   Average score: ${summary.averageScore}`)
    console.log(`   High confidence: ${summary.byConfidence.high + summary.byConfidence.very_high}`)

    return NextResponse.json({
      success: true,
      data: {
        ratings,
        summary,
        metadata,
      },
    })
  } catch (error) {
    console.error("❌ Ticker rating error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
