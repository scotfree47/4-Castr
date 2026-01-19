"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartStyle,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useSearchParams } from "next/navigation"
import * as React from "react"
import { Cell, Label, Pie, PieChart, Sector } from "recharts"
import type { PieSectorDataItem } from "recharts/types/polar/Pie"
import { calculateGrowthMetrics, FEATURED_COLORS, type CategoryType } from "../../data"

export function GrowthBreakdown() {
  const searchParams = useSearchParams()

  // Sync with Trend component via URL params
  const category = (searchParams?.get("category") as CategoryType) || "equity"
  const [timeRange, setTimeRange] = React.useState("1m")
  const [activeTicker, setActiveTicker] = React.useState<string>("")

  // Get months from time range
  const months = timeRange === "1m" ? 1 : timeRange === "3m" ? 3 : 12

  // Calculate growth metrics
  const growthData = React.useMemo(() => {
    const metrics = calculateGrowthMetrics(category, months)
    return metrics.map((m, index) => ({
      ticker: m.ticker,
      value: Math.abs(m.dollarChange),
      dollarChange: m.dollarChange,
      percentChange: m.percentChange,
      currentPrice: m.currentPrice,
      fill: FEATURED_COLORS[index] || FEATURED_COLORS[4],
    }))
  }, [category, months])

  // Set initial active ticker
  React.useEffect(() => {
    if (growthData.length > 0 && !activeTicker) {
      setActiveTicker(growthData[0].ticker)
    }
  }, [growthData, activeTicker])

  const activeIndex = React.useMemo(
    () => growthData.findIndex((item) => item.ticker === activeTicker),
    [activeTicker, growthData]
  )

  // Create chart config dynamically
  const chartConfig = React.useMemo(() => {
    const config: Record<string, any> = {
      growth: {
        label: "Growth",
      },
      value: {
        label: "Value",
      },
    }
    growthData.forEach((item) => {
      config[item.ticker] = {
        label: item.ticker,
        color: item.fill,
      }
    })
    return config
  }, [growthData])

  const id = "growth-breakdown"

  if (growthData.length === 0) {
    return (
      <Card className="flex flex-col cursor-pointer">
        <CardHeader>
          <CardTitle>Growth Breakdown</CardTitle>
          <CardDescription>No data available for this category</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card data-chart={id} className="flex flex-col cursor-pointer">
      <ChartStyle id={id} config={chartConfig} />
      <CardHeader className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 pb-2">
        <div>
          <CardTitle>Growth Breakdown</CardTitle>
          <CardDescription>Featured ticker performance</CardDescription>
        </div>
        <div className="flex items-center space-x-2">
          {/* Time Period Selector */}
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="flex-w max-w-32 rounded-lg cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end" className="rounded-lg">
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

          {/* Ticker Selector Dropdown */}
          <Select value={activeTicker} onValueChange={setActiveTicker}>
            <SelectTrigger className="w-[140px] rounded-lg cursor-pointer">
              <SelectValue placeholder="Select ticker" />
            </SelectTrigger>
            <SelectContent align="end" className="rounded-lg">
              {growthData.map((item) => (
                <SelectItem
                  key={item.ticker}
                  value={item.ticker}
                  className="rounded-md cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: item.fill }}
                    />
                    {item.ticker}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
          {/* Pie Chart */}
          <div className="flex justify-center">
            <ChartContainer
              id={id}
              config={chartConfig}
              className="mx-auto aspect-square w-full max-w-[300px]"
            >
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      hideLabel
                      formatter={(value, name) => {
                        const item = growthData.find((d) => d.ticker === name)
                        return (
                          <div className="flex flex-col gap-1">
                            <div className="font-medium">{name}</div>
                            <div className="text-xs text-muted-foreground">
                              ${item?.dollarChange.toFixed(2)} ({item?.percentChange.toFixed(2)}%)
                            </div>
                          </div>
                        )
                      }}
                    />
                  }
                />
                <Pie
                  data={growthData}
                  dataKey="value"
                  nameKey="ticker"
                  innerRadius={60}
                  strokeWidth={5}
                  activeIndex={activeIndex}
                  activeShape={({ outerRadius = 0, ...props }: PieSectorDataItem) => (
                    <g>
                      <Sector {...props} outerRadius={outerRadius + 10} />
                      <Sector
                        {...props}
                        outerRadius={outerRadius + 25}
                        innerRadius={outerRadius + 12}
                      />
                    </g>
                  )}
                >
                  {growthData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                  <Label
                    content={({ viewBox }) => {
                      if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                        const activeItem = growthData[activeIndex]
                        return (
                          <text
                            x={viewBox.cx}
                            y={viewBox.cy}
                            textAnchor="middle"
                            dominantBaseline="middle"
                          >
                            <tspan
                              x={viewBox.cx}
                              y={viewBox.cy}
                              className="fill-foreground text-3xl font-bold"
                            >
                              {activeItem?.percentChange >= 0 ? "+" : ""}
                              {activeItem?.percentChange.toFixed(1)}%
                            </tspan>
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy || 0) + 24}
                              className="fill-muted-foreground"
                            >
                              Growth
                            </tspan>
                          </text>
                        )
                      }
                    }}
                  />
                </Pie>
              </PieChart>
            </ChartContainer>
          </div>

          {/* Ticker List */}
          <div className="flex flex-col justify-center space-y-4">
            {growthData.map((item, index) => {
              const isActive = index === activeIndex
              const isPositive = item.dollarChange >= 0

              return (
                <div
                  key={item.ticker}
                  className={`flex items-center justify-between p-3 rounded-lg transition-colors cursor-pointer ${
                    isActive ? "bg-muted" : "hover:bg-muted/50"
                  }`}
                  onClick={() => setActiveTicker(item.ticker)}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: item.fill }}
                    />
                    <span className="font-medium">{item.ticker}</span>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold ${isPositive ? "text-green-600" : "text-red-600"}`}>
                      {isPositive ? "+" : ""}${item.dollarChange.toFixed(2)}
                    </div>
                    <div className={`text-sm ${isPositive ? "text-green-600" : "text-red-600"}`}>
                      {isPositive ? "+" : ""}
                      {item.percentChange.toFixed(2)}%
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
