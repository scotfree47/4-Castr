// featured-tickers.tsx

"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Eye, TrendingUp, TrendingDown, Award } from "lucide-react"
import React, { useCallback, useEffect, useState } from "react"

// Sentinels - exclude from featured tickers
const SENTINELS = {
  equity: ["SPY", "QQQ", "XLY"],
  commodity: ["GLD", "USO", "HG"],
  forex: ["EURUSD", "USDJPY", "GBPUSD", "EUR/USD", "USD/JPY", "GBP/USD"],
  crypto: ["BTC", "ETH", "SOL", "Bitcoin", "Ethereum", "Solana"],
  "rates-macro": ["TLT", "DXY", "TNX"],
  stress: ["VIX", "MOVE", "SKEW"],
}

interface SwingPoint {
  type: "high" | "low"
  price: number
  date: string
  barIndex: number
}

interface ForecastedSwing {
  type: "high" | "low"
  price: number
  date: string
  convergingMethods: string[]
  baseConfidence: number
  astroBoost: number
  finalConfidence: number
}

interface ForecastTicker {
  symbol: string
  currentPrice: number
  lastSwing: SwingPoint
  forecastedSwing: ForecastedSwing
  ingressValidity: boolean
  rank?: number
  atr14?: number
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
    const { currentPrice, forecastedSwing, atr14 } = ticker
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

    const priceDiff = Math.abs(forecastedSwing.price - currentPrice)
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
                currentPrice: rating.currentPrice || 0,
                lastSwing: {
                  type: rating.nextKeyLevel?.type === "resistance" ? "low" : "high",
                  price: rating.currentPrice ? rating.currentPrice * 0.98 : 0,
                  date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
                  barIndex: 0,
                },
                forecastedSwing: {
                  type: rating.nextKeyLevel?.type === "resistance" ? "high" : "low",
                  price: rating.nextKeyLevel?.price || rating.currentPrice || 0,
                  date:
                    rating.projections?.reachDate ||
                    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
                  convergingMethods: ["Technical Analysis"],
                  baseConfidence: rating.scores?.total ? rating.scores.total / 100 : 0,
                  astroBoost: 0,
                  finalConfidence: rating.scores?.total ? rating.scores.total / 100 : 0,
                },
                ingressValidity: true,
                rank: idx + 1,
                atr14: rating.atr14,
              }))
              .filter(
                (ticker: ForecastTicker) =>
                  ticker.currentPrice > 0 && ticker.forecastedSwing.price > 0
              )

            setTickers(regularTickers)
            setSummary({
              totalAnalyzed: ratingsResult.data.ratings.length,
              forecastsFound: regularTickers.length,
            })
            return
          }
        }
      } else {
        const rankedTickers = filteredForecasts.map((ticker: ForecastTicker, idx: number) => ({
          ...ticker,
          rank: idx + 1,
        }))

        setTickers(rankedTickers)
        setSummary(result.data?.summary || null)
      }
    } catch (err: any) {
      console.error("Error loading featured tickers:", err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [category])

  useEffect(() => {
    loadFeaturedTickers()
  }, [loadFeaturedTickers])

  const getTimelinePosition = (date: string, ingressStart: string, ingressEnd: string) => {
    const start = new Date(ingressStart).getTime()
    const end = new Date(ingressEnd).getTime()
    const current = new Date(date).getTime()
    return Math.max(0, Math.min(100, ((current - start) / (end - start)) * 100))
  }

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
          if (!ticker.currentPrice || !ticker.forecastedSwing?.price) return null

          const currentPos = ingressData
            ? getTimelinePosition(
                new Date().toISOString().split("T")[0],
                ingressData.start,
                ingressData.end
              )
            : 50
          const swingPos = ingressData
            ? getTimelinePosition(ticker.forecastedSwing.date, ingressData.start, ingressData.end)
            : 75
          const metrics = calculateATRMetrics(ticker, category)

          return (
            <div
              key={ticker.symbol}
              className={`rounded-xl border backdrop-blur-lg p-4 transition-all hover:scale-[1.02] hover:shadow-xl ${getCardColor()}`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                    #{ticker.rank}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="font-mono text-sm font-bold">
                        {ticker.symbol}
                      </Badge>
                      <Badge className={getSwingTypeColor(ticker.forecastedSwing.type)}>
                        {ticker.forecastedSwing.type === "high" ? "↗️" : "↘️"}{" "}
                        {ticker.forecastedSwing.type.toUpperCase()}
                      </Badge>
                    </div>

                    {/* Price Display with ATR% Requirement */}
                    <div className="text-sm mt-1 space-y-0.5">
                      <div className="opacity-80">
                        ${ticker.currentPrice.toFixed(2)} → $
                        {ticker.forecastedSwing.price.toFixed(2)}
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
                  {((ticker.forecastedSwing.finalConfidence || 0) * 100).toFixed(0)}%
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
                    <span>{ticker.forecastedSwing.date}</span>
                    <span>{ingressData.end}</span>
                  </div>
                </div>
              )}

              {/* Last Swing Info */}
              <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                <div>
                  <span className="opacity-60">Last {ticker.lastSwing?.type || "swing"}:</span>{" "}
                  <span className="font-medium">${(ticker.lastSwing?.price || 0).toFixed(2)}</span>
                </div>
                <div>
                  <span className="opacity-60">On:</span>{" "}
                  <span className="font-medium">{ticker.lastSwing?.date || "N/A"}</span>
                </div>
              </div>

              {/* ATR Multiple Display */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  {ticker.forecastedSwing.type === "high" ? (
                    <TrendingUp className="h-3 w-3 text-green-600" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-600" />
                  )}
                  <div className="flex items-center gap-1">
                    <span
                      className={
                        metrics.meetsThreshold
                          ? ticker.forecastedSwing.type === "high"
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
