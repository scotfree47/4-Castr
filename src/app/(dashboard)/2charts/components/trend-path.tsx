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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Activity,
  AlertTriangle,
  AlignHorizontalDistributeCenter,
  Bitcoin,
  Coins,
  DollarSign,
} from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import * as React from "react"
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts"
import type { CategoryType } from "../../data"
import { calculateGannSquareOfNine } from "@/lib/indicators/keyLevels"

const CATEGORY_CONFIG: Record<CategoryType, { name: string; icon: any }> = {
  equity: { name: "Equity", icon: DollarSign },
  commodity: { name: "Commodity", icon: Coins },
  forex: { name: "Forex", icon: Activity },
  crypto: { name: "Crypto", icon: Bitcoin },
  "rates-macro": { name: "Rates & Macro", icon: Activity },
  stress: { name: "Stress", icon: AlertTriangle },
}

export const TrendPath = React.memo(function TrendPath() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const categoryParam = (searchParams?.get("category") as CategoryType) || "equity"
  const [category, setCategory] = React.useState<CategoryType>(categoryParam)
  const [timeRange, setTimeRange] = React.useState("30d")
  const [visibleTickers, setVisibleTickers] = React.useState<Record<string, boolean>>({})
  const [showGannLevels, setShowGannLevels] = React.useState(false)

  const updateCategory = (newCategory: CategoryType) => {
    setCategory(newCategory)
    const params = new URLSearchParams(searchParams?.toString())
    params.set("category", newCategory)
    router.push(`?${params.toString()}`)
  }

  const days = timeRange === "7d" ? 7 : timeRange === "14d" ? 14 : 30

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

  const toggleTicker = React.useCallback((ticker: string) => {
    setVisibleTickers((prev) => ({ ...prev, [ticker]: !prev[ticker] }))
  }, [])

  const visibleSeries = chartData.series.map((s) => ({
    ...s,
    isVisible: visibleTickers[s.ticker] !== false,
  }))

  const priceData = React.useMemo(() => {
    return chartData.dates.map((date, i) => {
      const point: Record<string, any> = { date }
      visibleSeries.forEach((s) => {
        if (s.isVisible) point[s.ticker] = s.data[i]
      })
      return point
    })
  }, [chartData.dates, visibleSeries])

  const { sentinelDomain, featuredDomain } = React.useMemo(() => {
    const visibleSentinels = visibleSeries.filter((s) => s.isSentinel && s.isVisible)
    const visibleFeatured = visibleSeries.filter((s) => !s.isSentinel && s.isVisible)

    const calcDomain = (series: typeof visibleSeries, topPad: number) => {
      if (series.length === 0) return [0, 100]

      let min = Infinity,
        max = -Infinity
      series.forEach((s) =>
        s.data.forEach((p) => {
          if (p < min) min = p
          if (p > max) max = p
        })
      )

      const range = max - min
      const bottomPad = range * 0.2
      const topPadding = range * topPad
      return [Math.floor(min - bottomPad), Math.ceil(max + topPadding)]
    }

    return {
      sentinelDomain: calcDomain(visibleSentinels, 0.2),
      featuredDomain: calcDomain(visibleFeatured, 0.33),
    }
  }, [visibleSeries])

  const chartConfig = React.useMemo(() => {
    const cfg: Record<string, any> = {}
    visibleSeries.forEach((s) => {
      cfg[s.ticker] = { label: s.ticker, color: s.color }
    })
    return cfg
  }, [visibleSeries])

  const featuredTickers = visibleSeries.filter((s) => !s.isSentinel)
  const sentinelTickers = visibleSeries.filter((s) => s.isSentinel)

  // Calculate Gann Square of Nine levels for featured tickers
  const gannLevels = React.useMemo(() => {
    if (!showGannLevels || featuredTickers.length === 0) return []

    // Use the first visible featured ticker for Gann calculations
    const primaryTicker = featuredTickers.find((t) => t.isVisible)
    if (!primaryTicker) return []

    const anchorPrice = primaryTicker.anchorPrice
    if (!anchorPrice || anchorPrice <= 0) return []

    // Auto-detect box size based on price range
    let boxSize = 1 // default for stocks
    if (category === "forex") boxSize = 0.0001
    else if (category === "crypto") boxSize = anchorPrice > 1000 ? 10 : anchorPrice > 100 ? 1 : 0.01
    else if (category === "commodity") boxSize = anchorPrice > 1000 ? 10 : 1

    // Calculate Gann levels (show only cardinal angles for simplicity)
    const allLevels = calculateGannSquareOfNine(anchorPrice, boxSize, 5, 5)
    const cardinalLevels = allLevels.filter((l) => l.type === "cardinal")

    // Filter levels within chart domain to avoid clutter
    const [minPrice, maxPrice] = featuredDomain
    return cardinalLevels.filter((l) => l.price >= minPrice && l.price <= maxPrice)
  }, [showGannLevels, featuredTickers, category, featuredDomain])

  if (loading) {
    return (
      <Card className="@container/card">
        <CardContent className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="@container/card border-destructive">
        <CardContent className="pt-6">
          <p className="text-destructive">Error: {error}</p>
          <Button variant="outline" onClick={() => window.location.reload()} className="mt-4">
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="@container/card hover:border-primary/50 transition-colors">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Trend</CardTitle>
            <CardDescription>Relative price performance</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="flex w-auto max-w-28 cursor-pointer" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d" className="cursor-pointer">
                  7 days
                </SelectItem>
                <SelectItem value="14d" className="cursor-pointer">
                  14 days
                </SelectItem>
                <SelectItem value="30d" className="cursor-pointer">
                  30 days
                </SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant={showGannLevels ? "default" : "outline"}
              size="sm"
              className="cursor-pointer"
              onClick={() => setShowGannLevels(!showGannLevels)}
              title="Toggle Gann Square of Nine levels"
            >
              <span className="font-mono text-xs">G9</span>
            </Button>

            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="cursor-pointer">
                  <AlignHorizontalDistributeCenter className="h-4 w-4" />
                  <span className="hidden sm:inline ml-2">Tickers</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {featuredTickers.length > 0 && (
                  <>
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
                  </>
                )}
                {sentinelTickers.length > 0 && (
                  <>
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
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs
          value={category}
          onValueChange={(v) => updateCategory(v as CategoryType)}
          className="w-full mb-4"
        >
          <TabsList className="grid w-full grid-cols-6 bg-muted/50 p-1 rounded-lg h-12">
            {Object.entries(CATEGORY_CONFIG).map(([cat, config]) => {
              const Icon = config.icon
              return (
                <TabsTrigger
                  key={cat}
                  value={cat}
                  className="cursor-pointer rounded-md px-2 py-2 text-xs sm:text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <span className="hidden sm:inline">{config.name}</span>
                  <Icon className="sm:hidden h-4 w-4" />
                </TabsTrigger>
              )
            })}
          </TabsList>
        </Tabs>

        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <LineChart data={priceData}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(v) =>
                new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })
              }
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
                  labelFormatter={(v) =>
                    new Date(v).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  }
                  formatter={(value, name) => {
                    const series = visibleSeries.find((s) => s.ticker === name)
                    if (!series) return null

                    const actualPrice = typeof value === "number" ? value : 0

                    return (
                      <div className="flex items-center gap-2 w-full">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: series.color }}
                        />
                        <span className="font-medium">{name}</span>
                        <span className="ml-auto font-mono">${actualPrice.toFixed(2)}</span>
                      </div>
                    )
                  }}
                />
              }
            />

            {/* Gann Square of Nine Reference Lines */}
            {showGannLevels &&
              gannLevels.map((level, idx) => (
                <ReferenceLine
                  key={`gann-${idx}`}
                  y={level.price}
                  yAxisId="featured"
                  stroke="hsl(var(--primary))"
                  strokeOpacity={0.2}
                  strokeDasharray="3 3"
                  strokeWidth={1}
                  label={{
                    value: `${level.price.toFixed(2)}°`,
                    position: "right",
                    fill: "hsl(var(--muted-foreground))",
                    fontSize: 10,
                    opacity: 0.5,
                  }}
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
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
})
