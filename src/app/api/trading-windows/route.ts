// app/api/trading-windows/route.ts
// API endpoint for trading window detection (weather forecast)

import { detectTradingWindows } from "@/lib/services/confluenceEngine"
import { createErrorResponse } from "@/lib/api/errors"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Parse parameters
    const symbol = searchParams.get("symbol") || "SPY"
    const category = searchParams.get("category") || "equity"
    const daysAhead = parseInt(searchParams.get("daysAhead") || "90")
    const limit = parseInt(searchParams.get("limit") || "10")

    console.log(`🔮 Trading windows request: ${symbol} (${category}), ${daysAhead} days ahead`)

    // Validate inputs
    if (daysAhead < 7 || daysAhead > 180) {
      return NextResponse.json(
        {
          success: false,
          error: "daysAhead must be between 7 and 180",
        },
        { status: 400 }
      )
    }

    // Detect trading windows
    const windows = await detectTradingWindows(symbol, category, daysAhead)

    // Limit results
    const limitedWindows = windows.slice(0, limit)

    // Calculate summary statistics
    const summary = {
      totalWindows: windows.length,
      windowsReturned: limitedWindows.length,
      highProbability: windows.filter((w) => w.type === "high_probability").length,
      moderate: windows.filter((w) => w.type === "moderate").length,
      avoid: windows.filter((w) => w.type === "avoid").length,
      extremeVolatility: windows.filter((w) => w.type === "extreme_volatility").length,
      averageScore:
        windows.length > 0
          ? Math.round(windows.reduce((sum, w) => sum + w.combinedScore, 0) / windows.length)
          : 0,
      bestWindow: windows[0] || null,
    }

    console.log(`✅ Found ${windows.length} windows, returning top ${limitedWindows.length}`)

    return NextResponse.json({
      success: true,
      data: {
        symbol,
        category,
        daysAhead,
        windows: limitedWindows,
        summary,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error("❌ Trading windows error:", error)
    const errorResponse = createErrorResponse(error, "Failed to detect trading windows")
    return NextResponse.json(errorResponse, { status: errorResponse.status })
  }
}
