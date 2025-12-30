/**
 * JWT Authentication for Version Gating
 * 
 * This module handles getting a JWT token with app_version claim
 * from the Edge Function, which is then used for Supabase requests.
 */

import { APP_VERSION } from './supabase';
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '';

interface JWTResponse {
  token: string;
  app_version: number;
  expires_in: number;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Get JWT token with app_version claim from Edge Function
 */
export async function getJWTWithVersion(): Promise<string> {
  // Check if we have a valid cached token
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  try {
    // Call Edge Function to get JWT with app_version
    const response = await fetch(`${supabaseUrl}/functions/v1/inject-app-version`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-app-version': String(APP_VERSION),
        'apikey': Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
      },
    });

    if (!response.ok) {
      throw new Error(`Edge Function error: ${response.statusText}`);
    }

    const data: JWTResponse = await response.json();

    // Cache the token
    cachedToken = {
      token: data.token,
      expiresAt: Date.now() + (data.expires_in * 1000) - 60000, // Expire 1 min early
    };

    return data.token;
  } catch (error) {
    console.error('Failed to get JWT token:', error);
    throw error;
  }
}

/**
 * Clear cached token (useful for testing or when version changes)
 */
export function clearJWTCache() {
  cachedToken = null;
}




