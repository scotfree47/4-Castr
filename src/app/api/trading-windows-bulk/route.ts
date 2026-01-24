// app/api/trading-windows-bulk/route.ts
// Bulk API endpoint for fetching trading windows across multiple symbols

import { detectTradingWindows, type TradingWindow } from "@/lib/services/confluenceEngine"
import { createErrorResponse } from "@/lib/api/errors"
import { NextRequest, NextResponse } from "next/server"
import { SENTINELS, type CategoryType } from "@/app/(dashboard)/data/tickers/chart-utils"

interface SymbolWindows {
  symbol: string
  category: CategoryType
  windows: TradingWindow[]
  bestWindow: TradingWindow | null
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const includeAllSentinels = searchParams.get("sentinels") === "true"
    const specificSymbols = searchParams.get("symbols")?.split(",") || []
    const daysAhead = parseInt(searchParams.get("daysAhead") || "90")
    const topN = parseInt(searchParams.get("topN") || "10")

    console.log(`🔮 Bulk trading windows request: ${includeAllSentinels ? "all sentinels" : specificSymbols.join(", ")}`)

    if (daysAhead < 7 || daysAhead > 180) {
      return NextResponse.json(
        { success: false, error: "daysAhead must be between 7 and 180" },
        { status: 400 }
      )
    }

    // Collect all symbols to process
    const symbolsToProcess: Array<{ symbol: string; category: CategoryType }> = []

    if (includeAllSentinels) {
      // Add all sentinels from all categories
      Object.entries(SENTINELS).forEach(([category, symbols]) => {
        symbols.forEach((symbol) => {
          symbolsToProcess.push({ symbol, category: category as CategoryType })
        })
      })
    } else if (specificSymbols.length > 0) {
      // Process specific symbols (need to infer categories)
      specificSymbols.forEach((symbol) => {
        // Try to find category from SENTINELS
        let foundCategory: CategoryType | null = null
        for (const [cat, syms] of Object.entries(SENTINELS)) {
          if ((syms as readonly string[]).includes(symbol)) {
            foundCategory = cat as CategoryType
            break
          }
        }
        if (foundCategory) {
          symbolsToProcess.push({ symbol, category: foundCategory })
        } else {
          // Default to equity if not found
          symbolsToProcess.push({ symbol, category: "equity" })
        }
      })
    } else {
      return NextResponse.json(
        { success: false, error: "Must specify either sentinels=true or symbols=..." },
        { status: 400 }
      )
    }

    console.log(`📊 Processing ${symbolsToProcess.length} symbols...`)

    // Fetch windows for all symbols in parallel
    const windowPromises = symbolsToProcess.map(async ({ symbol, category }) => {
      try {
        const windows = await detectTradingWindows(symbol, category, daysAhead)
        return {
          symbol,
          category,
          windows: windows.slice(0, 5), // Top 5 per symbol
          bestWindow: windows[0] || null,
        } as SymbolWindows
      } catch (error) {
        console.error(`❌ Error processing ${symbol}:`, error)
        return {
          symbol,
          category,
          windows: [],
          bestWindow: null,
        } as SymbolWindows
      }
    })

    const allResults = await Promise.all(windowPromises)

    // Flatten all windows and sort by combined score
    const allWindows = allResults
      .flatMap((result) =>
        result.windows.map((window) => ({
          ...window,
          symbol: result.symbol,
          category: result.category,
        }))
      )
      .sort((a, b) => b.combinedScore - a.combinedScore)

    const topWindows = allWindows.slice(0, topN)

    // Summary statistics
    const summary = {
      totalSymbols: symbolsToProcess.length,
      symbolsWithWindows: allResults.filter((r) => r.windows.length > 0).length,
      totalWindows: allWindows.length,
      topWindows: topWindows.length,
      highProbability: allWindows.filter((w) => w.type === "high_probability").length,
      moderate: allWindows.filter((w) => w.type === "moderate").length,
      avoid: allWindows.filter((w) => w.type === "avoid").length,
      extremeVolatility: allWindows.filter((w) => w.type === "extreme_volatility").length,
      averageScore:
        allWindows.length > 0
          ? Math.round(allWindows.reduce((sum, w) => sum + w.combinedScore, 0) / allWindows.length)
          : 0,
    }

    console.log(`✅ Found ${allWindows.length} total windows across ${symbolsToProcess.length} symbols`)

    return NextResponse.json({
      success: true,
      data: {
        windows: topWindows,
        bySymbol: allResults,
        summary,
        daysAhead,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error("❌ Bulk trading windows error:", error)
    const errorResponse = createErrorResponse(error, "Failed to detect bulk trading windows")
    return NextResponse.json(errorResponse, { status: errorResponse.status })
  }
}
