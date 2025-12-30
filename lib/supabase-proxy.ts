/**
 * Supabase Proxy Client
 * 
 * This wraps Supabase calls through an Edge Function that validates app version.
 * Old apps cannot call the Edge Function and are blocked.
 */

import { APP_VERSION } from './supabase';
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Proxy a Supabase query through the Edge Function
 */
export async function proxySupabaseRequest(
  method: string,
  path: string,
  body?: any,
  headers?: Record<string, string>
): Promise<Response> {
  // Build the proxy path
  const proxyPath = `/rest/v1${path}`;
  const proxyUrl = `${supabaseUrl}/functions/v1/proxy-with-version-check${proxyPath}`;

  // Call Edge Function with app version
  const response = await fetch(proxyUrl, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-app-version': String(APP_VERSION),
      'apikey': supabaseAnonKey,
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  return response;
}

/**
 * Helper to make Supabase-style queries through proxy
 */
export async function proxySelect(table: string, options?: {
  select?: string;
  filter?: Record<string, any>;
  order?: { column: string; ascending?: boolean };
  limit?: number;
}) {
  let path = `/${table}?`;
  
  if (options?.select) {
    path += `select=${options.select}&`;
  }
  
  if (options?.filter) {
    // Add filters to query string
    Object.entries(options.filter).forEach(([key, value]) => {
      path += `${key}=eq.${value}&`;
    });
  }
  
  if (options?.order) {
    path += `order=${options.order.column}.${options.order.ascending ? 'asc' : 'desc'}&`;
  }
  
  if (options?.limit) {
    path += `limit=${options.limit}&`;
  }
  
  const response = await proxySupabaseRequest('GET', path);
  return response.json();
}




