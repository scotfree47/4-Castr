// app/api/levels/[symbol]/route.ts
// Comprehensive key levels calculation endpoint

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { 
  calculateComprehensiveLevels,
  getAllFutureLevels,
  type OHLCVBar,
  type ComprehensiveLevels,
  type FutureLevelProjection
} from '@/lib/indicators/keyLevels';

interface LevelsResponse {
  success: boolean;
  data?: {
    current: ComprehensiveLevels;
    future?: FutureLevelProjection[];
    metadata: {
      symbol: string;
      dataPoints: number;
      startDate: string;
      endDate: string;
      timestamp: string;
    };
  };
  error?: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
): Promise<NextResponse<LevelsResponse>> {
  try {
    const { symbol } = await params;
    const { searchParams } = new URL(request.url);
    
    // Parameters
    const startDate = searchParams.get('startDate') || 
      new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || 
      new Date().toISOString().split('T')[0];
    const includeFuture = searchParams.get('includeFuture') === 'true';
    const barsToProject = parseInt(searchParams.get('barsToProject') || '50');
    const swingLength = parseInt(searchParams.get('swingLength') || '10');
    const pivotBars = parseInt(searchParams.get('pivotBars') || '5');

    console.log(`→ Calculating levels for ${symbol}...`);

    // Get price data from Supabase
    const { data: priceData, error: priceError } = await supabaseAdmin
      .from('financial_data')
      .select('date, open, high, low, close, volume')
      .eq('symbol', symbol)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (priceError || !priceData || priceData.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No price data available',
      }, { status: 404 });
    }

    // Convert to OHLCVBar format
    const bars: OHLCVBar[] = priceData.map(bar => ({
      time: new Date(bar.date).getTime(),
      open: parseFloat(bar.open) || 0,
      high: parseFloat(bar.high) || 0,
      low: parseFloat(bar.low) || 0,
      close: parseFloat(bar.close) || 0,
      volume: parseFloat(bar.volume) || 0,
    }));

    console.log(`✓ Loaded ${bars.length} bars`);

    // Calculate comprehensive levels
    const currentTime = new Date().getTime();
    const levels = calculateComprehensiveLevels(bars, {
      currentTime,
      includeGannSquare144: true,
      includeSeasonalDates: true,
      swingLength,
      pivotBars,
    });

    console.log(`✓ Calculated current levels`);

    // Calculate future projections if requested
    let futureLevels: FutureLevelProjection[] | undefined;
    if (includeFuture) {
      futureLevels = getAllFutureLevels(bars, {
        barsToProject,
        barInterval: 86400000, // 1 day in milliseconds
        includeGannFan: false, // Requires manual anchor
        includeTrendLevels: true,
        includeValueArea: true,
        includeGannOctaves: true,
      });
      console.log(`✓ Projected ${futureLevels.length} future levels`);
    }

    return NextResponse.json({
      success: true,
      data: {
        current: levels,
        future: futureLevels,
        metadata: {
          symbol,
          dataPoints: bars.length,
          startDate: priceData[0].date,
          endDate: priceData[priceData.length - 1].date,
          timestamp: new Date().toISOString(),
        },
      },
    });

  } catch (error) {
    console.error('Levels API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}