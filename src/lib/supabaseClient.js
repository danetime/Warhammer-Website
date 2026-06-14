import { createClient } from '@supabase/supabase-js'

// Single shared Supabase client for the whole app.
// Credentials come from .env (see .env.example). The same Supabase project
// is used both locally and in production.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // Step 1 scaffold: real credentials are added to .env before auth (Step 3).
  console.warn(
    'Supabase credentials missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env',
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
