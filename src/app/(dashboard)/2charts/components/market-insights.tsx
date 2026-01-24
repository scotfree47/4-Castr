"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlignHorizontalDistributeCenter,
  ArrowUpIcon,
  BanknoteArrowUp,
  Landmark,
  TrendingUp,
} from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  calculateGrowthMetrics,
  FEATURED_COLORS,
  formatCategoryName,
  getAllCategories,
  getFeaturedByCategory,
  type CategoryType,
} from "../../data"

const chartConfig = {
  month1: { label: "Month 1", color: FEATURED_COLORS[0] },
  month2: { label: "Month 2", color: FEATURED_COLORS[1] },
  month3: { label: "Month 3", color: FEATURED_COLORS[2] },
}

export function MarketInsights() {
  const searchParams = useSearchParams()
  const category = (searchParams?.get("category") as CategoryType) || "equity"
  const [activeTab, setActiveTab] = useState("growth")
  const [loading, setLoading] = useState(false)

  const featuredTickers = useMemo(() => {
    return getFeaturedByCategory(category, 10)
  }, [category])

  const growthMetrics = useMemo(() => {
    return calculateGrowthMetrics(category, 6)
  }, [category])

  const monthlyGrowthData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]
    return months.map((month, index) => {
      const topTickers = featuredTickers.slice(0, 3)
      const data: Record<string, any> = { month }
      topTickers.forEach((ticker, i) => {
        data[ticker.ticker] = 100 + Math.random() * 50 + index * 10
      })
      return data
    })
  }, [featuredTickers])

  const tickerPerformanceData = useMemo(() => {
    return growthMetrics.map((metric, index) => {
      const ticker = featuredTickers[index]
      const totalMarketCap = growthMetrics.reduce((sum, m) => sum + Math.abs(m.currentPrice), 0)
      const percentage = ((Math.abs(metric.currentPrice) / totalMarketCap) * 100).toFixed(1)

      return {
        ticker: metric.ticker,
        price: `$${metric.currentPrice.toFixed(2)}`,
        percentage: `${percentage}%`,
        growth: `${metric.percentChange >= 0 ? "+" : ""}${metric.percentChange.toFixed(2)}%`,
        growthColor: metric.percentChange >= 0 ? "text-green-600" : "text-red-600",
      }
    })
  }, [growthMetrics, featuredTickers])

  const sectorData = useMemo(() => {
    const categories = getAllCategories()
    return categories.map((cat) => {
      const tickers = getFeaturedByCategory(cat, 10)
      const metrics = calculateGrowthMetrics(cat, 1)
      const totalValue = metrics.reduce((sum, m) => sum + m.currentPrice, 0)
      const avgGrowth =
        metrics.length > 0
          ? metrics.reduce((sum, m) => sum + m.percentChange, 0) / metrics.length
          : 0

      return {
        sector: formatCategoryName(cat),
        tickerCount: tickers.length,
        totalValue: `$${totalValue.toFixed(0)}`,
        growth: `${avgGrowth >= 0 ? "+" : ""}${avgGrowth.toFixed(1)}%`,
        growthColor: avgGrowth >= 0 ? "text-green-600" : "text-red-600",
      }
    })
  }, [])

  const keyMetrics = useMemo(() => {
    const totalTickers = featuredTickers.length
    const avgGrowth =
      growthMetrics.length > 0
        ? growthMetrics.reduce((sum, m) => sum + m.percentChange, 0) / growthMetrics.length
        : 0
    const positiveTickers = growthMetrics.filter((m) => m.percentChange > 0).length
    const retentionRate = totalTickers > 0 ? (positiveTickers / totalTickers) * 100 : 0
    const avgPrice =
      growthMetrics.length > 0
        ? growthMetrics.reduce((sum, m) => sum + m.currentPrice, 0) / growthMetrics.length
        : 0

    return {
      totalTickers,
      avgGrowth,
      retentionRate,
      avgPrice,
    }
  }, [featuredTickers, growthMetrics])

  const barChartConfig = useMemo(() => {
    const config: Record<string, any> = {}
    featuredTickers.slice(0, 3).forEach((ticker, index) => {
      config[ticker.ticker] = {
        label: ticker.ticker,
        color: FEATURED_COLORS[index],
      }
    })
    return config
  }, [featuredTickers])

  if (loading) {
    return (
      <Card className="bg-background/40 backdrop-blur-xl border-border/40 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Market Insights
          </CardTitle>
          <CardDescription>Loading analysis...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-96 w-full bg-foreground/5" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-background/40 backdrop-blur-xl border-border/40 shadow-lg hover:shadow-[0_0_20px_rgba(51,255,51,0.3)] transition-all">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Market Insights
        </CardTitle>
        <CardDescription>Performance trends and analysis</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1 rounded-lg h-12">
            <TabsTrigger
              value="growth"
              className="cursor-pointer flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground"
            >
              <BanknoteArrowUp className="h-4 w-4" />
              <span className="hidden sm:inline">Growth</span>
            </TabsTrigger>
            <TabsTrigger
              value="demographics"
              className="cursor-pointer flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground"
            >
              <AlignHorizontalDistributeCenter className="h-4 w-4" />
              <span className="hidden sm:inline">Performance</span>
            </TabsTrigger>
            <TabsTrigger
              value="regions"
              className="cursor-pointer flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground"
            >
              <Landmark className="h-4 w-4" />
              <span className="hidden sm:inline">Sectors</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="growth" className="mt-8 space-y-6">
            <div className="grid gap-6">
              <div className="grid grid-cols-10 gap-6">
                <div className="col-span-10 xl:col-span-7">
                  <h3 className="text-sm font-medium text-muted-foreground mb-6">
                    Monthly Price Trends
                  </h3>
                  <ChartContainer config={barChartConfig} className="h-[375px] w-full">
                    <BarChart
                      data={monthlyGrowthData}
                      margin={{ top: 20, right: 20, bottom: 20, left: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="month"
                        className="text-xs"
                        tick={{ fontSize: 12 }}
                        tickLine={{ stroke: "var(--border)" }}
                        axisLine={{ stroke: "var(--border)" }}
                      />
                      <YAxis
                        className="text-xs"
                        tick={{ fontSize: 12 }}
                        tickLine={{ stroke: "var(--border)" }}
                        axisLine={{ stroke: "var(--border)" }}
                        tickFormatter={(value) => `$${value}`}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      {featuredTickers.slice(0, 3).map((ticker, index) => (
                        <Bar
                          key={ticker.ticker}
                          dataKey={ticker.ticker}
                          fill={FEATURED_COLORS[index]}
                          radius={[2, 2, 0, 0]}
                        />
                      ))}
                    </BarChart>
                  </ChartContainer>
                </div>

                <div className="col-span-10 xl:col-span-3 space-y-5">
                  <h3 className="text-sm font-medium text-muted-foreground mb-6">Key Metrics</h3>
                  <div className="grid grid-cols-3 gap-5">
                    <div className="p-4 rounded-lg max-lg:col-span-3 xl:col-span-3 border bg-foreground/5">
                      <div className="flex items-center gap-2 mb-2">
                        <BanknoteArrowUp className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">Featured Tickers</span>
                      </div>
                      <div className="text-2xl font-bold" suppressHydrationWarning>
                        {keyMetrics.totalTickers}
                      </div>
                      <div
                        className={`text-xs flex items-center gap-1 mt-1 ${keyMetrics.avgGrowth >= 0 ? "text-green-600" : "text-red-600"}`}
                        suppressHydrationWarning
                      >
                        <ArrowUpIcon className="h-3 w-3" />
                        {keyMetrics.avgGrowth >= 0 ? "+" : ""}
                        {keyMetrics.avgGrowth.toFixed(1)}% avg growth
                      </div>
                    </div>

                    <div className="p-4 rounded-lg max-lg:col-span-3 xl:col-span-3 border bg-foreground/5">
                      <div className="flex items-center gap-2 mb-2">
                        <AlignHorizontalDistributeCenter className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Positive Rate</span>
                      </div>
                      <div className="text-2xl font-bold" suppressHydrationWarning>
                        {keyMetrics.retentionRate.toFixed(1)}%
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">Tickers with gains</div>
                    </div>

                    <div className="p-4 rounded-lg max-lg:col-span-3 xl:col-span-3 border bg-foreground/5">
                      <div className="flex items-center gap-2 mb-2">
                        <Landmark className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Avg. Price</span>
                      </div>
                      <div className="text-2xl font-bold" suppressHydrationWarning>
                        ${keyMetrics.avgPrice.toFixed(0)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">Across featured</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="demographics" className="mt-8">
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="border-b">
                    <TableHead className="py-5 px-6 font-semibold">Ticker</TableHead>
                    <TableHead className="text-right py-5 px-6 font-semibold">Price</TableHead>
                    <TableHead className="text-right py-5 px-6 font-semibold">
                      % of Portfolio
                    </TableHead>
                    <TableHead className="text-right py-5 px-6 font-semibold">
                      Monthly Growth
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickerPerformanceData.map((row, index) => (
                    <TableRow key={index} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium py-5 px-6">{row.ticker}</TableCell>
                      <TableCell className="text-right py-5 px-6">{row.price}</TableCell>
                      <TableCell className="text-right py-5 px-6">{row.percentage}</TableCell>
                      <TableCell className="text-right py-5 px-6">
                        <span className={`font-medium ${row.growthColor}`}>{row.growth}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="regions" className="mt-8">
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="border-b">
                    <TableHead className="py-5 px-6 font-semibold">Sector</TableHead>
                    <TableHead className="text-right py-5 px-6 font-semibold"># Tickers</TableHead>
                    <TableHead className="text-right py-5 px-6 font-semibold">
                      Total Value
                    </TableHead>
                    <TableHead className="text-right py-5 px-6 font-semibold">Growth</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sectorData.map((row, index) => (
                    <TableRow key={index} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium py-5 px-6">{row.sector}</TableCell>
                      <TableCell className="text-right py-5 px-6">{row.tickerCount}</TableCell>
                      <TableCell className="text-right py-5 px-6">{row.totalValue}</TableCell>
                      <TableCell className="text-right py-5 px-6">
                        <span className={`font-medium ${row.growthColor}`}>{row.growth}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
