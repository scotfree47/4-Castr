"use client"

import { Plus } from "lucide-react"

import { Calendars } from "./calendars"
import { DatePicker } from "./date-picker"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

interface CalendarSidebarProps {
  selectedDate?: Date
  onDateSelect?: (date: Date) => void
  onNewCalendar?: () => void
  onNewEvent?: () => void
  events?: Array<{ date: Date; count: number }>
  className?: string
  onTimeframeToggle?: (timeframeId: string, visible: boolean) => void
  onCalendarToggle?: (calendarId: string, visible: boolean) => void
}

export function CalendarSidebar({ 
  selectedDate,
  onDateSelect,
  onNewCalendar,
  onNewEvent,
  events = [],
  className,
  onTimeframeToggle,
  onCalendarToggle,
}: CalendarSidebarProps) {
  return (
    <div className={`flex flex-col h-full bg-background rounded-lg ${className}`}>
      {/* Add New Event Button */}
      <div className="px-6 pb-6 border-b">
        <Button 
          className="w-full cursor-pointer"
          onClick={onNewEvent}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add New Event
        </Button>
      </div>

      {/* Date Picker */}
      <DatePicker
        selectedDate={selectedDate}
        onDateSelect={onDateSelect}
        events={events}
      />

      <Separator />

      {/* Calendars - Gann Moments */}
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

      {/* Footer - Optional: Add filter controls */}
      <div className="p-6 border-t">
        <div className="text-xs text-muted-foreground text-center">
          Toggle calendars to show/hide Gann moments
        </div>
      </div>
    </div>
  )
}