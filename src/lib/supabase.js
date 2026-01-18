import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// ✅ Client-side Supabase client (for browser usage)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ✅ Server-side admin client (for API routes)
// This has elevated permissions and should NEVER be exposed to the browser
export const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  db: {
    schema: "public",
  },
})

// ✅ Type-safe helper to ensure environment variables are set
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"
  )
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("⚠️  SUPABASE_SERVICE_ROLE_KEY is missing. Server-side operations may fail.")
}
