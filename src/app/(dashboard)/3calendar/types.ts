// Calendar Event - individual dates/moments on the calendar
export interface CalendarEvent {
  id: string | number
  name: string  // Primary identifier (e.g., "Summer Solstice 2025")
  date: Date
  type: "gann" | "fibonacci" | "fiscal" | "secondary fib" | "secondary gann"
  color: string
  visible: boolean
  
  // Optional meeting/event fields
  title?: string
  time?: string
  duration?: string
  attendees?: string[]
  location?: string
  description?: string
  
  // Optional Gann/Financial specific fields
  timeframe?: 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly'
  angle?: string
  category?: string
}

// Calendar - categories/groups of events (Gann, Fibonacci, Fiscal)
export interface Calendar {
  id: string
  name: string
  color: string
  visible: boolean
  type: "gann" | "fibonacci" | "fiscal"
}

// Type for raw JSON data before conversion
export interface CalendarEventJSON {
  id: string | number
  name: string
  date: string  // Date as ISO string in JSON
  type: string
  color: string
  visible: boolean
  title?: string
  time?: string
  duration?: string
  attendees?: string[]
  location?: string
  description?: string
  timeframe?: 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly'
  angle?: string
  category?: string
}