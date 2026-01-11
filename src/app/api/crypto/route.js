import { NextResponse } from 'next/server';
import { fetchFromCoinGecko, fetchFromCoinMarketCap } from '@/lib/apiAdapters';
import { readCryptoCSV } from '@/lib/csvAdapter';

const CRYPTO_COINS = {
  'Bitcoin': { gecko: 'bitcoin', cmc: 'BTC', symbol: 'BTC' },
  'Ethereum': { gecko: 'ethereum', cmc: 'ETH', symbol: 'ETH' },
  'BNB': { gecko: 'binancecoin', cmc: 'BNB', symbol: 'BNB' },
  'XRP': { gecko: 'ripple', cmc: 'XRP', symbol: 'XRP' },
  'BCH': { gecko: 'bitcoin-cash', cmc: 'BCH', symbol: 'BCH' },
  'Solana': { gecko: 'solana', cmc: 'SOL', symbol: 'SOL' },
  'Cardano': { gecko: 'cardano', cmc: 'ADA', symbol: 'ADA' },
  'Polkadot': { gecko: 'polkadot', cmc: 'DOT', symbol: 'DOT' },
  'Chainlink': { gecko: 'chainlink', cmc: 'LINK', symbol: 'LINK' },
  'Stellar': { gecko: 'stellar', cmc: 'XLM', symbol: 'XLM' }
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = searchParams.get('days') || 30;
    const startDate = searchParams.get('startDate') || new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];

    const results = {};
    const errors = {};

    for (const [name, ids] of Object.entries(CRYPTO_COINS)) {
      try {
        // 1. Check CSV first (historical solstice/equinox data)
        console.log(`→ Checking CSV for ${name}...`);
        const csvData = await readCryptoCSV(ids.symbol, startDate, endDate);
        if (csvData && csvData.length > 0) {
          console.log(`✓ CSV hit for ${name}: ${csvData.length} records`);
          results[name] = csvData;
          continue;
        }

        // 2. Try CoinGecko
        if (ids.gecko) {
          console.log(`→ Fetching ${name} from CoinGecko...`);
          const data = await fetchFromCoinGecko(ids.gecko, days);
          if (data && data.length > 0) {
            console.log(`✓ Fetched ${data.length} records for ${name}`);
            results[name] = data;
            continue;
          }
        }

        // 3. Fallback to CoinMarketCap
        if (ids.cmc) {
          console.log(`→ Fetching ${name} from CoinMarketCap...`);
          const data = await fetchFromCoinMarketCap(ids.cmc);
          if (data && data.length > 0) {
            console.log(`✓ Fetched ${data.length} records for ${name}`);
            results[name] = data;
            continue;
          }
        }

        console.warn(`⚠ No data found for ${name}`);
        results[name] = [];
        errors[name] = 'No data available';
      } catch (coinError) {
        console.error(`Error fetching ${name}:`, coinError.message);
        results[name] = [];
        errors[name] = coinError.message;
      }
    }

    return NextResponse.json({
      success: true,
      data: results,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
      metadata: {
        days,
        startDate,
        endDate,
        coins: Object.keys(CRYPTO_COINS),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Crypto API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}