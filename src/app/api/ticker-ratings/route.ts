// app/api/ticker-ratings/route.ts
// OPTIMIZED: Prioritize cache, fall back to live calculation only when needed
export const dynamic = "force-dynamic"
export const revalidate = 0

import { batchCalculateRatings, type TickerRating } from "@/lib/services/confluenceEngine"
import { getCurrentIngressPeriod } from "@/lib/utils"
import { getSupabaseAdmin } from "@/lib/supabase"
import { NextRequest, NextResponse } from "next/server"

async function getRatingsFromCache(
  category?: string,
  symbols?: string[],
  ingressPeriod?: string
): Promise<TickerRating[]> {
  try {
    // Use current ingress if not provided
    if (!ingressPeriod) {
      const ingress = await getCurrentIngressPeriod()
      ingressPeriod = `${new Date(ingress.start).getFullYear()}-${String(new Date(ingress.start).getMonth() + 1).padStart(2, "0")}-${ingress.sign.toLowerCase()}`
    }

    let query = getSupabaseAdmin()
      .from("ticker_ratings_cache")
      .select("*")
      .eq("ingress_period", ingressPeriod)

    if (category) query = query.eq("category", category)
    if (symbols && symbols.length > 0) query = query.in("symbol", symbols)

    const { data, error } = await query

    if (error || !data || data.length === 0) return []

    // Transform cache format to TickerRating format
    return data.map((cached: any): TickerRating => {
      const d = cached.rating_data
      return {
        symbol: cached.symbol,
        category: cached.category,
        sector: d.sector || "unknown",
        currentPrice: d.current_price || 0,
        priceDate: d.price_date || new Date().toISOString().split("T")[0],
        dataPoints: 0,
        nextKeyLevel: {
          price: d.next_key_level?.price || 0,
          type: d.next_key_level?.type || "resistance",
          distancePercent: d.next_key_level?.distance_percent || 0,
          distancePoints: d.next_key_level?.distance_points || 0,
          daysUntilEstimate: d.projections?.days_until_target || 0,
          confidence: d.scores?.total ? d.scores.total / 100 : 0,
        },
        scores: {
          confluence: d.scores?.confluence || 0,
          proximity: d.scores?.proximity || 0,
          momentum: d.scores?.momentum || 0,
          seasonal: d.scores?.seasonal || 0,
          aspectAlignment: d.scores?.aspect_alignment || 0,
          volatility: d.scores?.volatility || 0,
          trend: d.scores?.trend || 0,
          volume: d.scores?.volume || 0,
          technical: d.scores?.technical || 0,
          fundamental: d.scores?.fundamental || 0,
          total: d.scores?.total || 0,
        },
        rating: d.rating || "C",
        confidence: d.confidence || "medium",
        recommendation: d.recommendation || "hold",
        ingressAlignment: {
          sign: d.ingress_alignment?.sign || "Unknown",
          daysRemaining: d.ingress_alignment?.days_in_period || 0,
          favorability: d.ingress_alignment?.favorability || "neutral",
        },
        reasons: d.reasons || [],
        warnings: d.warnings || [],
        projections: {
          reachDate: d.projections?.most_likely_date || "",
          probability: d.projections?.reach_probability || 0,
          confidenceInterval: {
            earliest: d.projections?.earliest_date || "",
            mostLikely: d.projections?.most_likely_date || "",
            latest: d.projections?.latest_date || "",
          },
        },
        rank: d.featured_rank || 0,
        confluenceScore: d.scores?.confluence || 0,
        tradeabilityScore: d.scores?.total || 0,
        reason: d.reasons?.join("; ") || "",
        atr14: d.validations?.atr?.current || 0,
        atrMultiple: d.validations?.atr?.multiple || 0,
      }
    })
  } catch (error) {
    console.error("Cache query error:", error)
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

    // PRIORITY 1: Try cache first (unless force refresh)
    if (!forceRefresh) {
      console.log("   📊 Attempting cache lookup...")
      const cachedRatings = await getRatingsFromCache(
        categoryFilter || undefined,
        symbols,
        undefined
      )

      if (cachedRatings.length > 0) {
        console.log(`   ✅ Cache hit: ${cachedRatings.length} ratings`)

        // Filter by minScore
        ratings = cachedRatings.filter((r) => r.scores.total >= minScore)

        // Sort and limit
        ratings.sort((a, b) => b.scores.total - a.scores.total)
        ratings = ratings.slice(0, maxResults)

        metadata.source = "cache"
        metadata.cacheHit = true
      } else {
        console.log("   ⚠️  Cache miss, falling back to live calculation...")
        ratings = await performLiveCalculation(mode, categoryFilter, symbols, minScore, maxResults)
        metadata.source = "live_calculation"
        metadata.cacheHit = false
      }
    } else {
      console.log("   🔄 Force refresh: live calculation...")
      ratings = await performLiveCalculation(mode, categoryFilter, symbols, minScore, maxResults)
      metadata.source = "live_calculation_forced"
      metadata.cacheHit = false
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

    console.log(`   ✅ Returning ${ratings.length} ratings (avg: ${summary.averageScore})`)

    return NextResponse.json({
      success: true,
      data: {
        ratings,
        summary,
        metadata,
      },
    })
  } catch (error: any) {
    console.error("❌ Ticker rating error:", error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

async function performLiveCalculation(
  mode: string,
  categoryFilter: string | null,
  symbols: string[] | undefined,
  minScore: number,
  maxResults: number
): Promise<TickerRating[]> {
  const options: any = {
    minScore,
    maxResults,
    lookbackDays: 1095,
    includeProjections: false, // CRITICAL: Disable expensive features
    includeSeasonalData: false, // CRITICAL: Disable expensive features
    parallelism: 3, // CRITICAL: Reduce parallelism
  }

  if (categoryFilter) {
    options.categories = [categoryFilter]
  }

  if (symbols && symbols.length > 0) {
    options.symbols = symbols
  }

  return await batchCalculateRatings(options)
}
