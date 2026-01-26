// app/api/ticker-ratings/route.ts
import { createErrorResponse } from "@/lib/api/errors"
import { batchCalculateRatings, type TickerRating } from "@/lib/services/confluenceEngine"
import { getSupabaseAdmin } from "@/lib/supabase"
import { NextRequest, NextResponse } from "next/server"

async function getFeaturedTickersFromCache(category?: string): Promise<any[]> {
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

    const mode = searchParams.get("mode") || "batch"
    const categoryFilter = searchParams.get("category")
    const minScore = parseInt(searchParams.get("minScore") || "75")
    const maxResults = parseInt(searchParams.get("maxResults") || "1000")
    const symbols = searchParams.get("symbols")?.split(",").filter(Boolean)
    const forceRefresh = searchParams.get("refresh") === "true"

    console.log(`🎯 Ticker ratings: mode=${mode}, category=${categoryFilter || "all"}`)

    let ratings: TickerRating[]
    let metadata: any = {
      timestamp: new Date().toISOString(),
      mode,
    }

    // MODE 1: Featured tickers (dashboard) - USE CACHE FIRST
    if (mode === "featured") {
      console.log("📊 Fetching featured tickers (cache-first)...")

      // Try cache first
      if (!forceRefresh) {
        const cachedTickers = await getFeaturedTickersFromCache(categoryFilter || undefined)

        if (cachedTickers.length > 0) {
          console.log(`✅ Cache hit: ${cachedTickers.length} featured tickers`)

          // Convert cached format to TickerRating format
          ratings = cachedTickers.map(
            (cached: any): TickerRating => ({
              symbol: cached.symbol,
              category: cached.category,
              sector: cached.sector || "unknown",
              currentPrice: cached.current_price || 0,
              priceDate: new Date().toISOString().split("T")[0],
              dataPoints: 0,
              nextKeyLevel: {
                price: cached.next_key_level_price || 0,
                type: cached.next_key_level_type || "resistance",
                distancePercent: cached.distance_percent || 0,
                distancePoints: Math.abs(
                  (cached.next_key_level_price || 0) - (cached.current_price || 0)
                ),
                daysUntilEstimate: cached.days_until || 0,
                confidence: (cached.confluence_score || 0) / 100,
              },
              scores: {
                confluence: cached.confluence_score || 0,
                proximity: 0,
                momentum: 0,
                seasonal: 0,
                aspectAlignment: 0,
                volatility: 0,
                trend: 0,
                volume: 0,
                technical: (cached.tradeability_score || 0) * 0.7,
                fundamental: (cached.tradeability_score || 0) * 0.3,
                total: cached.tradeability_score || 0,
              },
              rating:
                cached.tradeability_score >= 90 ? "A" : cached.tradeability_score >= 80 ? "B" : "C",
              confidence: cached.tradeability_score >= 85 ? "high" : "medium",
              recommendation: "hold",
              ingressAlignment: { sign: "Unknown", daysRemaining: 0, favorability: "neutral" },
              reasons: cached.reason ? [cached.reason] : [],
              warnings: [],
              projections: {
                reachDate: new Date(Date.now() + (cached.days_until || 14) * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split("T")[0],
                probability: (cached.confluence_score || 0) / 100,
                confidenceInterval: {
                  earliest: "",
                  mostLikely: new Date(Date.now() + (cached.days_until || 14) * 24 * 60 * 60 * 1000)
                    .toISOString()
                    .split("T")[0],
                  latest: "",
                },
              },
              rank: cached.rank || 0,
              confluenceScore: cached.confluence_score || 0,
              tradeabilityScore: cached.tradeability_score || 0,
              reason: cached.reason || "",
              atr14: 0,
              atrMultiple: 0,
            })
          )

          metadata.source = "cache"
          metadata.cacheHit = true
        } else {
          console.log("⚠️ Cache miss, calculating fresh...")

          // Use batch calculation instead of deprecated function
          const options: any = {
            minScore: 50,
            maxResults: 10,
            lookbackDays: 1095,
            includeProjections: true,
            includeSeasonalData: true,
            parallelism: 5,
          }

          if (categoryFilter) {
            options.categories = [categoryFilter]
          }

          ratings = await batchCalculateRatings(options)
          metadata.source = "calculated"
          metadata.cacheHit = false
        }
      } else {
        // Force refresh using batch calculation
        console.log("🔄 Force refresh requested...")

        const options: any = {
          minScore: 50,
          maxResults: 10,
          lookbackDays: 1095,
          includeProjections: true,
          includeSeasonalData: true,
          parallelism: 5,
        }

        if (categoryFilter) {
          options.categories = [categoryFilter]
        }

        ratings = await batchCalculateRatings(options)
        metadata.source = "calculated"
        metadata.cacheHit = false
      }
    }
    // MODE 2: Batch ratings
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

    // Generate summary
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
      averageScore:
        ratings.length > 0
          ? Math.round(ratings.reduce((sum, r) => sum + r.scores.total, 0) / ratings.length)
          : 0,
    }

    const categories = ["equity", "commodity", "forex", "crypto", "rates-macro", "stress"]
    for (const category of categories) {
      summary.byCategory[category] = ratings.filter((r) => r.category === category).length
    }

    console.log(`✅ Completed: ${ratings.length} ratings (avg: ${summary.averageScore})`)

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
