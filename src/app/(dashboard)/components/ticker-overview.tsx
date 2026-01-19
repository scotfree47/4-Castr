"use client"
import { useState, useEffect } from "react"
import { TrendingUp, TrendingDown, DollarSign, Activity, Coins, TrendingUpDown, Bitcoin, AlertTriangle } from "lucide-react"
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel"
import { Separator } from "@/components/ui/separator"
{/*
import { Ticker } from "../../data"
*/}

const SENTINELS = {
  equity: ['SPY', 'QQQ', 'XLY'],
  'commodities-futures': ['GLD', 'USO', 'HG1!'],
  forex: ['EUR/USD', 'USD/JPY', 'GBP/USD'],
  crypto: ['Bitcoin', 'Ethereum', 'Solana'],
  'rates-macro': ['TLT', 'FEDFUNDS', 'CPI'],  
  stress: ['MOVE', 'TRIN', 'TLT']
}

const GROUP_CONFIG = [
  { id: 'equity', title: 'Equity', icon: DollarSign },
  { id: 'commodities-futures', title: 'Commodities / Futures', icon: Coins },
  { id: 'forex', title: 'Forex', icon: TrendingUpDown },
  { id: 'crypto', title: 'Crypto', icon: Bitcoin },
  { id: 'rates-macro', title: 'Rates / Macro', icon: Activity },
  { id: 'stress', title: 'Stress', icon: AlertTriangle }
]

export function TickerOverview() {
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
    api.on('select', () => setCurrent(api.selectedScrollSnap()))
  }, [api])

  const initializeData = async () => {
    try {
      setLoading(true)
      
      console.log('🔍 Fetching ingress data...')
      const ingress = await getCurrentIngress()
      console.log('✅ Ingress data:', ingress)
      setIngressData(ingress)
      
      console.log('🔍 Fetching metrics...')
      await fetchAllMetrics(ingress)
      console.log('✅ Metrics fetched')
    } catch (error) {
      console.error('❌ Error initializing data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getCurrentIngress = async () => {
    try {
      const res = await fetch('/api/ingress');
      const result = await res.json();
      
      if (result.success) {
        return result.data;
      }
      
      console.error('Error fetching ingress:', result.error);
      return null;
    } catch (err) {
      console.error('Error in getCurrentIngress:', err);
      return null;
    }
  }

  const getLastTradingDay = (date: string, isWeekendSensitive = true) => {
    const d = new Date(date)
    
    if (!isWeekendSensitive) return date
    
    const dayOfWeek = d.getDay()
    
    if (dayOfWeek === 6) {
      d.setDate(d.getDate() - 1)
    }
    else if (dayOfWeek === 0) {
      d.setDate(d.getDate() - 2)
    }
    
    return d.toISOString().split('T')[0]
  }

  const fetchAllMetrics = async (ingress: any) => {
    if (!ingress) {
      setMetrics(GROUP_CONFIG.map(createEmptyMetric))
      return
    }

    try {
      const endDate = new Date().toISOString().split('T')[0]
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      const results = await Promise.all(
        GROUP_CONFIG.map(async (group) => {
          try {
            const res = await fetch(`/api/${group.id}?startDate=${ingress.previousEnd}&endDate=${endDate}`)
            const data = await res.json()
            
            if (data.success) {
              return processGroupData(group, data.data, ingress, yesterday)
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
      console.error('Error fetching metrics:', error)
    }
  }

  const processGroupData = (group: any, data: any, ingress: any, yesterday: string) => {
    const sentinels = SENTINELS[group.id as keyof typeof SENTINELS]
    const isWeekendSensitive = group.id !== 'crypto'
    const ingressEndDate = getLastTradingDay(ingress.previousEnd, isWeekendSensitive)
    
    const sentinelMetrics = sentinels.map((symbol: string) => {
      const symbolData = data[symbol]
      if (!symbolData || symbolData.length === 0) {
        return { symbol, price: 0, change: 0, valid: false }
      }

      const latestData = symbolData.find((d: any) => d.date === yesterday) || symbolData[0]
      const latestPrice = latestData?.close || 0

      const ingressData = symbolData.find((d: any) => d.date === ingressEndDate)
      const ingressPrice = ingressData?.close || latestPrice

      const change = ingressPrice !== 0 ? ((latestPrice - ingressPrice) / ingressPrice) * 100 : 0

      return {
        symbol,
        price: latestPrice,
        change,
        valid: true
      }
    })

    const validMetrics = sentinelMetrics.filter(m => m.valid)
    
    if (validMetrics.length === 0) {
      return createEmptyMetric(group)
    }

    const avgChange = validMetrics.reduce((sum, m) => sum + m.change, 0) / validMetrics.length

    const strongest = validMetrics.reduce((max, m) => 
      Math.abs(m.change) > Math.abs(max.change) ? m : max
    )

    const momentum = avgChange >= 0 ? 'Positive' : 'Negative'
    const TrendIcon = avgChange >= 0 ? TrendingUp : TrendingDown

    return {
      title: group.title,
      strongestSymbol: strongest.symbol,
      strongestPrice: strongest.price,
      strongestChange: strongest.change,
      description: `Strongest of ${validMetrics.length} sentinels`,
      avgChange: `${avgChange >= 0 ? '+' : ''}${avgChange.toFixed(2)}%`,
      trend: avgChange >= 0 ? 'up' : 'down',
      icon: group.icon,
      footer: `${ingress.month}'s Momentum: ${momentum}`,
      footerIcon: TrendIcon,
      sentinels: sentinelMetrics.map(m => ({
        symbol: m.symbol,
        display: `${m.symbol} $${m.price.toFixed(2)} ${m.change >= 0 ? '+' : ''}${m.change.toFixed(2)}%`
      }))
    }
  }

  const createEmptyMetric = (group: any) => ({
    title: group.title,
    strongestSymbol: '—',
    strongestPrice: 0,
    strongestChange: 0,
    description: 'No data available',
    avgChange: '0%',
    trend: 'neutral',
    icon: group.icon,
    footer: 'Awaiting data',
    footerIcon: TrendingUp,
    sentinels: []
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
              <Card className="cursor-pointer hover:border-primary/50  transition-colors h-full flex flex-col">
                <CardHeader className="relative flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Icon className="h-6 w-6 text-muted-foreground" />
                      <CardDescription className="text-lg">{metric.title}</CardDescription>
                    </div>
                    {/* Top badge aligned with title */}
                    <Badge variant={metric.trend === 'up' ? 'default' : 'destructive'} className="flex items-center gap-1 shrink-0">
                      {metric.trend === 'up' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {metric.avgChange}
                    </Badge>
                  </div>
                  
                  <div className="flex items-start justify-between gap-4">
                    <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                      {metric.strongestSymbol} ${metric.strongestPrice.toFixed(2)}
                    </CardTitle>
                    {/* Bottom badge aligned with strongest sentinel */}
                    <Badge variant={metric.strongestChange >= 0 ? 'default' : 'destructive'} className="flex items-center gap-1 shrink-0">
                      {metric.strongestChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {metric.strongestChange >= 0 ? '+' : ''}{metric.strongestChange.toFixed(2)}%
                    </Badge>
                  </div>
                  
                  {/* Fixed height container for sentinels */}
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
              index === current ? 'bg-primary' : 'bg-muted-foreground hover:bg-primary'
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