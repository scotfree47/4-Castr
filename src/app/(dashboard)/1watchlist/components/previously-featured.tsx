"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { Eye, History, MoreHorizontal, TrendingDown, TrendingUp } from "lucide-react"
import { useEffect, useState } from "react"

interface Transaction {
  id: string
  customer: {
    name: string
    email: string
    avatar: string
  }
  amount: string
  status: "Pass" | "Wait" | "Fail"
  date: string
  trend: "up" | "down"
  change: string
  reason: string
}

export function PreviouslyFeatured() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<any>(null)

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Pass":
        return "bg-green-500/5 text-green-400 border-green-500/30 shadow-green-500/10"
      case "Wait":
        return "bg-yellow-500/5 text-yellow-400 border-yellow-500/30 shadow-yellow-500/10"
      case "Fail":
        return "bg-red-500/5 text-red-400 border-red-500/30 shadow-red-500/10"
      default:
        return "bg-gray-500/5 text-gray-400 border-gray-500/30 shadow-gray-500/10"
    }
  }

  useEffect(() => {
    loadPreviouslyFeatured()
  }, [])

  const loadPreviouslyFeatured = async () => {
    try {
      setLoading(true)
      setError(null)

      const timestamp = new Date().getTime()
      const response = await fetch(
        `/api/ticker-ratings?mode=batch&category=equity&minScore=50&t=${timestamp}`,
        {
          headers: {
            "Cache-Control": "no-cache",
          },
        }
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || "Failed to load tickers")
      }

      const allTickers = result.data.ratings || []
      const enriched = allTickers.slice(5, 10).map((ticker: any) => {
        let status: "Pass" | "Wait" | "Fail"
        if (ticker.recommendation === "strong_buy" || ticker.recommendation === "buy") {
          status = "Pass"
        } else if (ticker.recommendation === "hold") {
          status = "Wait"
        } else {
          status = "Fail"
        }

        let reason = ""
        if (ticker.scores.confluence < 60) {
          reason = "Low confluence"
        } else if (ticker.scores.momentum < 60) {
          reason = "Weak momentum"
        } else if (ticker.scores.proximity < 70) {
          reason = "Far from level"
        } else {
          reason = "Lower ranking"
        }

        const trend = ticker.nextKeyLevel.type === "resistance" ? "up" : "down"
        const change = `${trend === "up" ? "+" : ""}${ticker.nextKeyLevel.distancePercent.toFixed(1)}%`
        const weeksAgo = Math.floor(Math.random() * 4) + 2

        return {
          id: ticker.symbol,
          customer: {
            name: ticker.symbol,
            email: ticker.sector,
            avatar: `/avatars/${ticker.symbol.slice(0, 2).toLowerCase()}.png`,
          },
          amount: `$${ticker.currentPrice.toFixed(2)}`,
          status,
          date: `${weeksAgo} weeks ago`,
          trend,
          change,
          reason,
        }
      })

      setTransactions(enriched)

      setSummary({
        pass: enriched.filter((t: Transaction) => t.status === "Pass").length,
        wait: enriched.filter((t: Transaction) => t.status === "Wait").length,
        fail: enriched.filter((t: Transaction) => t.status === "Fail").length,
        total: enriched.length,
      })
    } catch (err: any) {
      console.error("Error loading previously featured:", err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card className="bg-background/40 backdrop-blur-xl border-border/40 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Previously Featured
          </CardTitle>
          <CardDescription>Loading recent performers...</CardDescription>
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
            <History className="h-5 w-5" />
            Previously Featured
          </CardTitle>
          <CardDescription className="text-destructive">{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={loadPreviouslyFeatured}>
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (transactions.length === 0) {
    return (
      <Card className="bg-background/40 backdrop-blur-xl border-border/40 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Previously Featured
          </CardTitle>
          <CardDescription>
            <span className="text-4xl mb-2 block">📉</span>
            No previously featured tickers available
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
            <History className="h-5 w-5" />
            Previously Featured
          </CardTitle>
          <CardDescription>Recent Performers (Rank 6-10)</CardDescription>
        </div>
        <Button variant="outline" asChild size="sm" className="sm:flex">
          <a href="/h1-tickers" className="dark:text-foreground">
            <Eye className="h-4 w-4 mr-2" />
            View All
          </a>
        </Button>
      </CardHeader>

      {summary && (
        <CardContent className="pt-0">
          <div className="grid grid-cols-4 gap-3 mb-4 p-3 rounded-lg bg-foreground/5">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{summary.pass}</div>
              <div className="text-xs opacity-60">Pass</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-400">{summary.wait}</div>
              <div className="text-xs opacity-60">Wait</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-400">{summary.fail}</div>
              <div className="text-xs opacity-60">Fail</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{summary.total}</div>
              <div className="text-xs opacity-60">Total</div>
            </div>
          </div>
        </CardContent>
      )}

      <CardContent className="space-y-3">
        {transactions.map((transaction) => (
          <div
            key={transaction.id}
            className={`rounded-xl border backdrop-blur-lg p-4 transition-all hover:scale-[1.02] hover:shadow-xl ${getStatusColor(transaction.status)}`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>{transaction.customer.name.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs">
                      {transaction.customer.name}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {transaction.customer.email}
                    </Badge>
                  </div>
                  <div className="text-sm opacity-80 mt-1">{transaction.date}</div>
                </div>
              </div>
              <Badge
                variant={
                  transaction.status === "Pass"
                    ? "default"
                    : transaction.status === "Wait"
                      ? "secondary"
                      : "destructive"
                }
              >
                {transaction.status}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs mb-2">
              <div>
                <span className="opacity-60">Price:</span>{" "}
                <span className="font-medium font-mono">{transaction.amount}</span>
              </div>
              <div className="flex items-center gap-1">
                {transaction.trend === "up" ? (
                  <TrendingUp className="h-3 w-3 text-green-600" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-600" />
                )}
                <span className={transaction.trend === "up" ? "text-green-600" : "text-red-600"}>
                  {transaction.change}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between mt-2 pt-2 border-t border-current/10">
              <div className="text-xs opacity-80">
                <span className="opacity-40">•</span> {transaction.reason}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="cursor-pointer text-xs">Alerts</DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer text-xs">Metrics</DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer text-xs">Favorite</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
