import { createClient } from '@supabase/supabase-js'

const configuredUrl = import.meta.env.VITE_SUPABASE_URL
const configuredKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Missing config used to fall back to the literal strings 'YOUR_SUPABASE_URL' /
// 'YOUR_SUPABASE_ANON_KEY', which builds a client that can never work and fails
// later with a misleading auth error. A production build now refuses to start;
// in dev we warn and use a placeholder so the public guest flow (tests, quotes)
// still runs without Supabase configured.
if (!configuredUrl || !configuredKey) {
  const message =
    'Missing Supabase config: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in frontend/.env'
  if (import.meta.env.PROD) throw new Error(message)
  console.warn(message)
}

const supabaseUrl = configuredUrl || 'http://localhost:54321'
const supabaseAnonKey = configuredKey || 'public-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
