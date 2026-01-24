"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { type TradingWindow } from "@/lib/services/confluenceEngine"
import { useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Calendar, TrendingUp, AlertTriangle, Zap } from "lucide-react"

interface WindowWithSymbol extends TradingWindow {
  symbol: string
  category: string
}

interface MultiSymbolTradingWindowsProps {
  includeSentinels?: boolean
  specificSymbols?: string[]
  topN?: number
  daysAhead?: number
}

export function MultiSymbolTradingWindows({
  includeSentinels = true,
  specificSymbols = [],
  topN = 10,
  daysAhead = 90,
}: MultiSymbolTradingWindowsProps) {
  const [windows, setWindows] = useState<WindowWithSymbol[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<any>(null)

  useEffect(() => {
    async function loadWindows() {
      try {
        setIsLoading(true)
        setError(null)

        const params = new URLSearchParams({
          daysAhead: daysAhead.toString(),
          topN: topN.toString(),
        })

        if (includeSentinels) {
          params.set("sentinels", "true")
        } else if (specificSymbols.length > 0) {
          params.set("symbols", specificSymbols.join(","))
        }

        const response = await fetch(`/api/trading-windows-bulk?${params.toString()}`)
        const data = await response.json()

        if (!data.success) {
          throw new Error(data.error || "Failed to load windows")
        }

        setWindows(data.data.windows)
        setSummary(data.data.summary)
      } catch (err) {
        console.error("Error loading trading windows:", err)
        setError("Unable to load trading windows")
      } finally {
        setIsLoading(false)
      }
    }

    loadWindows()
  }, [includeSentinels, specificSymbols, topN, daysAhead])

  if (isLoading) {
    return (
      <Card className="bg-background/40 backdrop-blur-xl border-border/40 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Market-Wide Trading Forecast
          </CardTitle>
          <CardDescription>Scanning all sentinels for optimal trading opportunities...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full bg-foreground/5" />
          <Skeleton className="h-20 w-full bg-foreground/5" />
          <Skeleton className="h-20 w-full bg-foreground/5" />
        </CardContent>
      </Card>
    )
  }

  if (error || windows.length === 0) {
    return (
      <Card className="bg-background/40 backdrop-blur-xl border-border/40 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Market-Wide Trading Forecast
          </CardTitle>
          <CardDescription>
            {error || "No high-probability windows found across any symbols"}
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const getTypeColor = (type: TradingWindow["type"]) => {
    switch (type) {
      case "high_probability":
        return "bg-green-500/5 text-green-400 border-green-500/30 shadow-green-500/10"
      case "moderate":
        return "bg-blue-500/5 text-blue-400 border-blue-500/30 shadow-blue-500/10"
      case "avoid":
        return "bg-gray-500/5 text-gray-400 border-gray-500/30 shadow-gray-500/10"
      case "extreme_volatility":
        return "bg-orange-500/5 text-orange-400 border-orange-500/30 shadow-orange-500/10"
    }
  }

  const getTypeIcon = (type: TradingWindow["type"]) => {
    switch (type) {
      case "high_probability":
        return <TrendingUp className="h-4 w-4" />
      case "moderate":
        return <TrendingUp className="h-4 w-4 opacity-60" />
      case "avoid":
        return <AlertTriangle className="h-4 w-4" />
      case "extreme_volatility":
        return <Zap className="h-4 w-4" />
    }
  }

  const getTypeLabel = (type: TradingWindow["type"]) => {
    switch (type) {
      case "high_probability":
        return "High Probability"
      case "moderate":
        return "Moderate"
      case "avoid":
        return "Avoid"
      case "extreme_volatility":
        return "High Volatility"
    }
  }

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const startMonth = start.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    const endMonth = end.toLocaleDateString("en-US", { month: "short", day: "numeric" })

    if (startMonth === endMonth) {
      return startMonth
    }
    return `${startMonth} - ${endMonth}`
  }

  return (
    <Card className="bg-background/40 backdrop-blur-xl border-border/40 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Market-Wide Trading Forecast
        </CardTitle>
        <CardDescription>
          Top {windows.length} opportunities across {summary?.totalSymbols} symbols based on technical
          confluence + astrological timing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Summary Stats */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 p-3 rounded-lg bg-foreground/5">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{summary.highProbability}</div>
              <div className="text-xs opacity-60">High Prob</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{summary.moderate}</div>
              <div className="text-xs opacity-60">Moderate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{summary.symbolsWithWindows}</div>
              <div className="text-xs opacity-60">Active Symbols</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{summary.averageScore}</div>
              <div className="text-xs opacity-60">Avg Score</div>
            </div>
          </div>
        )}

        {/* Trading Windows */}
        {windows.map((window, index) => (
          <div
            key={`${window.symbol}-${window.startDate}-${index}`}
            className={`rounded-xl border backdrop-blur-lg p-4 transition-all hover:scale-[1.02] hover:shadow-xl ${getTypeColor(window.type)}`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{window.emoji}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs">
                      {window.symbol}
                    </Badge>
                    {getTypeIcon(window.type)}
                    <span className="font-semibold">{getTypeLabel(window.type)}</span>
                  </div>
                  <div className="text-sm opacity-80">
                    {formatDateRange(window.startDate, window.endDate)} ({window.daysInWindow} days)
                  </div>
                </div>
              </div>
              <Badge variant="outline" className="font-mono">
                {window.combinedScore}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs mb-2">
              <div>
                <span className="opacity-60">Technical:</span>{" "}
                <span className="font-medium">{window.technicalConfluence}</span>
              </div>
              <div>
                <span className="opacity-60">Astrological:</span>{" "}
                <span className="font-medium">{window.astrologicalAlignment}</span>
              </div>
            </div>

            <div className="text-xs opacity-80 space-y-1">
              {window.reasons.map((reason, i) => (
                <div key={i} className="flex items-start gap-1">
                  <span className="opacity-40">•</span>
                  <span>{reason}</span>
                </div>
              ))}
            </div>

            {window.keyLevels.length > 0 && (
              <div className="mt-2 pt-2 border-t border-current/10 text-xs">
                <span className="opacity-60">Key Levels:</span>{" "}
                <span className="font-mono">
                  {window.keyLevels
                    .slice(0, 3)
                    .map((l) => l.toFixed(2))
                    .join(", ")}
                </span>
              </div>
            )}
          </div>
        ))}

        {windows.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <span className="text-4xl mb-2 block">🌧️</span>
            <p>No favorable trading windows found</p>
            <p className="text-sm mt-1">Check back later for better market conditions</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
