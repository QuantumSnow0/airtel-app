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

/**
 * App Version for Version Gating
 * This version is sent with every Supabase request via x-app-version header.
 * Update this value when you want to enforce a new minimum version.
 * 
 * To bump version without rebuilding:
 * 1. Update this constant
 * 2. Update min_app_version in app_control table in Supabase
 * 3. Users will need to update via OTA update or new build
 */
export const APP_VERSION = Constants.expoConfig?.ios?.buildNumber 
  ? parseInt(Constants.expoConfig.ios.buildNumber, 10)
  : Constants.expoConfig?.android?.versionCode 
  ? Constants.expoConfig.android.versionCode 
  : 2; // Default fallback

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

let supabase: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  // Custom fetch that routes through Edge Function for version validation
  const customFetch = async (url: string, options?: RequestInit): Promise<Response> => {
    try {
      const urlStr = String(url);
      console.log('🔍 Custom fetch called:', urlStr.substring(0, 150));
      
      // Check if this is a Supabase REST API call
      if (urlStr.includes('/rest/v1/') || urlStr.includes('/auth/v1/') || urlStr.includes('/storage/v1/')) {
        // Parse the original URL
        let originalUrl: URL;
        try {
          originalUrl = new URL(urlStr);
        } catch {
          // If URL parsing fails, try to construct it
          originalUrl = new URL(urlStr, supabaseUrl);
        }
        
        const proxyPath = originalUrl.pathname + originalUrl.search;
        const proxyUrl = `${supabaseUrl}/functions/v1/proxy-with-version-check${proxyPath}`;
        
        console.log('📡 Routing through Edge Function:', proxyUrl.substring(0, 150));
        console.log('🔐 App Version:', APP_VERSION);
        console.log('📋 Original URL:', urlStr.substring(0, 150));
        
        // Merge headers
        const headers = new Headers(options?.headers);
        headers.set('x-app-version', String(APP_VERSION));
        headers.set('apikey', supabaseAnonKey);
        
        // Forward request through Edge Function
        const response = await fetch(proxyUrl, {
          ...options,
          headers: headers,
        });
        
        console.log('✅ Edge Function response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Edge Function error:', response.status, errorText.substring(0, 200));
        }
        
        return response;
      }
      
      console.log('⏭️ Not a Supabase API call, using normal fetch');
      // For non-Supabase URLs, use normal fetch
      return fetch(url, options);
    } catch (error) {
      console.error('❌ Custom fetch error:', error);
      // Fallback to normal fetch on error
      return fetch(url, options);
    }
  };

  // Create client with custom fetch
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
    },
    global: {
      headers: {
        'x-app-version': String(APP_VERSION),
      },
      fetch: customFetch,
    },
  });
  console.log('Supabase client initialized with Edge Function proxy:', {
    url: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'missing',
    hasKey: !!supabaseAnonKey,
    appVersion: APP_VERSION,
  });
} else {
  console.warn('Supabase URL and Anon Key are required. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file or app.json');
}

// Export a getter function to ensure we always check if configured
export const getSupabaseClient = (): SupabaseClient => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
  }
  
  // Block access if version check failed
  // Import here to avoid circular dependency
  const { isVersionCheckPassed } = require('./version-blocker');
  if (!isVersionCheckPassed()) {
    throw new Error('App version is too old. Please update the app to continue.');
  }
  
  return supabase;
};

// Export supabase directly for convenience, but it may be null
export { supabase };

