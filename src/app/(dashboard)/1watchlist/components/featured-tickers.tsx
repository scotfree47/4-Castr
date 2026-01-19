"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Eye, Star, Target, TrendingUp } from "lucide-react"
import { useEffect, useState } from "react"

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

export function FeaturedTickers({ category = "equity" }: FeaturedTickersProps) {
  const [tickers, setTickers] = useState<FeaturedTicker[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadFeaturedTickers()
  }, [category])

  const loadFeaturedTickers = async () => {
    try {
      setLoading(true)
      setError(null)

      const timestamp = new Date().getTime()

      // ✅ FIXED: Use your existing /api/ticker-ratings endpoint
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

      // ✅ FIXED: Access ratings from result.data.ratings (matches your API structure)
      const ratings = result.data?.ratings || []

      // Take top 10 and add rank
      const rankedTickers = ratings.slice(0, 10).map((ticker: FeaturedTicker, idx: number) => ({
        ...ticker,
        rank: idx + 1,
      }))

      setTickers(rankedTickers)
    } catch (err: any) {
      console.error("Error loading featured tickers:", err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <p className="text-destructive">Error: {error}</p>
          <Button variant="outline" onClick={loadFeaturedTickers} className="mt-4">
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (tickers.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">No featured tickers available for {category}</p>
          <Button variant="outline" onClick={loadFeaturedTickers} className="mt-4">
            Refresh
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="cursor-pointer hover:border-primary/50 hover:shadow-[0_0_20px_rgba(51,255,51,0.3)] transition-all">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle>Featured Tickers</CardTitle>
          <CardDescription>
            Top Performers - {category.charAt(0).toUpperCase() + category.slice(1)}
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

      <CardContent className="space-y-4">
        {tickers.map((ticker) => (
          <div
            key={ticker.symbol}
            className="flex items-center p-3 rounded-lg border gap-2 hover:border-primary/30 transition-colors"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
              #{ticker.rank}
            </div>

            <div className="flex gap-2 items-center justify-between space-x-3 flex-1 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 flex-wrap">
                  <p className="text-sm font-medium truncate">{ticker.symbol}</p>

                  <Badge
                    variant={
                      ticker.rating === "A+" || ticker.rating === "A"
                        ? "default"
                        : ticker.rating === "B+" || ticker.rating === "B"
                          ? "secondary"
                          : "outline"
                    }
                    className="text-xs"
                  >
                    {ticker.rating}
                  </Badge>

                  <Badge variant="outline" className="text-xs">
                    {ticker.sector}
                  </Badge>

                  {ticker.scores.confluence >= 60 && (
                    <Badge variant="default" className="text-xs">
                      <Target className="h-3 w-3 mr-1" />
                      {ticker.scores.confluence}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center space-x-2 mt-1 flex-wrap">
                  <div className="flex items-center space-x-1">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    <span className="text-xs text-muted-foreground">
                      {(ticker.scores.total / 20).toFixed(1)}
                    </span>
                  </div>

                  <span className="text-xs text-muted-foreground">•</span>

                  <span
                    className={`text-xs ${
                      ticker.nextKeyLevel.type === "support" ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    ${ticker.nextKeyLevel.price.toFixed(2)} ({ticker.nextKeyLevel.type})
                  </span>

                  {ticker.reasons.length > 0 && (
                    <>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {ticker.reasons[0]}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="text-right space-y-1">
                <div className="flex items-center space-x-2">
                  <p className="text-sm font-medium">${ticker.currentPrice.toFixed(2)}</p>

                  <Badge
                    variant="outline"
                    className={`${
                      ticker.nextKeyLevel.type === "resistance"
                        ? "text-green-600 border-green-200"
                        : "text-red-600 border-red-200"
                    } cursor-pointer`}
                  >
                    <TrendingUp className="h-3 w-3 mr-1" />
                    {ticker.nextKeyLevel.distancePercent.toFixed(2)}%
                  </Badge>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-xs text-muted-foreground">
                    ~{ticker.nextKeyLevel.daysUntilEstimate}d
                  </span>
                  <Progress
                    value={Math.min(ticker.nextKeyLevel.daysUntilEstimate, 30) * (100 / 30)}
                    className="w-12 h-1"
                  />
                </div>

                <div className="text-xs text-muted-foreground capitalize">
                  {ticker.confidence.replace("_", " ")}
                </div>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
