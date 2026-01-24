"use client"

import { Plus, Calendar as CalendarIconLucide } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Calendars } from "./calendars"
import { DatePicker } from "./date-picker"

interface CalendarSidebarProps {
  selectedDate?: Date
  onDateSelect?: (date: Date) => void
  onNewCalendar?: () => void
  onNewEvent?: () => void
  className?: string
  onTimeframeToggle?: (timeframeId: string, visible: boolean) => void
  onCalendarToggle?: (calendarId: string, visible: boolean) => void
}

export function CalendarSidebar({
  selectedDate,
  onDateSelect,
  onNewCalendar,
  onNewEvent,
  className,
  onTimeframeToggle,
  onCalendarToggle,
}: CalendarSidebarProps) {
  return (
    <div
      className={`flex flex-col h-full bg-background/40 backdrop-blur-xl rounded-lg border-border/40 ${className}`}
    >
      <div className="px-6 pb-6 pt-6 border-b">
        <Button
          className="w-full cursor-pointer hover:scale-[1.02] transition-all shadow-lg hover:shadow-[0_0_15px_rgba(51,255,51,0.3)]"
          onClick={onNewEvent}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add New Event
        </Button>
      </div>

      <DatePicker selectedDate={selectedDate} onDateSelect={onDateSelect} />

      <Separator />

      <div className="flex-1 p-4 overflow-y-auto">
        <Calendars
          onCalendarToggle={(calendarId, visible) => {
            console.log(`Calendar ${calendarId} visibility: ${visible}`)
            onCalendarToggle?.(calendarId, visible)
          }}
          onTimeframeToggle={(timeframeId, visible) => {
            console.log(`Timeframe ${timeframeId} visibility: ${visible}`)
            onTimeframeToggle?.(timeframeId, visible)
          }}
        />
      </div>

      <div className="p-6 border-t bg-foreground/5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground text-center justify-center">
          <CalendarIconLucide className="h-3 w-3" />
          <span>Toggle calendars to show/hide Gann moments</span>
        </div>
      </div>
    </div>
  )
}
