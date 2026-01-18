// app/api/market-data/route.ts
// UNIFIED MARKET DATA API - Consolidates equity, crypto, forex, commodity, rates-macro, stress
// Replaces: /api/equity, /api/crypto, /api/forex, /api/commodities-futures, /api/rates-macro, /api/stress

import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Category definitions with their symbols
const MARKET_CATEGORIES = {
  equity: ["SPY", "QQQ", "XLY"],
  crypto: ["Bitcoin", "Ethereum", "Solana", "BNB", "XRP", "Cardano", "Polkadot", "Chainlink", "Stellar"],
  forex: ["EUR/USD", "USD/JPY", "GBP/USD", "GBP/JPY", "AUD/USD", "EUR/NZD", "GBP/AUD", "GBP/CAD", "NZD/CAD", "AUD/NZD"],
  commodity: ["GLD", "USO", "HG1!", "GC1!", "CL1!", "COTTON", "WHEAT", "CORN", "SUGAR", "COFFEE", "SI1!", "NG1!", "CT1!", "SB1!", "KC1!"],
  "rates-macro": ["TLT", "FEDFUNDS", "CPI", "TNX", "DXY", "UNRATE", "PCE", "NFP"],
  stress: ["VIX", "MOVE", "TRIN", "VVIX", "VXN", "RVX", "TYX", "BVOL"],
} as const

type Category = keyof typeof MARKET_CATEGORIES

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parse parameters
    const category = (searchParams.get("category") || "all") as Category | "all"
    const symbols = searchParams.get("symbols")?.split(",").filter(Boolean)
    const startDate = searchParams.get("startDate") || 
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
    const endDate = searchParams.get("endDate") || new Date().toISOString().split("T")[0]
    const source = searchParams.get("source") // 'cache' | 'api' | 'csv' | undefined (auto)

    console.log(`📊 Market data request: category=${category}, symbols=${symbols?.length || 'all'}, dates=${startDate} to ${endDate}`)

    // Determine which symbols to fetch
    let symbolsToFetch: string[] = []
    let categoriesToFetch: Category[] = []

    if (symbols && symbols.length > 0) {
      // Specific symbols requested
      symbolsToFetch = symbols
    } else if (category === "all") {
      // All categories
      categoriesToFetch = Object.keys(MARKET_CATEGORIES) as Category[]
      symbolsToFetch = categoriesToFetch.flatMap(cat => MARKET_CATEGORIES[cat])
    } else if (category in MARKET_CATEGORIES) {
      // Single category
      categoriesToFetch = [category]
      symbolsToFetch = MARKET_CATEGORIES[category]
    } else {
      return NextResponse.json(
        { success: false, error: `Invalid category: ${category}` },
        { status: 400 }
      )
    }

    console.log(`   Fetching ${symbolsToFetch.length} symbols across ${categoriesToFetch.length || 1} categories`)

    // Fetch data from Supabase
    const { data, error } = await supabaseAdmin
      .from("financial_data")
      .select("*")
      .in("symbol", symbolsToFetch)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("symbol")
      .order("date", { ascending: false })

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    // Group data by symbol
    const groupedData: Record<string, any[]> = {}
    const missingSymbols: string[] = []

    for (const symbol of symbolsToFetch) {
      const symbolData = data?.filter(d => d.symbol === symbol) || []
      groupedData[symbol] = symbolData
      
      if (symbolData.length === 0) {
        missingSymbols.push(symbol)
      }
    }

    // Generate summary statistics
    const summary = {
      totalSymbols: symbolsToFetch.length,
      symbolsWithData: symbolsToFetch.length - missingSymbols.length,
      symbolsMissing: missingSymbols.length,
      totalRecords: data?.length || 0,
      dateRange: {
        start: startDate,
        end: endDate,
      },
      byCategory: {} as Record<string, { symbols: number; records: number }>,
    }

    // Calculate per-category stats
    for (const cat of categoriesToFetch.length > 0 ? categoriesToFetch : [category as Category]) {
      const catSymbols = MARKET_CATEGORIES[cat]
      const catData = data?.filter(d => catSymbols.includes(d.symbol as any)) || []
      
      summary.byCategory[cat] = {
        symbols: catSymbols.length,
        records: catData.length,
      }
    }

    console.log(`✅ Retrieved ${summary.totalRecords} records for ${summary.symbolsWithData}/${summary.totalSymbols} symbols`)

    if (missingSymbols.length > 0 && missingSymbols.length <= 10) {
      console.log(`⚠️  Missing data for: ${missingSymbols.join(", ")}`)
    } else if (missingSymbols.length > 10) {
      console.log(`⚠️  Missing data for ${missingSymbols.length} symbols`)
    }

    return NextResponse.json({
      success: true,
      data: groupedData,
      summary,
      metadata: {
        category,
        timestamp: new Date().toISOString(),
        source: "database",
        missingSymbols: missingSymbols.length > 0 ? missingSymbols : undefined,
      },
    })
  } catch (error: any) {
    console.error("Market data API error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    )
  }
}
