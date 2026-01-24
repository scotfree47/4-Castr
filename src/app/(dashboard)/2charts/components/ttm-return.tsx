"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { AlignHorizontalDistributeCenter, BarChart3 } from "lucide-react"
import { useSearchParams } from "next/navigation"
import * as React from "react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import type { CategoryType } from "../../data"

export function TtmReturn() {
  const searchParams = useSearchParams()

  const category = (searchParams?.get("category") as CategoryType) || "equity"
  const [timeRange, setTimeRange] = React.useState("1m")
  const [visibleTickers, setVisibleTickers] = React.useState<Record<string, boolean>>({})

  const days = timeRange === "1m" ? 30 : timeRange === "3m" ? 90 : 365

  const [chartData, setChartData] = React.useState<{
    dates: string[]
    series: Array<{
      ticker: string
      data: number[]
      color: string
      isSentinel: boolean
      isVisible: boolean
      anchorPrice: number
    }>
  }>({ dates: [], series: [] })

  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const loadChartData = async () => {
      try {
        setLoading(true)
        setError(null)

        const timestamp = new Date().getTime()
        const response = await fetch(
          `/api/chart-data?category=${category}&days=${days}&t=${timestamp}`,
          {
            method: "GET",
            headers: { "Cache-Control": "no-cache" },
            cache: "no-store",
          }
        )

        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const result = await response.json()
        if (!result.success) throw new Error(result.error || "Failed to load")

        setChartData(result.data)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadChartData()
  }, [category, days])

  React.useEffect(() => {
    const initial: Record<string, boolean> = {}
    chartData.series.forEach((s) => {
      initial[s.ticker] = true
    })
    setVisibleTickers(initial)
  }, [chartData.series])

  const toggleTicker = (ticker: string) => {
    setVisibleTickers((prev) => ({ ...prev, [ticker]: !prev[ticker] }))
  }

  const visibleSeries = chartData.series.map((s) => ({
    ...s,
    isVisible: visibleTickers[s.ticker] !== false,
  }))

  const priceData = React.useMemo(() => {
    return chartData.dates.map((date, index) => {
      const dataPoint: Record<string, any> = { date }

      visibleSeries.forEach((s) => {
        if (s.isVisible) {
          dataPoint[s.ticker] = s.data[index]
        }
      })

      return dataPoint
    })
  }, [chartData.dates, visibleSeries])

  const { sentinelDomain, featuredDomain } = React.useMemo(() => {
    const visibleSentinels = visibleSeries.filter((s) => s.isSentinel && s.isVisible)
    const visibleFeatured = visibleSeries.filter((s) => !s.isSentinel && s.isVisible)

    const calcSentinelDomain = (series: typeof visibleSeries) => {
      if (series.length === 0) return [0, 100]

      let yMin = Infinity
      let yMax = -Infinity

      series.forEach((s) => {
        s.data.forEach((price) => {
          if (price < yMin) yMin = price
          if (price > yMax) yMax = price
        })
      })

      const range = yMax - yMin
      const bottomPadding = range * 0.2
      const topPadding = range * 0.2

      return [Math.floor(yMin - bottomPadding), Math.ceil(yMax + topPadding)]
    }

    const calcFeaturedDomain = (series: typeof visibleSeries) => {
      if (series.length === 0) return [0, 100]

      let yMin = Infinity
      let yMax = -Infinity

      series.forEach((s) => {
        s.data.forEach((price) => {
          if (price < yMin) yMin = price
          if (price > yMax) yMax = price
        })
      })

      const range = yMax - yMin
      const bottomPadding = range * 0.2
      const topPadding = range * 0.33

      return [Math.floor(yMin - bottomPadding), Math.ceil(yMax + topPadding)]
    }

    return {
      sentinelDomain: calcSentinelDomain(visibleSentinels),
      featuredDomain: calcFeaturedDomain(visibleFeatured),
    }
  }, [visibleSeries])

  const chartConfig = React.useMemo(() => {
    const config: Record<string, any> = {}
    visibleSeries.forEach((s) => {
      config[s.ticker] = {
        label: s.ticker,
        color: s.color,
      }
    })
    return config
  }, [visibleSeries])

  const featuredTickers = visibleSeries.filter((s) => !s.isSentinel)
  const sentinelTickers = visibleSeries.filter((s) => s.isSentinel)

  if (loading) {
    return (
      <Card className="bg-background/40 backdrop-blur-xl border-border/40 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Return
          </CardTitle>
          <CardDescription>Loading trailing performance...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-64 w-full bg-foreground/5" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="bg-background/40 backdrop-blur-xl border-border/40 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Return
          </CardTitle>
          <CardDescription className="text-destructive">{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-background/40 backdrop-blur-xl border-border/40 shadow-lg hover:shadow-[0_0_20px_rgba(51,255,51,0.3)] transition-all">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Return
          </CardTitle>
          <CardDescription>Trailing performance review</CardDescription>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="flex w-auto max-w-32 cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1m" className="cursor-pointer">
                1 month
              </SelectItem>
              <SelectItem value="3m" className="cursor-pointer">
                3 months
              </SelectItem>
              <SelectItem value="12m" className="cursor-pointer">
                12 months
              </SelectItem>
            </SelectContent>
          </Select>

          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="cursor-pointer">
                <AlignHorizontalDistributeCenter className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5 text-xs font-semibold">Featured</div>
              {featuredTickers.map((s) => (
                <DropdownMenuCheckboxItem
                  key={s.ticker}
                  checked={visibleTickers[s.ticker] !== false}
                  onCheckedChange={() => toggleTicker(s.ticker)}
                  onSelect={(e) => e.preventDefault()}
                  className="cursor-pointer"
                >
                  <span
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: s.color }}
                  />
                  {s.ticker}
                </DropdownMenuCheckboxItem>
              ))}
              <div className="px-2 py-1.5 text-xs font-semibold mt-2">Sentinels</div>
              {sentinelTickers.map((s) => (
                <DropdownMenuCheckboxItem
                  key={s.ticker}
                  checked={visibleTickers[s.ticker] !== false}
                  onCheckedChange={() => toggleTicker(s.ticker)}
                  onSelect={(e) => e.preventDefault()}
                  className="cursor-pointer"
                >
                  <span
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: s.color }}
                  />
                  {s.ticker}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="p-0 pt-6">
        <div className="px-6 pb-6">
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <LineChart data={priceData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                className="text-xs"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => {
                  if (!value) return ""
                  const date = new Date(value)
                  return date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                }}
              />
              <YAxis yAxisId="featured" hide domain={featuredDomain} scale="linear" />
              <YAxis
                yAxisId="sentinel"
                orientation="right"
                hide
                domain={sentinelDomain}
                scale="linear"
              />
              <ChartTooltip
                offset={20}
                content={
                  <ChartTooltipContent
                    className="min-w-[200px]"
                    labelFormatter={(value) => {
                      return new Date(value).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    }}
                    formatter={(value, name, props, index, payload) => {
                      // Guard against non-array payload
                      if (!payload || !Array.isArray(payload) || payload.length === 0) return null

                      const sortedPayload = Array.from(payload).sort((a, b) => {
                        const seriesA = visibleSeries.find((s) => s.ticker === a.dataKey)
                        const seriesB = visibleSeries.find((s) => s.ticker === b.dataKey)
                        if (!seriesA || !seriesB) return 0

                        if (seriesA.isSentinel === seriesB.isSentinel) return 0
                        return seriesA.isSentinel ? 1 : -1
                      })

                      const currentPayloadIndex = sortedPayload.findIndex((p) => p.dataKey === name)
                      if (currentPayloadIndex === -1) return null

                      const series = visibleSeries.find((s) => s.ticker === name)
                      if (!series) return null

                      const actualPrice = typeof value === "number" ? value : 0

                      const featuredCount = sortedPayload.filter((p) => {
                        const s = visibleSeries.find((vs) => vs.ticker === p.dataKey)
                        return s && !s.isSentinel
                      }).length

                      const sentinelCount = sortedPayload.filter((p) => {
                        const s = visibleSeries.find((vs) => vs.ticker === p.dataKey)
                        return s && s.isSentinel
                      }).length

                      const isLastFeatured =
                        !series.isSentinel && currentPayloadIndex === featuredCount - 1

                      return (
                        <div className="flex flex-col gap-0">
                          <div className="flex items-center gap-2 w-full">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: series.color }}
                            />
                            <span className="font-medium">{name}</span>
                            <span className="ml-auto font-mono">${actualPrice.toFixed(2)}</span>
                          </div>
                          {isLastFeatured && sentinelCount > 0 && (
                            <div className="border-t border-border my-1 -mx-2" />
                          )}
                        </div>
                      )
                    }}
                  />
                }
              />

              {visibleSeries
                .filter((s) => !s.isSentinel && s.isVisible)
                .map((s) => (
                  <Line
                    key={s.ticker}
                    yAxisId="featured"
                    type="monotone"
                    dataKey={s.ticker}
                    stroke={s.color}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ))}

              {visibleSeries
                .filter((s) => s.isSentinel && s.isVisible)
                .map((s) => (
                  <Line
                    key={s.ticker}
                    yAxisId="sentinel"
                    type="monotone"
                    dataKey={s.ticker}
                    stroke={s.color}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    strokeOpacity={0.3}
                    dot={false}
                    connectNulls
                  />
                ))}
            </LineChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  )
}
