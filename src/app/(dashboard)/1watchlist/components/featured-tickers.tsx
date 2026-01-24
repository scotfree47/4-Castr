"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Eye, Star, Target, TrendingUp, Award } from "lucide-react"
import React, { useCallback, useEffect, useState } from "react"

interface NextKeyLevel {
  price: number
  type: "support" | "resistance"
  distancePercent: number
  distancePoints: number
  daysUntilEstimate: number
  confidence: number
}

interface TickerScores {
  confluence: number
  proximity: number
  momentum: number
  seasonal: number
  volatility: number
  trend: number
  volume: number
  technical: number
  fundamental: number
  total: number
}

interface FeaturedTicker {
  symbol: string
  category: string
  sector: string
  currentPrice: number
  nextKeyLevel: NextKeyLevel
  scores: TickerScores
  rating: "A+" | "A" | "B+" | "B" | "C+" | "C" | "D" | "F"
  confidence: "very_high" | "high" | "medium" | "low" | "very_low"
  recommendation: "strong_buy" | "buy" | "hold" | "sell" | "strong_sell"
  reasons: string[]
  rank?: number
}

interface FeaturedTickersProps {
  category?: string
}

export const FeaturedTickers = React.memo(function FeaturedTickers({
  category = "equity",
}: FeaturedTickersProps) {
  const [tickers, setTickers] = useState<FeaturedTicker[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<any>(null)

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case "A+":
      case "A":
        return "bg-green-500/5 text-green-400 border-green-500/30 shadow-green-500/10"
      case "B+":
      case "B":
        return "bg-blue-500/5 text-blue-400 border-blue-500/30 shadow-blue-500/10"
      case "C+":
      case "C":
        return "bg-yellow-500/5 text-yellow-400 border-yellow-500/30 shadow-yellow-500/10"
      default:
        return "bg-gray-500/5 text-gray-400 border-gray-500/30 shadow-gray-500/10"
    }
  }

  const loadFeaturedTickers = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const timestamp = new Date().getTime()
      const response = await fetch(
        `/api/ticker-ratings?mode=featured&category=${category}&minScore=75&t=${timestamp}`,
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
        throw new Error(result.error || "Failed to load featured tickers")
      }

      const ratings = result.data?.ratings || []
      const rankedTickers = ratings.slice(0, 10).map((ticker: FeaturedTicker, idx: number) => ({
        ...ticker,
        rank: idx + 1,
      }))

      setTickers(rankedTickers)

      // Calculate summary stats
      setSummary({
        totalTickers: rankedTickers.length,
        avgScore: (
          rankedTickers.reduce((sum: number, t: FeaturedTicker) => sum + t.scores.total, 0) /
          rankedTickers.length
        ).toFixed(0),
        strongBuys: rankedTickers.filter((t: FeaturedTicker) => t.recommendation === "strong_buy")
          .length,
        avgConfluence: (
          rankedTickers.reduce((sum: number, t: FeaturedTicker) => sum + t.scores.confluence, 0) /
          rankedTickers.length
        ).toFixed(0),
      })
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

  if (loading) {
    return (
      <Card className="bg-background/40 backdrop-blur-xl border-border/40 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Featured Tickers
          </CardTitle>
          <CardDescription>Loading top performers...</CardDescription>
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
            Featured Tickers
          </CardTitle>
          <CardDescription className="text-destructive">{error}</CardDescription>
        </CardHeader>
        <CardContent>
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
            Featured Tickers
          </CardTitle>
          <CardDescription>
            <span className="text-4xl mb-2 block">📊</span>
            No featured tickers available
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="bg-background/40 backdrop-blur-xl border-border/40 shadow-lg hover:shadow-[0_0_20px_rgba(51,255,51,0.3)] transition-all">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Featured Tickers
          </CardTitle>
          <CardDescription>
            Top {tickers.length} performers - {category.charAt(0).toUpperCase() + category.slice(1)}
          </CardDescription>
        </div>
        <Button variant="outline" asChild size="sm" className="sm:flex">
          <a href="/h1-tickers" className="dark:text-foreground">
            <Eye className="h-4 w-4 mr-2" />
            View All
          </a>
        </Button>
      </CardHeader>
      <Separator orientation="horizontal" className="mx-8" />

      {summary && (
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 p-3 rounded-lg bg-foreground/5">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{summary.strongBuys}</div>
              <div className="text-xs opacity-60">Strong Buys</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{summary.avgScore}</div>
              <div className="text-xs opacity-60">Avg Score</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{summary.avgConfluence}</div>
              <div className="text-xs opacity-60">Avg Confluence</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{summary.totalTickers}</div>
              <div className="text-xs opacity-60">Total</div>
            </div>
          </div>
        </CardContent>
      )}

      <CardContent className="space-y-3">
        {tickers.map((ticker) => (
          <div
            key={ticker.symbol}
            className={`rounded-xl border backdrop-blur-lg p-4 transition-all hover:scale-[1.02] hover:shadow-xl ${getRatingColor(ticker.rating)}`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                  #{ticker.rank}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="font-mono text-xs">
                      {ticker.symbol}
                    </Badge>
                    <Badge
                      variant={
                        ticker.rating === "A+" || ticker.rating === "A" ? "default" : "secondary"
                      }
                      className="text-xs"
                    >
                      {ticker.rating}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {ticker.sector}
                    </Badge>
                  </div>
                  <div className="text-sm opacity-80 mt-1">
                    ${ticker.currentPrice.toFixed(2)} → ${ticker.nextKeyLevel.price.toFixed(2)}
                  </div>
                </div>
              </div>
              <Badge variant="outline" className="font-mono">
                <Star className="h-3 w-3 mr-1 fill-yellow-400 text-yellow-400" />
                {(ticker.scores.total / 20).toFixed(1)}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs mb-2">
              <div>
                <span className="opacity-60">Confluence:</span>{" "}
                <span className="font-medium">{ticker.scores.confluence}</span>
              </div>
              <div>
                <span className="opacity-60">Momentum:</span>{" "}
                <span className="font-medium">{ticker.scores.momentum}</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-3 w-3" />
                <span
                  className={
                    ticker.nextKeyLevel.type === "resistance" ? "text-green-600" : "text-red-600"
                  }
                >
                  {ticker.nextKeyLevel.distancePercent.toFixed(2)}% to {ticker.nextKeyLevel.type}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="opacity-60">~{ticker.nextKeyLevel.daysUntilEstimate}d</span>
                <Progress
                  value={Math.min(ticker.nextKeyLevel.daysUntilEstimate, 30) * (100 / 30)}
                  className="w-12 h-1"
                />
              </div>
            </div>

            {ticker.reasons.length > 0 && (
              <div className="mt-2 pt-2 border-t border-current/10 text-xs opacity-80">
                <div className="flex items-start gap-1">
                  <span className="opacity-40">•</span>
                  <span>{ticker.reasons[0]}</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
})
