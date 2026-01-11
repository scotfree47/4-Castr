import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Map month-day to zodiac sign for solar ingress
const DATE_TO_ZODIAC = {
  '03-20': 'Aries',     // Spring Equinox
  '03-21': 'Aries',
  '06-20': 'Cancer',    // Summer Solstice
  '06-21': 'Cancer',
  '09-22': 'Libra',     // Autumn Equinox
  '09-23': 'Libra',
  '12-21': 'Capricorn'  // Winter Solstice
};

async function seedAstroEvents() {
  const csvPath = path.join(__dirname, 'data', 'anchors', 'anchors_solstice_equinox.csv');
  const fileContent = fs.readFileSync(csvPath, 'utf8');
  const parsed = Papa.parse(fileContent, { header: true });

  const events = parsed.data
    .filter(row => row.Date)
    .map(row => {
      const monthDay = row.Date.slice(5); // Get MM-DD
      const zodiacSign = DATE_TO_ZODIAC[monthDay] || 'Unknown';
      
      return {
        event_date: row.Date,
        event_type: 'solar_ingress',
        zodiac_sign: zodiacSign
      };
    });

  console.log(`📅 Seeding ${events.length} astro events...`);

  // Delete existing solar_ingress events
  const { error: deleteError } = await supabase
    .from('astro_events')
    .delete()
    .eq('event_type', 'solar_ingress');

  if (deleteError) {
    console.error('⚠️  Error deleting old events:', deleteError);
  } else {
    console.log('✓ Cleared old solar_ingress events');
  }

  // Insert new events
  const { data, error } = await supabase
    .from('astro_events')
    .insert(events);

  if (error) {
    console.error('❌ Error seeding astro_events:', error);
    process.exit(1);
  }

  console.log('✅ Seeded astro_events successfully!');
  console.log('Sample events:', events.slice(0, 3));
  process.exit(0);
}

seedAstroEvents();