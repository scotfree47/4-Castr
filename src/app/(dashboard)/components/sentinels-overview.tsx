"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel"
import { Separator } from "@/components/ui/separator"
import {
  Activity,
  AlertTriangle,
  Bitcoin,
  Coins,
  DollarSign,
  Target,
  TrendingDown,
  TrendingUp,
  TrendingUpDown,
} from "lucide-react"
import { useEffect, useState } from "react"
const SENTINELS = {
  equity: ["SPY", "QQQ", "XLY"],
  commodity: ["GLD", "USO", "HG"],
  forex: ["EURUSD", "USDJPY", "GBPUSD"],
  crypto: ["BTC", "ETH", "SOL"],
  "rates-macro": ["TLT", "DXY", "TNX"],
  stress: ["VIX", "MOVE", "SKEW"],
}

const GROUP_CONFIG = [
  { id: "equity", title: "Equity", icon: DollarSign },
  { id: "commodity", title: "Commodity", icon: Coins },
  { id: "forex", title: "Forex", icon: TrendingUpDown },
  { id: "crypto", title: "Crypto", icon: Bitcoin },
  { id: "rates-macro", title: "Rates / Macro", icon: Activity },
  { id: "stress", title: "Stress", icon: AlertTriangle },
]

interface SentinelMetric {
  title: string
  strongestSymbol: string
  strongestPrice: number
  strongestChange: number
  nearestSupport: number | null
  nearestResistance: number | null
  description: string
  avgChange: string
  trend: "up" | "down" | "neutral"
  icon: any
  footer: string
  footerIcon: any
  sentinels: Array<{ symbol: string; display: string }>
  categoryId: string
}

interface SentinelsOverviewProps {
  onCategoryChange?: (category: string) => void
}

