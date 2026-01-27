// sentinels-overview.tsx

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

interface SentinelsOverviewProps {
  onCategoryChange?: (category: string) => void
}

interface SentinelData {
  symbol: string
  category: string
  currentPrice: number
  nextKeyLevel: {
    price: number
    type: "support" | "resistance"
    distancePercent: number
  }
  scores: {
    total: number
    confluence: number
    momentum: number
  }
  convergence?: {
    has_convergence: boolean
    confidence?: number
    forecasted_swing?: {
      type: "high" | "low"
      price: number
      date: string
    }
    astro_confirmation?: {
      score: number
      reasons: string[]
    }
  }
  atr14?: number
}

const SENTINELS = {
  equity: ["SPY", "QQQ", "XLY"],
  commodity: ["GLD", "USO", "HG1!"],
  forex: ["EUR/USD", "USD/JPY", "GBP/USD"],
  crypto: ["Bitcoin", "Ethereum", "Solana"],
  "rates-macro": ["TLT", "DXY", "TNX"],
  stress: ["VIX", "MOVE", "TRIN"],
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
  avgChange: string
  trend: "up" | "down" | "neutral"
  icon: any
  footer: string
  footerIcon: any
  sentinels: Array<{ symbol: string; display: string }>
  categoryId: string
  hasConvergence: boolean
  convergenceData?: {
    confidence: number
    forecastedPrice: number
    forecastedDate: string
    forecastedType: "high" | "low"
    astroScore?: number
    astroReasons?: string[]
  }
}

