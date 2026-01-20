"use client"

import { ChevronRight, Eye, EyeOff } from "lucide-react"
import { useState } from "react"

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

// Import Gann calendar configuration
import calendarsData from "../data/calendars.json"

interface CalendarItem {
  id: string
  name: string
  color: string
  visible: boolean
  type: string
}

interface TimeframeItem {
  id: string
  name: string
  visible: boolean
  timeframe: "Daily" | "Weekly" | "Monthly" | "Quarterly" | "Yearly"
}

interface CalendarsProps {
  onCalendarToggle?: (calendarId: string, visible: boolean) => void
  onTimeframeToggle?: (timeframeId: string, visible: boolean) => void
}

// Timeframe toggles for Gann moments
const TIMEFRAME_TOGGLES: TimeframeItem[] = [
  { id: "daily", name: "Daily", visible: true, timeframe: "Daily" },
  { id: "weekly", name: "Weekly", visible: true, timeframe: "Weekly" },
  { id: "monthly", name: "Monthly", visible: true, timeframe: "Monthly" },
  { id: "quarterly", name: "Quarterly", visible: true, timeframe: "Quarterly" },
  { id: "yearly", name: "Yearly", visible: true, timeframe: "Yearly" },
]

export function Calendars({ onCalendarToggle, onTimeframeToggle }: CalendarsProps) {
  // Initialize with Gann calendar data
  const [calendarData, setCalendarData] = useState<CalendarItem[]>(
    calendarsData.map((cal) => ({
      id: cal.id,
      name: cal.name,
      color: cal.color,
      visible: cal.visible,
      type: cal.type,
    }))
  )

  // Initialize timeframe toggles
  const [timeframeData, setTimeframeData] = useState<TimeframeItem[]>(TIMEFRAME_TOGGLES)

  const handleToggleVisibility = (calendarId: string) => {
    setCalendarData((prev) =>
      prev.map((item) => (item.id === calendarId ? { ...item, visible: !item.visible } : item))
    )

    const calendar = calendarData.find((c) => c.id === calendarId)
    if (calendar) {
      onCalendarToggle?.(calendarId, !calendar.visible)
    }
  }

  const handleToggleTimeframe = (timeframeId: string) => {
    setTimeframeData((prev) =>
      prev.map((item) => (item.id === timeframeId ? { ...item, visible: !item.visible } : item))
    )

    const timeframe = timeframeData.find((t) => t.id === timeframeId)
    if (timeframe) {
      onTimeframeToggle?.(timeframeId, !timeframe.visible)
    }
  }

  // Group calendars by type
  const gannMoments = calendarData.filter((cal) => cal.type === "gann")
  const fibonacciMoments = calendarData.filter((cal) => cal.type === "fibonacci")
  const fiscalDates = calendarData.filter((cal) => cal.type === "fiscal")

  return (
    <div className="space-y-4 pb-4">
      {/* Timeframe Toggles */}
      <div>
        <Collapsible defaultOpen className="group/collapsible">
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-accent hover:text-accent-foreground rounded-md cursor-pointer">
            <span className="text-sm font-medium">Timeframes</span>
            <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="mt-2 space-y-1">
              {timeframeData.map((item) => (
                <div key={item.id} className="group/timeframe-item">
                  <div className="flex items-center justify-between p-2 hover:bg-accent/50 rounded-md">
                    <div className="flex items-center gap-3 flex-1">
                      {/* Timeframe Name */}
                      <span
                        className={cn(
                          "flex-1 truncate text-sm",
                          !item.visible && "text-muted-foreground"
                        )}
                      >
                        {item.name}
                      </span>

                      {/* Visibility Toggle on Hover */}
                      <button
                        onClick={() => handleToggleTimeframe(item.id)}
                        className="opacity-0 group-hover/timeframe-item:opacity-100 cursor-pointer hover:bg-accent rounded-sm p-1 transition-opacity"
                      >
                        {item.visible ? (
                          <Eye className="h-3 w-3 text-muted-foreground" />
                        ) : (
                          <EyeOff className="h-3 w-3 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Calendar Type Toggles - Combined */}
      <div>
        <Collapsible defaultOpen className="group/collapsible">
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-accent hover:text-accent-foreground rounded-md cursor-pointer">
            <span className="text-sm font-medium">Types</span>
            <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="mt-2 space-y-1">
              {/* Gann Moments */}
              {gannMoments.map((item) => (
                <div key={item.id} className="group/calendar-item">
                  <div className="flex items-center justify-between p-2 hover:bg-accent/50 rounded-md">
                    <div className="flex items-center gap-3 flex-1">
                      {/* Color Indicator */}
                      <div className={cn("w-3 h-3 rounded-full", item.color)} />

                      {/* Calendar Name */}
                      <span
                        className={cn(
                          "flex-1 truncate text-sm",
                          !item.visible && "text-muted-foreground"
                        )}
                      >
                        {item.name}
                      </span>

                      {/* Visibility Toggle on Hover */}
                      <button
                        onClick={() => handleToggleVisibility(item.id)}
                        className="opacity-0 group-hover/calendar-item:opacity-100 cursor-pointer hover:bg-accent rounded-sm p-1 transition-opacity"
                      >
                        {item.visible ? (
                          <Eye className="h-3 w-3 text-muted-foreground" />
                        ) : (
                          <EyeOff className="h-3 w-3 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Separator */}
              {gannMoments.length > 0 && fibonacciMoments.length > 0 && (
                <div className="flex items-center gap-2 px-2 py-2">
                  <Separator className="flex-1" />
                </div>
              )}

              {/* Fibonacci Moments */}
              {fibonacciMoments.map((item) => (
                <div key={item.id} className="group/calendar-item">
                  <div className="flex items-center justify-between p-2 hover:bg-accent/50 rounded-md">
                    <div className="flex items-center gap-3 flex-1">
                      <div className={cn("w-3 h-3 rounded-full", item.color)} />
                      <span
                        className={cn(
                          "flex-1 truncate text-sm",
                          !item.visible && "text-muted-foreground"
                        )}
                      >
                        {item.name}
                      </span>
                      <button
                        onClick={() => handleToggleVisibility(item.id)}
                        className="opacity-0 group-hover/calendar-item:opacity-100 cursor-pointer hover:bg-accent rounded-sm p-1 transition-opacity"
                      >
                        {item.visible ? (
                          <Eye className="h-3 w-3 text-muted-foreground" />
                        ) : (
                          <EyeOff className="h-3 w-3 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Separator */}
              {fibonacciMoments.length > 0 && fiscalDates.length > 0 && (
                <div className="flex items-center gap-2 px-2 py-2">
                  <Separator className="flex-1" />
                </div>
              )}

              {/* Fiscal Dates */}
              {fiscalDates.map((item) => (
                <div key={item.id} className="group/calendar-item">
                  <div className="flex items-center justify-between p-2 hover:bg-accent/50 rounded-md">
                    <div className="flex items-center gap-3 flex-1">
                      <div className={cn("w-3 h-3 rounded-full", item.color)} />
                      <span
                        className={cn(
                          "flex-1 truncate text-sm",
                          !item.visible && "text-muted-foreground"
                        )}
                      >
                        {item.name}
                      </span>
                      <button
                        onClick={() => handleToggleVisibility(item.id)}
                        className="opacity-0 group-hover/calendar-item:opacity-100 cursor-pointer hover:bg-accent rounded-sm p-1 transition-opacity"
                      >
                        {item.visible ? (
                          <Eye className="h-3 w-3 text-muted-foreground" />
                        ) : (
                          <EyeOff className="h-3 w-3 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  )
}
