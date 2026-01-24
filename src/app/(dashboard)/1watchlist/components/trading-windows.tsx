"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { detectTradingWindows, type TradingWindow } from "@/lib/services/confluenceEngine"
import { useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Calendar, TrendingUp, AlertTriangle, Zap } from "lucide-react"

interface TradingWindowsProps {
  symbol?: string
  category?: string
}

export function TradingWindows({ symbol = "SPY", category = "equity" }: TradingWindowsProps) {
  const [windows, setWindows] = useState<TradingWindow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadWindows() {
      try {
        setIsLoading(true)
        setError(null)
        const results = await detectTradingWindows(symbol, category, 90)
        setWindows(results.slice(0, 5)) // Show top 5 windows
      } catch (err) {
        console.error("Error loading trading windows:", err)
        setError("Unable to load trading windows")
      } finally {
        setIsLoading(false)
      }
    }

    loadWindows()
  }, [symbol, category])

  if (isLoading) {
    return (
      <Card className="bg-background/40 backdrop-blur-xl border-border/40 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Trading Forecast
          </CardTitle>
          <CardDescription>Loading optimal trading windows...</CardDescription>
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
            Trading Forecast
          </CardTitle>
          <CardDescription>
            {error || "No high-probability windows found in the next 90 days"}
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
          Trading Forecast for {symbol}
        </CardTitle>
        <CardDescription>
          Optimal trading windows based on technical confluence + astrological timing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {windows.map((window, index) => (
          <div
            key={`${window.startDate}-${index}`}
            className={`rounded-xl border backdrop-blur-lg p-4 transition-all hover:scale-[1.02] hover:shadow-xl ${getTypeColor(window.type)}`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{window.emoji}</span>
                <div>
                  <div className="flex items-center gap-2">
                    {getTypeIcon(window.type)}
                    <span className="font-semibold">{getTypeLabel(window.type)}</span>
                  </div>
                  <div className="text-sm opacity-80">
                    {formatDateRange(window.startDate, window.endDate)} ({window.daysInWindow}{" "}
                    days)
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
            <p>No favorable trading windows in the next 90 days</p>
            <p className="text-sm mt-1">Check back later for better conditions</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
