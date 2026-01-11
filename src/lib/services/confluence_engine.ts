// /lib/services/confluenceEngine.ts
// Automated featured symbol selection based on confluence + proximity

import { 
  calculateEnhancedLevels,
  rankSymbolsBySetup,
  type OHLCVBar,
  type SymbolRanking,
  analyzeMultiTimeframeConfluence
} from '@/lib/indicators/keyLevels';

export interface FeaturedTickerResult {
  symbol: string;
  category: string;
  sector: string;
  currentPrice: number;
  nextKeyLevel: {
    price: number;
    type: 'support' | 'resistance';
    distancePercent: number;
    daysUntil?: number; // estimated based on avg daily movement
  };
  confluenceScore: number;
  tradeabilityScore: number;
  reason: string;
  rank: number;
}

/**
 * Calculate featured tickers for a specific category
 * Uses confluence + proximity scoring to rank symbols
 */
export async function calculateFeaturedTickers(
  category: string,
  symbols: string[],
  options: {
    maxResults?: number;
    minScore?: number;
    useMultiTimeframe?: boolean;
  } = {}
): Promise<FeaturedTickerResult[]> {
  const { maxResults = 5, minScore = 50, useMultiTimeframe = false } = options;

  const symbolAnalyses: Array<{
    symbol: string;
    currentPrice: number;
    levels: any[];
  }> = [];

  // Fetch data and calculate levels for each symbol
  for (const symbol of symbols) {
    try {
      // Fetch price data from your API
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      const response = await fetch(
        `/api/${category}?startDate=${startDate}&endDate=${endDate}`
      );
      const data = await response.json();

      if (!data.success || !data.data[symbol]) {
        console.warn(`No data for ${symbol}`);
        continue;
      }

      const priceData: OHLCVBar[] = data.data[symbol].map((d: any) => ({
        time: new Date(d.date).getTime(),
        open: d.open || d.close,
        high: d.high || d.close,
        low: d.low || d.close,
        close: d.close,
        volume: d.volume || 0
      }));

      if (priceData.length === 0) continue;

      const currentPrice = priceData[priceData.length - 1].close;

      // Calculate enhanced levels with confluence
      const analysis = calculateEnhancedLevels(priceData, currentPrice, {
        swingLength: 20,
        pivotBars: 5,
        currentTime: Date.now(),
        includeGannSquare144: false,
        includeSeasonalDates: false
      });

      // Flatten all levels
      const allLevels = [
        ...analysis.gannOctaves,
        ...analysis.fibonacci,
        ...analysis.supportResistance.map(sr => ({
          price: sr.price,
          type: sr.type,
          label: sr.type,
          strength: sr.strength / 10
        }))
      ];

      symbolAnalyses.push({
        symbol,
        currentPrice,
        levels: allLevels
      });

    } catch (error) {
      console.error(`Error analyzing ${symbol}:`, error);
    }
  }

  if (symbolAnalyses.length === 0) {
    return [];
  }

  // Rank symbols by setup quality
  const rankings = rankSymbolsBySetup(symbolAnalyses, {
    maxDistancePercent: 5,
    confluenceWeight: 0.6,
    proximityWeight: 0.4
  });

  // Filter by minimum score and convert to FeaturedTickerResult
  const featured: FeaturedTickerResult[] = rankings
    .filter(r => r.score >= minScore)
    .slice(0, maxResults)
    .map((ranking, index) => {
      // Determine sector based on symbol (you can enhance this)
      const sector = determineSector(ranking.symbol, category);

      // Calculate estimated days until next level
      let daysUntil: number | undefined;
      if (ranking.nextLevel) {
        const avgDailyMove = 1.5; // You can calculate this from historical data
        daysUntil = Math.ceil(
          ranking.nextLevel.distancePercent / avgDailyMove
        );
      }

      return {
        symbol: ranking.symbol,
        category,
        sector,
        currentPrice: ranking.currentPrice,
        nextKeyLevel: ranking.nextLevel ? {
          price: ranking.nextLevel.price,
          type: ranking.nextLevel.type as 'support' | 'resistance',
          distancePercent: ranking.nextLevel.distancePercent,
          daysUntil
        } : {
          price: ranking.currentPrice,
          type: 'support',
          distancePercent: 0
        },
        confluenceScore: ranking.confluence?.score || 0,
        tradeabilityScore: ranking.score,
        reason: ranking.reason,
        rank: index + 1
      };
    });

  return featured;
}

