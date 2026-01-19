// src/app/(dashboard)/2charts/schemas/task-schema.ts
import { z } from "zod"

// Flexible key level schema
const keyLevelSchema = z.union([
  z.string(), // Simple string like "$150.25"
  z.object({
    price: z.number(),
    type: z.enum(["support", "resistance"]),
    distancePercent: z.number().optional(),
    distancePoints: z.number().optional(),
    daysUntilEstimate: z.number().optional(),
    confidence: z.number().optional(),
  }),
])

export const taskSchema = z.object({
  id: z.union([z.string(), z.number()]),
  ticker: z.string(),
  sector: z.string(),
  trend: z.enum(["bullish", "bearish", "neutral", "favorable", "unfavorable"]),
  next: keyLevelSchema,
  last: keyLevelSchema,
  compare: z.string(),
  type: z.enum(["equity", "commodity", "forex", "crypto", "rates-macro", "stress"]),
})

export type Task = z.infer<typeof taskSchema>

// Helper: Convert ticker rating to task format
export function ratingToTask(rating: any): Task {
  return {
    id: rating.symbol,
    ticker: rating.symbol,
    sector: rating.sector || "Unknown",
    trend:
      rating.recommendation === "strong_buy" || rating.recommendation === "buy"
        ? "bullish"
        : rating.recommendation === "sell" || rating.recommendation === "strong_sell"
          ? "bearish"
          : "neutral",
    next: rating.nextKeyLevel || `$${rating.currentPrice?.toFixed(2) || "0.00"}`,
    last: rating.previousKeyLevel || `$${rating.currentPrice?.toFixed(2) || "0.00"}`,
    compare: "Ticker(s)",
    type: rating.category || "equity",
  }
}

// Helper: Convert legacy ticker data to task format
export function tickerToTask(ticker: any): Task {
  return {
    id: ticker.id?.toString() || ticker.ticker || ticker.symbol,
    ticker: ticker.ticker || ticker.symbol,
    sector: ticker.sector || "Unknown",
    trend: ticker.trend || "neutral",
    next: ticker.next || `$0.00`,
    last: ticker.last || `$0.00`,
    compare: ticker.compare || "Ticker(s)",
    type: ticker.type || ticker.category || "equity",
  }
}
