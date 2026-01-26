import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ============================================================================
// SYMBOL NORMALIZATION (Enhanced from existing)
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
