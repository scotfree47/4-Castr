// src/lib/api/client.ts
/**
 * Client-side API wrapper
 * Complements server-side dataProviders.js
 */

import type { ComprehensiveLevels, FutureLevelProjection } from "@/lib/hooks/useMarketData"

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = "ApiError"
  }
}

async function fetcher<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options)

  if (!response.ok) {
    throw new ApiError(response.status, `API error: ${response.statusText}`)
  }

  const data = await response.json()

  if (!data.success) {
    throw new ApiError(response.status, data.error || "Request failed")
  }

  return data.data
}

export const api = {
  levels: {
    get: async (
      symbol: string,
      params?: {
        startDate?: string
        endDate?: string
        includeFuture?: boolean
        barsToProject?: number
        swingLength?: number
        pivotBars?: number
      }
    ) => {
      const queryParams = new URLSearchParams(
        Object.entries(params || {})
          .filter(([_, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)])
      )
      return fetcher<{
        current: ComprehensiveLevels
        future?: FutureLevelProjection[]
      }>(`/api/levels/${symbol}?${queryParams}`)
    },
  },

  tickers: {
    ratings: async (params?: {
      mode?: "batch" | "single"
      minScore?: number
      category?: string
    }) => {
      // Convert params to string values for URLSearchParams
      const stringParams: Record<string, string> = {
        mode: params?.mode || "batch",
        minScore: String(params?.minScore ?? 0),
      }

      if (params?.category) {
        stringParams.category = params.category
      }

      const queryParams = new URLSearchParams(stringParams)
      return fetcher<{ ratings: any[] }>(`/api/ticker-ratings?${queryParams}`)
    },
  },
}
