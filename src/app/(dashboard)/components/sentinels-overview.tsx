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
  commodity: ["GLD", "USO", "HG1!"],
  forex: ["EUR/USD", "USD/JPY", "GBP/USD"],
  crypto: ["Bitcoin", "Ethereum", "Solana"],
  "rates-macro": ["TLT", "FEDFUNDS", "CPI"],
  stress: ["MOVE", "TRIN", "VIX"],
}

const GROUP_CONFIG = [
  { id: "equity", title: "Equity", icon: DollarSign },
  { id: "commodity", title: "Commodity", icon: Coins },
  { id: "forex", title: "Forex", icon: TrendingUpDown },
  { id: "crypto", title: "Crypto", icon: Bitcoin },
  { id: "rates-macro", title: "Rates / Macro", icon: Activity },
  { id: "stress", title: "Stress", icon: AlertTriangle },
]

export function SentinelsOverview() {
  const [api, setApi] = useState<any>()
  const [current, setCurrent] = useState(0)
  const [metrics, setMetrics] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [ingressData, setIngressData] = useState<any>(null)

  useEffect(() => {
    initializeData()
  }, [])

  useEffect(() => {
    if (!api) return
    setCurrent(api.selectedScrollSnap())
    api.on("select", () => setCurrent(api.selectedScrollSnap()))
  }, [api])

  const initializeData = async () => {
    try {
      setLoading(true)

      // Get ingress period
      const ingress = await getCurrentIngress()
      setIngressData(ingress)

      // Fetch sentinel metrics
      await fetchAllMetrics(ingress)
    } catch (error) {
      console.error("❌ Error initializing sentinels:", error)
    } finally {
      setLoading(false)
    }
  }

  const getCurrentIngress = async () => {
    try {
      const res = await fetch("/api/ingress")
      const result = await res.json()

      if (result.success) {
        return result.data
      }

      console.error("Error fetching ingress:", result.error)
      return null
    } catch (err) {
      console.error("Error in getCurrentIngress:", err)
      return null
    }
  }

  const getLastTradingDay = (date: string, isWeekendSensitive = true) => {
    const d = new Date(date)
    if (!isWeekendSensitive) return date

    const dayOfWeek = d.getDay()
    if (dayOfWeek === 6) d.setDate(d.getDate() - 1)
    else if (dayOfWeek === 0) d.setDate(d.getDate() - 2)

    return d.toISOString().split("T")[0]
  }

  const fetchAllMetrics = async (ingress: any) => {
    if (!ingress) {
      setMetrics(GROUP_CONFIG.map(createEmptyMetric))
      return
    }

    try {
      const endDate = new Date().toISOString().split("T")[0]
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0]

      const results = await Promise.all(
        GROUP_CONFIG.map(async (group) => {
          try {
            // ✅ NEW: Use unified ticker-ratings API for each sentinel
            const symbols = SENTINELS[group.id as keyof typeof SENTINELS]
            const symbolsParam = symbols.join(",")

            const res = await fetch(
              `/api/ticker-ratings?mode=batch&symbols=${symbolsParam}&minScore=0`,
              {
                headers: {
                  "Cache-Control": "no-cache",
                },
              }
            )

            const result = await res.json()

            if (result.success && result.data.ratings.length > 0) {
              return processGroupRatings(group, result.data.ratings, ingress)
            }

            return createEmptyMetric(group)
          } catch (err) {
            console.error(`Error fetching ${group.id}:`, err)
            return createEmptyMetric(group)
          }
        })
      )

      setMetrics(results)
    } catch (error) {
      console.error("Error fetching metrics:", error)
    }
  }

  const processGroupRatings = (group: any, ratings: any[], ingress: any) => {
    if (ratings.length === 0) {
      return createEmptyMetric(group)
    }

    // ✅ NEW: Use ratings from unified API
    const validRatings = ratings.filter((r) => r.currentPrice > 0)

    if (validRatings.length === 0) {
      return createEmptyMetric(group)
    }

    // Calculate average total score as "momentum"
    const avgScore = validRatings.reduce((sum, r) => sum + r.scores.total, 0) / validRatings.length

    // Find strongest by absolute score
    const strongest = validRatings.reduce((max, r) => (r.scores.total > max.scores.total ? r : max))

    const momentum = avgScore >= 50 ? "Positive" : "Negative"
    const TrendIcon = avgScore >= 50 ? TrendingUp : TrendingDown

    return {
      title: group.title,
      strongestSymbol: strongest.symbol,
      strongestPrice: strongest.currentPrice,
      strongestChange: strongest.scores.total, // Use total score as "change"
      nearestSupport:
        strongest.nextKeyLevel.type === "support" ? strongest.nextKeyLevel.price : null,
      nearestResistance:
        strongest.nextKeyLevel.type === "resistance" ? strongest.nextKeyLevel.price : null,
      description: `Strongest of ${validRatings.length} sentinels`,
      avgChange: `${avgScore.toFixed(0)}`,
      trend: avgScore >= 50 ? "up" : "down",
      icon: group.icon,
      footer: `${ingress.month}'s Score: ${avgScore.toFixed(0)}`,
      footerIcon: TrendIcon,
      sentinels: validRatings.map((r) => ({
        symbol: r.symbol,
        display: `${r.symbol} $${r.currentPrice.toFixed(2)} [${r.rating}]`,
      })),
    }
  }

  const createEmptyMetric = (group: any) => ({
    title: group.title,
    strongestSymbol: "—",
    strongestPrice: 0,
    strongestChange: 0,
    description: "No data available",
    avgChange: "0",
    trend: "neutral",
    icon: group.icon,
    footer: "Awaiting data",
    footerIcon: TrendingUp,
    sentinels: [],
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <Carousel setApi={setApi}>
      <CarouselContent>
        {metrics.map((metric) => {
          const Icon = metric.icon
          const FooterIcon = metric.footerIcon

          return (
            <CarouselItem key={metric.title}>
              <Card className="cursor-pointer hover:overflow-visible border-2 hover:border-primary/50 hover:shadow-[0_0_20px_rgba(51,255,51,1)] transition-colors h-full flex flex-col">
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

                      {/* Show support/resistance if available */}
                      {(metric.nearestSupport || metric.nearestResistance) && (
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
                      )}
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
                        {metric.sentinels.map((s: any, idx: number) => (
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
            className={`h-2 w-8 rounded-lg transition-colors ${
              index === current ? "bg-primary" : "bg-muted-foreground hover:bg-primary"
            }`}
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
