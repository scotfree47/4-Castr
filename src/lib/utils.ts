import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function normalizeSymbol(input: string): string {
  const ALIASES: Record<string, string[]> = {
    Bitcoin: ["BTC", "BTCUSD", "BTC-USD"],
    Ethereum: ["ETH", "ETHUSD", "ETH-USD"],
    Solana: ["SOL", "SOLUSD"],
    SPY: ["SPY.US", "NYSEARCA:SPY"],
  }

  const base = input.replace(/^(NYSE|NASDAQ|NYSEARCA):/, "")

  for (const [canonical, aliases] of Object.entries(ALIASES)) {
    if (aliases.includes(base)) return canonical
  }

  return base
}
