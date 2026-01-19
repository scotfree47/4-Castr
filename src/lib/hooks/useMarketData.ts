// hooks/useMarketData.ts
// Unified hook for all market data fetching (levels, tickers, ratings)

import { useState, useEffect, useCallback } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface ComprehensiveLevels {
  support: number[];
  resistance: number[];
  fibonacci: {
    level: number;
    ratio: string;
    type: 'support' | 'resistance';
  }[];
  pivots: {
    price: number;
    type: 'high' | 'low';
    date: string;
  }[];
}

export interface FutureLevelProjection {
  date: string;
  projectedSupport: number[];
  projectedResistance: number[];
  confidence: number;
}

export interface TickerData {
  id: number;
  ticker: string;
  sector: string;
  trend: string;
  next: string;
  last: string;
  compare: string;
  type: string;
}

interface UseLevelsOptions {
  symbol: string;
  startDate?: string;
  endDate?: string;
  includeFuture?: boolean;
  barsToProject?: number;
  swingLength?: number;
  pivotBars?: number;
  enabled?: boolean;
}

interface UseLevelsReturn {
  levels: ComprehensiveLevels | null;
  futureLevels: FutureLevelProjection[] | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

interface UseTickersReturn {
  data: TickerData[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

// ============================================================================
// LEVELS HOOK
// ============================================================================

export function useLevels(options: UseLevelsOptions): UseLevelsReturn {
  const {
    symbol,
    startDate,
    endDate,
    includeFuture = false,
    barsToProject = 50,
    swingLength = 10,
    pivotBars = 5,
    enabled = true,
  } = options;

  const [levels, setLevels] = useState<ComprehensiveLevels | null>(null);
  const [futureLevels, setFutureLevels] = useState<FutureLevelProjection[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLevels = useCallback(async () => {
    if (!enabled || !symbol) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
        ...(includeFuture && { includeFuture: 'true' }),
        barsToProject: barsToProject.toString(),
        swingLength: swingLength.toString(),
        pivotBars: pivotBars.toString(),
      });

      const response = await fetch(`/api/levels/${symbol}?${params}`);
      const data = await response.json();

      if (data.success) {
        setLevels(data.data.current);
        setFutureLevels(data.data.future || null);
      } else {
        setError(data.error || 'Failed to fetch levels');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [symbol, startDate, endDate, includeFuture, barsToProject, swingLength, pivotBars, enabled]);

  useEffect(() => {
    fetchLevels();
  }, [fetchLevels]);

  return {
    levels,
    futureLevels,
    isLoading,
    error,
    refetch: fetchLevels,
  };
}

// ============================================================================
// TICKERS HOOK
// ============================================================================

export function useTickersData(): UseTickersReturn {
  const [data, setData] = useState<TickerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTickersData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log("📄 Loading all tickers data...");

      const response = await fetch(
        `/api/ticker-ratings?mode=batch&minScore=0`,
        {
          headers: {
            "Cache-Control": "no-cache",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to load tickers");
      }

      const ratings = result.data.ratings || [];
      const transformedData: TickerData[] = ratings.map((rating: any, index: number) => ({
        id: index + 1,
        ticker: rating.symbol,
        sector: rating.sector,
        trend: rating.recommendation === 'strong_buy' || rating.recommendation === 'buy' 
          ? 'bullish' 
          : rating.recommendation === 'strong_sell' || rating.recommendation === 'sell'
          ? 'bearish'
          : 'neutral',
        next: rating.nextKeyLevel.price.toFixed(2),
        last: rating.currentPrice.toFixed(2),
        compare: 'Ticker(s)',
        type: rating.category,
      }));

      console.log(`✅ Loaded ${transformedData.length} tickers`);
      setData(transformedData);
    } catch (err: any) {
      console.error("❌ Error loading tickers:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTickersData();
  }, [loadTickersData]);

  return {
    data,
    loading,
    error,
    refresh: loadTickersData,
  };
}

// ============================================================================
// UNIFIED MARKET DATA HOOK (ADVANCED)
// ============================================================================

interface UseMarketDataOptions {
  symbols?: string[];
  category?: string;
  minScore?: number;
  includeHistorical?: boolean;
  includeFutureLevels?: boolean;
}

interface UseMarketDataReturn {
  tickers: TickerData[];
  levels: Record<string, ComprehensiveLevels>;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useMarketData(options: UseMarketDataOptions = {}): UseMarketDataReturn {
  const {
    symbols = [],
    category,
    minScore = 0,
    includeHistorical = false,
    includeFutureLevels = false,
  } = options;

  const [tickers, setTickers] = useState<TickerData[]>([]);
  const [levels, setLevels] = useState<Record<string, ComprehensiveLevels>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMarketData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch ticker ratings
      const params = new URLSearchParams({
        mode: 'batch',
        minScore: minScore.toString(),
        ...(category && { category }),
      });

      const response = await fetch(`/api/ticker-ratings?${params}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to load market data');
      }

      const ratings = result.data.ratings || [];
      
      // Transform to ticker data
      const tickerData: TickerData[] = ratings.map((rating: any, index: number) => ({
        id: index + 1,
        ticker: rating.symbol,
        sector: rating.sector,
        trend: rating.recommendation === 'strong_buy' || rating.recommendation === 'buy' 
          ? 'bullish' 
          : rating.recommendation === 'strong_sell' || rating.recommendation === 'sell'
          ? 'bearish'
          : 'neutral',
        next: rating.nextKeyLevel.price.toFixed(2),
        last: rating.currentPrice.toFixed(2),
        compare: 'Ticker(s)',
        type: rating.category,
      }));

      setTickers(tickerData);

      // Optionally fetch levels for each symbol
      if (symbols.length > 0 || includeHistorical) {
        const levelsData: Record<string, ComprehensiveLevels> = {};
        
        const symbolsToFetch = symbols.length > 0 
          ? symbols 
          : ratings.slice(0, 10).map((r: any) => r.symbol);

        await Promise.all(
          symbolsToFetch.map(async (symbol) => {
            try {
              const levelsParams = new URLSearchParams({
                ...(includeFutureLevels && { includeFuture: 'true' }),
              });

              const levelsResponse = await fetch(`/api/levels/${symbol}?${levelsParams}`);
              const levelsResult = await levelsResponse.json();

              if (levelsResult.success) {
                levelsData[symbol] = levelsResult.data.current;
              }
            } catch (err) {
              console.warn(`Failed to fetch levels for ${symbol}:`, err);
            }
          })
        );

        setLevels(levelsData);
      }

    } catch (err: any) {
      console.error('❌ Error loading market data:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [symbols, category, minScore, includeHistorical, includeFutureLevels]);

  useEffect(() => {
    fetchMarketData();
  }, [fetchMarketData]);

  return {
    tickers,
    levels,
    isLoading,
    error,
    refetch: fetchMarketData,
  };
}