/**
 * Calculate featured tickers across ALL categories
 */
export async function calculateAllFeaturedTickers(): Promise<{
  equity: FeaturedTickerResult[];
  commodity: FeaturedTickerResult[];
  forex: FeaturedTickerResult[];
  crypto: FeaturedTickerResult[];
  'rates-macro': FeaturedTickerResult[];
  stress: FeaturedTickerResult[];
}> {
  // Define symbols for each category
  const categories = {
    equity: ['SPY', 'QQQ', 'XLY', 'AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN'],
    commodity: ['GLD', 'USO', 'HG1!', 'GC1!', 'CL1!'],
    forex: ['EUR/USD', 'USD/JPY', 'GBP/USD'],
    crypto: ['Bitcoin', 'Ethereum', 'Solana'],
    'rates-macro': ['TLT', 'FEDFUNDS', 'CPI'],
    stress: ['VIX', 'MOVE', 'TRIN']
  };

  const results: any = {};

  for (const [category, symbols] of Object.entries(categories)) {
    try {
      results[category] = await calculateFeaturedTickers(
        category,
        symbols,
        { maxResults: 5, minScore: 50 }
      );
    } catch (error) {
      console.error(`Error calculating featured for ${category}:`, error);
      results[category] = [];
    }
  }

  return results;
}

/**
 * Helper: Determine sector from symbol
 */
function determineSector(symbol: string, category: string): string {
  // Technology
  if (['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META'].includes(symbol)) {
    return 'technology';
  }
  
  // Finance
  if (['JPM', 'BAC', 'GS', 'C', 'WFC'].includes(symbol)) {
    return 'finance';
  }
  
  // Healthcare
  if (['JNJ', 'UNH', 'PFE', 'ABBV', 'TMO'].includes(symbol)) {
    return 'healthcare';
  }
  
  // Energy
  if (['XOM', 'CVX', 'USO', 'CL1!'].includes(symbol)) {
    return 'energy';
  }
  
  // Consumer
  if (['AMZN', 'TSLA', 'WMT', 'HD', 'MCD'].includes(symbol)) {
    return 'consumer';
  }
  
  // Commodities
  if (category === 'commodity') {
    return 'real_estate'; // Using your existing sector name
  }
  
  // Crypto
  if (category === 'crypto') {
    return 'cryptocurrency';
  }
  
  // Default
  return 'unknown';
}

/**
 * Store featured tickers to database/cache
 * (You can implement Supabase storage here)
 */
export async function storeFeaturedTickers(
  featured: FeaturedTickerResult[]
): Promise<void> {
  // TODO: Store to Supabase or your preferred storage
  console.log('Storing featured tickers:', featured.length);
  
  // Example Supabase implementation:
  // const { error } = await supabaseAdmin
  //   .from('featured_tickers')
  //   .upsert(featured.map(f => ({
  //     symbol: f.symbol,
  //     category: f.category,
  //     data: f,
  //     updated_at: new Date().toISOString()
  //   })));
  
  // if (error) throw error;
}

/**
 * Check if featured tickers need refresh
 * (based on solar ingress or time elapsed)
 */
export async function shouldRefreshFeatured(): Promise<{
  shouldRefresh: boolean;
  reason: string;
}> {
  try {
    // Check current solar ingress
    const ingressRes = await fetch('/api/ingress');
    const ingressData = await ingressRes.json();
    
    if (!ingressData.success) {
      return { shouldRefresh: false, reason: 'No ingress data' };
    }
    
    const { currentStart, currentEnd } = ingressData.data;
    const now = new Date();
    const periodStart = new Date(currentStart);
    const daysSincePeriodStart = Math.floor(
      (now.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    // Refresh if:
    // 1. Just started new ingress period (< 1 day old)
    if (daysSincePeriodStart === 0) {
      return { shouldRefresh: true, reason: 'New ingress period started' };
    }
    
    // 2. Every 7 days during ingress period
    if (daysSincePeriodStart % 7 === 0) {
      return { shouldRefresh: true, reason: 'Weekly refresh' };
    }
    
    return { shouldRefresh: false, reason: 'No refresh needed' };
    
  } catch (error) {
    console.error('Error checking refresh need:', error);
    return { shouldRefresh: false, reason: 'Error checking' };
  }
}