"use client"

import { useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Users,
  MoreHorizontal,
  Search,
  Grid3X3,
  List,
  ChevronDown,
  Menu
} from "lucide-react"
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay } from "date-fns"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { type CalendarEvent } from "../types"
import { getGannMomentsForRange } from "../gann-calculator"

interface CalendarMainProps {
  selectedDate?: Date
  onDateSelect?: (date: Date) => void
  onMenuClick?: () => void
  events?: CalendarEvent[]
  onEventClick?: (event: CalendarEvent) => void
  visibleTimeframes?: Record<string, boolean>
  visibleCalendars?: Record<string, boolean>
}

export function CalendarMain({ selectedDate, onDateSelect, onMenuClick, events, onEventClick, visibleTimeframes = {}, visibleCalendars = {} }: CalendarMainProps) {
  const [currentDate, setCurrentDate] = useState(selectedDate || new Date())
  const [viewMode, setViewMode] = useState<"month" | "week" | "day" | "list">("month")
  const [showEventDialog, setShowEventDialog] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)

  // Extend to show full weeks (including previous/next month days)
  const calendarStart = new Date(monthStart)
  calendarStart.setDate(calendarStart.getDate() - monthStart.getDay())

  const calendarEnd = new Date(monthEnd)
  calendarEnd.setDate(calendarEnd.getDate() + (6 - monthEnd.getDay()))

  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  // Generate Gann moments dynamically for the current view
  const allGannMoments = getGannMomentsForRange(calendarStart, calendarEnd)
  
  // Filter Gann moments based on visibility settings
  const filteredGannMoments = allGannMoments.filter(moment => {
    // Check timeframe visibility
    const timeframeKey = moment.timeframe.toLowerCase()
    if (visibleTimeframes[timeframeKey] === false) return false
    
    // Check calendar type visibility (based on category)
    // Map categories to calendar IDs
    const categoryToCalendar: Record<string, string> = {
      anchor: 'gann moments',
      major_pivot: 'gann moments',
      balance: 'gann moments',
      reversal: 'gann moments',
      golden_ratio: 'fibonacci moments',
      fib_major: 'fibonacci moments',
      angle_2x1_after_fib: 'fibonacci moments',
      market_hours: 'fiscal dates',
      angle_all: 'secondary gann moments',
      fib_minor: 'secondary fibonacci moments',
    }
    
    const calendarId = categoryToCalendar[moment.category] || 'gann moments'
    if (visibleCalendars[calendarId] === false) return false
    
    return true
  })
  
  // Combine with any user-provided events
  const sampleEvents: CalendarEvent[] = events 
    ? [...events, ...filteredGannMoments as any]
    : filteredGannMoments as any

  const getEventsForDay = (date: Date) => {
    return sampleEvents.filter(event => isSameDay(event.date, date))
  }

  // Check if an event is a moment marker (Gann date)
  const isMomentMarker = (event: CalendarEvent | null) => {
    if (!event) return false
    return event.duration === "moment" || event.timeframe !== undefined
  }

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate(direction === "prev" ? subMonths(currentDate, 1) : addMonths(currentDate, 1))
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const handleEventClick = (event: CalendarEvent) => {
    if (onEventClick) {
      onEventClick(event)
    } else {
      setSelectedEvent(event)
      setShowEventDialog(true)
    }
  }

  const renderCalendarGrid = () => {
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

    return (
      <div className="flex-1 bg-background">
        {/* Calendar Header */}
        <div className="grid grid-cols-7 border-b">
          {weekDays.map(day => (
            <div key={day} className="p-4 text-center font-medium text-sm text-muted-foreground border-r last:border-r-0">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Body */}
        <div className="grid grid-cols-7 flex-1">
          {calendarDays.map(day => {
            const dayEvents = getEventsForDay(day)
            const momentMarkers = dayEvents.filter(isMomentMarker)
            const regularEvents = dayEvents.filter(e => !isMomentMarker(e))
            const isCurrentMonth = isSameMonth(day, currentDate)
            const isDayToday = isToday(day)
            const isSelected = selectedDate && isSameDay(day, selectedDate)

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "min-h-[120px] border-r border-b last:border-r-0 p-2 cursor-pointer transition-colors relative",
                  isCurrentMonth ? "bg-background hover:bg-accent/50" : "bg-muted/30 text-muted-foreground",
                  isSelected && "ring-2 ring-primary ring-inset",
                  isDayToday && "bg-accent/20"
                )}
                onClick={() => onDateSelect?.(day)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={cn(
                    "text-sm font-medium",
                    isDayToday && "bg-primary text-primary-foreground rounded-md w-6 h-6 flex items-center justify-center text-xs"
                  )}>
                    {format(day, 'd')}
                  </span>
                  {dayEvents.length > 3 && (
                    <span className="text-xs text-muted-foreground">
                      +{dayEvents.length - 3}
                    </span>
                  )}
                </div>

                {/* Regular Events */}
                <div className="space-y-1 mb-2">
                  {regularEvents.slice(0, 2).map(event => (
                    <div
                      key={event.id}
                      className={cn(
                        "text-xs p-1 rounded-sm text-white cursor-pointer truncate",
                        event.color
                      )}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEventClick(event)
                      }}
                    >
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span className="truncate">{event.title}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Moment Markers - Rendered as thin horizontal lines */}
                {momentMarkers.length > 0 && (
                  <div className="absolute bottom-1 left-1 right-1 space-y-0.5">
                    {momentMarkers.slice(0, 3).map(marker => (
                      <div
                        key={marker.id}
                        className={cn(
                          "h-0.5 rounded-full cursor-pointer hover:h-1 transition-all",
                          marker.color
                        )}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEventClick(marker)
                        }}
                        title={`${marker.time} - ${marker.title}`}
                      />
                    ))}
                    {momentMarkers.length > 3 && (
                      <div className="text-[10px] text-muted-foreground text-center">
                        +{momentMarkers.length - 3} more
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderListView = () => {
    const upcomingEvents = sampleEvents
      .filter(event => event.date >= new Date())
      .sort((a, b) => a.date.getTime() - b.date.getTime())

    // Group by date
    const groupedByDate = upcomingEvents.reduce((acc, event) => {
      const dateKey = format(event.date, 'yyyy-MM-dd')
      if (!acc[dateKey]) acc[dateKey] = []
      acc[dateKey].push(event)
      return acc
    }, {} as Record<string, CalendarEvent[]>)

    return (
      <div className="flex-1 p-6">
        <div className="space-y-6">
          {Object.entries(groupedByDate).map(([dateKey, dateEvents]) => {
            const momentMarkers = dateEvents.filter(isMomentMarker)
            const regularEvents = dateEvents.filter(e => !isMomentMarker(e))
            
            return (
              <div key={dateKey}>
                <h3 className="text-lg font-semibold mb-3">
                  {format(new Date(dateKey), 'EEEE, MMMM d, yyyy')}
                </h3>
                
                {/* Regular Events */}
                {regularEvents.map(event => (
                  <Card key={event.id} className="cursor-pointer hover:shadow-md transition-shadow mb-3" onClick={() => handleEventClick(event)}>
                    <CardContent className="px-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className={cn("w-3 h-3 rounded-full mt-1.5", event.color)} />
                          <div className="flex-1">
                            <h4 className="font-medium">{event.title}</h4>
                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                              <div className="flex items-center flex-wrap gap-1">
                                <Clock className="w-4 h-4" />
                                {event.time}
                              </div>
                              {event.location && (
                                <div className="flex items-center flex-wrap gap-1">
                                  <MapPin className="w-4 h-4" />
                                  {event.location}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {/* Moment Markers List */}
                {momentMarkers.length > 0 && (
                  <Card className="mb-3">
                    <CardContent className="px-4 py-3">
                      <h4 className="text-sm font-medium mb-2">Gann Moments</h4>
                      <div className="space-y-1">
                        {momentMarkers.map(marker => (
                          <div
                            key={marker.id}
                            className="flex items-center gap-2 text-xs cursor-pointer hover:bg-accent/50 p-1 rounded"
                            onClick={() => handleEventClick(marker)}
                          >
                            <div className={cn("w-12 h-1 rounded-full", marker.color)} />
                            <span className="text-muted-foreground">{marker.time}</span>
                            <span className="flex-1">{marker.title}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-col flex-wrap gap-4 p-6 border-b md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Mobile Menu Button */}
          <Button
            variant="outline"
            size="sm"
            className="xl:hidden cursor-pointer"
            onClick={onMenuClick}
          >
            <Menu className="w-4 h-4" />
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigateMonth("prev")} className="cursor-pointer">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigateMonth("next")} className="cursor-pointer">
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday} className="cursor-pointer">
              Today
            </Button>
          </div>

          <h1 className="text-2xl font-semibold">
            {format(currentDate, 'MMMM yyyy')}
          </h1>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search events..." className="pl-10 w-64" />
          </div>

          {/* View Mode Toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="cursor-pointer">
                <Search className="w-4 h-4 mr-2" />
                Search
                <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setViewMode("month")} className="cursor-pointer">
                <Grid3X3 className="w-4 h-4 mr-2" />
                Month
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setViewMode("list")} className="cursor-pointer">
                <List className="w-4 h-4 mr-2" />
                List
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Calendar Content */}
      {viewMode === "month" ? renderCalendarGrid() : renderListView()}

      {/* Event Detail Dialog */}
      <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedEvent?.title || "Event Details"}</DialogTitle>
            <DialogDescription>
              {selectedEvent && isMomentMarker(selectedEvent) ? "Gann Calendar Moment" : "View and manage this calendar event"}
            </DialogDescription>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                <span>{format(selectedEvent.date, 'EEEE, MMMM d, yyyy')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span>{selectedEvent.time}</span>
              </div>
              {selectedEvent.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span>{selectedEvent.location}</span>
                </div>
              )}
              {selectedEvent.description && (
                <div className="text-sm text-muted-foreground">
                  {selectedEvent.description}
                </div>
              )}
              {selectedEvent.angle && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className={cn("text-white", selectedEvent.color)}>
                    {selectedEvent.angle}
                  </Badge>
                  {selectedEvent.timeframe && (
                    <Badge variant="outline">{selectedEvent.timeframe}</Badge>
                  )}
                </div>
              )}
              {!isMomentMarker(selectedEvent) && selectedEvent.attendees && selectedEvent.attendees.length > 0 && (
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <div className="flex items-center gap-2">
                    <span>Attendees:</span>
                    <div className="flex -space-x-2">
                      {selectedEvent.attendees.map((attendee: string, index: number) => (
                        <Avatar key={index} className="w-6 h-6 border-2 border-background">
                          <AvatarFallback className="text-xs">{attendee}</AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}