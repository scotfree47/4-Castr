"use client"

import * as React from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Line, LineChart, CartesianGrid, XAxis, YAxis, ReferenceLine } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { AlignHorizontalDistributeCenter, DollarSign, Coins, TrendingUpDown, Bitcoin, Activity, AlertTriangle, TrendingUp } from "lucide-react"
import { 
  formatChartData, 
  getAllCategories, 
  formatCategoryName,
  type CategoryType 
} from "../../data"

// Fibonacci level configuration
const FIB_LEVELS = {
  retracement: [
    { key: 'level_1000', ratio: 1.000, label: '100%', color: 'hsl(var(--chart-1))' },
    { key: 'level_886', ratio: 0.886, label: '88.6%', color: 'hsl(var(--chart-2))' },
    { key: 'level_786', ratio: 0.786, label: '78.6%', color: 'hsl(var(--chart-3))' },
    { key: 'level_618', ratio: 0.618, label: '61.8%', color: 'hsl(220, 70%, 50%)', important: true }, // Golden ratio
    { key: 'level_500', ratio: 0.500, label: '50%', color: 'hsl(var(--chart-4))' },
    { key: 'level_382', ratio: 0.382, label: '38.2%', color: 'hsl(var(--chart-5))' },
    { key: 'level_236', ratio: 0.236, label: '23.6%', color: 'hsl(var(--muted-foreground))' },
    { key: 'level_0', ratio: 0.000, label: '0%', color: 'hsl(var(--chart-1))' },
  ],
  extension_up: [
    { key: 'level_1272', ratio: 1.272, label: '127.2%', color: 'hsl(142, 76%, 36%)' },
    { key: 'level_1414', ratio: 1.414, label: '141.4%', color: 'hsl(142, 70%, 45%)' },
    { key: 'level_1618', ratio: 1.618, label: '161.8%', color: 'hsl(142, 76%, 36%)', important: true }, // Golden
    { key: 'level_2618', ratio: 2.618, label: '261.8%', color: 'hsl(142, 70%, 50%)' },
    { key: 'level_3618', ratio: 3.618, label: '361.8%', color: 'hsl(142, 65%, 55%)' },
    { key: 'level_4236', ratio: 4.236, label: '423.6%', color: 'hsl(142, 60%, 60%)' },
    { key: 'level_4618', ratio: 4.618, label: '461.8%', color: 'hsl(142, 55%, 65%)' },
  ],
  extension_down: [
    { key: 'level_n027', ratio: -0.27, label: '-27%', color: 'hsl(0, 60%, 60%)' },
    { key: 'level_n0618', ratio: -0.618, label: '-61.8%', color: 'hsl(0, 76%, 36%)', important: true }, // Golden
    { key: 'level_n1000', ratio: -1.000, label: '-100%', color: 'hsl(0, 70%, 45%)' },
    { key: 'level_n1272', ratio: -1.272, label: '-127.2%', color: 'hsl(0, 70%, 50%)' },
    { key: 'level_n1414', ratio: -1.414, label: '-141.4%', color: 'hsl(0, 65%, 55%)' },
    { key: 'level_n1618', ratio: -1.618, label: '-161.8%', color: 'hsl(0, 76%, 36%)', important: true },
    { key: 'level_n2618', ratio: -2.618, label: '-261.8%', color: 'hsl(0, 60%, 60%)' },
    { key: 'level_n3618', ratio: -3.618, label: '-361.8%', color: 'hsl(0, 55%, 65%)' },
    { key: 'level_n4236', ratio: -4.236, label: '-423.6%', color: 'hsl(0, 50%, 70%)' },
    { key: 'level_n4618', ratio: -4.618, label: '-461.8%', color: 'hsl(0, 45%, 75%)' },
  ]
}

