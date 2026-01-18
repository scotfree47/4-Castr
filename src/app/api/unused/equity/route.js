// app/api/equity/route.js
// FIXED VERSION - Now actually caches to Supabase

import { supabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import { fetchFromPolygon, fetchFromTwelveData, fetchFromAlphaVantage, fetchWithFallback } from '@/lib/apiAdapters';
import { readEquityCSV } from '@/lib/csvAdapter';

const EQUITY_SYMBOLS = ['SPY', 'QQQ', 'XLY'];

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];

    const results = {};
    const errors = {};

    for (const symbol of EQUITY_SYMBOLS) {
      try {
        // 1. Check CSV first (historical solstice/equinox data)
        console.log(`→ Checking CSV for ${symbol}...`);
        const csvData = await readEquityCSV(symbol, startDate, endDate);
        if (csvData && csvData.length > 0) {
          console.log(`✓ CSV hit for ${symbol}: ${csvData.length} records`);
          results[symbol] = csvData;
          continue;
        }

        // 2. Check cache
        const { data: cached, error: cacheError } = await supabaseAdmin
          .from('financial_data')
          .select('*')
          .eq('symbol', symbol)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: false });

        if (!cacheError && cached && cached.length > 0) {
          console.log(`✓ Cache hit for ${symbol}: ${cached.length} records`);
          results[symbol] = cached;
          continue;
        }

        // 3. Fetch with API fallback chain
        console.log(`→ Fetching ${symbol} from APIs...`);
        const data = await fetchWithFallback(
          symbol,
          startDate,
          endDate,
          [
            (s, start, end) => fetchFromPolygon(s, start, end),
            (s, start, end) => fetchFromTwelveData(s, start, end),
            (s, start, end) => fetchFromAlphaVantage(s, start, end)
          ]
        );

        if (data && data.length > 0) {
          // 🔥 FIX: Actually insert into Supabase
          console.log(`→ Caching ${data.length} records for ${symbol}...`);
          
          const { error: insertError } = await supabaseAdmin
            .from('financial_data')
            .upsert(
              data.map(bar => ({
                symbol: bar.symbol,
                date: bar.date,
                open: bar.open,
                high: bar.high,
                low: bar.low,
                close: bar.close,
                volume: bar.volume,
              })),
              { 
                onConflict: 'symbol,date',
                ignoreDuplicates: false 
              }
            );

          if (insertError) {
            console.error(`❌ Error caching ${symbol}:`, insertError);
          } else {
            console.log(`✓ Cached ${data.length} records for ${symbol}`);
          }

          results[symbol] = data;
        } else {
          console.warn(`⚠ No data found for ${symbol}`);
          results[symbol] = [];
          errors[symbol] = 'No data available from any source';
        }
      } catch (symbolError) {
        console.error(`Error fetching ${symbol}:`, symbolError.message);
        results[symbol] = [];
        errors[symbol] = symbolError.message;
      }
    }

    return NextResponse.json({
      success: true,
      data: results,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
      metadata: {
        startDate,
        endDate,
        symbols: EQUITY_SYMBOLS,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Equity API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}