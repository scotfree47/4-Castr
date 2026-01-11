export interface CalendarEvent {
  id: string | number
  title: string
  date: Date
  time: string
  duration: string
  type: "meeting" | "event" | "personal" | "task" | "reminder"
  attendees: string[]
  location: string
  color: string
  description?: string
  timeframe?: 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly'
  angle?: string
  category?: string
}

export interface Calendar {
  id: string
  name: string
  color: string
  visible: boolean
  type: "gann" | "fibonacci" | "fiscal"
}