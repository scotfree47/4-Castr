import { supabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import { fetchFromPolygon, fetchFromTwelveData, fetchFromAlphaVantage, fetchFromFRED, fetchWithFallback } from '@/lib/apiAdapters';
import { readStressCSV, readRatesMacroCSV } from '@/lib/csvAdapter';

// Market tickers (fetched via stock/forex APIs)
const MARKET_SYMBOLS = ['TNX', 'TLT', 'DXY'];

// Economic indicators (fetched via FRED)
const FRED_SERIES = {
  'UNRATE': 'UNRATE',
  'FEDFUNDS': 'FEDFUNDS',
  'CPI': 'CPIAUCSL',
  'PCE': 'PCEPILFE',
  'NFP': 'PAYEMS'
};

// CSV mapping for market symbols
const CSV_MAP = {
  'TNX': { source: 'stress', key: 'TNX' },
  'DXY': { source: 'stress', key: 'DXY' },
  'TLT': { source: 'rates-macro', key: 'TLT' }
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];

    const results = {};
    const errors = {};

    // Fetch market symbols (TNX, TLT, DXY)
    for (const symbol of MARKET_SYMBOLS) {
      try {
        // 1. Check CSV first if available
        if (CSV_MAP[symbol]) {
          console.log(`→ Checking CSV for ${symbol}...`);
          const csvData = CSV_MAP[symbol].source === 'stress'
            ? await readStressCSV(CSV_MAP[symbol].key, startDate, endDate)
            : await readRatesMacroCSV(CSV_MAP[symbol].key, startDate, endDate);
          
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

        // 3. Fetch with API fallback chain
        console.log(`→ Fetching ${symbol} from APIs...`);
        const data = await fetchWithFallback(
          symbol,
          startDate,
          endDate,
          [
            (s, start, end) => fetchFromTwelveData(s, start, end),
            (s, start, end) => fetchFromPolygon(s, start, end),
            (s, start, end) => fetchFromAlphaVantage(s, start, end)
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

    // Fetch FRED economic indicators
    for (const [indicator, seriesId] of Object.entries(FRED_SERIES)) {
      try {
        console.log(`→ Fetching ${indicator} from FRED...`);
        const data = await fetchFromFRED(seriesId, startDate, endDate);

        if (data && data.length > 0) {
          console.log(`✓ Fetched ${data.length} records for ${indicator}`);
          results[indicator] = data;
        } else {
          console.warn(`⚠ No FRED data for ${indicator}`);
          results[indicator] = [];
          errors[indicator] = 'No FRED data available';
        }
      } catch (fredError) {
        console.error(`Error fetching ${indicator}:`, fredError.message);
        results[indicator] = [];
        errors[indicator] = fredError.message;
      }
    }

    return NextResponse.json({
      success: true,
      data: results,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
      metadata: {
        startDate,
        endDate,
        marketSymbols: MARKET_SYMBOLS,
        fredIndicators: Object.keys(FRED_SERIES),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Rates/Macro API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}