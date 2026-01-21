export const dynamic = "force-dynamic"
export const revalidate = 0

import { getSupabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const eventType = searchParams.get('eventType'); // 'aspect', 'lunar_phase', 'solar_ingress'
    
    let query = supabaseAdmin
      .from('astro_events')
      .select('*')
      .order('event_date', { ascending: false });
    
    if (startDate) query = query.gte('event_date', startDate);
    if (endDate) query = query.lte('event_date', endDate);
    if (eventType) query = query.eq('event_type', eventType);
    
    const { data, error } = await query.limit(100);
    
    if (error) throw error;
    
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}