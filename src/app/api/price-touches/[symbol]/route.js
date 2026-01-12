// app/api/price-touches/[symbol]/route.js
import { supabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import { readPriceTouchCSV, readFibonacciCSV } from '@/lib/csvAdapter';

function detectTouches(priceData, fibLevels, tolerance = 0.005) {
  const touches = [];
  
  const levelsArray = Object.entries(fibLevels)
    .filter(([key]) => key.startsWith('level_'))
    .map(([key, value]) => ({
      level: key.replace('level_', ''),
      price: value
    }));

  priceData.forEach(candle => {
    const { date, high, low, close, open } = candle;
    
    levelsArray.forEach(fibLevel => {
      const upperBound = fibLevel.price * (1 + tolerance);
      const lowerBound = fibLevel.price * (1 - tolerance);
      
      const touched = (
        (high >= lowerBound && high <= upperBound) ||
        (low >= lowerBound && low <= upperBound) ||
        (open >= lowerBound && open <= upperBound) ||
        (close >= lowerBound && close <= upperBound) ||
        (low < fibLevel.price && high > fibLevel.price)
      );

      if (touched) {
        let touchType = 'cross';
        if (close > fibLevel.price && open < fibLevel.price) touchType = 'bounce_up';
        if (close < fibLevel.price && open > fibLevel.price) touchType = 'reject_down';
        if (Math.abs(close - fibLevel.price) < fibLevel.price * tolerance) {
          touchType = 'hold';
        }

        touches.push({
          date,
          level: fibLevel.level,
          level_price: fibLevel.price,
          candle_open: open,
          candle_close: close,
          candle_high: high,
          candle_low: low,
          touch_type: touchType,
          distance_from_level: Math.abs(close - fibLevel.price),
          distance_pct: Math.abs((close - fibLevel.price) / fibLevel.price) * 100
        });
      }
    });
  });

  return touches;
}

export async function GET(request, { params }) {
  try {
    const { symbol } = params;
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || 
      new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || 
      new Date().toISOString().split('T')[0];
    const tolerance = parseFloat(searchParams.get('tolerance') || '0.005');

    console.log(`→ Checking price touches for ${symbol}...`);

    const csvTouches = await readPriceTouchCSV(symbol, startDate, endDate);
    
    if (csvTouches && csvTouches.length > 0) {
      console.log(`✓ CSV hit for ${symbol}: ${csvTouches.length} touches`);
      return NextResponse.json({
        success: true,
        data: csvTouches,
        source: 'csv',
        metadata: {
          symbol,
          startDate,
          endDate,
          touchCount: csvTouches.length,
          timestamp: new Date().toISOString()
        }
      });
    }

    console.log(`→ Fetching price data for ${symbol}...`);

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

    const touches = detectTouches(priceData, fibLevels, tolerance);

    const touchesByLevel = touches.reduce((acc, touch) => {
      if (!acc[touch.level]) {
        acc[touch.level] = {
          level: touch.level,
          level_price: touch.level_price,
          touch_count: 0,
          touches: []
        };
      }
      acc[touch.level].touch_count++;
      acc[touch.level].touches.push(touch);
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      data: {
        all_touches: touches,
        by_level: Object.values(touchesByLevel).sort((a, b) => 
          parseFloat(b.level) - parseFloat(a.level)
        ),
        fibonacci_levels: fibLevels,
        summary: {
          total_touches: touches.length,
          levels_touched: Object.keys(touchesByLevel).length,
          most_touched_level: Object.values(touchesByLevel)
            .sort((a, b) => b.touch_count - a.touch_count)[0]?.level || null
        }
      },
      source: 'calculated',
      metadata: {
        symbol,
        startDate,
        endDate,
        tolerance,
        priceDataPoints: priceData.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Price touches API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}