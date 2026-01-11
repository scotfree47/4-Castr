import { supabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';

const ZODIAC_TO_MONTH = {
  'Aries': 'April',
  'Taurus': 'May',
  'Gemini': 'June',
  'Cancer': 'July',
  'Leo': 'August',
  'Virgo': 'September',
  'Libra': 'October',
  'Scorpio': 'November',
  'Sagittarius': 'December',
  'Capricorn': 'January',
  'Aquarius': 'February',
  'Pisces': 'March'
}

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabaseAdmin
      .from('astro_events')
      .select('*')
      .eq('event_type', 'solar_ingress')
      .lte('event_date', today)  // ← Changed from 'date' to 'event_date'
      .order('event_date', { ascending: false })  // ← Changed here too
      .limit(2);
    
    if (error || !data || data.length === 0) {
      console.error('Error fetching ingress:', error);
      return NextResponse.json(
        { success: false, error: 'No ingress data found' },
        { status: 404 }
      );
    }
    
    const currentIngress = data[0];
    const previousIngress = data[1];
    
    // zodiac_sign is already a column
    const zodiacSign = currentIngress.zodiac_sign || 'Unknown';
    
    return NextResponse.json({
      success: true,
      data: {
        currentStart: currentIngress.event_date,  // ← Changed
        previousEnd: previousIngress.event_date,  // ← Changed
        zodiacSign,
        month: ZODIAC_TO_MONTH[zodiacSign] || 'Unknown'
      }
    });
  } catch (error) {
    console.error('Ingress API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}