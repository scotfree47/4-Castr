import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { getSupabaseAdmin } from "./supabase.js"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ============================================================================
// SYMBOL NORMALIZATION
// ============================================================================

const SYMBOL_ALIASES: Record<string, string> = {
  // Crypto → CoinGecko IDs (lowercase)
  BTC: "bitcoin",
  Bitcoin: "bitcoin",
  BITCOIN: "bitcoin",
  btc: "bitcoin",
  ETH: "ethereum",
  Ethereum: "ethereum",
  ETHEREUM: "ethereum",
  eth: "ethereum",
  SOL: "solana",
  Solana: "solana",
  SOLANA: "solana",
  sol: "solana",
  BNB: "binancecoin",
  XRP: "ripple",
  ADA: "cardano",
  AVAX: "avalanche-2",
  DOT: "polkadot",

  // Forex → slash notation
  EURUSD: "EUR/USD",
  USDJPY: "USD/JPY",
  GBPUSD: "GBP/USD",
  GBPJPY: "GBP/JPY",
  AUDUSD: "AUD/USD",
  USDCAD: "USD/CAD",

  // Commodities → 1! suffix
  GC: "GC1!",
  CL: "CL1!",
  HG: "HG1!",
  SI: "SI1!",
  NG: "NG1!",
  ZW: "ZW1!",
  ZC: "ZC1!",
}

export function normalizeSymbol(input: string, category?: string): string {
  // Check aliases first
  if (SYMBOL_ALIASES[input]) {
    return SYMBOL_ALIASES[input]
  }

  // Remove exchange prefixes (existing logic)
  const base = input.replace(/^(NYSE|NASDAQ|NYSEARCA):/, "")

  // Category-specific normalization
  if (category === "crypto") {
    return base.toLowerCase()
  }

  if (category === "forex") {
    // Convert EURUSD → EUR/USD if no slash
    if (base.length === 6 && /^[A-Z]{6}$/.test(base)) {
      return `${base.slice(0, 3)}/${base.slice(3, 6)}`
    }
    return base
  }

  if (category === "commodity") {
    // Add 1! suffix if missing
    if (/^[A-Z]{2}$/.test(base) && !base.endsWith("1!")) {
      return `${base}1!`
    }
    return base
  }

  // Default: return cleaned base
  return base
}

/**
 * Get all possible variants of a symbol for database queries
 */
export function getSymbolVariants(symbol: string, category?: string): string[] {
  const canonical = normalizeSymbol(symbol, category)
  const variants = new Set([canonical, symbol])

  // Add all aliases that map to this canonical form
  Object.entries(SYMBOL_ALIASES).forEach(([alias, target]) => {
    if (target === canonical) {
      variants.add(alias)
    }
  })

  // Category-specific variants
  if (category === "crypto") {
    variants.add(symbol.toLowerCase())
    variants.add(symbol.toUpperCase())
    variants.add(symbol.charAt(0).toUpperCase() + symbol.slice(1).toLowerCase())
  }

  if (category === "forex") {
    const noSlash = canonical.replace("/", "")
    variants.add(noSlash)
    variants.add(canonical)
  }

  if (category === "commodity") {
    const base = canonical.replace("1!", "")
    variants.add(base)
    variants.add(`${base}1!`)
  }

  return Array.from(variants)
}

/**
 * Display format: how to show symbol to users
 */
export function formatSymbolForDisplay(symbol: string, category?: string): string {
  const canonical = normalizeSymbol(symbol, category)

  if (category === "crypto") {
    // Capitalize first letter: bitcoin → Bitcoin
    return canonical.charAt(0).toUpperCase() + canonical.slice(1)
  }

  return canonical
}

// ============================================================================
// INGRESS PERIOD CALCULATIONS
// ============================================================================

export interface IngressPeriod {
  sign: string
  month: string
  start: string
  end: string
  daysInPeriod: number
  dayOfPeriod: number
  daysRemaining: number
  progress: number
  period: string // CRITICAL: Added for cache queries (format: "YYYY-MM-sign")
}

/**
 * Get current solar ingress period
 * SINGLE SOURCE OF TRUTH - use this everywhere instead of local implementations
 */
