// app/api/astro-correlation/[symbol]/route.js
import { supabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import { readAstroAlignmentCSV, readFibonacciCSV } from '@/lib/csvAdapter';

function correlateAstroWithTouches(astroEvents, priceTouches, windowDays = 3) {
  const correlations = [];
  const windowMs = windowDays * 24 * 60 * 60 * 1000;

  astroEvents.forEach(astroEvent => {
    const astroDate = new Date(astroEvent.date);
    
    const nearbyTouches = priceTouches.filter(touch => {
      const touchDate = new Date(touch.date);
      const timeDiff = Math.abs(touchDate - astroDate);
      return timeDiff <= windowMs;
    });

    if (nearbyTouches.length > 0) {
      correlations.push({
        astro_event: {
          type: astroEvent.event_type,
          date: astroEvent.date,
          details: astroEvent.event || astroEvent.aspect || astroEvent.phase || 'Unknown',
          planet: astroEvent.planet || null,
          sign: astroEvent.sign || null
        },
        price_touches: nearbyTouches.map(touch => ({
          date: touch.date,
          level: touch.level,
          level_price: touch.level_price,
          touch_type: touch.touch_type,
          days_from_astro: Math.round(
            (new Date(touch.date) - astroDate) / (24 * 60 * 60 * 1000)
          )
        })),
        correlation_strength: nearbyTouches.length,
        window_days: windowDays
      });
    }
  });

  return correlations;
}

export async function GET(request, { params }) {
  try {
    const { symbol } = params;
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || 
      new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || 
      new Date().toISOString().split('T')[0];
    const windowDays = parseInt(searchParams.get('windowDays') || '3');
    const eventType = searchParams.get('eventType');

    console.log(`→ Analyzing astro correlation for ${symbol}...`);

    const astroEvents = await readAstroAlignmentCSV(startDate, endDate, eventType);
    if (!astroEvents || astroEvents.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No astro events found in date range' 
        },
        { status: 404 }
      );
    }

    console.log(`✓ Found ${astroEvents.length} astro events`);
    
    const { data: priceData, error: priceError } = await supabaseAdmin
      .from('financial_data')
      .select('date, open, high, low, close')
      .eq('symbol', symbol)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (priceError || !priceData || priceData.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No price data available in database',
          hint: 'Run your equity/crypto/forex APIs first to populate data',
          detail: priceError?.message 
        },
        { status: 404 }
      );
    }

    console.log(`✓ Found ${priceData.length} price records`);

    let fibLevels;
    const csvFib = await readFibonacciCSV(symbol, startDate, endDate);
    
    if (csvFib && csvFib.length > 0) {
      const latest = csvFib[csvFib.length - 1];
      fibLevels = {
        level_0: latest.level_0,
        level_236: latest.level_236,
        level_382: latest.level_382,
        level_500: latest.level_500,
        level_618: latest.level_618,
        level_786: latest.level_786,
        level_886: latest.level_886,
        level_1000: latest.level_1000,
        level_1272: latest.level_1272,
        level_1414: latest.level_1414,
        level_1618: latest.level_1618,
        level_2618: latest.level_2618,
        level_3618: latest.level_3618,
        level_4236: latest.level_4236,
        level_4618: latest.level_4618,
        level_n027: latest.level_n027,
        level_n0618: latest.level_n0618,
        level_n1000: latest.level_n1000,
        level_n1272: latest.level_n1272,
        level_n1414: latest.level_n1414,
        level_n1618: latest.level_n1618,
        level_n2618: latest.level_n2618,
        level_n3618: latest.level_n3618,
        level_n4236: latest.level_n4236,
        level_n4618: latest.level_n4618
      };
    } else {
      const high = Math.max(...priceData.map(d => d.high));
      const low = Math.min(...priceData.map(d => d.low));
      const diff = high - low;
      
      fibLevels = {
        level_0: low,
        level_236: low + diff * 0.236,
        level_382: low + diff * 0.382,
        level_500: low + diff * 0.500,
        level_618: low + diff * 0.618,
        level_786: low + diff * 0.786,
        level_886: low + diff * 0.886,
        level_1000: high,
        level_1272: high + diff * 0.272,
        level_1414: high + diff * 0.414,
        level_1618: high + diff * 0.618,
        level_2618: high + diff * 1.618,
        level_3618: high + diff * 2.618,
        level_4236: high + diff * 3.236,
        level_4618: high + diff * 3.618,
        level_n027: low - diff * 0.27,
        level_n0618: low - diff * 0.618,
        level_n1000: low - diff * 1.000,
        level_n1272: low - diff * 1.272,
        level_n1414: low - diff * 1.414,
        level_n1618: low - diff * 1.618,
        level_n2618: low - diff * 2.618,
        level_n3618: low - diff * 3.618,
        level_n4236: low - diff * 4.236,
        level_n4618: low - diff * 4.618
      };
    }

    const touches = [];
    const tolerance = 0.005;
    
    const levelsArray = Object.entries(fibLevels)
      .filter(([key]) => key.startsWith('level_'))
      .map(([key, value]) => ({
        level: key.replace('level_', ''),
        price: value
      }));

    priceData.forEach(candle => {
      levelsArray.forEach(fibLevel => {
        const upperBound = fibLevel.price * (1 + tolerance);
        const lowerBound = fibLevel.price * (1 - tolerance);
        
        const touched = (
          (candle.high >= lowerBound && candle.high <= upperBound) ||
          (candle.low >= lowerBound && candle.low <= upperBound) ||
          (candle.low < fibLevel.price && candle.high > fibLevel.price)
        );

        if (touched) {
          let touchType = 'cross';
          if (candle.close > fibLevel.price && candle.open < fibLevel.price) touchType = 'bounce_up';
          if (candle.close < fibLevel.price && candle.open > fibLevel.price) touchType = 'reject_down';

          touches.push({
            date: candle.date,
            level: fibLevel.level,
            level_price: fibLevel.price,
            touch_type: touchType
          });
        }
      });
    });

    console.log(`✓ Found ${touches.length} price touches`);

    const correlations = correlateAstroWithTouches(astroEvents, touches, windowDays);

    const stats = {
      total_astro_events: astroEvents.length,
      total_price_touches: touches.length,
      correlated_events: correlations.length,
      correlation_rate: (correlations.length / astroEvents.length * 100).toFixed(2) + '%',
      avg_touches_per_event: correlations.length > 0
        ? (correlations.reduce((sum, c) => sum + c.correlation_strength, 0) / correlations.length).toFixed(2)
        : 0,
      strongest_correlation: correlations.length > 0
        ? correlations.sort((a, b) => b.correlation_strength - a.correlation_strength)[0]
        : null
    };

    const byEventType = correlations.reduce((acc, corr) => {
      const type = corr.astro_event.type;
      if (!acc[type]) {
        acc[type] = {
          event_type: type,
          count: 0,
          correlations: []
        };
      }
      acc[type].count++;
      acc[type].correlations.push(corr);
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      data: {
        correlations: correlations.sort((a, b) => 
          new Date(a.astro_event.date) - new Date(b.astro_event.date)
        ),
        by_event_type: Object.values(byEventType),
        statistics: stats,
        fibonacci_levels: fibLevels
      },
      metadata: {
        symbol,
        startDate,
        endDate,
        windowDays,
        eventTypeFilter: eventType || 'all',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Astro correlation API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}