export function SentinelsOverview({ onCategoryChange }: SentinelsOverviewProps = {}) {
  const [api, setApi] = useState<any>()
  const [current, setCurrent] = useState(0)
  const [metrics, setMetrics] = useState<SentinelMetric[]>([])
  const [loading, setLoading] = useState(true)
  const [ingressData, setIngressData] = useState<any>(null)

  useEffect(() => {
    initializeData()
  }, [])

  useEffect(() => {
    if (!api) return
    setCurrent(api.selectedScrollSnap())
    api.on("select", () => {
      const index = api.selectedScrollSnap()
      setCurrent(index)
      // Notify parent of category change
      if (onCategoryChange && metrics[index]) {
        onCategoryChange(metrics[index].categoryId)
      }
    })
  }, [api, metrics, onCategoryChange])

  // Notify parent of initial category
  useEffect(() => {
    if (metrics.length > 0 && onCategoryChange) {
      onCategoryChange(metrics[0].categoryId)
    }
  }, [metrics, onCategoryChange])

  const initializeData = async () => {
    try {
      setLoading(true)
      const ingress = await getCurrentIngress()
      setIngressData(ingress)
      await fetchAllMetrics(ingress)
    } catch (error) {
      console.error("❌ Error initializing sentinels:", error)
    } finally {
      setLoading(false)
    }
  }

  const getCurrentIngress = async () => {
    try {
      const res = await fetch("/api/ingress", {
        headers: { "Cache-Control": "no-cache" },
      })
      const result = await res.json()

      if (result.success && result.data) {
        return result.data
      }

      console.error("Error fetching ingress:", result.error)
      return null
    } catch (err) {
      console.error("Error in getCurrentIngress:", err)
      return null
    }
  }

  const fetchAllMetrics = async (ingress: any) => {
    if (!ingress) {
      console.warn("⚠️ No ingress data available")
      setMetrics(GROUP_CONFIG.map(createEmptyMetric))
      return
    }

    console.log("📊 Fetching sentinels metrics for all categories...")

    try {
      const results = await Promise.all(
        GROUP_CONFIG.map(async (group) => {
          try {
            const symbols = SENTINELS[group.id as keyof typeof SENTINELS]
            const symbolsParam = symbols.join(",")

            console.log(`🔍 Fetching ${group.id}: ${symbolsParam}`)

            // Fetch ticker ratings
            const ratingsRes = await fetch(
              `/api/ticker-ratings?mode=batch&symbols=${symbolsParam}&minScore=0`,
              { headers: { "Cache-Control": "no-cache" } }
            )
            const ratingsResult = await ratingsRes.json()

            console.log(`   📈 ${group.id} ratings:`, ratingsResult.success ? `${ratingsResult.data?.ratings?.length || 0} tickers` : "FAILED")

            if (ratingsResult.success && ratingsResult.data?.ratings && ratingsResult.data.ratings.length > 0) {
              const metric = processGroupRatings(group, ratingsResult.data.ratings, ingress)
              console.log(`   ✅ ${group.id} metric:`, metric.strongestSymbol, metric.strongestPrice)
              return metric
            }

            console.warn(`   ⚠️ ${group.id}: No ratings data, using empty metric`)
            return createEmptyMetric(group)
          } catch (err) {
            console.error(`❌ Error fetching ${group.id}:`, err)
            return createEmptyMetric(group)
          }
        })
      )

      console.log("✅ All metrics fetched, setting state...")
      setMetrics(results)
    } catch (error) {
      console.error("❌ Critical error fetching metrics:", error)
      setMetrics(GROUP_CONFIG.map(createEmptyMetric))
    }
  }

  const processGroupRatings = (group: any, ratings: any[], ingress: any): SentinelMetric => {
    if (!ratings || ratings.length === 0) return createEmptyMetric(group)

    const validRatings = ratings.filter((r) => r.currentPrice > 0)
    if (validRatings.length === 0) return createEmptyMetric(group)

    // Calculate average total score
    const avgScore = validRatings.reduce((sum, r) => sum + r.scores.total, 0) / validRatings.length

    // Find strongest by total score
    const strongest = validRatings.reduce((max, r) => (r.scores.total > max.scores.total ? r : max))

    const TrendIcon = avgScore >= 50 ? TrendingUp : TrendingDown
    const trend: "up" | "down" | "neutral" = avgScore >= 50 ? "up" : "down"

    return {
      title: group.title,
      strongestSymbol: strongest.symbol,
      strongestPrice: strongest.currentPrice,
      strongestChange: strongest.scores.total,
      nearestSupport:
        strongest.nextKeyLevel?.type === "support" ? strongest.nextKeyLevel.price : null,
      nearestResistance:
        strongest.nextKeyLevel?.type === "resistance" ? strongest.nextKeyLevel.price : null,
      description: `Strongest of ${validRatings.length} sentinels`,
      avgChange: `${avgScore.toFixed(0)}`,
      trend,
      icon: group.icon,
      footer: `${ingress.month || "Current"}'s Score: ${avgScore.toFixed(0)}`,
      footerIcon: TrendIcon,
      sentinels: validRatings.map((r) => ({
        symbol: r.symbol,
        display: `${r.symbol} ${r.currentPrice.toFixed(2)} [${r.rating}]`,
      })),
      categoryId: group.id,
    }
  }

  const createEmptyMetric = (group: any): SentinelMetric => ({
    title: group.title,
    strongestSymbol: "—",
    strongestPrice: 0,
    strongestChange: 0,
    nearestSupport: null,
    nearestResistance: null,
    description: "No data available",
    avgChange: "0",
    trend: "neutral",
    icon: group.icon,
    footer: "Awaiting data",
    footerIcon: TrendingUp,
    sentinels: [],
    categoryId: group.id,
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  const getWindowTypeColor = (type: string) => {
    switch (type) {
      case "high_probability":
        return "bg-green-500/5 text-green-400 border-green-500/30 shadow-green-500/10"
      case "moderate":
        return "bg-blue-500/5 text-blue-400 border-blue-500/30 shadow-blue-500/10"
      case "avoid":
        return "bg-gray-500/5 text-gray-400 border-gray-500/30 shadow-gray-500/10"
      case "extreme_volatility":
        return "bg-orange-500/5 text-orange-400 border-orange-500/30 shadow-orange-500/10"
      default:
        return "bg-background/20 border-border/40"
    }
  }

  return (
    <Carousel setApi={setApi}>
      <CarouselContent>
        {metrics.map((metric) => {
          const Icon = metric.icon
          const FooterIcon = metric.footerIcon

          return (
            <CarouselItem key={metric.title}>
              <Card className="bg-background/40 backdrop-blur-xl border-border/40 shadow-lg hover:border-primary/50 transition-colors h-full flex flex-col">
                <CardHeader className="relative flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Icon className="h-6 w-6 text-muted-foreground" />
                      <CardTitle className="text-lg">{metric.title}</CardTitle>
                    </div>
                    <Badge
                      variant={metric.trend === "up" ? "default" : "destructive"}
                      className="flex items-center gap-1 shrink-0"
                    >
                      {metric.trend === "up" ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {metric.avgChange}
                    </Badge>
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="text-2xl font-semibold tabular-nums">
                        {metric.strongestSymbol} ${metric.strongestPrice.toFixed(2)}
                      </div>

                      {/*(metric.nearestSupport || metric.nearestResistance) && (
                        <div className="mt-2 flex items-center gap-3 text-xs">
                          {metric.nearestSupport && (
                            <div className="flex items-center gap-1">
                              <Target className="h-3 w-3 text-green-600" />
                              <span className="text-green-600">
                                S: ${metric.nearestSupport.toFixed(2)}
                              </span>
                            </div>
                          )}
                          {metric.nearestResistance && (
                            <div className="flex items-center gap-1">
                              <Target className="h-3 w-3 text-red-600" />
                              <span className="text-red-600">
                                R: ${metric.nearestResistance.toFixed(2)}
                              </span>
                            </div>
                          )}
                        </div>
                      )*/}
                    </div>

                    <Badge
                      variant={metric.strongestChange >= 50 ? "default" : "destructive"}
                      className="flex items-center gap-1 shrink-0"
                    >
                      {metric.strongestChange >= 50 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {metric.strongestChange.toFixed(0)}
                    </Badge>
                  </div>

                  <div className="min-h-[2.5rem] flex items-center">
                    {metric.sentinels && metric.sentinels.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {metric.sentinels.map((s, idx) => (
                          <span key={s.symbol} className="flex items-center gap-2">
                            {s.display}
                            {idx < metric.sentinels.length - 1 && (
                              <span className="text-border">|</span>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </CardHeader>

                <Separator className="my-1" />

                <CardFooter className="flex-col items-center gap-2 text-sm pt-1">
                  <div className="font-semibold text-center flex items-center gap-2 text-[1.75rem]">
                    {metric.footer}
                    <FooterIcon className="h-7 w-7" />
                  </div>
                </CardFooter>
              </Card>
            </CarouselItem>
          )
        })}
      </CarouselContent>

      <div className="flex justify-center items-center gap-4 py-4">
        <button
          className="group h-2 w-8 rounded-lg bg-transparent transition-colors flex items-center justify-center -translate-y-0.5"
          onClick={() => api?.scrollPrev()}
        >
          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-sm">←</span>
        </button>

        {metrics.map((_, index) => (
          <button
            key={index}
            className={`h-2 w-8 rounded-lg transition-colors ${index === current ? "bg-primary" : "bg-muted-foreground hover:bg-primary"}`}
            onClick={() => api?.scrollTo(index)}
          />
        ))}

        <button
          className="group h-2 w-8 rounded-lg bg-transparent transition-colors flex items-center justify-center -translate-y-0.5"
          onClick={() => api?.scrollNext()}
        >
          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-sm">→</span>
        </button>
      </div>
    </Carousel>
  )
}
