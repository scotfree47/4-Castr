"use client"

import { useEffect, useState } from "react"
import { Eye, Star, TrendingUp, Target } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"

interface FeaturedTicker {
  symbol: string;
  category: string;
  sector: string;
  currentPrice: number;
  nextKeyLevel: {
    price: number;
    type: 'support' | 'resistance';
    distancePercent: number;
    daysUntil?: number;
  };
  confluenceScore: number;
  tradeabilityScore: number;
  reason: string;
  rank: number;
}

export function FeaturedTickers() {
  const [tickers, setTickers] = useState<FeaturedTicker[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadFeaturedTickers = async () => {
      try {
        setLoading(true);
        
        // ✅ FIXED: Use path segment instead of query param
        const response = await fetch('/api/featured/equity');
        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error || 'Failed to load featured tickers');
        }
        
        console.log('✅ Featured tickers loaded:', data.data.length);
        setTickers(data.data);
        
      } catch (err: any) {
        console.error('❌ Error loading featured tickers:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadFeaturedTickers();
  }, [])

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
          <Button 
            variant="outline" 
            onClick={() => window.location.reload()}
            className="mt-4"
          >
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
          <p className="text-muted-foreground">No featured tickers available</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="cursor-pointer hover:border-primary/50 hover:shadow-[0_0_20px_rgba(51,255,51,0.3)] transition-all">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle>Featured Tickers</CardTitle>
          <CardDescription>Top Performers</CardDescription>
        </div>
        <Button variant="outline" asChild size="sm" className="sm:flex">
          <a href="/h1-tickers" className="dark:text-foreground">
            <Eye className="h-4 w-4 mr-2"/>
            View All
          </a>
        </Button>
      </CardHeader>
      <Separator
            orientation="horizontal"
            className="mx-8 min-w-48 max-w-156 hidden:lg-92 data-[orientation=horizontal]:h-[1]"
      />
      
      <CardContent className="space-y-4">
        {tickers.map((ticker) => (
          <div key={ticker.symbol} className="flex items-center p-3 rounded-lg border gap-2">
            
            {/* Rank Badge */}
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
              #{ticker.rank}
            </div>
            
            <div className="flex gap-2 items-center justify-between space-x-3 flex-1 flex-wrap">
              
              {/* Symbol & Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <p className="text-sm font-medium truncate">{ticker.symbol}</p>
                  
                  <Badge variant="outline" className="text-xs">
                    {ticker.category}
                  </Badge>
                  
                  {/* Confluence Badge */}
                  {ticker.confluenceScore > 60 && (
                    <Badge variant="default" className="text-xs">
                      <Target className="h-3 w-3 mr-1" />
                      {ticker.confluenceScore}
                    </Badge>
                  )}
                </div>
                
                {/* Next Level Info */}
                <div className="flex items-center space-x-2 mt-1">
                  <div className="flex items-center space-x-1">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    <span className="text-xs text-muted-foreground">
                      {(ticker.tradeabilityScore / 20).toFixed(1)}
                    </span>
                  </div>
                  
                  {/*
                  <span className="text-xs text-muted-foreground">•</span>

                  {/* Change to visually display current price; hide reasoning as background process */}
                  {/*
                  <span className="text-xs text-muted-foreground">{ticker.reason}</span>
                  */}

                  {/*                  {ticker.nextKeyLevel && (  
                  {ticker.nextKeyLevel && (
                    <>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className={`text-xs ${ // hide 
                        ticker.nextKeyLevel.type === 'support' 
                          ? 'text-green-600' 
                          : 'text-red-600'
                      }`}>
                        ${ticker.nextKeyLevel.price.toFixed(2)} ({ticker.nextKeyLevel.type})
                      </span>
                    </>
                  )}
                  */}
                  
                </div>
              </div>
              
              {/* Price & Stats */}
              <div className="text-right space-y-1">
                <div className="flex items-center space-x-2">
                  <p className="text-sm font-medium">
                    ${ticker.currentPrice.toFixed(2)}
                  </p>
                  
                  <Badge
                    variant="outline"
                    className={`${
                      ticker.nextKeyLevel.type === 'resistance'
                        ? 'text-green-600 border-green-200'
                        : 'text-red-600 border-red-200'
                    } cursor-pointer`}
                  >
                    <TrendingUp className="h-3 w-3 mr-1" />
                    {ticker.nextKeyLevel.distancePercent.toFixed(2)}%
                  </Badge>
                </div>
                
                {/* Days Until Next Level */}
                {ticker.nextKeyLevel.daysUntil && (
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-muted-foreground">
                      Days: {ticker.nextKeyLevel.daysUntil}
                    </span>
                    <Progress
                      value={Math.min(ticker.nextKeyLevel.daysUntil, 30) * (100/30)}
                      className="w-12 h-1"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}