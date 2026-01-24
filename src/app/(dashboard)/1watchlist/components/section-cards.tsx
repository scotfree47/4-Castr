"use client"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Activity, BarChart3, DollarSign, TrendingDown, TrendingUp, Users } from "lucide-react"
import { useEffect, useState } from "react"

interface Metrics {
  totalRevenue: number
  revenueChange: number
  newTickers: number
  newTickersChange: number
  activeAccounts: number
  accountsChange: number
  portfolioGrowth: number
}

export function SectionCards() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)

  const getChangeColor = (change: number) => {
    if (change > 0) return "bg-green-500/5 text-green-400 border-green-500/30"
    if (change < 0) return "bg-red-500/5 text-red-400 border-red-500/30"
    return "bg-gray-500/5 text-gray-400 border-gray-500/30"
  }

  useEffect(() => {
    const calculateMetrics = async () => {
      try {
        setLoading(true)
        const response = await fetch("/api/ticker-ratings?mode=featured&category=equity")
        if (!response.ok) throw new Error("Failed to fetch")

        const result = await response.json()
        if (!result.success) throw new Error(result.error)

        const featured = (result.data.ratings || []).slice(0, 10)

        const totalRevenue = featured.reduce(
          (sum: number, ticker: any) => sum + (ticker.currentPrice || 0),
          0
        )

        const revenueChange = 5.2
        const portfolioGrowth = revenueChange

        setMetrics({
          totalRevenue,
          revenueChange,
          newTickers: 4,
          newTickersChange: -20,
          activeAccounts: 45678,
          accountsChange: 12.5,
          portfolioGrowth,
        })
      } catch (error) {
        console.error("Error calculating metrics:", error)
      } finally {
        setLoading(false)
      }
    }

    calculateMetrics()
  }, [])

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="bg-background/40 backdrop-blur-xl border-border/40 shadow-lg">
            <CardHeader>
              <Skeleton className="h-4 w-24 bg-foreground/5" />
              <Skeleton className="h-8 w-32 bg-foreground/5 mt-2" />
            </CardHeader>
          </Card>
        ))}
      </div>
    )
  }

  if (!metrics) return null

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card className="bg-background/40 backdrop-blur-xl border-border/40 shadow-lg hover:scale-[1.02] transition-all">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardDescription>Total Revenue</CardDescription>
            <DollarSign className="h-4 w-4 opacity-60" />
          </div>
          <CardTitle className="text-2xl font-semibold tabular-nums">
            ${metrics.totalRevenue.toFixed(2)}
          </CardTitle>
          <CardAction>
            <Badge
              variant="outline"
              className={`${getChangeColor(metrics.revenueChange)} transition-all`}
            >
              {metrics.revenueChange >= 0 ? (
                <TrendingUp className="h-3 w-3 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 mr-1" />
              )}
              {metrics.revenueChange >= 0 ? "+" : ""}
              {metrics.revenueChange.toFixed(1)}%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {Math.abs(metrics.revenueChange).toFixed(0)}%{" "}
            {metrics.revenueChange >= 0 ? "Increase" : "Decrease"} from previous month
            {metrics.revenueChange >= 0 ? (
              <TrendingUp className="size-4" />
            ) : (
              <TrendingDown className="size-4" />
            )}
          </div>
          <div className="text-muted-foreground text-xs">Expected profit from featured tickers</div>
        </CardFooter>
      </Card>

      <Card className="bg-background/40 backdrop-blur-xl border-border/40 shadow-lg hover:scale-[1.02] transition-all">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardDescription>New Tickers</CardDescription>
            <Activity className="h-4 w-4 opacity-60" />
          </div>
          <CardTitle className="text-2xl font-semibold tabular-nums">
            {metrics.newTickers}
          </CardTitle>
          <CardAction>
            <Badge
              variant="outline"
              className={`${getChangeColor(metrics.newTickersChange)} transition-all`}
            >
              <TrendingDown className="h-3 w-3 mr-1" />
              {metrics.newTickersChange}%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Down 20% this period <TrendingDown className="size-4" />
          </div>
          <div className="text-muted-foreground text-xs">Tickers added since month start</div>
        </CardFooter>
      </Card>

      <Card className="bg-background/40 backdrop-blur-xl border-border/40 shadow-lg hover:scale-[1.02] transition-all">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardDescription>Active Tickers</CardDescription>
            <Users className="h-4 w-4 opacity-60" />
          </div>
          <CardTitle className="text-2xl font-semibold tabular-nums">
            {metrics.activeAccounts.toLocaleString()}
          </CardTitle>
          <CardAction>
            <Badge
              variant="outline"
              className={`${getChangeColor(metrics.accountsChange)} transition-all`}
            >
              <TrendingUp className="h-3 w-3 mr-1" />+{metrics.accountsChange}%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Strong momentum <TrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground text-xs">Favorited tickers awaiting targets</div>
        </CardFooter>
      </Card>

      <Card className="bg-background/40 backdrop-blur-xl border-border/40 shadow-lg hover:scale-[1.02] transition-all">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardDescription>Portfolio Growth</CardDescription>
            <BarChart3 className="h-4 w-4 opacity-60" />
          </div>
          <CardTitle className="text-2xl font-semibold tabular-nums">
            {metrics.portfolioGrowth.toFixed(1)}%
          </CardTitle>
          <CardAction>
            <Badge
              variant="outline"
              className={`${getChangeColor(metrics.portfolioGrowth)} transition-all`}
            >
              {metrics.portfolioGrowth >= 0 ? (
                <TrendingUp className="h-3 w-3 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 mr-1" />
              )}
              {metrics.portfolioGrowth >= 0 ? "+" : ""}
              {metrics.portfolioGrowth.toFixed(1)}%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Steady performance increase <TrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground text-xs">Performance of favorited tickers</div>
        </CardFooter>
      </Card>
    </div>
  )
}
