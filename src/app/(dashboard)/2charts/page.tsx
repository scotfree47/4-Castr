import { GrowthBreakdown } from "./components/growth-breakdown"
import { MarketInsights } from "./components/market-insights"
import { TrendPath } from "./components/trend-path"
import { TtmReturn } from "./components/ttm-return"

export default function Charts() {
  return (
    <div className="flex-1 space-y-6 px-6 pt-0">
      {/* Enhanced Header */}
      <div className="flex md:flex-row flex-col md:items-center justify-between gap-4 md:gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Charts</h1>
          <p className="text-muted-foreground">Monitor key metrics of various tickers</p>
        </div>
      </div>

      {/* Chart Grid */}
      <div className="@container/main space-y-6">
        <TrendPath />

        <div className="grid gap-6 grid-cols-1 @5xl:grid-cols-2">
          <TtmReturn />
          <GrowthBreakdown />
        </div>

        <MarketInsights />
      </div>
    </div>
  )
}
