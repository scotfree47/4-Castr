// app/api/ticker-ratings/route.ts
// HYBRID: Cache-first with auto-population on miss
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

async function populateCache(
  ratings: TickerRating[],
  category: string,
  clearFirst: boolean = false
): Promise<void> {
  try {
    const ingress = await getCurrentIngressPeriod()
    const period = `${new Date(ingress.start).getFullYear()}-${String(new Date(ingress.start).getMonth() + 1).padStart(2, "0")}-${ingress.sign.toLowerCase()}`

    console.log(`   💾 Writing ${ratings.length} ratings to cache (${period})...`)

    // Clear existing cache for this category/period if requested
    if (clearFirst) {
      await getSupabaseAdmin()
        .from("ticker_ratings_cache")
        .delete()
        .eq("category", category)
        .eq("ingress_period", period)
    }

    // Transform ratings to cache format
    const cacheRows = ratings.map((r, idx) => ({
      symbol: r.symbol,
      category: r.category,
      ingress_period: period,
      calculated_at: new Date().toISOString(),
      rating_data: {
        current_price: r.currentPrice,
        price_date: r.priceDate,
        next_key_level: {
          price: r.nextKeyLevel.price,
          type: r.nextKeyLevel.type,
          distance_percent: r.nextKeyLevel.distancePercent,
          distance_points: r.nextKeyLevel.distancePoints,
        },
        scores: {
          confluence: r.scores.confluence,
          proximity: r.scores.proximity,
          momentum: r.scores.momentum,
          seasonal: r.scores.seasonal,
          aspect_alignment: r.scores.aspectAlignment,
          volatility: r.scores.volatility,
          trend: r.scores.trend,
          volume: r.scores.volume,
          technical: r.scores.technical,
          fundamental: r.scores.fundamental,
          total: r.scores.total,
        },
        rating: r.rating,
        confidence: r.confidence,
        recommendation: r.recommendation,
        convergence: {
          has_convergence: false,
          confidence: r.scores.total / 100,
        },
        validations: {
          fib: { quality: "none", ratio: null, score: 0 },
          gann: {
            quality: "none",
            time_symmetry: false,
            price_square: false,
            angle_holding: false,
            score: 0,
          },
          lunar: {
            phase: null,
            recommendation: null,
            entry_favorability: null,
            exit_favorability: null,
            days_to_phase: null,
          },
          atr: {
            state: null,
            current: r.atr14,
            current_percent: null,
            average_percent: null,
            multiple: r.atrMultiple,
            strength: null,
          },
        },
        sector: r.sector,
        reasons: r.reasons,
        warnings: r.warnings,
        projections: {
          days_until_target: r.nextKeyLevel.daysUntilEstimate,
          reach_probability: r.projections?.probability || 0,
          earliest_date: r.projections?.confidenceInterval?.earliest || null,
          most_likely_date: r.projections?.reachDate || "",
          latest_date: r.projections?.confidenceInterval?.latest || null,
        },
        ingress_alignment: {
          sign: r.ingressAlignment?.sign || "",
          start_date: ingress.start,
          end_date: ingress.end,
          days_in_period: r.ingressAlignment?.daysRemaining || 0,
          favorability: r.ingressAlignment?.favorability || null,
        },
        featured_rank: idx + 1,
        dynamic_score: r.scores.total,
        last_rank_update: new Date().toISOString(),
      },
    }))

    // Batch insert (upsert)
    const { error } = await getSupabaseAdmin().from("ticker_ratings_cache").upsert(cacheRows, {
      onConflict: "symbol,category,ingress_period",
    })

    if (error) throw error
    console.log(`   ✅ Cache populated: ${cacheRows.length} rows`)
  } catch (error) {
    console.error("   ❌ Cache population failed:", error)
    // Don't throw - cache failure shouldn't break the response
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const mode = searchParams.get("mode") || "batch"
    const categoryFilter = searchParams.get("category")
    const minScore = parseInt(searchParams.get("minScore") || "50") // ← Lowered from 75
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
        console.log("   ⚠️  Cache miss, auto-populating...")
        ratings = await performLiveCalculation(mode, categoryFilter, symbols, minScore, maxResults)

        // AUTO-POPULATE CACHE
        if (categoryFilter && ratings.length > 0) {
          await populateCache(ratings, categoryFilter)
        }

        metadata.source = "live_calculation_auto_cached"
        metadata.cacheHit = false
      }
    } else {
      console.log("   🔄 Force refresh: live calculation...")
      ratings = await performLiveCalculation(mode, categoryFilter, symbols, minScore, maxResults)

      // REFRESH CACHE
      if (categoryFilter && ratings.length > 0) {
        await populateCache(ratings, categoryFilter, true)
      }

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
    minScore, // ← Use the ACTUAL minScore passed from request
    maxResults,
    lookbackDays: 1095,
    includeProjections: false,
    includeSeasonalData: false,
    parallelism: 3,
  }

  if (categoryFilter) {
    options.categories = [categoryFilter]
  }

  if (symbols && symbols.length > 0) {
    options.symbols = symbols
  }

  return await batchCalculateRatings(options)
}
