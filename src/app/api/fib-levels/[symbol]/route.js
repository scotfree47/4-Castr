import { supabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';

const ANCHOR_DATES = {
  solstices: [
    { summer: '2025-06-21', winter: '2025-12-21' },
    { summer: '2022-06-21', winter: '2022-12-21' },
    { summer: '2020-06-20', winter: '2020-12-22' },
    { summer: '2018-06-21', winter: '2018-12-21' },
    { summer: '2015-06-21', winter: '2015-12-22' },
    { summer: '2005-06-21', winter: '2005-12-21' }
  ],
  equinoxes: [
    { spring: '2025-03-20', fall: '2025-09-22' },
    { spring: '2022-03-20', fall: '2022-09-23' },
    { spring: '2020-03-20', fall: '2020-09-22' },
    { spring: '2018-03-20', fall: '2018-09-23' },
    { spring: '2015-03-20', fall: '2015-09-23' },
    { spring: '2005-03-20', fall: '2005-09-22' }
  ]
};

export async function GET(request, { params }) {
  try {
    const { symbol } = params;
    const today = new Date().toISOString().split('T')[0];
    
    const { data: cached } = await supabaseAdmin
      .from('fibonacci_levels')
      .select('*')
      .eq('symbol', symbol)
      .eq('calculation_date', today)
      .maybeSingle();
    
    if (cached) {
      console.log(`✓ Fib cache hit for ${symbol}`);
      return NextResponse.json({ success: true, data: cached });
    }
    
    console.log(`→ Calculating fib levels for ${symbol}...`);
    
    const { data: priceData, error: priceError } = await supabaseAdmin
      .from('financial_data')
      .select('date, open, high, low, close')
      .eq('symbol', symbol)
      .gte('date', '2005-01-01')
      .order('date', { ascending: true });
    
    if (priceError || !priceData || priceData.length === 0) {
      throw new Error(`No price data found for ${symbol}`);
    }
    
    const fibLevels = calculateAggregateFibLevels(priceData);
    
    if (!fibLevels) {
      throw new Error('Unable to calculate Fibonacci levels');
    }
    
    const { data: stored, error: storeError } = await supabaseAdmin
      .from('fibonacci_levels')
      .insert({
        symbol,
        calculation_date: today,
        swing_high: fibLevels.swing_high,
        swing_low: fibLevels.swing_low,
        level_0: fibLevels.level_0,
        level_236: fibLevels.level_236,
        level_382: fibLevels.level_382,
        level_500: fibLevels.level_500,
        level_618: fibLevels.level_618,
        level_786: fibLevels.level_786,
        level_100: fibLevels.level_100
      })
      .select()
      .single();
    
    if (storeError) {
      console.error('Error storing fib levels:', storeError);
    }
    
    console.log(`✓ Calculated fib levels for ${symbol}`);
    
    return NextResponse.json({ 
      success: true, 
      data: stored || { symbol, ...fibLevels }
    });
    
  } catch (error) {
    console.error('Fib levels API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

function calculateAggregateFibLevels(priceData) {
  const allLevels = {
    level_0: [],
    level_236: [],
    level_382: [],
    level_500: [],
    level_618: [],
    level_786: [],
    level_100: []
  };
  
  let overallHigh = 0;
  let overallLow = Infinity;
  
  ANCHOR_DATES.solstices.forEach(pair => {
    const summerData = priceData.find(d => d.date === pair.summer);
    const winterData = priceData.find(d => d.date === pair.winter);
    
    if (summerData && winterData) {
      const high = Math.max(summerData.high, winterData.high);
      const low = Math.min(summerData.low, winterData.low);
      const range = high - low;
      
      overallHigh = Math.max(overallHigh, high);
      overallLow = Math.min(overallLow, low);
      
      allLevels.level_0.push(high);
      allLevels.level_236.push(high - (range * 0.236));
      allLevels.level_382.push(high - (range * 0.382));
      allLevels.level_500.push(high - (range * 0.5));
      allLevels.level_618.push(high - (range * 0.618));
      allLevels.level_786.push(high - (range * 0.786));
      allLevels.level_100.push(low);
    }
  });
  
  ANCHOR_DATES.equinoxes.forEach(pair => {
    const springData = priceData.find(d => d.date === pair.spring);
    const fallData = priceData.find(d => d.date === pair.fall);
    
    if (springData && fallData) {
      const high = Math.max(springData.high, fallData.high);
      const low = Math.min(springData.low, fallData.low);
      const range = high - low;
      
      overallHigh = Math.max(overallHigh, high);
      overallLow = Math.min(overallLow, low);
      
      allLevels.level_0.push(high);
      allLevels.level_236.push(high - (range * 0.236));
      allLevels.level_382.push(high - (range * 0.382));
      allLevels.level_500.push(high - (range * 0.5));
      allLevels.level_618.push(high - (range * 0.618));
      allLevels.level_786.push(high - (range * 0.786));
      allLevels.level_100.push(low);
    }
  });
  
  const avgLevels = {};
  for (const [key, values] of Object.entries(allLevels)) {
    if (values.length > 0) {
      avgLevels[key] = values.reduce((sum, val) => sum + val, 0) / values.length;
    }
  }
  
  return {
    swing_high: overallHigh,
    swing_low: overallLow,
    ...avgLevels
  };
}