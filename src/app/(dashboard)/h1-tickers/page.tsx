import { SentinelsOverview } from "../components/sentinels-overview"
import { Tickers } from "./components/tickers"
import { getH1Tickers } from "../data"

export default function AllTickers() {
  const tickerData = getH1Tickers()

  return (
    <div className="flex-1 space-y-6 px-6 pt-0">
      {/* Enhanced Header */}
      <div className="flex md:flex-row flex-col md:items-center justify-between gap-4 md:gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Tickers</h1>
          <p className="text-muted-foreground">Review of all sectors</p>
        </div>
      </div>

      {/* Sentinel Overview - fetches its own data from API */}
      <div className="@container/main space-y-6">
        <SentinelsOverview />
      </div>

      {/* All Tickers Data Table */}
      <div className="grid gap-6 grid-cols-1 @5xl:grid-cols-1">
        <div className="@container/main">
          <Tickers data={tickerData} />
        </div>
      </div>
    </div>
  )
}

