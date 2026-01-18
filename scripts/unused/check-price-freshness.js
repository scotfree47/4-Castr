// scripts/check-price-freshness.js
// Check when price data was last updated

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkPriceFreshness() {
  console.log('🔍 Checking price data freshness...\n')
  
  const symbols = ['SPY', 'QQQ', 'AAPL', 'TSLA', 'Bitcoin', 'bitcoin', 'EUR/USD', 'EURUSD']
  
  for (const symbol of symbols) {
    const { data, error } = await supabase
      .from('financial_data')
      .select('symbol, date, close')
      .eq('symbol', symbol)
      .order('date', { ascending: false })
      .limit(1)
    
    if (data && data.length > 0) {
      const latest = data[0]
      const daysOld = Math.floor(
        (new Date() - new Date(latest.date)) / (1000 * 60 * 60 * 24)
      )
      
      console.log(`${symbol.padEnd(10)} | $${latest.close.toFixed(2).padStart(8)} | ${latest.date} (${daysOld} days old)`)
    } else {
      console.log(`${symbol.padEnd(10)} | NO DATA FOUND`)
    }
  }
  
  // Check overall data range
  console.log('\n📊 Overall data range:')
  
  const { data: oldest } = await supabase
    .from('financial_data')
    .select('date')
    .order('date', { ascending: true })
    .limit(1)
  
  const { data: newest } = await supabase
    .from('financial_data')
    .select('date')
    .order('date', { ascending: false })
    .limit(1)
  
  if (oldest && newest) {
    console.log(`Oldest: ${oldest[0].date}`)
    console.log(`Newest: ${newest[0].date}`)
  }
  
  // Check total rows
  const { count } = await supabase
    .from('financial_data')
    .select('*', { count: 'exact', head: true })
  
  console.log(`\n📈 Total price records: ${count?.toLocaleString()}`)
}

checkPriceFreshness().then(() => {
  console.log('\n✅ Check complete')
  process.exit(0)
}).catch(err => {
  console.error('❌ Error:', err)
  process.exit(1)
})