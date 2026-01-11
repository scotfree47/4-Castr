"use client"

import { useEffect, useState } from "react"
import { Eye, MoreHorizontal } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { getAllTickers, getTickerHistory } from '../../data'

export function PreviouslyFeatured() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadPreviouslyFeatured = async () => {
      try {
        // Get tickers that were recently featured but aren't in top 5 anymore
        const allTickers = getAllTickers()
          .filter(t => t.type === 'equity')
          .sort((a, b) => (b.confidenceScore || 0) - (a.confidenceScore || 0))
          .slice(5, 10) // positions 6-10
        
        const enriched = allTickers.map(ticker => {
          const history = getTickerHistory(ticker.ticker)
          const currentPrice = history[history.length - 1]?.price || 0
          
          // Determine status based on next key level
          const nextLevel = typeof ticker.next === 'object' && ticker.next && 'type' in ticker.next 
            ? (ticker.next as any) 
            : null

          const status = nextLevel?.type === 'resistance' ? 'Wait' : 
                        nextLevel?.type === 'support' ? 'Pass' : 
                        'Fail'
                        
          // Calculate weeks ago (mock for now - you'd track this in your data)
          const weeksAgo = Math.floor(Math.random() * 4) + 2
          
          return {
            id: ticker.ticker,
            customer: {
              name: ticker.ticker,
              email: ticker.type,
              avatar: `/avatars/${ticker.ticker.slice(0, 2).toLowerCase()}.png`,
            },
            amount: `$${currentPrice.toFixed(2)}`,
            status,
            date: `${weeksAgo} weeks ago`,
          }
        })
        
        setTransactions(enriched)
      } catch (error) {
        console.error('Error loading previously featured:', error)
      } finally {
        setLoading(false)
      }
    }

    loadPreviouslyFeatured()
  }, [])

  if (loading) {
    return (
      <Card className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </Card>
    )
  }

  return (
    <Card className="cursor-pointer hover:border-primary/50 hover:shadow-[0_0_20px_rgba(51,255,51,0.3)] transition-all">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle>Previously Featured</CardTitle>
          <CardDescription>Recent Performers</CardDescription>
        </div>
        <Button variant="outline" asChild size="sm" className="sm:flex">
          <a
            href="/h1-tickers"
            className="dark:text-foreground">
            <Eye className="h-4 w-4 mr-2"/>
            View All
          </a>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {transactions.map((transaction) => (
          <div key={transaction.id}>
            <div className="flex p-3 rounded-lg border gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback>{transaction.customer.name.slice(0, 2)}</AvatarFallback>
              </Avatar>
              <div className="flex flex-1 items-center flex-wrap justify-between gap-1">
                <div className="flex items-center space-x-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{transaction.customer.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{transaction.customer.email}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Badge
                    variant={
                      transaction.status === "Pass" ? "default" :
                      transaction.status === "Wait" ? "secondary" : "destructive"
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