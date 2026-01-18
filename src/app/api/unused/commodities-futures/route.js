import { supabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import { fetchFromPolygon, fetchFromTwelveData, fetchWithFallback } from '@/lib/apiAdapters';
import { readCommodityCSV } from '@/lib/csvAdapter';

const COMMODITIES_FUTURES = [
  // Energy
  'USO',   // Crude Oil ETF
  'CL1!',  // Crude Oil futures
  'NG1!',  // Natural Gas futures
  // Precious Metals
  'GLD',   // Gold ETF
  'GC1!',  // Gold futures
  'SLV',   // Silver ETF
  'SI1!',  // Silver futures
  // Industrial Metals
  'COPX',  // Copper ETF
  'HG1!',  // Copper futures
  // Agriculture
  'WEAT',  // Wheat ETF
  'ZW1!',  // Wheat futures
  'CORN',  // Corn ETF
  'ZC1!',  // Corn futures
  'CT1!',  // Cotton futures
  'SB1!',  // Sugar futures
  'KC1!',  // Coffee futures
  'ZS1!',  // Soybeans futures
  'ZL1!',  // Soybean Oil futures
  'LE1!',  // Live Cattle futures
];

// Map route symbols to CSV commodity names
const CSV_MAP = {
  'CT1!': 'COTTON',
  'ZW1!': 'WHEAT',
  'WEAT': 'WHEAT',
  'ZC1!': 'CORN',
  'CORN': 'CORN',
  'SB1!': 'SUGAR',
  'KC1!': 'COFFEE'
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];

    const results = {};
    const errors = {};

    for (const symbol of COMMODITIES_FUTURES) {
      try {
        // 1. Check CSV first if symbol maps to CSV commodity
        if (CSV_MAP[symbol]) {
          console.log(`→ Checking CSV for ${symbol}...`);
          const csvData = await readCommodityCSV(CSV_MAP[symbol], startDate, endDate);
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
            (s, start, end) => fetchFromPolygon(s, start, end),
            (s, start, end) => fetchFromTwelveData(s, start, end)
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
        symbols: COMMODITIES_FUTURES,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Commodities/Futures API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}