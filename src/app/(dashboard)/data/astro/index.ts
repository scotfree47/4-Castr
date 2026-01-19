// src/app/(dashboard)/data/astro/index.ts
// Centralized astro data exports

export * from './astro-schema'
export { default as astroEvents } from './events.json'

// Utility functions for astro data (if needed in future)
export const getEventsInRange = (startDate: string, endDate: string) => {
  // This would filter events.json by date range
  // Currently events.json is empty, but structure is ready
  return []
}

export const getEventsByType = (type: string) => {
  // Filter by event type (lunar_phase, retrograde, etc.)
  return []
}