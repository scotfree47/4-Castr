import { z } from "zod"

// Main ticker schema matching your actual data.json structure
export const tickerSchema = z.object({
  id: z.union([z.string(), z.number()]), // Allow both string and number
  ticker: z.string(),
  sector: z.string(),
  type: z.string(), // "commodity", "stock", "etf", "crypto", "forex"
  trend: z.string(), // "favorable", "unfavorable", "bullish", "bearish"
  next: z.union([z.string(), z.number()]), // Your next key price
  last: z.union([z.string(), z.number()]), // Your previous key price
  compare: z.string().optional(),
  confidenceScore: z.number().optional(), // Optional until you add it to data
})

export type Ticker = z.infer<typeof tickerSchema>

// Utility types
export type TickerType = "stock" | "etf" | "crypto" | "forex" | "commodity"
export type Trend = "bullish" | "bearish" | "favorable" | "unfavorable"

// Type guards and utilities
export const isFavorable = (ticker: Ticker): boolean => 
  ticker.trend === "favorable" || ticker.trend === "bullish"

export const isUnfavorable = (ticker: Ticker): boolean => 
  ticker.trend === "unfavorable" || ticker.trend === "bearish"

export const hasConfidenceScore = (ticker: Ticker): boolean => 
  ticker.confidenceScore !== undefined && ticker.confidenceScore !== null

export const getConfidenceScore = (ticker: Ticker): number => 
  ticker.confidenceScore ?? 0

export const hasHighConfidence = (ticker: Ticker, threshold = 70): boolean => 
  getConfidenceScore(ticker) >= threshold

// Convert next/last to numbers safely
export const getNextPrice = (ticker: Ticker): number => {
  const val = typeof ticker.next === 'string' ? parseFloat(ticker.next) : ticker.next
  return isNaN(val) ? 0 : val
}

export const getLastPrice = (ticker: Ticker): number => {
  const val = typeof ticker.last === 'string' ? parseFloat(ticker.last) : ticker.last
  return isNaN(val) ? 0 : val
}