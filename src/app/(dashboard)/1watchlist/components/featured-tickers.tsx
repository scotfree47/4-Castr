// featured-tickers.tsx

"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Award, Eye, TrendingDown, TrendingUp } from "lucide-react"
import React, { useCallback, useEffect, useState } from "react"

// Sentinels - exclude from featured tickers
const SENTINELS = {
  equity: ["SPY", "QQQ", "XLY"],
  commodity: ["GLD", "USO", "HG1!"],
  forex: ["EUR/USD", "USD/JPY", "GBP/USD"],
  crypto: ["Bitcoin", "Ethereum", "Solana"],
  "rates-macro": ["TLT", "DXY", "TNX"],
  stress: ["VIX", "MOVE", "TRIN"],
}

interface ValidationData {
  fib: {
    quality: string
    ratio: number | null
    score: number
  }
  gann: {
    quality: string
    time_symmetry: boolean
    price_square: boolean
    angle_holding: boolean
    score: number
  }
  lunar: {
    phase: string | null
    recommendation: string | null
    entry_favorability: string | null
    exit_favorability: string | null
    days_to_phase: number | null
  }
  atr: {
    state: string | null
    current: number
    current_percent: number | null
    average_percent: number | null
    multiple: number
    strength: string | null
  }
}

interface IngressAlignment {
  sign: string
  start_date: string
  end_date: string
  days_in_period: number
  favorability: string | null
}

interface ForecastTicker {
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
    rating: string | null
    confidence: string | null
    recommendation: string | null
    convergence: {
      has_convergence: boolean
      methods?: string[]
      confidence?: number
      forecasted_swing?: {
        type: "high" | "low"
        price: number
        date: string
      }
      astro_confirmation?: {
        score: number
        reasons: string[]
      }
    }
    validations: ValidationData
    sector: string
    reasons: string[]
    warnings: string[]
    projections: {
      days_until_target: number
      reach_probability: number
      earliest_date: string | null
      most_likely_date: string
      latest_date: string | null
    }
    ingress_alignment: IngressAlignment
    featured_rank: number | null
    dynamic_score: number | null
    last_rank_update: string | null
  }
}

interface FeaturedTickersProps {
  category?: string
}

