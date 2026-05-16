import { createBrowserClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

export const supabasePublic = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: 'meu-caixa-public-client',
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
