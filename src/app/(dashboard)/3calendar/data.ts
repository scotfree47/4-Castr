import { type CalendarEvent } from "./types"
import eventsData from "./data/events.json"

// Regular calendar events (meetings, appointments, etc.)
export const events: CalendarEvent[] = eventsData.map(event => ({
  ...event,
  date: new Date(event.date),
  type: event.type as CalendarEvent["type"]
}))

// Note: Gann moments are now generated dynamically in calendar-main.tsx
// using the getGannMomentsForRange() function from gann-calculator.ts
// This avoids storing 250,000+ pre-generated events

export const allEvents = events