export const FeaturedTickers = React.memo(function FeaturedTickers({
  category = "equity",
}: FeaturedTickersProps) {
  const [tickers, setTickers] = useState<ForecastTicker[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<any>(null)
  const [ingressData, setIngressData] = useState<any>(null)

  const getCardColor = () => "bg-background/40 border-border/40"

  const getSwingTypeColor = (type: "high" | "low") => {
    return type === "high"
      ? "bg-green-500/10 text-green-400 border-green-500/40"
      : "bg-red-500/10 text-red-400 border-red-500/40"
  }

  const getTimelinePosition = (date: string, start: string, end: string) => {
    const targetTime = new Date(date).getTime()
    const startTime = new Date(start).getTime()
    const endTime = new Date(end).getTime()
    const position = ((targetTime - startTime) / (endTime - startTime)) * 100
    return Math.max(0, Math.min(100, position))
  }

  // ATR% thresholds per category
  const getATRThresholds = (category: string, symbol?: string) => {
    let multiple: number

    switch (category) {
      case "equity":
        multiple = 2
        break
      case "commodity":
        multiple = 2.5
        break
      case "forex":
        multiple = 2
        break
      case "crypto":
        const isMajor = symbol && ["BTC", "ETH", "Bitcoin", "Ethereum"].includes(symbol)
        multiple = isMajor ? 3 : 3.5
        break
      case "rates-macro":
        multiple = 2
        break
      case "stress":
        multiple = 2
        break
      default:
        multiple = 2
    }

    return {
      minMultiple: multiple,
      minPercent: multiple * 100,
      label: "ATR",
    }
  }

  const calculateATRMetrics = (ticker: ForecastTicker, category: string) => {
    const { rating_data } = ticker
    const currentPrice = rating_data.current_price
    const forecastedPrice =
      rating_data.convergence.forecasted_swing?.price || rating_data.next_key_level.price
    const atr14 = rating_data.validations.atr.current
    const thresholds = getATRThresholds(category, ticker.symbol)

    if (!atr14 || atr14 === 0) {
      return {
        atrMultiple: 0,
        percentMove: 0,
        meetsThreshold: false,
        displayText: "N/A",
        thresholds,
      }
    }

    const priceDiff = Math.abs(forecastedPrice - currentPrice)
    const atrMultiple = priceDiff / atr14
    const percentMove = (priceDiff / currentPrice) * 100
    const meetsThreshold = atrMultiple >= thresholds.minMultiple

    return {
      atrMultiple,
      percentMove,
      meetsThreshold,
      displayText: `${atrMultiple.toFixed(2)}× ${thresholds.label}`,
      thresholds,
    }
  }

  const loadFeaturedTickers = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const ingressRes = await fetch("/api/ingress", {
        headers: { "Cache-Control": "no-cache" },
      })
      const ingressResult = await ingressRes.json()

      if (ingressResult.success && ingressResult.data) {
        setIngressData(ingressResult.data)
      }

      const timestamp = new Date().getTime()
      const response = await fetch(
        `/api/convergence-forecasts?category=${category}&limit=10&t=${timestamp}`,
        {
          method: "GET",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
          cache: "no-store",
        }
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || "Failed to load convergence forecasts")
      }

      const forecasts = result.data?.forecasts || []
      const sentinelList = SENTINELS[category as keyof typeof SENTINELS] || []
      const filteredForecasts = forecasts.filter(
        (f: ForecastTicker) => !sentinelList.includes(f.symbol)
      )

      if (filteredForecasts.length === 0) {
        const ratingsResponse = await fetch(
          `/api/ticker-ratings?category=${category}&mode=featured&minScore=70&t=${timestamp}`,
          {
            method: "GET",
            headers: {
              "Cache-Control": "no-cache, no-store, must-revalidate",
              Pragma: "no-cache",
            },
            cache: "no-store",
          }
        )

        if (ratingsResponse.ok) {
          const ratingsResult = await ratingsResponse.json()
          if (ratingsResult.success && ratingsResult.data?.ratings?.length > 0) {
            const regularTickers = ratingsResult.data.ratings
              .filter((rating: any) => !sentinelList.includes(rating.symbol))
              .slice(0, 10)
              .map((rating: any, idx: number) => ({
                symbol: rating.symbol,
                category: rating.category,
                ingress_period: rating.ingress_period,
                calculated_at: rating.calculated_at,
                rating_data: {
                  current_price: rating.rating_data.current_price,
                  price_date: rating.rating_data.price_date,
                  next_key_level: rating.rating_data.next_key_level,
                  scores: rating.rating_data.scores,
                  rating: rating.rating_data.rating,
                  confidence: rating.rating_data.confidence,
                  recommendation: rating.rating_data.recommendation,
                  convergence: {
                    has_convergence: false,
                    confidence: rating.rating_data.scores.total / 100,
                  },
                  validations: rating.rating_data.validations,
                  sector: rating.rating_data.sector,
                  reasons: rating.rating_data.reasons,
                  warnings: rating.rating_data.warnings,
                  projections: rating.rating_data.projections,
                  ingress_alignment: rating.rating_data.ingress_alignment,
                  featured_rank: idx + 1,
                  dynamic_score: rating.rating_data.scores.total,
                  last_rank_update: null,
                },
              }))

            setTickers(regularTickers)
            setSummary({
              total: regularTickers.length,
              avgConfidence:
                regularTickers.reduce(
                  (sum: number, t: ForecastTicker) => sum + t.rating_data.scores.total,
                  0
                ) / regularTickers.length,
            })
            return
          }
        }
      }

      const rankedForecasts = filteredForecasts.map((f: ForecastTicker, idx: number) => ({
        ...f,
        rating_data: {
          ...f.rating_data,
          featured_rank: idx + 1,
        },
      }))

      setTickers(rankedForecasts)
      setSummary({
        total: rankedForecasts.length,
        avgConfidence:
          rankedForecasts.reduce(
            (sum: number, t: ForecastTicker) =>
              sum + (t.rating_data.convergence.confidence || 0) * 100,
            0
          ) / rankedForecasts.length,
      })
    } catch (err) {
      console.error("Error loading featured tickers:", err)
      setError(err instanceof Error ? err.message : "Failed to load tickers")
    } finally {
      setLoading(false)
    }
  }, [category])

  useEffect(() => {
    loadFeaturedTickers()
  }, [loadFeaturedTickers])

  if (loading) {
    return (
      <Card className="bg-background/40 backdrop-blur-xl border-border/40 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Featured
          </CardTitle>
          <CardDescription>Top Performers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full bg-foreground/5" />
          <Skeleton className="h-20 w-full bg-foreground/5" />
          <Skeleton className="h-20 w-full bg-foreground/5" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="bg-background/40 backdrop-blur-xl border-border/40 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Featured
          </CardTitle>
          <CardDescription>Top Performers</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive mb-4">{error}</p>
          <Button variant="outline" onClick={loadFeaturedTickers}>
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (tickers.length === 0) {
    return (
      <Card className="bg-background/40 backdrop-blur-xl border-border/40 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Featured
          </CardTitle>
          <CardDescription>Top Performers</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-8">
          <span className="text-4xl mb-2 block">🔮</span>
          <p className="text-sm text-muted-foreground">
            No convergence forecasts found within current ingress period
            {ingressData && ` (${ingressData.sign} - ${ingressData.month})`}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-background/40 backdrop-blur-xl border-border/40 shadow-lg hover:shadow-[0_0_20px_rgba(51,255,51,0.3)] transition-all">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Featured
          </CardTitle>
          <CardDescription>Top Performers</CardDescription>
        </div>
        <Button variant="outline" asChild size="sm" className="sm:flex">
          <a href="/h1-tickers" className="dark:text-foreground">
            <Eye className="h-4 w-4 mr-2" />
            View All
          </a>
        </Button>
      </CardHeader>
      <Separator orientation="horizontal" className="mx-4 sm:mx-6 md:mx-8" />

      <CardContent className="space-y-4">
        {tickers.map((ticker) => {
          const { rating_data } = ticker

          if (!rating_data.current_price || !rating_data.next_key_level.price) return null

          const currentPos = ingressData
            ? getTimelinePosition(
                new Date().toISOString().split("T")[0],
                ingressData.start,
                ingressData.end
              )
            : 50

          const forecastDate =
            rating_data.convergence.forecasted_swing?.date ||
            rating_data.projections.most_likely_date

          const swingPos = ingressData
            ? getTimelinePosition(forecastDate, ingressData.start, ingressData.end)
            : 75

          const metrics = calculateATRMetrics(ticker, category)

          const swingType =
            rating_data.convergence.forecasted_swing?.type ||
            (rating_data.next_key_level.type === "resistance" ? "high" : "low")

          const targetPrice =
            rating_data.convergence.forecasted_swing?.price || rating_data.next_key_level.price

          const confidence = rating_data.convergence.confidence || rating_data.scores.total / 100

          return (
            <div
              key={ticker.symbol}
              className={`rounded-xl border backdrop-blur-lg p-4 transition-all hover:scale-[1.02] hover:shadow-xl ${getCardColor()}`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                    #{rating_data.featured_rank || 0}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="font-mono text-sm font-bold">
                        {ticker.symbol}
                      </Badge>
                      <Badge className={getSwingTypeColor(swingType)}>
                        {swingType === "high" ? "↗️" : "↘️"} {swingType.toUpperCase()}
                      </Badge>
                    </div>

                    {/* Price Display with ATR% Requirement */}
                    <div className="text-sm mt-1 space-y-0.5">
                      <div className="opacity-80">
                        ${rating_data.current_price.toFixed(2)} → ${targetPrice.toFixed(2)}
                      </div>
                      <div
                        className={`text-xs font-semibold ${
                          metrics.meetsThreshold ? "text-green-400" : "text-red-400/60"
                        }`}
                      >
                        {metrics.percentMove.toFixed(1)}% move / {metrics.thresholds.minPercent}%
                        min required
                      </div>
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className="font-mono font-bold text-base">
                  {(confidence * 100).toFixed(0)}%
                </Badge>
              </div>

              {/* Ingress Timeline */}
              {ingressData && (
                <div className="mb-3">
                  <div className="relative h-3 rounded-full bg-gradient-to-r from-gray-500/20 via-transparent to-gray-500/20">
                    <div
                      className="absolute top-0 h-full rounded-full transition-all"
                      style={{
                        left: `${Math.max(0, swingPos - 5)}%`,
                        width: "10%",
                        background: "rgba(51, 255, 51, 0.6)",
                        boxShadow: "0 0 10px rgba(51, 255, 51, 0.5)",
                      }}
                    />
                    <div
                      className="absolute top-0 h-full w-0.5 bg-blue-400"
                      style={{ left: `${currentPos}%` }}
                    >
                      <div className="absolute -top-1 -left-1 w-2 h-2 rounded-full bg-blue-400" />
                    </div>
                    <div
                      className="absolute top-0 h-full w-0.5 bg-green-400"
                      style={{ left: `${swingPos}%` }}
                    >
                      <div className="absolute -top-1 -left-1 w-2 h-2 rounded-full bg-green-400" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] mt-0.5 opacity-60">
                    <span>{ingressData.start}</span>
                    <span>{forecastDate}</span>
                    <span>{ingressData.end}</span>
                  </div>
                </div>
              )}

              {/* Target Info */}
              <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                <div>
                  <span className="opacity-60">Target Level:</span>{" "}
                  <span className="font-medium">
                    ${rating_data.next_key_level.price.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="opacity-60">Est. Date:</span>{" "}
                  <span className="font-medium">{forecastDate}</span>
                </div>
              </div>

              {/* ATR Multiple Display */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  {swingType === "high" ? (
                    <TrendingUp className="h-3 w-3 text-green-600" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-600" />
                  )}
                  <div className="flex items-center gap-1">
                    <span
                      className={
                        metrics.meetsThreshold
                          ? swingType === "high"
                            ? "text-green-600 font-semibold"
                            : "text-red-600 font-semibold"
                          : "text-muted-foreground"
                      }
                    >
                      {metrics.displayText}
                    </span>
                    {metrics.meetsThreshold && (
                      <span className="text-xs opacity-60">
                        (≥{metrics.thresholds.minMultiple}× threshold)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
})
