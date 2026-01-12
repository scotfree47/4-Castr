// /app/api/cron/refresh-featured/route.ts
// Automated cron job to refresh featured tickers on ingress events

import { NextRequest, NextResponse } from 'next/server';
import { 
  calculateAllFeaturedTickers,
  storeFeaturedTickers,
  shouldRefreshFeatured
} from '@/lib/services/confluenceEngine';

// Vercel Cron Job Secret (set in environment variables)
const CRON_SECRET = process.env.CRON_SECRET;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/cron/refresh-featured
 * 
 * Triggered by:
 * 1. Vercel Cron (hourly check)
 * 2. Manual webhook call
 * 
 * Checks if solar ingress period changed, then recalculates featured tickers
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (security)
    const authHeader = request.headers.get('authorization');
    
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🔄 Cron: Checking if featured tickers need refresh...');

    // Check if refresh is needed
    const { shouldRefresh, reason } = await shouldRefreshFeatured();

    if (!shouldRefresh) {
      console.log(`⏭️  Cron: Skipping refresh - ${reason}`);
      return NextResponse.json({
        success: true,
        message: `No refresh needed: ${reason}`,
        refreshed: false
      });
    }

    console.log(`✅ Cron: Refresh triggered - ${reason}`);

    // Calculate new featured tickers for all categories
    const featured = await calculateAllFeaturedTickers();

    // Count total featured
    const totalFeatured = Object.values(featured).reduce(
      (sum, arr) => sum + arr.length,
      0
    );

    console.log(`📊 Cron: Calculated ${totalFeatured} featured tickers`);

    // Store to database/cache
    const allFeatured = Object.values(featured).flat();
    await storeFeaturedTickers(allFeatured);

    console.log('💾 Cron: Featured tickers stored successfully');

    return NextResponse.json({
      success: true,
      message: `Refreshed featured tickers: ${reason}`,
      refreshed: true,
      data: {
        totalFeatured,
        byCategory: {
          equity: featured.equity.length,
          commodity: featured.commodity.length,
          forex: featured.forex.length,
          crypto: featured.crypto.length,
          'rates-macro': featured['rates-macro'].length,
          stress: featured.stress.length
        },
        topFeatured: featured.equity.slice(0, 3).map(f => ({
          symbol: f.symbol,
          score: f.tradeabilityScore,
          reason: f.reason
        }))
      }
    });

  } catch (error: any) {
    console.error('❌ Cron: Error refreshing featured tickers:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Unknown error',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}