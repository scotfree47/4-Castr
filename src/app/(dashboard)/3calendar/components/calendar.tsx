"use client"

import { useState } from "react"
import { CalendarSidebar } from "./calendar-sidebar"
import { CalendarMain } from "./calendar-main"
import { EventForm } from "./event-form"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { type CalendarEvent } from "../types"
import { useCalendar } from "../use-calendar"

interface CalendarProps {
  events: CalendarEvent[]
  eventDates?: Array<{ date: Date; count: number }>
}

export function Calendar({ events, eventDates = [] }: CalendarProps) {
  const calendar = useCalendar(events)
  const [visibleTimeframes, setVisibleTimeframes] = useState<Record<string, boolean>>({
    daily: true,
    weekly: true,
    monthly: true,
    quarterly: true,
    yearly: true,
  })
  const [visibleCalendars, setVisibleCalendars] = useState<Record<string, boolean>>({
    'gann moments': true,
    'fibonacci moments': true,
    'fiscal dates': true,
    'secondary fibonacci moments': true,
    'secondary gann moments': true,
  })

  const handleTimeframeToggle = (timeframeId: string, visible: boolean) => {
    setVisibleTimeframes(prev => ({ ...prev, [timeframeId]: visible }))
  }

  const handleCalendarToggle = (calendarId: string, visible: boolean) => {
    setVisibleCalendars(prev => ({ ...prev, [calendarId]: visible }))
  }

  return (
    <>
      <div className="border rounded-lg bg-background relative">
        <div className="flex min-h-[800px]">
          {/* Desktop Sidebar - Hidden on mobile/tablet, shown on extra large screens */}
          <div className="hidden xl:block w-80 flex-shrink-0 border-r">
            <CalendarSidebar
              selectedDate={calendar.selectedDate}
              onDateSelect={calendar.handleDateSelect}
              onNewCalendar={calendar.handleNewCalendar}
              onNewEvent={calendar.handleNewEvent}
              events={eventDates}
              className="h-full"
              onTimeframeToggle={handleTimeframeToggle}
              onCalendarToggle={handleCalendarToggle}
            />
          </div>
          
          {/* Main Calendar Panel */}
          <div className="flex-1 min-w-0">
            <CalendarMain 
              selectedDate={calendar.selectedDate}
              onDateSelect={calendar.handleDateSelect}
              onMenuClick={() => calendar.setShowCalendarSheet(true)}
              events={calendar.events}
              onEventClick={calendar.handleEditEvent}
              visibleTimeframes={visibleTimeframes}
              visibleCalendars={visibleCalendars}
            />
          </div>
        </div>

        {/* Mobile/Tablet Sheet - Positioned relative to calendar container */}
        <Sheet open={calendar.showCalendarSheet} onOpenChange={calendar.setShowCalendarSheet}>
          <SheetContent side="left" className="w-80 p-0" style={{ position: 'absolute' }}>
            <SheetHeader className="p-4 pb-2">
              <SheetTitle>Calendar</SheetTitle>
              <SheetDescription>
                Browse dates and manage your calendar events
              </SheetDescription>
            </SheetHeader>
            <CalendarSidebar
              selectedDate={calendar.selectedDate}
              onDateSelect={calendar.handleDateSelect}
              onNewCalendar={calendar.handleNewCalendar}
              onNewEvent={calendar.handleNewEvent}
              events={eventDates}
              className="h-full"
              onTimeframeToggle={handleTimeframeToggle}
              onCalendarToggle={handleCalendarToggle}
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Event Form Dialog */}
      <EventForm
        event={calendar.editingEvent}
        open={calendar.showEventForm}
        onOpenChange={calendar.setShowEventForm}
        onSave={calendar.handleSaveEvent}
        onDelete={calendar.handleDeleteEvent}
      />
    </>
  )
}