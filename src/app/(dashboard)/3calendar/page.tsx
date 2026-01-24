import { Calendar } from "./components/calendar"
import { TradingWindowsCalendar } from "./components/trading-windows-calendar"
import { events } from "./data"

export default function CalendarPage() {
  return (
    <div className="flex-1 space-y-6">
      <div className="flex md:flex-row flex-col md:items-center justify-between gap-4 md:gap-6">
        <div className="flex flex-col px-3 lg:px-6 gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground">Trading opportunities and astronomical events</p>
        </div>
      </div>

      {/* Trading Windows Calendar - Bi-Scaling View */}
      <div className="px-3 lg:px-6">
        <TradingWindowsCalendar defaultCategory="equity" defaultDays={30} />
      </div>

      {/* Traditional Calendar Events */}
      <div className="px-3 lg:px-6">
        <Calendar events={events} />
      </div>
    </div>
  )
}
