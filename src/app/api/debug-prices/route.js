export const dynamic = "force-dynamic"
export const revalidate = 0

import { getSupabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    // Check what SPY data exists
    const { data, error } = await supabaseAdmin
      .from('financial_data')
      .select('date, symbol, close')
      .eq('symbol', 'SPY')
      .order('date', { ascending: true })
      .limit(10);
    
    // Get date range
    const { data: dateRange } = await supabaseAdmin
      .from('financial_data')
      .select('date')
      .eq('symbol', 'SPY')
      .order('date', { ascending: false })
      .limit(1);
    
    // Count total rows
    const { count } = await supabaseAdmin
      .from('financial_data')
      .select('*', { count: 'exact', head: true })
      .eq('symbol', 'SPY');
    
    return NextResponse.json({
      success: true,
      firstTenRecords: data,
      latestDate: dateRange?.[0]?.date,
      totalRows: count,
      error
    });
  } catch (error) {
    console.error('❌ Debug prices error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}