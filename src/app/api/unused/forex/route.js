import { supabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import { fetchFromTwelveData, fetchFromAlphaVantage, fetchWithFallback } from '@/lib/apiAdapters';
import { readForexCSV } from '@/lib/csvAdapter';

const FOREX_PAIRS = [
  'EUR/USD',
  'USD/JPY',
  'GBP/JPY',
  'GBP/NZD',
  'EUR/NZD',
  'GBP/AUD',
  'GBP/CAD',
  'NZD/CAD',
  'NZD/CHF',
  'AUD/NZD'
];

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];

    const results = {};
    const errors = {};

    for (const pair of FOREX_PAIRS) {
      try {
        // Convert EUR/USD to EURUSD for CSV lookup
        const csvPair = pair.replace('/', '');
        
        // 1. Check CSV first (historical solstice/equinox data)
        console.log(`→ Checking CSV for ${pair}...`);
        const csvData = await readForexCSV(csvPair, startDate, endDate);
        if (csvData && csvData.length > 0) {
          console.log(`✓ CSV hit for ${pair}: ${csvData.length} records`);
          results[pair] = csvData;
          continue;
        }

        // 2. Check cache
        const { data: cached, error: cacheError } = await supabaseAdmin
          .from('financial_data')
          .select('*')
          .eq('symbol', pair)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: false });

        if (!cacheError && cached && cached.length > 0) {
          console.log(`✓ Cache hit for ${pair}: ${cached.length} records`);
          results[pair] = cached;
          continue;
        }

        // 3. Fetch with API fallback
        console.log(`→ Fetching ${pair} from APIs...`);
        const data = await fetchWithFallback(
          pair,
          startDate,
          endDate,
          [
            (s, start, end) => fetchFromTwelveData(s, start, end),
            (s, start, end) => fetchFromAlphaVantage(s, start, end)
          ]
        );

        if (data && data.length > 0) {
          await supabaseAdmin
            .from('financial_data')
            .upsert(data, { onConflict: 'symbol,date' });
          console.log(`✓ Cached ${data.length} records for ${pair}`);
          results[pair] = data;
        } else {
          console.warn(`⚠ No data found for ${pair}`);
          results[pair] = [];
          errors[pair] = 'No data available';
        }
      } catch (pairError) {
        console.error(`Error fetching ${pair}:`, pairError.message);
        results[pair] = [];
        errors[pair] = pairError.message;
      }
    }

    return NextResponse.json({
      success: true,
      data: results,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
      metadata: {
        startDate,
        endDate,
        pairs: FOREX_PAIRS,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Forex API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}