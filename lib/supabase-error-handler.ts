import { PostgrestError } from '@supabase/supabase-js';
import { Alert } from 'react-native';

/**
 * Check if error is a permission/RLS error that indicates app version is too old
 */
export function isVersionGatingError(error: PostgrestError | null): boolean {
  if (!error) return false;
  
  // Check for common RLS/permission error codes
  // 42501 = insufficient_privilege
  // PGRST301 = permission denied (PostgREST)
  return (
    error.code === '42501' ||
    error.code === 'PGRST301' ||
    error.message?.toLowerCase().includes('permission denied') ||
    error.message?.toLowerCase().includes('row-level security')
  );
}

/**
 * Handle Supabase errors gracefully
 * Shows "Please update the app" message for version gating errors
 */
export function handleSupabaseError(error: PostgrestError | null, defaultMessage?: string): void {
  if (!error) return;

  if (isVersionGatingError(error)) {
    Alert.alert(
      'Update Required',
      'Please update the app to continue using this feature.',
      [{ text: 'OK' }]
    );
  } else {
    // For other errors, show default message or log silently
    if (defaultMessage) {
      console.error('Supabase error:', error);
    }
  }
}











