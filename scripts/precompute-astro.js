const Astronomy = require('astronomy-engine');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Date range: Dec 21, 2004 → Present
const START_DATE = new Date('2004-12-21');
const END_DATE = new Date();

// All planets we care about
const PLANETS = [
  { name: 'Sun', body: Astronomy.Body.Sun },
  { name: 'Moon', body: Astronomy.Body.Moon },
  { name: 'Mercury', body: Astronomy.Body.Mercury },
  { name: 'Venus', body: Astronomy.Body.Venus },
  { name: 'Mars', body: Astronomy.Body.Mars },
  { name: 'Jupiter', body: Astronomy.Body.Jupiter },
  { name: 'Saturn', body: Astronomy.Body.Saturn }
];

// Zodiac signs with planetary rulerships
const ZODIAC_SIGNS = [
  { name: 'Aries', ruler: 'Mars', element: 'fire', modality: 'cardinal' },
  { name: 'Taurus', ruler: 'Venus', element: 'earth', modality: 'fixed' },
  { name: 'Gemini', ruler: 'Mercury', element: 'air', modality: 'mutable' },
  { name: 'Cancer', ruler: 'Moon', element: 'water', modality: 'cardinal' },
  { name: 'Leo', ruler: 'Sun', element: 'fire', modality: 'fixed' },
  { name: 'Virgo', ruler: 'Mercury', element: 'earth', modality: 'mutable' },
  { name: 'Libra', ruler: 'Venus', element: 'air', modality: 'cardinal' },
  { name: 'Scorpio', ruler: 'Mars', element: 'water', modality: 'fixed' },
  { name: 'Sagittarius', ruler: 'Jupiter', element: 'fire', modality: 'mutable' },
  { name: 'Capricorn', ruler: 'Saturn', element: 'earth', modality: 'cardinal' },
  { name: 'Aquarius', ruler: 'Saturn', element: 'air', modality: 'fixed' },
  { name: 'Pisces', ruler: 'Jupiter', element: 'water', modality: 'mutable' }
];

// Aspect types with orbs and classifications
const ASPECTS = [
  { name: 'conjunction', degrees: 0, orb: 8, nature: 'neutral' },
  { name: 'sextile', degrees: 60, orb: 4, nature: 'harmonious' },
  { name: 'square', degrees: 90, orb: 6, nature: 'harsh' },
  { name: 'trine', degrees: 120, orb: 6, nature: 'harmonious' },
  { name: 'opposition', degrees: 180, orb: 6, nature: 'harsh' }
];

// Calculate ecliptic longitude
function getEclipticLongitude(body, date) {
  const ecliptic = Astronomy.Ecliptic(Astronomy.GeoVector(body, date, false));
  return ecliptic.elon;
}

// Get zodiac sign from longitude
function getZodiacSign(longitude) {
  const signIndex = Math.floor(longitude / 30);
  return ZODIAC_SIGNS[signIndex];
}

// Check if aspect exists within orb
function getAspectType(angle) {
  const normalizedAngle = ((angle % 360) + 360) % 360;
  
  for (const aspect of ASPECTS) {
    let diff = Math.abs(normalizedAngle - aspect.degrees);
    if (diff > 180) diff = 360 - diff;
    
    if (diff <= aspect.orb) {
      return { 
        type: aspect.name, 
        orb: diff, 
        nature: aspect.nature,
        exact: diff < 1 
      };
    }
  }
  return null;
}

// Calculate lunar phase details
function getLunarPhase(sunLon, moonLon) {
  const angle = ((moonLon - sunLon + 360) % 360);
  const illumination = (1 - Math.cos(angle * Math.PI / 180)) / 2 * 100;
  
  let phase;
  if (angle < 45) phase = 'new';
  else if (angle < 90) phase = 'waxing_crescent';
  else if (angle < 135) phase = 'first_quarter';
  else if (angle < 180) phase = 'waxing_gibbous';
  else if (angle < 225) phase = 'full';
  else if (angle < 270) phase = 'waning_gibbous';
  else if (angle < 315) phase = 'last_quarter';
  else phase = 'waning_crescent';
  
  return { phase, illumination: Math.round(illumination * 10) / 10, angle };
}

// Detect retrograde motion (simplified - checks if longitude decreasing)
function isRetrograde(body, date) {
  const yesterday = new Date(date);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const todayLon = getEclipticLongitude(body, date);
  const yesterdayLon = getEclipticLongitude(body, yesterday);
  
  // Account for zero-crossing
  let diff = todayLon - yesterdayLon;
  if (diff < -300) diff += 360;
  if (diff > 300) diff -= 360;
  
  return diff < 0;
}

// Get solstice and equinox dates for a year
function getSolsticeEquinoxDates(year) {
  const dates = [];
  
  // Spring Equinox (Sun enters Aries)
  dates.push({ date: Astronomy.SearchSunLongitude(0, year, 90), type: 'vernal_equinox', sign: 'Aries' });
  
  // Summer Solstice (Sun enters Cancer)
  dates.push({ date: Astronomy.SearchSunLongitude(90, year, 90), type: 'summer_solstice', sign: 'Cancer' });
  
  // Autumn Equinox (Sun enters Libra)
  dates.push({ date: Astronomy.SearchSunLongitude(180, year, 90), type: 'autumn_equinox', sign: 'Libra' });
  
  // Winter Solstice (Sun enters Capricorn)
  dates.push({ date: Astronomy.SearchSunLongitude(270, year, 90), type: 'winter_solstice', sign: 'Capricorn' });
  
  return dates;
}

