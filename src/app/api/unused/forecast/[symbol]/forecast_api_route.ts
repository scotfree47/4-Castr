// app/api/forecast/[symbol]/route.ts
// Generate 1-3 month forecasts using seasonal dates + key levels

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { 
  calculateComprehensiveLevels,
  getAllFutureLevels,
  getUpcomingSeasonalDates,
  type OHLCVBar,
  type FutureLevelProjection
} from '@/lib/indicators/keyLevels';
import { readAstroAlignmentCSV } from '@/lib/csvAdapter';

interface ForecastEvent {
  date: string;
  timestamp: number;
  daysUntil: number;
  type: 'seasonal' | 'projected_level' | 'confluence';
  confidence: number;
  details: {
    description: string;
    expectedMove?: 'up' | 'down' | 'reversal';
    keyLevels?: number[];
    seasonalType?: string;
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { symbol: string } }
) {
  try {
    const { symbol } = params;
    const { searchParams } = new URL(request.url);
    
    const monthsAhead = parseInt(searchParams.get('months') || '3');
    const daysAhead = monthsAhead * 30;
    
    console.log(`→ Generating ${monthsAhead}-month forecast for ${symbol}...`);

    // 1. Get recent price data (last 90 days for analysis)
    const lookbackDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];

    const { data: priceData, error: priceError } = await supabaseAdmin
      .from('financial_data')
      .select('date, open, high, low, close, volume')
      .eq('symbol', symbol)
      .gte('date', lookbackDate)
      .lte('date', today)
      .order('date', { ascending: true });

    if (priceError || !priceData || priceData.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No price data available for analysis',
      }, { status: 404 });
    }

    const bars: OHLCVBar[] = priceData.map(bar => ({
      time: new Date(bar.date).getTime(),
      open: parseFloat(bar.open) || 0,
      high: parseFloat(bar.high) || 0,
      low: parseFloat(bar.low) || 0,
      close: parseFloat(bar.close) || 0,
      volume: parseFloat(bar.volume) || 0,
    }));

    const currentPrice = bars[bars.length - 1].close;
    const currentTime = Date.now();

    // 2. Get upcoming seasonal dates (2025/2026)
    const seasonalDates = getUpcomingSeasonalDates(currentTime, daysAhead);
    
    console.log(`✓ Found ${seasonalDates.length} upcoming seasonal events`);

    // 3. Calculate comprehensive levels
    const levels = calculateComprehensiveLevels(bars, {
      currentTime,
      includeGannSquare144: false, // Skip heavy calculations
      includeSeasonalDates: true,
      swingLength: 10,
      pivotBars: 5,
    });

    // 4. Project future levels
    const futureLevels = getAllFutureLevels(bars, {
      barsToProject: daysAhead,
      barInterval: 86400000, // 1 day
      includeGannFan: false,
      includeTrendLevels: true,
      includeValueArea: true,
      includeGannOctaves: true,
    });

    console.log(`✓ Projected ${futureLevels.length} future levels`);

    // 5. Build forecast events
    const forecastEvents: ForecastEvent[] = [];

    // Add seasonal events
    seasonalDates.forEach(seasonal => {
      const daysUntil = Math.floor((seasonal.timestamp - currentTime) / (1000 * 60 * 60 * 24));
      
      forecastEvents.push({
        date: new Date(seasonal.timestamp).toISOString().split('T')[0],
        timestamp: seasonal.timestamp,
        daysUntil,
        type: 'seasonal',
        confidence: seasonal.strength / 10, // 0.7 to 1.0
        details: {
          description: seasonal.name,
          expectedMove: seasonal.type === 'solstice' ? 'reversal' : 
                       seasonal.type === 'equinox' ? 'reversal' : 'up',
          seasonalType: seasonal.type,
        },
      });
    });

    // Add high-confidence projected levels
    futureLevels
      .filter(level => level.confidence > 0.6)
      .forEach(level => {
        const daysUntil = level.barsAhead;
        
        forecastEvents.push({
          date: new Date(level.timestamp).toISOString().split('T')[0],
          timestamp: level.timestamp,
          daysUntil,
          type: 'projected_level',
          confidence: level.confidence,
          details: {
            description: `${level.label} at $${level.price.toFixed(2)}`,
            expectedMove: level.price > currentPrice ? 'up' : 'down',
            keyLevels: [level.price],
          },
        });
      });

    // 6. Find confluence events (seasonal + level alignment)
    const confluenceEvents: ForecastEvent[] = [];
    
    seasonalDates.forEach(seasonal => {
      const nearbyLevels = futureLevels.filter(level => {
        const timeDiff = Math.abs(level.timestamp - seasonal.timestamp);
        return timeDiff <= 3 * 24 * 60 * 60 * 1000; // Within 3 days
      });

      if (nearbyLevels.length >= 2) {
        confluenceEvents.push({
          date: new Date(seasonal.timestamp).toISOString().split('T')[0],
          timestamp: seasonal.timestamp,
          daysUntil: seasonal.daysUntil,
          type: 'confluence',
          confidence: 0.9, // High confidence when seasonal + levels align
          details: {
            description: `${seasonal.name} + ${nearbyLevels.length} key levels`,
            expectedMove: 'reversal',
            keyLevels: nearbyLevels.map(l => l.price),
            seasonalType: seasonal.type,
          },
        });
      }
    });

    forecastEvents.push(...confluenceEvents);

    // 7. Sort by date and get next 90 days
    const sortedEvents = forecastEvents
      .sort((a, b) => a.timestamp - b.timestamp)
      .filter(e => e.daysUntil <= daysAhead);

    // 8. Calculate key price targets for the period
    const upTargets = futureLevels
      .filter(l => l.price > currentPrice && l.confidence > 0.6)
      .sort((a, b) => a.price - b.price)
      .slice(0, 5);

    const downTargets = futureLevels
      .filter(l => l.price < currentPrice && l.confidence > 0.6)
      .sort((a, b) => b.price - a.price)
      .slice(0, 5);

    return NextResponse.json({
      success: true,
      data: {
        current: {
          price: currentPrice,
          date: priceData[priceData.length - 1].date,
        },
        forecast: {
          events: sortedEvents,
          upside_targets: upTargets.map(l => ({
            price: l.price,
            date: new Date(l.timestamp).toISOString().split('T')[0],
            type: l.type,
            confidence: l.confidence,
            gain_pct: ((l.price - currentPrice) / currentPrice * 100).toFixed(2),
          })),
          downside_targets: downTargets.map(l => ({
            price: l.price,
            date: new Date(l.timestamp).toISOString().split('T')[0],
            type: l.type,
            confidence: l.confidence,
            loss_pct: ((l.price - currentPrice) / currentPrice * 100).toFixed(2),
          })),
        },
        summary: {
          total_events: sortedEvents.length,
          high_confidence_events: sortedEvents.filter(e => e.confidence >= 0.8).length,
          confluence_events: confluenceEvents.length,
          next_seasonal: seasonalDates[0] ? {
            date: new Date(seasonalDates[0].timestamp).toISOString().split('T')[0],
            name: seasonalDates[0].name,
            days_until: seasonalDates[0].daysUntil,
          } : null,
        },
        metadata: {
          symbol,
          current_date: today,
          forecast_days: daysAhead,
          data_points_used: bars.length,
          timestamp: new Date().toISOString(),
        },
      },
    });

  } catch (error) {
    console.error('Forecast API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}