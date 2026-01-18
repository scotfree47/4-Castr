// scripts/debug-astro-schema.js
// Run this to check what columns exist in your astro_events table
// Usage: node scripts/debug-astro-schema.js

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugAstroSchema() {
  console.log('🔍 Checking astro_events table schema...\n');
  
  // 1. Try to get ANY row to see structure
  const { data: sample, error: sampleError } = await supabase
    .from('astro_events')
    .select('*')
    .limit(1);
  
  if (sampleError) {
    console.error('❌ Error querying table:', sampleError);
    return;
  }
  
  if (!sample || sample.length === 0) {
    console.log('⚠️  Table is empty!');
    return;
  }
  
  console.log('✅ Sample row structure:');
  console.log(JSON.stringify(sample[0], null, 2));
  console.log('\n📋 Available columns:');
  console.log(Object.keys(sample[0]).join(', '));
  
  // 2. Check what event_types exist
  const { data: eventTypes } = await supabase
    .from('astro_events')
    .select('event_type')
    .limit(1000);
  
  if (eventTypes) {
    const uniqueTypes = [...new Set(eventTypes.map(e => e.event_type))];
    console.log('\n🏷️  Unique event_type values:');
    console.log(uniqueTypes.join(', '));
  }
  
  // 3. Try to find Sun ingress events
  console.log('\n🌞 Looking for Sun ingress events...');
  
  const { data: sunIngress, error: sunError } = await supabase
    .from('astro_events')
    .select('*')
    .eq('event_type', 'ingress')
    .eq('body', 'Sun')
    .order('date', { ascending: false })
    .limit(3);
  
  if (sunIngress && sunIngress.length > 0) {
    console.log(`✅ Found ${sunIngress.length} Sun ingress events (event_type='ingress')`);
    console.log('Latest:', sunIngress[0]);
  } else {
    console.log('⚠️  No events with event_type="ingress" and body="Sun"');
    
    // Try solar_ingress
    const { data: solarIngress } = await supabase
      .from('astro_events')
      .select('*')
      .eq('event_type', 'solar_ingress')
      .order('date', { ascending: false })
      .limit(3);
    
    if (solarIngress && solarIngress.length > 0) {
      console.log(`✅ Found ${solarIngress.length} events with event_type='solar_ingress'`);
      console.log('Latest:', solarIngress[0]);
    } else {
      console.log('⚠️  No events with event_type="solar_ingress" either');
    }
  }
  
  // 4. Show all events around today
  const today = new Date().toISOString().split('T')[0];
  const { data: recent } = await supabase
    .from('astro_events')
    .select('*')
    .lte('date', today)
    .order('date', { ascending: false })
    .limit(5);
  
  if (recent) {
    console.log('\n📅 Recent events (last 5):');
    recent.forEach(e => {
      console.log(`  ${e.date} - ${e.event_type} - ${e.body || 'N/A'}`);
    });
  }
}

debugAstroSchema().then(() => {
  console.log('\n✅ Debug complete');
  process.exit(0);
}).catch(err => {
  console.error('❌ Debug failed:', err);
  process.exit(1);
});