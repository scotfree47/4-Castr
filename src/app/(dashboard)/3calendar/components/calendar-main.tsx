"use client"

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  subMonths,
} from "date-fns"
import {
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Grid3X3,
  List,
  MapPin,
  Menu,
  Search,
  Users,
} from "lucide-react"
import { useState } from "react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { getGannMomentsForRange } from "../gann-calculator"
import { type CalendarEvent } from "../types"

interface CalendarMainProps {
  selectedDate?: Date
  onDateSelect?: (date: Date) => void
  onMenuClick?: () => void
  events?: CalendarEvent[]
  onEventClick?: (event: CalendarEvent) => void
  visibleTimeframes?: Record<string, boolean>
  visibleCalendars?: Record<string, boolean>
}

export function CalendarMain({
  selectedDate,
  onDateSelect,
  onMenuClick,
  events,
  onEventClick,
  visibleTimeframes = {},
  visibleCalendars = {},
}: CalendarMainProps) {
  const [currentDate, setCurrentDate] = useState(selectedDate || new Date())
  const [viewMode, setViewMode] = useState<"month" | "week" | "day" | "list">("month")
  const [showEventDialog, setShowEventDialog] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [loading, setLoading] = useState(false)

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)

  const calendarStart = new Date(monthStart)
  calendarStart.setDate(calendarStart.getDate() - monthStart.getDay())

  const calendarEnd = new Date(monthEnd)
  calendarEnd.setDate(calendarEnd.getDate() + (6 - monthEnd.getDay()))

  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const allGannMoments = getGannMomentsForRange(calendarStart, calendarEnd)

  const filteredGannMoments = allGannMoments.filter((moment) => {
    const timeframeKey = moment.timeframe.toLowerCase()
    if (visibleTimeframes[timeframeKey] === false) return false

    const categoryToCalendar: Record<string, string> = {
      anchor: "gann moments",
      major_pivot: "gann moments",
      balance: "gann moments",
      reversal: "gann moments",
      golden_ratio: "fibonacci moments",
      fib_major: "fibonacci moments",
      angle_2x1_after_fib: "fibonacci moments",
      market_hours: "fiscal dates",
      angle_all: "secondary gann moments",
      fib_minor: "secondary fibonacci moments",
    }

    const calendarId = categoryToCalendar[moment.category] || "gann moments"
    if (visibleCalendars[calendarId] === false) return false

    return true
  })

  const sampleEvents: CalendarEvent[] = events
    ? [...events, ...(filteredGannMoments as any)]
    : (filteredGannMoments as any)

  const getEventsForDay = (date: Date) => {
    return sampleEvents.filter((event) => isSameDay(event.date, date))
  }

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

  if (loading) {
    return (
      <Card className="bg-background/40 backdrop-blur-xl border-border/40 shadow-lg">
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <CalendarIcon className="h-5 w-5" />
            <span className="font-semibold">Loading Calendar</span>
          </div>
          <Skeleton className="h-96 w-full bg-foreground/5" />
        </CardContent>
      </Card>
    )
  }

  const renderCalendarGrid = () => {
    const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

    return (
      <div className="flex-1 bg-background/20">
        <div className="grid grid-cols-7 border-b">
          {weekDays.map((day) => (
            <div
              key={day}
              className="p-4 text-center font-medium text-sm text-muted-foreground border-r last:border-r-0"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 flex-1">
          {calendarDays.map((day) => {
            const dayEvents = getEventsForDay(day)
            const momentMarkers = dayEvents.filter(isMomentMarker)
            const regularEvents = dayEvents.filter((e) => !isMomentMarker(e))
            const isCurrentMonth = isSameMonth(day, currentDate)
            const isDayToday = isToday(day)
            const isSelected = selectedDate && isSameDay(day, selectedDate)

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "min-h-[120px] border-r border-b last:border-r-0 p-2 cursor-pointer transition-all relative hover:scale-[1.01]",
                  isCurrentMonth
                    ? "bg-background hover:bg-accent/50"
                    : "bg-muted/30 text-muted-foreground",
                  isSelected && "ring-2 ring-primary ring-inset",
                  isDayToday && "bg-accent/20"
                )}
                onClick={() => onDateSelect?.(day)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      isDayToday &&
                        "bg-primary text-primary-foreground rounded-md w-6 h-6 flex items-center justify-center text-xs"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  {dayEvents.length > 3 && (
                    <span className="text-xs text-muted-foreground">+{dayEvents.length - 3}</span>
                  )}
                </div>

                <div className="space-y-1 mb-2">
                  {regularEvents.slice(0, 2).map((event) => (
                    <div
                      key={event.id}
                      className={cn(
                        "text-xs p-1 rounded-sm text-white cursor-pointer truncate transition-all hover:scale-[1.02]",
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

                {momentMarkers.length > 0 && (
                  <div className="absolute bottom-1 left-1 right-1 space-y-0.5">
                    {momentMarkers.slice(0, 3).map((marker) => (
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
      .filter((event) => event.date >= new Date())
      .sort((a, b) => a.date.getTime() - b.date.getTime())

    const groupedByDate = upcomingEvents.reduce(
      (acc, event) => {
        const dateKey = format(event.date, "yyyy-MM-dd")
        if (!acc[dateKey]) acc[dateKey] = []
        acc[dateKey].push(event)
        return acc
      },
      {} as Record<string, CalendarEvent[]>
    )

    return (
      <div className="flex-1 p-6">
        <div className="space-y-6">
          {Object.entries(groupedByDate).map(([dateKey, dateEvents]) => {
            const momentMarkers = dateEvents.filter(isMomentMarker)
            const regularEvents = dateEvents.filter((e) => !isMomentMarker(e))

            return (
              <div key={dateKey}>
                <h3 className="text-lg font-semibold mb-3">
                  {format(new Date(dateKey), "EEEE, MMMM d, yyyy")}
                </h3>

                {regularEvents.map((event) => (
                  <Card
                    key={event.id}
                    className="cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all mb-3 bg-background/40 backdrop-blur-xl border-border/40"
                    onClick={() => handleEventClick(event)}
                  >
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

                {momentMarkers.length > 0 && (
                  <Card className="mb-3 bg-background/40 backdrop-blur-xl border-border/40">
                    <CardContent className="px-4 py-3">
                      <h4 className="text-sm font-medium mb-2">Gann Moments</h4>
                      <div className="space-y-1">
                        {momentMarkers.map((marker) => (
                          <div
                            key={marker.id}
                            className="flex items-center gap-2 text-xs cursor-pointer hover:bg-accent/50 p-1 rounded transition-all"
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
      <div className="flex flex-col flex-wrap gap-4 p-6 border-b md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="xl:hidden cursor-pointer"
            onClick={onMenuClick}
          >
            <Menu className="w-4 h-4" />
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth("prev")}
              className="cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth("next")}
              className="cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday} className="cursor-pointer">
              Today
            </Button>
          </div>

          <h1 className="text-2xl font-semibold">{format(currentDate, "MMMM yyyy")}</h1>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search events..." className="pl-10 w-64" />
          </div>

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

      {viewMode === "month" ? renderCalendarGrid() : renderListView()}

      <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
        <DialogContent className="max-w-md bg-background/40 backdrop-blur-xl border-border/40 shadow-lg">
          <DialogHeader>
            <DialogTitle>{selectedEvent?.title || "Event Details"}</DialogTitle>
            <DialogDescription>
              {selectedEvent && isMomentMarker(selectedEvent)
                ? "Gann Calendar Moment"
                : "View and manage this calendar event"}
            </DialogDescription>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                <span>{format(selectedEvent.date, "EEEE, MMMM d, yyyy")}</span>
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
                <div className="text-sm text-muted-foreground">{selectedEvent.description}</div>
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
              {!isMomentMarker(selectedEvent) &&
                selectedEvent.attendees &&
                selectedEvent.attendees.length > 0 && (
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