export function TrendPath() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const categoryParam = (searchParams?.get('category') as CategoryType) || 'equity'
  const [category, setCategory] = React.useState<CategoryType>(categoryParam)
  const [timeRange, setTimeRange] = React.useState("30d")
  const [visibleTickers, setVisibleTickers] = React.useState<Record<string, boolean>>({})
  const [showFibLevels, setShowFibLevels] = React.useState(false)
  const [showKeyLevels, setShowKeyLevels] = React.useState(false)
  const [fibLevels, setFibLevels] = React.useState<any>(null)
  const [keyLevels, setKeyLevels] = React.useState<any>(null)
  const [fibSymbol, setFibSymbol] = React.useState<string>('')

  const updateCategory = (newCategory: CategoryType) => {
    setCategory(newCategory)
    const params = new URLSearchParams(searchParams?.toString())
    params.set('category', newCategory)
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

  React.useEffect(() => {
    console.log('🔄 TrendPath: Loading chart data for', category, days, 'days')
    formatChartData(category, days).then(data => {
      console.log('✅ TrendPath: Chart data loaded:', data.series.length, 'series')
      setChartData(data)
    }).catch(err => {
      console.error('❌ TrendPath: Error loading chart data:', err)
    })
  }, [category, days])

  React.useEffect(() => {
    const initialVisibility: Record<string, boolean> = {}
    chartData.series.forEach(s => {
      initialVisibility[s.ticker] = true
    })
    setVisibleTickers(initialVisibility)
  }, [category])

  // Fetch Fibonacci levels when enabled
  React.useEffect(() => {
    if (showFibLevels && chartData.series.length > 0) {
      // Use the first non-sentinel ticker for Fib calculation
      const symbol = chartData.series.find(s => !s.isSentinel)?.ticker || chartData.series[0]?.ticker
      if (symbol && symbol !== fibSymbol) {
        setFibSymbol(symbol)
        fetchFibonacciLevels(symbol)
      }
    }
  }, [showFibLevels, chartData.series])

  const fetchFibonacciLevels = async (symbol: string) => {
    try {
      const startDate = chartData.dates[0]
      const endDate = chartData.dates[chartData.dates.length - 1]
      const response = await fetch(
        `/api/fibonacci?symbol=${symbol}&startDate=${startDate}&endDate=${endDate}`
      )
      const data = await response.json()
      
      if (data.success) {
        setFibLevels(data.data.levels.all)
        console.log('✅ Fibonacci levels loaded for', symbol)
      }
    } catch (error) {
      console.error('❌ Error fetching Fibonacci levels:', error)
    }
  }

  const fetchKeyLevels = async (symbol: string) => {
    try {
      const startDate = chartData.dates[0]
      const endDate = chartData.dates[chartData.dates.length - 1]
      const response = await fetch(
        `/api/levels/${symbol}?startDate=${startDate}&endDate=${endDate}&swingLength=10&pivotBars=5`
      )
      const data = await response.json()
      
      if (data.success) {
        setKeyLevels(data.data.current)
        console.log('✅ Key levels loaded for', symbol)
      }
    } catch (error) {
      console.error('❌ Error fetching key levels:', error)
    }
  }

  const toggleTicker = (ticker: string) => {
    setVisibleTickers(prev => ({
      ...prev,
      [ticker]: !prev[ticker]
    }))
  }

  const visibleSeries = chartData.series.map(s => ({
    ...s,
    isVisible: visibleTickers[s.ticker] !== false
  }))

  const priceData = React.useMemo(() => {
    return chartData.dates.map((date, index) => {
      const dataPoint: Record<string, any> = { date }
      
      visibleSeries.forEach(s => {
        if (s.isVisible) {
          dataPoint[s.ticker] = s.data[index]
        }
      })
      
      return dataPoint
    })
  }, [chartData.dates, visibleSeries])

  const yAxisDomain = React.useMemo(() => {
    const visibleData = visibleSeries.filter(s => s.isVisible)
    if (visibleData.length === 0) return [0, 100]
    
    let yMin = Infinity
    let yMax = -Infinity
    
    visibleData.forEach(series => {
      series.data.forEach(price => {
        if (price < yMin) yMin = price
        if (price > yMax) yMax = price
      })
    })
    
    // Include Fib levels in domain calculation if visible
    if (showFibLevels && fibLevels) {
      Object.values(fibLevels).forEach((level: any) => {
        if (level < yMin) yMin = level
        if (level > yMax) yMax = level
      })
    }
    
    const range = yMax - yMin
    const padding = range * 0.05
    
    return [
      Math.floor(yMin - padding), 
      Math.ceil(yMax + padding)
    ]
  }, [visibleSeries, showFibLevels, fibLevels])

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

  const categories = getAllCategories()
  const featuredTickers = visibleSeries.filter(s => !s.isSentinel)
  const sentinelTickers = visibleSeries.filter(s => s.isSentinel)

  const categoryIcons: Record<CategoryType, any> = {
    equity: DollarSign,
    commodity: Coins,
    forex: TrendingUpDown,
    crypto: Bitcoin,
    'rates-macro': Activity,
    stress: AlertTriangle
  }

  // Render Fibonacci lines
  const renderFibLines = () => {
    if (!showFibLevels || !fibLevels) return null

    const allLevels = [
      ...FIB_LEVELS.retracement,
      ...FIB_LEVELS.extension_up,
      ...FIB_LEVELS.extension_down
    ]

    return allLevels.map(levelConfig => {
      const price = fibLevels[levelConfig.key]
      if (!price) return null

      return (
        <ReferenceLine
          key={levelConfig.key}
          y={price}
          stroke={levelConfig.color}
          strokeWidth={levelConfig.important ? 2 : 1}
          strokeDasharray={levelConfig.important ? "5 5" : "3 3"}
          strokeOpacity={levelConfig.important ? 0.8 : 0.4}
          label={{
            value: levelConfig.label,
            position: 'right',
            fill: levelConfig.color,
            fontSize: 10,
            fontWeight: levelConfig.important ? 'bold' : 'normal'
          }}
        />
      )
    })
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
            {/* Fibonacci Toggle */}
            <div className="flex items-center gap-2 px-3 py-1 border rounded-md bg-background/50">
              <TrendingUp className="h-3 w-3 text-muted-foreground" />
              <Label htmlFor="fib-toggle" className="text-xs cursor-pointer whitespace-nowrap">
                Fib Levels
              </Label>
              <Switch
                id="fib-toggle"
                checked={showFibLevels}
                onCheckedChange={setShowFibLevels}
                className="scale-75"
              />
            </div>

            {/* Time Range Selector */}
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="flex w-auto max-w-28 cursor-pointer" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d" className="cursor-pointer">7 days</SelectItem>
                <SelectItem value="14d" className="cursor-pointer">14 days</SelectItem>
                <SelectItem value="30d" className="cursor-pointer">30 days</SelectItem>
              </SelectContent>
            </Select>

            {/* Ticker Visibility Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="cursor-pointer">
                  <AlignHorizontalDistributeCenter className="h-4 w-4" />
                  <span className="hidden sm:inline ml-2">Tickers</span>
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
        </div>
      </CardHeader>

      <CardContent>
        {/* Fib Symbol Indicator */}
        {showFibLevels && fibSymbol && (
          <div className="mb-2 text-xs text-muted-foreground flex items-center gap-2">
            <TrendingUp className="h-3 w-3" />
            Fibonacci levels calculated for: <span className="font-semibold">{fibSymbol}</span>
          </div>
        )}

        {/* Category Tabs Inside Card */}
        <Tabs value={category} onValueChange={(v) => updateCategory(v as CategoryType)} className="w-full mb-4">
          <TabsList className="grid w-full grid-cols-6 bg-muted/50 p-1 rounded-lg h-12">
            {categories.map(cat => {
              const Icon = categoryIcons[cat]
              return (
                <TabsTrigger
                  key={cat}
                  value={cat}
                  className="cursor-pointer rounded-md px-2 py-2 text-xs sm:text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <span className="hidden sm:inline">{formatCategoryName(cat)}</span>
                  <Icon className="sm:hidden h-4 w-4" />
                </TabsTrigger>
              )
            })}
          </TabsList>
        </Tabs>

        {/* Chart */}
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <LineChart data={priceData}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
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
            
            {/* Fibonacci Lines */}
            {renderFibLines()}
            
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
      </CardContent>
    </Card>
  )
}