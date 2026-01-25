// app/api/ticker-ratings/route.ts
// UNIFIED ENDPOINT: Uses consolidated confluenceEngine

import {
  batchCalculateRatings,
  calculateAllFeaturedTickers,
  fetchFeaturedTickersFromCache,
  type TickerRating,
} from "@/lib/services/confluenceEngine"
import { createErrorResponse } from "@/lib/api/errors"
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

    // MODE 1: Featured tickers (for dashboard) - USE CACHE FIRST
    if (mode === "featured") {
      console.log("📊 Fetching featured tickers from cache...")

      // Try cache first for fast response
      const cachedTickers = await fetchFeaturedTickersFromCache(categoryFilter || undefined)

      if (cachedTickers.length > 0) {
        console.log(`✅ Found ${cachedTickers.length} cached featured tickers`)

        // Convert cached format back to TickerRating format
        ratings = cachedTickers.map((cached: any) => ({
          symbol: cached.symbol,
          category: cached.category,
          sector: cached.sector || "unknown",
          currentPrice: cached.current_price,
          priceDate: new Date().toISOString().split("T")[0],
          dataPoints: 0,
          nextKeyLevel: {
            price: cached.next_key_level_price,
            type: cached.next_key_level_type,
            distancePercent: cached.distance_percent,
            distancePoints: Math.abs(cached.next_key_level_price - cached.current_price),
            daysUntilEstimate: cached.days_until,
            confidence: 0.7,
          },
          scores: {
            confluence: cached.confluence_score,
            proximity: 0,
            momentum: 0,
            seasonal: 0,
            aspectAlignment: 0,
            volatility: 0,
            trend: 0,
            volume: 0,
            technical: cached.tradeability_score * 0.7,
            fundamental: cached.tradeability_score * 0.3,
            total: cached.tradeability_score,
          },
          rating: "B",
          confidence: "medium",
          recommendation: "hold",
          ingressAlignment: { sign: "Unknown", daysRemaining: 0, favorability: "neutral" },
          reasons: [cached.reason || "Featured ticker"],
          warnings: [],
          projections: {
            reachDate: new Date(Date.now() + cached.days_until * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
            probability: 0.7,
            confidenceInterval: { earliest: "", mostLikely: "", latest: "" },
          },
          rank: cached.rank,
          confluenceScore: cached.confluence_score,
          tradeabilityScore: cached.tradeability_score,
          reason: cached.reason || "Featured ticker",
        }))

        metadata.source = "cache"
        metadata.cacheHit = true
      } else {
        // Cache miss - calculate fresh
        console.log("⚠️ Cache miss, calculating featured tickers...")

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
        metadata.source = "calculated"
        metadata.cacheHit = false
      }
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
    const errorResponse = createErrorResponse(error, "Failed to calculate ticker ratings")
    return NextResponse.json(errorResponse, { status: errorResponse.status })
  }
}
