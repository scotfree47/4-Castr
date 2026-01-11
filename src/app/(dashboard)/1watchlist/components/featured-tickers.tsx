"use client"

import { useEffect, useState } from "react"
import { Eye, Star, TrendingUp, Target } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { getFeaturedByCategory, getTickerHistory, type CategoryType } from '../../data'

interface TickerWithLevels {
  id: string;
  name: string;
  trend: string;
  revenue: string;
  growth: string;
  rating: number;
  stock: number;
  category: string;
  // New: Key level data
  nearestSupport?: number;
  nearestResistance?: number;
  confluenceScore?: number; // How many indicators agree
  nextKeyLevel?: {
    price: number;
    type: 'support' | 'resistance';
    distance: number;
  };
}

export function FeaturedTickers() {
  const [tickers, setTickers] = useState<TickerWithLevels[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadFeaturedTickers = async () => {
      try {
        // Get top 5 equity tickers by confidence
        const featured = getFeaturedByCategory('equity', 5)
        
        // Enrich with price data AND key levels
        const enriched = await Promise.all(
          featured.map(async (ticker) => {
            const history = getTickerHistory(ticker.ticker)
            const currentPrice = history[history.length - 1]?.price || 0
            const previousPrice = history[history.length - 30]?.price || currentPrice
            const growth = previousPrice !== 0 
              ? ((currentPrice - previousPrice) / previousPrice * 100).toFixed(1)
              : '0.0'
            
            // Fetch key levels for this ticker
            let nearestSupport, nearestResistance, confluenceScore, nextKeyLevel;
            
            try {
              const levelsRes = await fetch(
                `/api/levels/${ticker.ticker}?startDate=${new Date(Date.now() - 90*24*60*60*1000).toISOString().split('T')[0]}`
              );
              const levelsData = await levelsRes.json();
              
              if (levelsData.success && levelsData.data) {
                const { current } = levelsData.data;
                
                // Find nearest support/resistance
                const allLevels: any[] = [];
                
                // Collect all levels
                current.gannOctaves?.forEach((l: any) => allLevels.push(l));
                current.fibonacci?.forEach((l: any) => allLevels.push(l));
                current.supportResistance?.forEach((sr: any) => 
                  allLevels.push({ price: sr.price, type: sr.type, strength: sr.strength })
                );
                
                if (current.valueArea) {
                  allLevels.push(
                    { price: current.valueArea.valueAreaHigh, type: 'resistance', strength: 9 },
                    { price: current.valueArea.valueAreaLow, type: 'support', strength: 9 }
                  );
                }
                
                // Find nearest support (below current price)
                const supports = allLevels
                  .filter(l => l.price < currentPrice && (l.type === 'support' || l.type === 'gann'))
                  .sort((a, b) => b.price - a.price);
                nearestSupport = supports[0]?.price;
                
                // Find nearest resistance (above current price)
                const resistances = allLevels
                  .filter(l => l.price > currentPrice && (l.type === 'resistance' || l.type === 'gann'))
                  .sort((a, b) => a.price - b.price);
                nearestResistance = resistances[0]?.price;
                
                // Calculate confluence score (levels within 1% of each other)
                const tolerance = currentPrice * 0.01;
                const nearbyLevels = allLevels.filter(l => 
                  Math.abs(l.price - currentPrice) <= tolerance
                );
                confluenceScore = nearbyLevels.length;
                
                // Next key level
                const nextSupport = supports[0];
                const nextRes = resistances[0];
                
                if (nextSupport && nextRes) {
                  const supportDist = currentPrice - nextSupport.price;
                  const resDist = nextRes.price - currentPrice;
                  
                  nextKeyLevel = supportDist < resDist
                    ? { price: nextSupport.price, type: 'support', distance: supportDist }
                    : { price: nextRes.price, type: 'resistance', distance: resDist };
                } else if (nextSupport) {
                  nextKeyLevel = { 
                    price: nextSupport.price, 
                    type: 'support', 
                    distance: currentPrice - nextSupport.price 
                  };
                } else if (nextRes) {
                  nextKeyLevel = { 
                    price: nextRes.price, 
                    type: 'resistance', 
                    distance: nextRes.price - currentPrice 
                  };
                }
              }
            } catch (err) {
              console.error(`Failed to fetch levels for ${ticker.ticker}:`, err);
            }
            
            return {
              id: ticker.ticker,
              name: ticker.ticker,
              trend: ticker.trend,
              revenue: `$${currentPrice.toFixed(2)}`,
              growth: `${parseFloat(growth) >= 0 ? '+' : ''}${growth}%`,
              rating: (ticker.confidenceScore ?? 0) / 20,
              stock: typeof ticker.next === 'object' && ticker.next && 'daysUntil' in ticker.next 
                ? (ticker.next as any).daysUntil 
                : 0,
              category: ticker.type,
              nearestSupport,
              nearestResistance,
              confluenceScore,
              nextKeyLevel,
            };
          })
        );
        
        setTickers(enriched)
      } catch (error) {
        console.error('Error loading featured tickers:', error)
      } finally {
        setLoading(false)
      }
    }

    loadFeaturedTickers()
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
          <CardTitle>Currently Featured</CardTitle>
          <CardDescription>Best Performers with Key Levels</CardDescription>
        </div>
        <Button variant="outline" asChild size="sm" className="sm:flex">
          <a href="/h1-tickers" className="dark:text-foreground">
            <Eye className="h-4 w-4 mr-2"/>
            View All
          </a>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {tickers.map((product, index) => (
          <div key={product.id} className="flex items-center p-3 rounded-lg border gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
              #{index + 1}
            </div>
            <div className="flex gap-2 items-center justify-between space-x-3 flex-1 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <p className="text-sm font-medium truncate">{product.name}</p>
                  <Badge variant="outline" className="text-xs">
                    {product.category}
                  </Badge>
                  {product.confluenceScore && product.confluenceScore > 2 && (
                    <Badge variant="default" className="text-xs">
                      <Target className="h-3 w-3 mr-1" />
                      {product.confluenceScore}x
                    </Badge>
                  )}
                </div>
                <div className="flex items-center space-x-2 mt-1">
                  <div className="flex items-center space-x-1">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    <span className="text-xs text-muted-foreground">{product.rating.toFixed(1)}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground">{product.trend}</span>
                  {product.nextKeyLevel && (
                    <>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className={`text-xs ${product.nextKeyLevel.type === 'support' ? 'text-green-600' : 'text-red-600'}`}>
                        ${product.nextKeyLevel.price.toFixed(2)} ({product.nextKeyLevel.type})
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="text-right space-y-1">
                <div className="flex items-center space-x-2">
                  <p className="text-sm font-medium">{product.revenue}</p>
                  <Badge
                    variant="outline"
                    className={`${parseFloat(product.growth) >= 0 ? 'text-green-600 border-green-200' : 'text-red-600 border-red-200'} cursor-pointer`}
                  >
                    <TrendingUp className="h-3 w-3 mr-1" />
                    {product.growth}
                  </Badge>
                </div>
                {product.nearestSupport && product.nearestResistance && (
                  <div className="text-xs text-muted-foreground">
                    S: ${product.nearestSupport.toFixed(2)} | R: ${product.nearestResistance.toFixed(2)}
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-muted-foreground">Days: {product.stock}</span>
                  <Progress
                    value={Math.min(product.stock, 30) * (100/30)}
                    className="w-12 h-1"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}