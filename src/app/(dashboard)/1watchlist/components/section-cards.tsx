"use client"

import { useEffect, useState } from "react"
import { TrendingDown, TrendingUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { getAllTickers, getTickerHistory } from '../../data'

export function SectionCards() {
  const [metrics, setMetrics] = useState({
    totalRevenue: 0,
    revenueChange: 0,
    newTickers: 0,
    newTickersChange: 0,
    activeAccounts: 45678,
    accountsChange: 12.5,
    portfolioGrowth: 0,
  })

  useEffect(() => {
    const calculateMetrics = () => {
      const allTickers = getAllTickers().filter(t => t.type === 'equity')
      
      // Calculate total revenue (sum of featured ticker prices)
      const featured = allTickers.slice(0, 10)
      const totalRevenue = featured.reduce((sum, ticker) => {
        const history = getTickerHistory(ticker.ticker)
        const currentPrice = history[history.length - 1]?.price || 0
        return sum + currentPrice
      }, 0)
      
      // Revenue change (30 days ago vs now)
      const revenueChange = featured.reduce((sum, ticker) => {
        const history = getTickerHistory(ticker.ticker)
        const current = history[history.length - 1]?.price || 0
        const previous = history[history.length - 30]?.price || current
        const change = previous !== 0 ? ((current - previous) / previous * 100) : 0
        return sum + change
      }, 0) / featured.length
      
      // Count new tickers (mock - you'd track this in your data)
      const newTickers = 4
      
      // Portfolio growth (average of all featured)
      const portfolioGrowth = revenueChange
      
      setMetrics({
        totalRevenue,
        revenueChange,
        newTickers,
        newTickersChange: -20,
        activeAccounts: 45678,
        accountsChange: 12.5,
        portfolioGrowth,
      })
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
              {metrics.revenueChange >= 0 ? '+' : ''}{metrics.revenueChange.toFixed(1)}%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {Math.abs(metrics.revenueChange).toFixed(0)}% {metrics.revenueChange >= 0 ? 'Increase' : 'Decrease'} from previous month
            {metrics.revenueChange >= 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
          </div>
          <div className="text-muted-foreground">
            Expected profit from featured tickers
          </div>
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
          <div className="text-muted-foreground">
            Tickers added since month start
          </div>
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
              <TrendingUp />
              +{metrics.accountsChange}%
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
              {metrics.portfolioGrowth >= 0 ? '+' : ''}{metrics.portfolioGrowth.toFixed(1)}%
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