export default function SentinelsOverview({ onCategoryChange }: SentinelsOverviewProps = {}) {
  const [api, setApi] = useState<any>()
  const [current, setCurrent] = useState(0)
  const [metrics, setMetrics] = useState<SentinelMetric[]>([])
  const [loading, setLoading] = useState(true)
  const [ingressData, setIngressData] = useState<any>(null)

  useEffect(() => {
    if (!api) return
    setCurrent(api.selectedScrollSnap())
    api.on("select", () => {
      const index = api.selectedScrollSnap()
      setCurrent(index)
      if (onCategoryChange && metrics[index]) {
        onCategoryChange(metrics[index].categoryId)
      }
    })
  }, [api, metrics, onCategoryChange])

  useEffect(() => {
    if (metrics.length > 0 && onCategoryChange) {
      onCategoryChange(metrics[0].categoryId)
    }
  }, [metrics, onCategoryChange])

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)

        // Fetch current ingress period
        const ingressRes = await fetch("/api/ingress", {
          headers: { "Cache-Control": "no-cache" },
        })
        const ingressResult = await ingressRes.json()

        if (ingressResult.success && ingressResult.data) {
          setIngressData(ingressResult.data)
        }

        // Fetch sentinel data from cache for each category
        const results = await Promise.all(
          GROUP_CONFIG.map(async (group) => {
            try {
              const symbols = SENTINELS[group.id as keyof typeof SENTINELS]
              const symbolsParam = symbols.join(",")

              const response = await fetch(
                `/api/ticker-ratings?category=${group.id}&symbols=${symbolsParam}`,
                {
                  headers: { "Cache-Control": "no-cache" },
                  cache: "no-store",
                }
              )

              if (!response.ok) {
                console.error(`❌ ${group.id} API error:`, response.status)
                return createEmptyMetric(group, ingressResult.data)
              }

              const result = await response.json()

              if (result.success && result.data.ratings) {
                return processGroupRatings(group, result.data.ratings, ingressResult.data)
              }

              return createEmptyMetric(group, ingressResult.data)
            } catch (err) {
              console.error(`Error fetching ${group.id}:`, err)
              return createEmptyMetric(group, ingressResult.data)
            }
          })
        )

        setMetrics(results)
      } catch (error) {
        console.error("Error fetching sentinel data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const processGroupRatings = (
    group: any,
    ratings: SentinelData[],
    ingress: any
  ): SentinelMetric => {
    if (!ratings || ratings.length === 0) {
      return createEmptyMetric(group, ingress)
    }

    const validRatings = ratings.filter((r) => r.currentPrice > 0)
    if (validRatings.length === 0) {
      return createEmptyMetric(group, ingress)
    }

    // Calculate average total score
    const avgScore = validRatings.reduce((sum, r) => sum + r.scores.total, 0) / validRatings.length

    // Find strongest by total score
    const strongest = validRatings.reduce((max, r) => (r.scores.total > max.scores.total ? r : max))

    const TrendIcon = avgScore >= 50 ? TrendingUp : TrendingDown
    const trend: "up" | "down" | "neutral" = avgScore >= 50 ? "up" : "down"

    // Check for convergence data
    const hasConvergence = strongest.convergence?.has_convergence || false
    const convergenceData = hasConvergence
      ? {
          confidence: strongest.convergence?.confidence || 0,
          forecastedPrice: strongest.convergence?.forecasted_swing?.price || 0,
          forecastedDate: strongest.convergence?.forecasted_swing?.date || "",
          forecastedType: strongest.convergence?.forecasted_swing?.type || "high",
          astroScore: strongest.convergence?.astro_confirmation?.score,
          astroReasons: strongest.convergence?.astro_confirmation?.reasons,
        }
      : undefined

    return {
      title: group.title,
      strongestSymbol: strongest.symbol,
      strongestPrice: strongest.currentPrice,
      strongestChange: strongest.scores.total,
      nearestSupport:
        strongest.nextKeyLevel?.type === "support" ? strongest.nextKeyLevel.price : null,
      nearestResistance:
        strongest.nextKeyLevel?.type === "resistance" ? strongest.nextKeyLevel.price : null,
      avgChange: `${avgScore.toFixed(0)}`,
      trend,
      icon: group.icon,
      footer: `${ingress?.month || "Current"}'s Score: ${avgScore.toFixed(0)}`,
      footerIcon: TrendIcon,
      sentinels: validRatings.map((r) => ({
        symbol: r.symbol,
        display: `${r.symbol} $${r.currentPrice.toFixed(2)} [${r.scores.total}]`,
      })),
      categoryId: group.id,
      hasConvergence,
      convergenceData,
    }
  }

  const createEmptyMetric = (group: any, ingress: any): SentinelMetric => ({
    title: group.title,
    strongestSymbol: "—",
    strongestPrice: 0,
    strongestChange: 0,
    nearestSupport: null,
    nearestResistance: null,
    avgChange: "0",
    trend: "neutral",
    icon: group.icon,
    footer: "Awaiting data",
    footerIcon: TrendingUp,
    sentinels: [],
    categoryId: group.id,
    hasConvergence: false,
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
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

                      {/* Convergence Info */}
                      {metric.hasConvergence && metric.convergenceData && (
                        <div className="mt-3 bg-secondary/50 rounded p-2 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1">
                              <Activity className="h-3 w-3" />
                              Convergence
                            </span>
                            <span className="font-medium">
                              {Math.round(metric.convergenceData.confidence * 100)}%
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            {metric.convergenceData.forecastedType === "high" ? (
                              <TrendingUp className="h-3 w-3 text-green-500" />
                            ) : (
                              <TrendingDown className="h-3 w-3 text-red-500" />
                            )}
                            <span>
                              ${metric.convergenceData.forecastedPrice.toFixed(2)} on{" "}
                              {new Date(metric.convergenceData.forecastedDate).toLocaleDateString()}
                            </span>
                          </div>
                          {/* Astro Confirmation */}
                          {metric.convergenceData.astroScore && (
                            <div className="mt-2 pt-2 border-t border-border/50">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-muted-foreground">Astro Score</span>
                                <span className="font-medium">
                                  {metric.convergenceData.astroScore}/100
                                </span>
                              </div>
                              {metric.convergenceData.astroReasons &&
                                metric.convergenceData.astroReasons.length > 0 && (
                                  <ul className="text-[10px] text-muted-foreground space-y-0.5">
                                    {metric.convergenceData.astroReasons.map((reason, idx) => (
                                      <li key={idx}>• {reason}</li>
                                    ))}
                                  </ul>
                                )}
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
