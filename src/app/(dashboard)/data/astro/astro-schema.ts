import { z } from "zod"

// Astro event types
export const astroEventSchema = z.object({
  id: z.string(),
  date: z.string(), // ISO date format
  type: z.enum([
    "lunar_phase",
    "retrograde",
    "ingress",
    "aspect",
    "seasonal_anchor"
  ]),
  planet: z.string().optional(), // e.g., "Mercury", "Venus"
  phase: z.string().optional(), // e.g., "Full Moon", "New Moon"
  description: z.string(),
  significance: z.enum(["high", "medium", "low"]).optional(),
})

export type AstroEvent = z.infer<typeof astroEventSchema>

// Utility types
export type AstroEventType = 
  | "lunar_phase" 
  | "retrograde" 
  | "ingress" 
  | "aspect" 
  | "seasonal_anchor"

// Type guards
export const isLunarEvent = (event: AstroEvent): boolean => 
  event.type === "lunar_phase"

export const isRetrograde = (event: AstroEvent): boolean => 
  event.type === "retrograde"

export const isHighSignificance = (event: AstroEvent): boolean => 
  event.significance === "high"