"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { AlignHorizontalDistributeCenter } from "lucide-react"
import { 
  formatChartData,
  type CategoryType 
} from "../../data"

export function TtmReturn() {
  const searchParams = useSearchParams()
  
  // Sync with Trend component via URL params
  const category = (searchParams?.get('category') as CategoryType) || 'equity'
  const [timeRange, setTimeRange] = React.useState("1m")
  const [visibleTickers, setVisibleTickers] = React.useState<Record<string, boolean>>({})

  // Get days from time range
  const days = timeRange === "1m" ? 30 : timeRange === "3m" ? 90 : 365

  // Get chart data for current category
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

  React.useEffect(() => {
    console.log('🔄 TtmReturn: Loading chart data for', category, days, 'days')
    formatChartData(category, days).then(data => {
      console.log('✅ TtmReturn: Chart data loaded:', data.series.length, 'series')
      console.log('📊 TtmReturn: First series sample:', data.series[0]?.ticker, data.series[0]?.data.slice(0, 5))
      setChartData(data)
    }).catch(err => {
      console.error('❌ TtmReturn: Error loading chart data:', err)
    })
  }, [category, days])

  // Initialize visibility state
  React.useEffect(() => {
    const initialVisibility: Record<string, boolean> = {}
    chartData.series.forEach(s => {
      initialVisibility[s.ticker] = true
    })
    setVisibleTickers(initialVisibility)
  }, [category])

  // Toggle ticker visibility
  const toggleTicker = (ticker: string) => {
    setVisibleTickers(prev => ({
      ...prev,
      [ticker]: !prev[ticker]
    }))
  }

  // Filter series by visibility
  const visibleSeries = chartData.series.map(s => ({
    ...s,
    isVisible: visibleTickers[s.ticker] !== false
  }))

  // Format raw price data for chart (no normalization)
  const priceData = React.useMemo(() => {
    return chartData.dates.map((date, index) => {
      const dataPoint: Record<string, any> = { date }
      
      visibleSeries.forEach(s => {
        if (s.isVisible) {
          // Use actual raw prices
          dataPoint[s.ticker] = s.data[index]
        }
      })
      
      return dataPoint
    })
  }, [chartData.dates, visibleSeries])

  // Calculate Y-axis domain dynamically based on ONLY visible tickers
  const yAxisDomain = React.useMemo(() => {
    const visibleData = visibleSeries.filter(s => s.isVisible)
    if (visibleData.length === 0) return [0, 100]
    
    let yMin = Infinity
    let yMax = -Infinity
    
    // Find min/max across all visible series
    visibleData.forEach(series => {
      series.data.forEach(price => {
        if (price < yMin) yMin = price
        if (price > yMax) yMax = price
      })
    })
    
    // Add 5% padding for visual breathing room
    const range = yMax - yMin
    const padding = range * 0.05
    
    return [
      Math.floor(yMin - padding), 
      Math.ceil(yMax + padding)
    ]
  }, [visibleSeries])

  // Create chart config
  const chartConfig = React.useMemo(() => {
    const config: Record<string, any> = {}
    visibleSeries.forEach(s => {
      config[s.ticker] = {
        label: s.ticker,
        color: s.color,
      }
    })
    return config
  }, [visibleSeries])

  const featuredTickers = visibleSeries.filter(s => !s.isSentinel)
  const sentinelTickers = visibleSeries.filter(s => s.isSentinel)

  return (
    <Card className="cursor-pointer hover:border-primary/50 transition-colors">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle>Return</CardTitle>
          <CardDescription>Trailing performance review</CardDescription>
        </div>
        <div className="flex items-center space-x-2">
          {/* Time Range Selector */}
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="flex w-auto max-w-32 cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1m" className="cursor-pointer">1 month</SelectItem>
              <SelectItem value="3m" className="cursor-pointer">3 months</SelectItem>
              <SelectItem value="12m" className="cursor-pointer">12 months</SelectItem>
            </SelectContent>
          </Select>

          {/* Ticker Visibility Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="cursor-pointer">
                <AlignHorizontalDistributeCenter className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5 text-xs font-semibold">Featured</div>
              {featuredTickers.map(s => (
                <DropdownMenuCheckboxItem
                  key={s.ticker}
                  checked={visibleTickers[s.ticker] !== false}
                  onCheckedChange={() => toggleTicker(s.ticker)}
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
              {sentinelTickers.map(s => (
                <DropdownMenuCheckboxItem
                  key={s.ticker}
                  checked={visibleTickers[s.ticker] !== false}
                  onCheckedChange={() => toggleTicker(s.ticker)}
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
                  const date = new Date(value)
                  return date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                }}
              />
              <YAxis 
                hide
                domain={yAxisDomain}
                scale="linear"
              />
              <ChartTooltip 
                offset={9}
                content={
                  <ChartTooltipContent
                    className="min-w-[150px]"
                    labelFormatter={(value) => {
                      return new Date(value).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    }}
                    formatter={(value, name, props) => {
                      const series = visibleSeries.find(s => s.ticker === name)
                      if (!series) return null
                      
                      // Value is already the actual price
                      const actualPrice = typeof value === 'number' ? value : 0
                      
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
              
              {/* Render sentinel lines first (dashed, behind, 30% opacity) */}
              {visibleSeries
                .filter(s => s.isSentinel && s.isVisible)
                .map(s => (
                  <Line
                    key={s.ticker}
                    type="monotone"
                    dataKey={s.ticker}
                    stroke={s.color}
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    strokeOpacity={0.3}
                    dot={false}
                    connectNulls
                  />
                ))}
              
              {/* Render featured lines (solid, in front) */}
              {visibleSeries
                .filter(s => !s.isSentinel && s.isVisible)
                .map(s => (
                  <Line
                    key={s.ticker}
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
        </div>
      </CardContent>
    </Card>
  )
}