export async function getCurrentIngressPeriod(): Promise<IngressPeriod> {
  const supabase = getSupabaseAdmin()
  const today = new Date().toISOString().split("T")[0]

  // Get current ingress (most recent before today)
  const { data: current } = await supabase
    .from("astro_events")
    .select("*")
    .eq("event_type", "ingress") // IMPORTANT: 'ingress' not 'solar_ingress'
    .eq("body", "Sun")
    .lte("date", today)
    .order("date", { ascending: false })
    .limit(1)

  // Get next ingress
  const { data: next } = await supabase
    .from("astro_events")
    .select("*")
    .eq("event_type", "ingress")
    .eq("body", "Sun")
    .gt("date", today)
    .order("date", { ascending: true })
    .limit(1)

  if (!current || current.length === 0) {
    // Fallback to estimated period
    return estimateIngressPeriod(new Date())
  }

  const currentIngress = current[0]
  const nextIngress = next && next.length > 0 ? next[0] : null

  const startDate = new Date(currentIngress.date)
  const endDate = nextIngress
    ? new Date(nextIngress.date)
    : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000)
  const now = new Date()

  const daysInPeriod = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  const dayOfPeriod = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
  const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  const progress = Math.round((dayOfPeriod / daysInPeriod) * 100)

  // CRITICAL: Generate period identifier for cache lookups
  // Format: "YYYY-MM-sign" (e.g., "2026-01-aquarius")
  const period = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-${(currentIngress.sign || "unknown").toLowerCase()}`

  return {
    sign: currentIngress.sign || "Unknown",
    month: getMonthName(startDate),
    start: currentIngress.date,
    end: endDate.toISOString().split("T")[0],
    daysInPeriod,
    dayOfPeriod,
    daysRemaining,
    progress,
    period, // CRITICAL: Added for cache system
  }
}

/**
 * Fallback when database has no ingress data
 */
function estimateIngressPeriod(date: Date): IngressPeriod {
  const sign = getZodiacSign(date)
  const bounds = getIngressBounds(date, sign)

  const daysInPeriod = Math.ceil(
    (bounds.end.getTime() - bounds.start.getTime()) / (1000 * 60 * 60 * 24)
  )
  const dayOfPeriod =
    Math.floor((date.getTime() - bounds.start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  const daysRemaining = Math.ceil((bounds.end.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

  // Generate period identifier
  const period = `${bounds.start.getFullYear()}-${String(bounds.start.getMonth() + 1).padStart(2, "0")}-${sign.toLowerCase()}`

  return {
    sign,
    month: getMonthName(bounds.start),
    start: bounds.start.toISOString().split("T")[0],
    end: bounds.end.toISOString().split("T")[0],
    daysInPeriod,
    dayOfPeriod,
    daysRemaining,
    progress: Math.round((dayOfPeriod / daysInPeriod) * 100),
    period,
  }
}

function getZodiacSign(date: Date): string {
  const month = date.getMonth() + 1
  const day = date.getDate()

  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return "Aquarius"
  if ((month === 2 && day >= 19) || (month === 3 && day <= 20)) return "Pisces"
  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return "Aries"
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return "Taurus"
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return "Gemini"
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return "Cancer"
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return "Leo"
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return "Virgo"
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return "Libra"
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return "Scorpio"
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return "Sagittarius"
  return "Capricorn"
}

function getIngressBounds(date: Date, sign: string): { start: Date; end: Date } {
  const year = date.getFullYear()
  const bounds: Record<string, { month: number; day: number }> = {
    Aquarius: { month: 1, day: 20 },
    Pisces: { month: 2, day: 19 },
    Aries: { month: 3, day: 21 },
    Taurus: { month: 4, day: 20 },
    Gemini: { month: 5, day: 21 },
    Cancer: { month: 6, day: 21 },
    Leo: { month: 7, day: 23 },
    Virgo: { month: 8, day: 23 },
    Libra: { month: 9, day: 23 },
    Scorpio: { month: 10, day: 23 },
    Sagittarius: { month: 11, day: 22 },
    Capricorn: { month: 12, day: 22 },
  }

  const start = new Date(year, bounds[sign].month - 1, bounds[sign].day)
  const end = new Date(start)
  end.setDate(end.getDate() + 30)

  return { start, end }
}

function getMonthName(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long" })
}
