// app/api/fibonacci/route.js
import { supabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import { readFibonacciCSV } from '@/lib/csvAdapter';

// Fibonacci calculation function
function calculateFibLevels(high, low) {
  const diff = high - low;
  return {
    // Standard retracement levels (0% to 100%)
    level_0: low,
    level_236: low + diff * 0.236,
    level_382: low + diff * 0.382,
    level_500: low + diff * 0.500,
    level_618: low + diff * 0.618,
    level_786: low + diff * 0.786,
    level_886: low + diff * 0.886,
    level_1000: high,
    // Extension levels above high (100%+)
    level_1272: high + diff * 0.272,
    level_1414: high + diff * 0.414,
    level_1618: high + diff * 0.618,
    level_2618: high + diff * 1.618,
    level_3618: high + diff * 2.618,
    level_4236: high + diff * 3.236,
    level_4618: high + diff * 3.618,
    // Extension levels below low (negative)
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

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const startDate = searchParams.get('startDate') || 
      new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || 
      new Date().toISOString().split('T')[0];

    if (!symbol) {
      return NextResponse.json(
        { success: false, error: 'Symbol required' },
        { status: 400 }
      );
    }

    // 1. Check CSV first (your existing fibonacci_levels.csv)
    console.log(`→ Checking Fibonacci CSV for ${symbol}...`);
    const csvData = await readFibonacciCSV(symbol, startDate, endDate);
    
    if (csvData && csvData.length > 0) {
      console.log(`✓ CSV hit for ${symbol}: ${csvData.length} records`);
      return NextResponse.json({
        success: true,
        data: csvData,
        source: 'csv',
        metadata: {
          symbol,
          startDate,
          endDate,
          recordCount: csvData.length,
          timestamp: new Date().toISOString()
        }
      });
    }

    // 2. Calculate from price data
    console.log(`→ Calculating Fibonacci levels for ${symbol}...`);
    
    // Get price data from your existing financial_data table
    const { data: priceData, error: priceError } = await supabaseAdmin
      .from('financial_data')
      .select('date, high, low, close')
      .eq('symbol', symbol)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (priceError || !priceData || priceData.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No price data available for Fibonacci calculation',
          detail: priceError?.message 
        },
        { status: 404 }
      );
    }

    // Find swing high/low points
    const high = Math.max(...priceData.map(d => d.high));
    const low = Math.min(...priceData.map(d => d.low));
    const currentPrice = priceData[priceData.length - 1].close;

    // Calculate levels
    const levels = calculateFibLevels(high, low);

    // Determine which levels are resistance (above) vs support (below)
    const resistanceLevels = Object.entries(levels)
      .filter(([_, value]) => value > currentPrice)
      .map(([key, value]) => ({
        level: key.replace('level_', ''),
        price: value,
        type: 'resistance'
      }));

    const supportLevels = Object.entries(levels)
      .filter(([_, value]) => value < currentPrice)
      .map(([key, value]) => ({
        level: key.replace('level_', ''),
        price: value,
        type: 'support'
      }));

    const result = {
      symbol,
      date_range: { start: startDate, end: endDate },
      swing_points: { high, low },
      current_price: currentPrice,
      levels: {
        all: levels,
        resistance: resistanceLevels.sort((a, b) => a.price - b.price),
        support: supportLevels.sort((a, b) => b.price - a.price)
      },
      nearest_levels: {
        resistance: resistanceLevels[0] || null,
        support: supportLevels[0] || null
      }
    };

    return NextResponse.json({
      success: true,
      data: result,
      source: 'calculated',
      metadata: {
        symbol,
        startDate,
        endDate,
        priceDataPoints: priceData.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Fibonacci API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}