"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ChartContainer } from "@/components/ui/chart"
import { CartesianGrid, Line, LineChart, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { Calendar as CalendarIcon, TrendingUp } from "lucide-react"
import { useState, useEffect, useMemo } from "react"
import type { CategoryType } from "../../data"
import { SENTINELS, formatCategoryName } from "../../data/tickers/chart-utils"

interface TradingWindowsCalendarProps {
  defaultCategory?: CategoryType
  defaultDays?: number
}

export function TradingWindowsCalendar({
  defaultCategory = "equity",
  defaultDays = 30,
}: TradingWindowsCalendarProps) {
  const [category, setCategory] = useState<CategoryType>(defaultCategory)
  const [days, setDays] = useState(defaultDays)
  const [chartData, setChartData] = useState<any>(null)
  const [windows, setWindows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        setError(null)

        // Load chart data for the category
        const chartResponse = await fetch(
          `/api/chart-data?category=${category}&days=${days}`,
          { cache: "no-store" }
        )

        if (!chartResponse.ok) throw new Error("Failed to load chart data")
        const chartResult = await chartResponse.json()

        if (!chartResult.success) throw new Error(chartResult.error)
        setChartData(chartResult.data)

        // Load trading windows for sentinels in this category
        const sentinels = SENTINELS[category]
        const windowsPromises = sentinels.map(async (symbol) => {
          const response = await fetch(
            `/api/trading-windows?symbol=${symbol}&category=${category}&daysAhead=${days}`,
            { cache: "no-store" }
          )
          const result = await response.json()
          return {
            symbol,
            windows: result.success ? result.data.windows : [],
          }
        })

        const windowsResults = await Promise.all(windowsPromises)
        setWindows(windowsResults)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [category, days])

  // Prepare data for bi-scaling chart
  const { priceData, sentinelDomain, featuredDomain } = useMemo(() => {
    if (!chartData || !chartData.dates || chartData.series.length === 0) {
      return { priceData: [], sentinelDomain: [0, 100], featuredDomain: [0, 100] }
    }

    const data = chartData.dates.map((date: string, idx: number) => {
      const point: Record<string, any> = { date }
      chartData.series.forEach((s: any) => {
        point[s.ticker] = s.data[idx]
      })
      return point
    })

    const sentinels = chartData.series.filter((s: any) => s.isSentinel)
    const featured = chartData.series.filter((s: any) => !s.isSentinel)

    const calcDomain = (series: any[], padding: number) => {
      if (series.length === 0) return [0, 100]
      const allValues = series.flatMap((s) => s.data.filter((v: number) => v > 0))
      if (allValues.length === 0) return [0, 100]
      const min = Math.min(...allValues)
      const max = Math.max(...allValues)
      const range = max - min
      return [Math.floor(min - range * padding), Math.ceil(max + range * padding)]
    }

    return {
      priceData: data,
      sentinelDomain: calcDomain(sentinels, 0.1),
      featuredDomain: calcDomain(featured, 0.2),
    }
  }, [chartData])

  if (loading) {
    return (
      <Card className="bg-background/40 backdrop-blur-xl border-border/40">
        <CardContent className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="bg-background/40 backdrop-blur-xl border-border/40 border-destructive">
        <CardContent className="pt-6">
          <p className="text-destructive">Error: {error}</p>
        </CardContent>
      </Card>
    )
  }

  const sentinels = chartData?.series.filter((s: any) => s.isSentinel && s.isVisible) || []
  const featured = chartData?.series.filter((s: any) => !s.isSentinel && s.isVisible) || []

  return (
    <Card className="bg-background/40 backdrop-blur-xl border-border/40 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Trading Windows Calendar
            </CardTitle>
            <CardDescription>
              Bi-scaling view: Sentinels (background) + Featured tickers (overlay)
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={days.toString()} onValueChange={(v) => setDays(parseInt(v))}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="60">60 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
              </SelectContent>
            </Select>

            <Select value={category} onValueChange={(v) => setCategory(v as CategoryType)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(SENTINELS).map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {formatCategoryName(cat as CategoryType)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Bi-Scaling Price Chart */}
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={priceData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.3} />
              <XAxis
                dataKey="date"
                tickFormatter={(v) =>
                  new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                }
                tick={{ fontSize: 12 }}
                tickLine={false}
              />

              {/* Sentinel YAxis (background scale) */}
              <YAxis
                yAxisId="sentinel"
                orientation="right"
                domain={sentinelDomain}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))", opacity: 0.6 }}
                tickLine={false}
                label={{
                  value: "Sentinels",
                  angle: 90,
                  position: "insideRight",
                  style: { fontSize: 11, fill: "hsl(var(--muted-foreground))", opacity: 0.6 },
                }}
              />

              {/* Featured YAxis (overlay scale) */}
              <YAxis
                yAxisId="featured"
                orientation="left"
                domain={featuredDomain}
                tick={{ fontSize: 11 }}
                tickLine={false}
                label={{
                  value: "Featured",
                  angle: -90,
                  position: "insideLeft",
                  style: { fontSize: 11, fill: "hsl(var(--foreground))" },
                }}
              />

              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                labelFormatter={(v) =>
                  new Date(v).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                }
              />

              {/* Sentinel Lines (background, dashed, muted) */}
              {sentinels.map((s: any) => (
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

              {/* Featured Lines (foreground, solid, vibrant) */}
              {featured.map((s: any) => (
                <Line
                  key={s.ticker}
                  yAxisId="featured"
                  type="monotone"
                  dataKey={s.ticker}
                  stroke={s.color}
                  strokeWidth={2.5}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Trading Windows Summary */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {windows.map(({ symbol, windows: symbolWindows }) => {
            if (symbolWindows.length === 0) return null

            const bestWindow = symbolWindows[0]
            return (
              <div
                key={symbol}
                className="p-4 rounded-lg border backdrop-blur-lg bg-background/20 hover:bg-background/30 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline" className="font-mono">
                    {symbol}
                  </Badge>
                  <span className="text-2xl">{bestWindow.emoji}</span>
                </div>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Score:</span>
                    <span className="font-semibold">{bestWindow.combinedScore}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duration:</span>
                    <span>{bestWindow.daysInWindow}d</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Start:</span>
                    <span className="text-xs">
                      {new Date(bestWindow.startDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}

          {windows.every((w) => w.windows.length === 0) && (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              <span className="text-4xl block mb-2">🌧️</span>
              <p>No favorable windows in next {days} days</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
