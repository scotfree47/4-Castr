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
import { TrendingDown, TrendingUp } from "lucide-react"
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
  const [metrics, setMetrics] = useState<Metrics>({
    totalRevenue: 0,
    revenueChange: 0,
    newTickers: 0,
    newTickersChange: 0,
    activeAccounts: 45678,
    accountsChange: 12.5,
    portfolioGrowth: 0,
  })

  useEffect(() => {
    const calculateMetrics = async () => {
      try {
        const response = await fetch("/api/ticker-ratings?mode=featured&category=equity")
        if (!response.ok) throw new Error("Failed to fetch")

        const result = await response.json()
        if (!result.success) throw new Error(result.error)

        const featured = (result.data.ratings || []).slice(0, 10)

        // Calculate total revenue
        const totalRevenue = featured.reduce(
          (sum: number, ticker: any) => sum + (ticker.currentPrice || 0),
          0
        )

        // Mock revenue change (would need historical data)
        const revenueChange = 5.2

        // Mock portfolio growth
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
      }
    }

    calculateMetrics()
  }, [])

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total Revenue</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            ${metrics.totalRevenue.toFixed(2)}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              {metrics.revenueChange >= 0 ? <TrendingUp /> : <TrendingDown />}
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
          <div className="text-muted-foreground">Expected profit from featured tickers</div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>New Tickers</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {metrics.newTickers}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <TrendingDown />
              {metrics.newTickersChange}%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Down 20% this period <TrendingDown className="size-4" />
          </div>
          <div className="text-muted-foreground">Tickers added since month start</div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Active Tickers</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {metrics.activeAccounts.toLocaleString()}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <TrendingUp />+{metrics.accountsChange}%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Strong momentum <TrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">Favorited tickers awaiting targets</div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Portfolio Growth</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {metrics.portfolioGrowth.toFixed(1)}%
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              {metrics.portfolioGrowth >= 0 ? <TrendingUp /> : <TrendingDown />}
              {metrics.portfolioGrowth >= 0 ? "+" : ""}
              {metrics.portfolioGrowth.toFixed(1)}%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Steady performance increase <TrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">Performance of favorited tickers</div>
        </CardFooter>
      </Card>
    </div>
  )
}
