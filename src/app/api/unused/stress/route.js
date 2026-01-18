import { supabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import { fetchFromPolygon, fetchFromTwelveData, fetchWithFallback } from '@/lib/apiAdapters';
import { readStressCSV } from '@/lib/csvAdapter';

const STRESS_SYMBOLS = [
  'VIX',   // CBOE Volatility Index
  'VVIX',  // Volatility of VIX
  'MOVE',  // Bond Market Volatility
  'VXN',   // Nasdaq Volatility Index
  'RVX',   // Russell 2000 Volatility Index
  'TRIN',  // Arms Index (Short-Term Trading Index)
  'TYX',   // 30-Year Treasury Yield
  'BVOL'   // Bitcoin Volatility Index
];

// Map route symbols to CSV indicator names
const CSV_MAP = {
  'VIX': 'VIX',
  'TYX': 'TNX',  // Your CSV has TNX instead of TYX
  'DXY': 'DXY'
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];

    const results = {};
    const errors = {};

    for (const symbol of STRESS_SYMBOLS) {
      try {
        // 1. Check CSV first if symbol maps to CSV indicator
        if (CSV_MAP[symbol]) {
          console.log(`→ Checking CSV for ${symbol}...`);
          const csvData = await readStressCSV(CSV_MAP[symbol], startDate, endDate);
          if (csvData && csvData.length > 0) {
            console.log(`✓ CSV hit for ${symbol}: ${csvData.length} records`);
            results[symbol] = csvData;
            continue;
          }
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

        // 3. Fetch with API fallback
        console.log(`→ Fetching ${symbol} from APIs...`);
        const data = await fetchWithFallback(
          symbol,
          startDate,
          endDate,
          [
            (s, start, end) => fetchFromTwelveData(s, start, end),
            (s, start, end) => fetchFromPolygon(s, start, end)
          ]
        );

        if (data && data.length > 0) {
          await supabaseAdmin
            .from('financial_data')
            .upsert(data, { onConflict: 'symbol,date' });
          console.log(`✓ Cached ${data.length} records for ${symbol}`);
          results[symbol] = data;
        } else {
          console.warn(`⚠ No data found for ${symbol}`);
          results[symbol] = [];
          errors[symbol] = 'No data available';
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
        symbols: STRESS_SYMBOLS,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Stress API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}