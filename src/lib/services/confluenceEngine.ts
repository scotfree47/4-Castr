// /lib/services/confluenceEngine.ts
// Automated featured symbol selection based on confluence + proximity

import { supabaseAdmin } from '@/lib/supabase';
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
    daysUntil?: number;
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

  // Calculate date range
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  // Fetch data and calculate levels for each symbol
  for (const symbol of symbols) {
    try {
      // Direct DB access instead of fetch
      const { data: priceRecords, error } = await supabaseAdmin
        .from('financial_data')
        .select('*')
        .eq('symbol', symbol)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (error || !priceRecords || priceRecords.length === 0) {
        console.warn(`No data for ${symbol}:`, error?.message);
        continue;
      }

      const priceData: OHLCVBar[] = priceRecords.map((d: any) => ({
        time: new Date(d.date).getTime(),
        open: d.open || d.close,
        high: d.high || d.close,
        low: d.low || d.close,
        close: d.close,
        volume: d.volume || 0
      }));

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
      const sector = determineSector(ranking.symbol, category);

      // Calculate estimated days until next level
      let daysUntil: number | undefined;
      if (ranking.nextLevel) {
        const avgDailyMove = 1.5;
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
    return 'real_estate';
  }
  
  // Crypto
  if (category === 'crypto') {
    return 'cryptocurrency';
  }
  
  return 'unknown';
}

/**
 * Store featured tickers to database/cache
 */
export async function storeFeaturedTickers(
  featured: FeaturedTickerResult[]
): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from('featured_tickers')
      .upsert(
        featured.map(f => ({
          symbol: f.symbol,
          category: f.category,
          sector: f.sector,
          current_price: f.currentPrice,
          next_key_level_price: f.nextKeyLevel.price,
          next_key_level_type: f.nextKeyLevel.type,
          distance_percent: f.nextKeyLevel.distancePercent,
          days_until: f.nextKeyLevel.daysUntil,
          confluence_score: f.confluenceScore,
          tradeability_score: f.tradeabilityScore,
          reason: f.reason,
          rank: f.rank,
          updated_at: new Date().toISOString()
        })),
        { onConflict: 'symbol,category' }
      );
    
    if (error) {
      console.error('Error storing featured tickers:', error);
      throw error;
    }
    
    console.log(`✓ Stored ${featured.length} featured tickers`);
  } catch (error) {
    console.error('Failed to store featured tickers:', error);
    throw error;
  }
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
    const today = new Date().toISOString().split('T')[0];
    
    // Direct DB access for ingress data
    const { data: ingressData, error } = await supabaseAdmin
      .from('astro_events')
      .select('*')
      .eq('event_type', 'solar_ingress')
      .lte('event_date', today)
      .order('event_date', { ascending: false })
      .limit(2);
    
    if (error || !ingressData || ingressData.length === 0) {
      console.error('Error fetching ingress:', error);
      return { shouldRefresh: false, reason: 'No ingress data' };
    }
    
    const currentIngress = ingressData[0];
    const now = new Date();
    const periodStart = new Date(currentIngress.event_date);
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
    
    // 3. Check last update from featured_tickers table
    const { data: lastUpdate } = await supabaseAdmin
      .from('featured_tickers')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();
    
    if (!lastUpdate) {
      return { shouldRefresh: true, reason: 'No existing featured data' };
    }
    
    const lastUpdateDate = new Date(lastUpdate.updated_at);
    const hoursSinceUpdate = Math.floor(
      (now.getTime() - lastUpdateDate.getTime()) / (1000 * 60 * 60)
    );
    
    // 4. Force refresh if data is older than 24 hours
    if (hoursSinceUpdate >= 24) {
      return { shouldRefresh: true, reason: 'Data older than 24 hours' };
    }
    
    return { shouldRefresh: false, reason: 'No refresh needed' };
    
  } catch (error) {
    console.error('Error checking refresh need:', error);
    return { shouldRefresh: false, reason: 'Error checking' };
  }
}

/**
 * Get current featured tickers from storage
 */
export async function getFeaturedTickers(
  category?: string
): Promise<FeaturedTickerResult[]> {
  try {
    let query = supabaseAdmin
      .from('featured_tickers')
      .select('*')
      .order('rank', { ascending: true });
    
    if (category) {
      query = query.eq('category', category);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      return [];
    }
    
    return data.map(d => ({
      symbol: d.symbol,
      category: d.category,
      sector: d.sector,
      currentPrice: d.current_price,
      nextKeyLevel: {
        price: d.next_key_level_price,
        type: d.next_key_level_type,
        distancePercent: d.distance_percent,
        daysUntil: d.days_until
      },
      confluenceScore: d.confluence_score,
      tradeabilityScore: d.tradeability_score,
      reason: d.reason,
      rank: d.rank
    }));
    
  } catch (error) {
    console.error('Error fetching featured tickers:', error);
    return [];
  }
}
