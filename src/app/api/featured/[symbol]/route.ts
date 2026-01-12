// /app/api/featured/[category]/route.ts
// API endpoint to fetch featured tickers for a specific category

import { NextRequest, NextResponse } from 'next/server';
import { calculateFeaturedTickers } from '@/lib/services/confluenceEngine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Symbol lists by category
const CATEGORY_SYMBOLS: Record<string, string[]> = {
  equity: ['SPY', 'QQQ', 'XLY', 'AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'GOOGL', 'META'],
  commodity: ['GLD', 'USO', 'HG1!', 'GC1!', 'CL1!', 'SI1!', 'NG1!'],
  forex: ['EUR/USD', 'USD/JPY', 'GBP/USD', 'GBP/JPY', 'AUD/USD'],
  crypto: ['Bitcoin', 'Ethereum', 'Solana', 'BNB', 'XRP'],
  'rates-macro': ['TLT', 'FEDFUNDS', 'CPI', 'TNX', 'DXY'],
  stress: ['VIX', 'MOVE', 'TRIN', 'VVIX', 'BVOL']
};

export async function GET(
  request: NextRequest,
  { params }: { params: { category: string } }
) {
  try {
    const { category } = params;

    // Validate category
    if (!CATEGORY_SYMBOLS[category]) {
      return NextResponse.json(
        { success: false, error: 'Invalid category' },
        { status: 400 }
      );
    }

    // Get symbols for this category
    const symbols = CATEGORY_SYMBOLS[category];

    // Calculate featured tickers
    const featured = await calculateFeaturedTickers(category, symbols, {
      maxResults: 5,
      minScore: 50,
      useMultiTimeframe: false
    });

    return NextResponse.json({
      success: true,
      data: featured,
      metadata: {
        category,
        totalSymbols: symbols.length,
        featuredCount: featured.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('Error fetching featured tickers:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to fetch featured tickers' 
      },
      { status: 500 }
    );
  }
}

/**
 * POST endpoint for manual refresh trigger
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { category: string } }
) {
  try {
    const { category } = params;

    if (!CATEGORY_SYMBOLS[category]) {
      return NextResponse.json(
        { success: false, error: 'Invalid category' },
        { status: 400 }
      );
    }

    const symbols = CATEGORY_SYMBOLS[category];
    const featured = await calculateFeaturedTickers(category, symbols, {
      maxResults: 5,
      minScore: 40, // Slightly lower threshold for manual refresh
      useMultiTimeframe: false
    });

    return NextResponse.json({
      success: true,
      message: 'Featured tickers refreshed',
      data: featured
    });

  } catch (error: any) {
    console.error('Error refreshing featured tickers:', error);
    
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}