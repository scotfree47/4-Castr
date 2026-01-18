// lib/hooks/useLevels.ts
// React hook for fetching and caching key levels

import { useState, useEffect } from 'react';
import type { ComprehensiveLevels, FutureLevelProjection } from '@/lib/indicators/keyLevels';

interface UseLevelsOptions {
  symbol: string;
  startDate?: string;
  endDate?: string;
  includeFuture?: boolean;
  barsToProject?: number;
  swingLength?: number;
  pivotBars?: number;
  enabled?: boolean; // Allow conditional fetching
}

interface UseLevelsReturn {
  levels: ComprehensiveLevels | null;
  futureLevels: FutureLevelProjection[] | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

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

  const fetchLevels = async () => {
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
  };

  useEffect(() => {
    fetchLevels();
  }, [symbol, startDate, endDate, includeFuture, enabled]);

  return {
    levels,
    futureLevels,
    isLoading,
    error,
    refetch: fetchLevels,
  };
}