import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// For server-side operations (API routes)
export const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    db: { schema: 'public' },
    auth: { persistSession: false }
  }
)


{/*
  // src/lib/supabase.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    db: {
      schema: 'public'
    },
    global: {
      headers: {
        // Force schema refresh
        'X-Client-Info': 'supabase-js/2.0.0'
      }
    }
  }
);

*/}