"use client"

import { FloatingActionMenu } from "@/components/floating-action-menu"
import { TradingWindowMonitor } from "@/components/trading-window-monitor"
import { useState } from "react"
import SentinelsOverview from "../components/sentinels-overview"
import { FeaturedTickers } from "./components/featured-tickers"
import { PreviouslyFeatured } from "./components/previously-featured"
import { SectionCards } from "./components/section-cards"

export default function Watchlist() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all") // ✅ Changed from "equity" to "all"

  return (
    <div className="flex-1 space-y-6 px-6 pt-0">
      {/* Background notification monitor */}
      <TradingWindowMonitor />

      {/* Enhanced Header */}
      <div className="flex md:flex-row flex-col md:items-center justify-between gap-4 md:gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Watchlist</h1>
          <p className="text-muted-foreground">Monitor ticker momentum</p>
        </div>
      </div>

      {/* Main Dashboard Grid */}
      <div className="@container/main space-y-6">
        {/* Top Row - Sentinels with Trading Windows */}
        <SentinelsOverview />

        {/* Second Row - Charts in 6-6 columns */}
        <div className="grid gap-6 grid-cols-1 @5xl:grid-cols-2">
          <FeaturedTickers category={selectedCategory} />
          <PreviouslyFeatured />
        </div>

        {/* Third Row - Customer Insights and Team Performance */}
        <SectionCards />

        <FloatingActionMenu />
      </div>
    </div>
  )
}
