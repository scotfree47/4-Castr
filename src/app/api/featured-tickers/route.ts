// app/api/featured-tickers/route.ts
// OPTIMIZED: Direct cache queries, no live computation
export const dynamic = "force-dynamic"
export const revalidate = 0

import { getSupabaseAdmin } from "@/lib/supabase"
import { getCurrentIngressPeriod } from "@/lib/utils"
import { NextRequest, NextResponse } from "next/server"

interface CachedRating {
  symbol: string
  category: string
  ingress_period: string
  calculated_at: string
  rating_data: {
    current_price: number
    price_date: string
    next_key_level: {
      price: number
      type: "support" | "resistance"
      distance_percent: number
      distance_points: number
    }
    scores: {
      confluence: number
      proximity: number
      momentum: number
      seasonal: number
      aspect_alignment: number
      volatility: number
      trend: number
      volume: number
      technical: number
      fundamental: number
      total: number
    }
    rating: string
    confidence: string
    recommendation: string
    convergence?: {
      has_convergence: boolean
      methods?: string[]
      confidence?: number
      forecasted_swing?: {
        type: "high" | "low"
        price: number
        date: string
      }
    }
    validations?: {
      fib?: {
        quality: string
        ratio?: number
        score: number
      }
      gann?: {
        quality: string
        time_symmetry: boolean
        price_square: boolean
        angle_holding: boolean
        score: number
      }
      lunar?: {
        phase: string
        recommendation: string
        entry_favorability: number
        exit_favorability: number
        days_to_phase: number
      }
      atr?: {
        state: string
        current: number
        current_percent: number
        average_percent: number
        multiple: number
        strength: number
      }
    }
    sector: string
    reasons: string[]
    warnings: string[]
    projections: {
      days_until_target: number
      reach_probability: number
      earliest_date?: string
      most_likely_date: string
      latest_date?: string
    }
    ingress_alignment: {
      sign: string
      start_date: string
      end_date: string
      days_in_period: number
      favorability: string
    }
    featured_rank: number | null
    dynamic_score: number | null
    last_rank_update: string | null
  }
}

interface ForecastResult {
  symbol: string
  currentPrice: number
  lastSwing: {
    type: "high" | "low"
    price: number
    date: string
    barIndex: number
  }
  forecastedSwing: {
    type: "high" | "low"
    price: number
    date: string
    convergingMethods: string[]
    baseConfidence: number
    astroBoost: number
    finalConfidence: number
    atrHorizon?: string
    fibOverlap?: any
    gannValidation?: any
    lunarTiming?: any
    atrAnalysis?: any
  }
  ingressValidity: boolean
  rank: number
  atr14: number
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category") || "equity"
    const limit = parseInt(searchParams.get("limit") || "10")

    console.log(`🌟 Featured tickers (cache): ${category}`)

    // Get current ingress period
    const ingress = await getCurrentIngressPeriod()
    const period = `${new Date(ingress.start).getFullYear()}-${String(new Date(ingress.start).getMonth() + 1).padStart(2, "0")}-${ingress.sign.toLowerCase()}`

    console.log(`   📅 Ingress period: ${period}`)

    // Query cache - filter by featured_rank NOT NULL
    const { data: cached, error } = await getSupabaseAdmin()
      .from("ticker_ratings_cache")
      .select("*")
      .eq("ingress_period", period)
      .eq("category", category)
      .not("rating_data->featured_rank", "is", null)
      .order("rating_data->dynamic_score", { ascending: false } as any)
      .limit(limit)

    if (error) {
      console.error("   ❌ Cache query error:", error)
      throw error
    }

    if (!cached || cached.length === 0) {
      console.log("   ⚠️  No cached featured tickers found")
      return NextResponse.json({
        success: true,
        data: {
          forecasts: [],
          summary: {
            totalAnalyzed: 0,
            forecastsFound: 0,
            avgConfidence: 0,
            highConfidenceCount: 0,
          },
          source: "cache",
          timestamp: new Date().toISOString(),
        },
      })
    }

    console.log(`   ✅ Found ${cached.length} cached featured tickers`)

    // Transform cache format to forecast format
    const forecasts: ForecastResult[] = cached.map((item: CachedRating) => {
      const d = item.rating_data

      return {
        symbol: item.symbol,
        currentPrice: d.current_price,
        lastSwing: {
          type: d.convergence?.forecasted_swing?.type === "high" ? "low" : "high",
          price: d.current_price * (d.convergence?.forecasted_swing?.type === "high" ? 0.98 : 1.02),
          date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          barIndex: 0,
        },
        forecastedSwing: {
          type:
            d.convergence?.forecasted_swing?.type ||
            (d.next_key_level.type === "resistance" ? "high" : "low"),
          price: d.convergence?.forecasted_swing?.price || d.next_key_level.price,
          date: d.convergence?.forecasted_swing?.date || d.projections.most_likely_date,
          convergingMethods: d.convergence?.methods || ["Technical Analysis"],
          baseConfidence: d.convergence?.confidence || d.scores.total / 100,
          astroBoost: 0,
          finalConfidence: d.convergence?.confidence || d.scores.total / 100,
          atrHorizon: undefined,
          fibOverlap: d.validations?.fib
            ? {
                fibLevel: 0,
                fibRatio: d.validations.fib.ratio || 0,
                atrMultiple: d.validations.atr?.multiple || 0,
                quality: d.validations.fib.quality as "excellent" | "good" | "fair" | "poor",
                score: d.validations.fib.score,
              }
            : undefined,
          gannValidation: d.validations?.gann
            ? {
                timeSymmetry: d.validations.gann.time_symmetry,
                priceSquare: d.validations.gann.price_square,
                angleHolding: d.validations.gann.angle_holding,
                quality: d.validations.gann.quality as "excellent" | "good" | "fair" | "poor",
                score: d.validations.gann.score,
              }
            : undefined,
          lunarTiming: d.validations?.lunar
            ? {
                phase: d.validations.lunar.phase,
                daysToPhase: d.validations.lunar.days_to_phase,
                entryFavorability: d.validations.lunar.entry_favorability,
                exitFavorability: d.validations.lunar.exit_favorability,
                recommendation: d.validations.lunar.recommendation as
                  | "favorable_entry"
                  | "favorable_exit"
                  | "neutral"
                  | "caution",
              }
            : undefined,
          atrAnalysis: d.validations?.atr
            ? {
                current: d.validations.atr.current,
                currentPercent: d.validations.atr.current_percent,
                average: d.validations.atr.average_percent,
                state: d.validations.atr.state as "compression" | "expansion" | "neutral",
                strength: d.validations.atr.strength,
              }
            : undefined,
        },
        ingressValidity: true,
        rank: d.featured_rank || 0,
        atr14: d.validations?.atr?.current || 0,
      }
    })

    const avgConfidence =
      forecasts.reduce((sum, f) => sum + f.forecastedSwing.finalConfidence, 0) / forecasts.length
    const highConfidenceCount = forecasts.filter(
      (f) => f.forecastedSwing.finalConfidence >= 0.75
    ).length

    return NextResponse.json({
      success: true,
      data: {
        forecasts,
        summary: {
          totalAnalyzed: cached.length,
          forecastsFound: cached.length,
          avgConfidence,
          highConfidenceCount,
        },
        source: "cache",
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error: any) {
    console.error("❌ Featured tickers error:", error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
