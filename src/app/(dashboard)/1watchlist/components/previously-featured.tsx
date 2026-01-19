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
import { Eye, MoreHorizontal, TrendingDown, TrendingUp } from "lucide-react"
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

  useEffect(() => {
    loadPreviouslyFeatured()
  }, [])

  const loadPreviouslyFeatured = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch all equity tickers, get positions 6-10
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

      // Get positions 6-10 (previously featured, no longer in top 5)
      const enriched = allTickers.slice(5, 10).map((ticker: any) => {
        // Determine status based on recommendation
        let status: "Pass" | "Wait" | "Fail"
        if (ticker.recommendation === "strong_buy" || ticker.recommendation === "buy") {
          status = "Pass"
        } else if (ticker.recommendation === "hold") {
          status = "Wait"
        } else {
          status = "Fail"
        }

        // Determine why it dropped from top 5
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

        // Calculate trend
        const trend = ticker.nextKeyLevel.type === "resistance" ? "up" : "down"
        const change = `${trend === "up" ? "+" : ""}${ticker.nextKeyLevel.distancePercent.toFixed(1)}%`

        // Mock time since featured (could be enhanced with actual tracking)
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
    } catch (err: any) {
      console.error("Error loading previously featured:", err)
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
          <Button variant="outline" onClick={loadPreviouslyFeatured} className="mt-4">
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (transactions.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">No previously featured tickers available</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="cursor-pointer hover:border-primary/50 hover:shadow-[0_0_20px_rgba(51,255,51,0.3)] transition-all">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle>Previously Featured</CardTitle>
          <CardDescription>Recent Performers (Rank 6-10)</CardDescription>
        </div>
        <Button variant="outline" asChild size="sm" className="sm:flex">
          <a href="/h1-tickers" className="dark:text-foreground">
            <Eye className="h-4 w-4 mr-2" />
            View All
          </a>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {transactions.map((transaction) => (
          <div key={transaction.id}>
            <div className="flex p-3 rounded-lg border gap-2 hover:border-primary/30 transition-colors">
              <Avatar className="h-8 w-8">
                <AvatarFallback>{transaction.customer.name.slice(0, 2)}</AvatarFallback>
              </Avatar>
              <div className="flex flex-1 items-center flex-wrap justify-between gap-1">
                <div className="flex items-center space-x-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{transaction.customer.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {transaction.customer.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="flex items-center gap-1">
                    {transaction.trend === "up" ? (
                      <TrendingUp className="h-3 w-3 text-green-600" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-600" />
                    )}
                    <span
                      className={`text-xs ${transaction.trend === "up" ? "text-green-600" : "text-red-600"}`}
                    >
                      {transaction.change}
                    </span>
                  </div>

                  <Badge
                    variant={
                      transaction.status === "Pass"
                        ? "default"
                        : transaction.status === "Wait"
                          ? "secondary"
                          : "destructive"
                    }
                    className="cursor-pointer"
                  >
                    {transaction.status}
                  </Badge>

                  <div className="text-right">
                    <p className="text-sm font-medium">{transaction.amount}</p>
                    <p className="text-xs text-muted-foreground">{transaction.date}</p>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 cursor-pointer">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem className="cursor-pointer text-xs">
                        Reason: {transaction.reason}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer">Alerts</DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer">Metrics</DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer">Favorite</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
