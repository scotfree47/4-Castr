// scripts/update-prices-from-csv.js
// Update financial_data table from your CSV file

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import fs from 'fs'
import Papa from 'papaparse'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function updatePricesFromCSV() {
  console.log('📊 Updating prices from CSV...\n')
  
  // Path to your CSV file
  const csvPath = join(__dirname, '..', 'public', 'data', 'tickers', 'price_data_dec22_20260107.csv')
  
  if (!fs.existsSync(csvPath)) {
    console.error('❌ CSV file not found:', csvPath)
    console.log('Please ensure the file exists at the expected location.')
    return
  }
  
  const csvContent = fs.readFileSync(csvPath, 'utf8')
  
  console.log('📖 Parsing CSV...')
  const parsed = Papa.parse(csvContent, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true
  })
  
  if (parsed.errors.length > 0) {
    console.error('❌ CSV parsing errors:', parsed.errors)
    return
  }
  
  console.log(`✅ Parsed ${parsed.data.length} rows\n`)
  
  // Group by symbol
  const symbolData = {}
  parsed.data.forEach(row => {
    const symbol = row.symbol || row.Symbol
    if (!symbol) return
    
    if (!symbolData[symbol]) {
      symbolData[symbol] = []
    }
    
    symbolData[symbol].push({
      symbol,
      date: row.date || row.Date,
      open: parseFloat(row.open || row.Open) || null,
      high: parseFloat(row.high || row.High) || null,
      low: parseFloat(row.low || row.Low) || null,
      close: parseFloat(row.close || row.Close),
      volume: parseFloat(row.volume || row.Volume) || 0,
    })
  })
  
  const symbols = Object.keys(symbolData)
  console.log(`📈 Found ${symbols.length} unique symbols`)
  console.log('Symbols:', symbols.slice(0, 10).join(', '), symbols.length > 10 ? '...' : '')
  
  // Update each symbol
  let updated = 0
  let errors = 0
  
  for (const symbol of symbols) {
    const records = symbolData[symbol]
    
    try {
      // Delete existing data for this symbol (optional - remove if you want to keep old data)
      // await supabase.from('financial_data').delete().eq('symbol', symbol)
      
      // Insert new data in batches of 1000
      for (let i = 0; i < records.length; i += 1000) {
        const batch = records.slice(i, i + 1000)
        
        const { error } = await supabase
          .from('financial_data')
          .upsert(batch, {
            onConflict: 'symbol,date', // Assumes you have a unique constraint on (symbol, date)
            ignoreDuplicates: false
          })
        
        if (error) {
          console.error(`❌ Error upserting ${symbol}:`, error.message)
          errors++
          break
        }
      }
      
      updated++
      console.log(`✅ ${updated}/${symbols.length} - Updated ${symbol} (${records.length} records)`)
      
    } catch (err) {
      console.error(`❌ Error processing ${symbol}:`, err.message)
      errors++
    }
  }
  
  console.log(`\n📊 Summary:`)
  console.log(`  Successfully updated: ${updated} symbols`)
  console.log(`  Errors: ${errors}`)
  
  // Verify freshness
  console.log('\n🔍 Checking freshness of key symbols...')
  
  const testSymbols = ['SPY', 'QQQ', 'AAPL']
  for (const symbol of testSymbols) {
    const { data } = await supabase
      .from('financial_data')
      .select('symbol, date, close')
      .eq('symbol', symbol)
      .order('date', { ascending: false })
      .limit(1)
    
    if (data && data.length > 0) {
      console.log(`  ${symbol}: $${data[0].close.toFixed(2)} on ${data[0].date}`)
    }
  }
}

updatePricesFromCSV().then(() => {
  console.log('\n✅ Update complete')
  process.exit(0)
}).catch(err => {
  console.error('❌ Fatal error:', err)
  process.exit(1)
})