// Main computation function
async function precomputeAstroData() {
  console.log('🌟 Starting enhanced astrological data precomputation...');
  console.log(`📅 Date range: ${START_DATE.toISOString().split('T')[0]} → ${END_DATE.toISOString().split('T')[0]}`);
  
  const events = [];
  let currentDate = new Date(START_DATE);
  let lastPositions = {};
  let lastRetrogrades = {};
  let processedDays = 0;
  
  // Pre-compute solstice/equinox dates for all years
  console.log('🔆 Computing solstice/equinox dates...');
  const startYear = START_DATE.getFullYear();
  const endYear = END_DATE.getFullYear();
  
  for (let year = startYear; year <= endYear; year++) {
    const seasonalPoints = getSolsticeEquinoxDates(year);
    seasonalPoints.forEach(point => {
      events.push({
        event_date: point.date.date.toISOString().split('T')[0],
        event_type: 'seasonal_point',
        seasonal_type: point.type,
        body1: 'Sun',
        zodiac_sign: point.sign,
        longitude: point.date.elon,
        metadata: { year, fibonacci_anchor: true }
      });
    });
  }
  
  console.log(`✅ Added ${(endYear - startYear + 1) * 4} seasonal anchor points`);
  console.log('📊 Processing daily planetary positions...');
  
  while (currentDate <= END_DATE) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const positions = {};
    
    // Calculate all planetary positions
    for (const planet of PLANETS) {
      const lon = getEclipticLongitude(planet.body, currentDate);
      const sign = getZodiacSign(lon);
      positions[planet.name] = { lon, sign };
      
      // Check for ingress (sign change)
      if (lastPositions[planet.name] && 
          lastPositions[planet.name].sign.name !== sign.name) {
        events.push({
          event_date: dateStr,
          event_type: 'ingress',
          body1: planet.name,
          zodiac_sign: sign.name,
          longitude: lon,
          metadata: { 
            from_sign: lastPositions[planet.name].sign.name,
            ruler: sign.ruler,
            element: sign.element
          }
        });
      }
      
      // Check for retrograde changes (skip Sun and Moon)
      if (planet.name !== 'Sun' && planet.name !== 'Moon') {
        const isRx = isRetrograde(planet.body, currentDate);
        if (lastRetrogrades[planet.name] !== undefined && 
            lastRetrogrades[planet.name] !== isRx) {
          events.push({
            event_date: dateStr,
            event_type: 'retrograde_station',
            body1: planet.name,
            retrograde_status: isRx ? 'starts' : 'ends',
            zodiac_sign: sign.name,
            longitude: lon,
            metadata: { direction: isRx ? 'retrograde' : 'direct' }
          });
        }
        lastRetrogrades[planet.name] = isRx;
      }
    }
    
    // Calculate all planetary aspects
    for (let i = 0; i < PLANETS.length; i++) {
      for (let j = i + 1; j < PLANETS.length; j++) {
        const body1 = PLANETS[i];
        const body2 = PLANETS[j];
        const angle = Math.abs(positions[body1.name].lon - positions[body2.name].lon);
        const aspect = getAspectType(angle);
        
        if (aspect) {
          events.push({
            event_date: dateStr,
            event_type: 'aspect',
            body1: body1.name,
            body2: body2.name,
            aspect_type: aspect.type,
            aspect_nature: aspect.nature,
            orb_degrees: aspect.orb,
            is_exact: aspect.exact,
            metadata: {
              body1_lon: positions[body1.name].lon,
              body2_lon: positions[body2.name].lon,
              body1_sign: positions[body1.name].sign.name,
              body2_sign: positions[body2.name].sign.name
            }
          });
        }
      }
    }
    
    // Detailed lunar phase
    const lunarPhase = getLunarPhase(positions.Sun.lon, positions.Moon.lon);
    events.push({
      event_date: dateStr,
      event_type: 'lunar_phase',
      lunar_phase: lunarPhase.phase,
      longitude: positions.Moon.lon,
      zodiac_sign: positions.Moon.sign.name,
      metadata: { 
        illumination: lunarPhase.illumination,
        angle: lunarPhase.angle,
        moon_ruler: positions.Moon.sign.ruler
      }
    });
    
    lastPositions = positions;
    processedDays++;
    
    if (processedDays % 365 === 0) {
      console.log(`📊 Processed ${processedDays} days... (${currentDate.getFullYear()}) - ${events.length} events`);
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  console.log(`\n✅ Computation complete! Found ${events.length} astrological events.`);
  console.log('💾 Inserting into database...');
  
  // Batch insert
  const batchSize = 1000;
  for (let i = 0; i < events.length; i += batchSize) {
    const batch = events.slice(i, i + batchSize);
    const { error } = await supabase.from('astro_events').insert(batch);
    
    if (error) {
      console.error(`❌ Error inserting batch ${i / batchSize + 1}:`, error);
    } else {
      console.log(`✅ Inserted batch ${i / batchSize + 1}/${Math.ceil(events.length / batchSize)}`);
    }
  }
  
  console.log('\n🎉 Precomputation complete! Database populated.');
  console.log('\n📋 Event Summary:');
  console.log(`   • Seasonal Points (Fibonacci Anchors): ${events.filter(e => e.event_type === 'seasonal_point').length}`);
  console.log(`   • Ingresses: ${events.filter(e => e.event_type === 'ingress').length}`);
  console.log(`   • Aspects: ${events.filter(e => e.event_type === 'aspect').length}`);
  console.log(`   • Lunar Phases: ${events.filter(e => e.event_type === 'lunar_phase').length}`);
  console.log(`   • Retrograde Stations: ${events.filter(e => e.event_type === 'retrograde_station').length}`);
}

// Run it
precomputeAstroData().catch(console.error);