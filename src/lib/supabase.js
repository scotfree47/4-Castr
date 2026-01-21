import { createClient } from "@supabase/supabase-js"

// Lazy initialization to avoid build-time errors
let supabaseInstance = null
let supabaseAdminInstance = null

export function getSupabase() {
  if (supabaseInstance) return supabaseInstance

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase environment variables. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"
    )
  }

  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey)
  return supabaseInstance
}

export function getSupabaseAdmin() {
  if (supabaseAdminInstance) return supabaseAdminInstance

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing Supabase admin credentials. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    )
  }

  supabaseAdminInstance = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    db: {
      schema: "public",
    },
  })

  return supabaseAdminInstance
}

// Backward compatibility - these proxy to lazy getters
export const supabase = new Proxy(
  {},
  {
    get(target, prop) {
      return getSupabase()[prop]
    },
  }
)

export const supabaseAdmin = new Proxy(
  {},
  {
    get(target, prop) {
      return getSupabaseAdmin()[prop]
    },
  }
)
