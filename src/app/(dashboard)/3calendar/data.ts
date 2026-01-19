import calendarsData from "./data/calendars.json"
import { type Calendar, type CalendarEvent } from "./types"

// Import calendars (Gann, Fibonacci, Fiscal categories)
export const calendars: Calendar[] = calendarsData.map((calendar) => ({
  ...calendar,
  type: calendar.type as Calendar["type"],
}))

// Empty events array since we're generating Gann/Fib moments dynamically
// or fetching them from APIs/calculations
export const events: CalendarEvent[] = []

// Export all calendars for use in components
export const allCalendars = calendars

// Helper to get calendar by ID
export const getCalendarById = (id: string) => {
  return calendars.find((cal) => cal.id === id)
}

// Helper to get visible calendars only
export const getVisibleCalendars = () => {
  return calendars.filter((cal) => cal.visible)
}
