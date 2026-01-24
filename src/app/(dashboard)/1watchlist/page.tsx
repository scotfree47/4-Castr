"use client"

import { SentinelsOverview } from "../components/sentinels-overview"
import { PreviouslyFeatured } from "./components/previously-featured"
import { FeaturedTickers } from "./components/featured-tickers"
import { SectionCards } from "./components/section-cards"
import { FloatingActionMenu } from "@/components/floating-action-menu"
import { TradingWindowMonitor } from "@/components/trading-window-monitor"
import { getHighConfidenceTickers } from "../data"
import { useState } from "react"

export default function Watchlist() {
  const [selectedCategory, setSelectedCategory] = useState<string>("equity")

  return (
    <div className="flex-1 space-y-6 px-6 pt-0">
        {/* Background notification monitor */}
        <TradingWindowMonitor />

        {/* Enhanced Header */}
        <div className="flex md:flex-row flex-col md:items-center justify-between gap-4 md:gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Watchlist</h1>
            <p className="text-muted-foreground">
              Monitor ticker momentum
            </p>
          </div>
        </div>

        {/* Main Dashboard Grid */}
        <div className="@container/main space-y-6">
          {/* Top Row - Sentinels with Trading Windows */}
          <SentinelsOverview onCategoryChange={setSelectedCategory} />

          {/* Second Row - Charts in 6-6 columns */}
          <div className="grid gap-6 grid-cols-1 @5xl:grid-cols-2">
            <FeaturedTickers category={selectedCategory} />
            <PreviouslyFeatured />
          </div>

          {/* Third Row - Customer Insights and Team Performance */}
          <SectionCards />
          
          <FloatingActionMenu />

          {/* Old Third Row - Two Column Layout
          <div className="grid gap-6 grid-cols-1 @5xl:grid-cols-2">
            <RecentTransactions />
            <TopProducts />
          </div>
          */}

        </div>
      </div>
  )
}

{/*}
const featuredTickers = getHighConfidenceTickers(80) // Top confidence
const bullishTickers = getBullishTickers()
*/}

{/*
export default function Watchlist() 
  
  return (
    
    <div className="flex-1 space-y-6 px-6 pt-0">
      
      // Enhanced Header //
      <div className="flex md:flex-row flex-col md:items-center justify-between gap-4 md:gap-6">
        
        <div className="flex flex-col gap-2">
          
          <h1 className="text-2xl font-bold tracking-tight">Watchlist</h1>
          
          <p className="text-muted-foreground">Monitor momentum of various tickers</p>

        </div>
      
      </div>

      // Watchlist Grid //
      <div className="@container/main space-y-6">
          
        // Top Row - Key Metrics 
        <SentinelsOverview />
        
          // Second Row - Two Column x Two Row Flex Layout //
          <div className="grid gap-6 grid-cols-1 @5xl:grid-cols-2">
            
            <FeaturedTickers />
            <PreviouslyFeatured />
            
          </div>
        
        // Third Row - Charts in 6-6 columns //
        <div className="@container/main space-y-6">
        
          <SectionCards />

        </div>
        
      </div>

    </div>
    
  )

*/}