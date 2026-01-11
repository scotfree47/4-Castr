import { supabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || 'SPY';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    console.log('🔍 Finance API Debug:');
    console.log('Symbol:', symbol);
    console.log('Dates:', startDate, 'to', endDate);
    console.log('Polygon Key exists:', !!process.env.POLYGON_API_KEY);

    // Check if data exists in DB first
    let query = supabaseAdmin
      .from('financial_data')
      .select('*')
      .eq('symbol', symbol)
      .order('date', { ascending: false });
    
    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);
    
    const { data: existingData, error } = await query;
    
    if (error) throw error;
    
    // If we have data, return it
    if (existingData && existingData.length > 0) {
      return NextResponse.json({ success: true, data: existingData, source: 'cache' });
    }
    
    // Otherwise, fetch from Polygon.io
    const polygonKey = process.env.POLYGON_API_KEY;
    const url = `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/${startDate}/${endDate}?apiKey=${polygonKey}`;
    
    const response = await axios.get(url);
    
    if (response.data.results) {
      // Transform and insert into DB
      const records = response.data.results.map(bar => ({
        symbol,
        date: new Date(bar.t).toISOString().split('T')[0],
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
        volume: bar.v,
        source: 'polygon'
      }));
      
      // Insert into database
      const { error: insertError } = await supabaseAdmin
        .from('financial_data')
        .upsert(records, { onConflict: 'symbol,date' });
      
      if (insertError) console.error('Insert error:', insertError);
      
      return NextResponse.json({ success: true, data: records, source: 'polygon' });
    }
    
    return NextResponse.json({ success: false, error: 'No data from Polygon' }, { status: 404 });
    
  } catch (error) {
    console.error('Finance API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}