import { AlertPreferences } from "@/components/alert-preferences"
import { TradingWindowMonitor } from "@/components/trading-window-monitor"

export default function AlertsPage() {
  return (
    <div className="flex-1 space-y-6 px-6 pt-0">
      {/* Background notification monitor */}
      <TradingWindowMonitor />

      {/* Enhanced Header */}
      <div className="flex md:flex-row flex-col md:items-center justify-between gap-4 md:gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Trading Alerts</h1>
          <p className="text-muted-foreground">
            Configure notifications for high-probability trading windows
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="@container/main space-y-6">
        <AlertPreferences />
      </div>
    </div>
  )
}
