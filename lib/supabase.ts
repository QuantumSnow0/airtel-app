import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

/**
 * Supabase Client Configuration
 * 
 * IMPORTANT SECURITY NOTES:
 * - Use the ANON KEY (public key) for client-side applications
 * - NEVER use the SERVICE ROLE KEY in client-side code - it bypasses all security!
 * - The anon key respects Row Level Security (RLS) policies
 * - For admin access, configure RLS policies in Supabase to allow admin users
 * 
 * Get your credentials from: Supabase Dashboard > Settings > API
 * - Project URL: Use this as EXPO_PUBLIC_SUPABASE_URL
 * - anon public key: Use this as EXPO_PUBLIC_SUPABASE_ANON_KEY (NOT the service_role key!)
 */

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

let supabase: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  console.warn('Supabase URL and Anon Key are required. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file or app.json');
}

// Export a getter function to ensure we always check if configured
export const getSupabaseClient = (): SupabaseClient => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
  }
  return supabase;
};

// Export supabase directly for convenience, but it may be null
export { supabase };

