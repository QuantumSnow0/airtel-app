import { Alert } from 'react-native';
import { APP_VERSION, getSupabaseClient } from './supabase';
import { setVersionCheckResult } from './version-blocker';

/**
 * Version Checker
 * 
 * Checks if the app version meets the minimum requirement.
 * Since Supabase RLS cannot read custom headers, we check version
 * in the app code and block access if version is too old.
 */

interface VersionCheckResult {
  allowed: boolean;
  minVersion: number | null;
  currentVersion: number;
}

/**
 * Check if app version meets minimum requirement
 * @returns Promise<VersionCheckResult>
 */
export async function checkAppVersion(): Promise<VersionCheckResult> {
  try {
    const supabase = getSupabaseClient();
    
    // Get minimum version from database
    const { data: minVersionData, error } = await supabase
      .from('app_control')
      .select('min_app_version')
      .eq('id', 1)
      .single();

    if (error) {
      console.error('Version check error:', error);
      // FAIL CLOSED: Block access on error to ensure security
      // If we can't verify version, assume it's too old
      return {
        allowed: false,
        minVersion: null,
        currentVersion: APP_VERSION,
      };
    }

    const minVersion = minVersionData?.min_app_version ?? null;
    // Check if current version meets minimum requirement
    const allowed = APP_VERSION >= (minVersion ?? 0);

    return {
      allowed,
      minVersion,
      currentVersion: APP_VERSION,
    };
  } catch (error) {
    console.error('Version check exception:', error);
    // FAIL CLOSED: Block access on exception to ensure security
    // If we can't verify version, assume it's too old
    return {
      allowed: false,
      minVersion: null,
      currentVersion: APP_VERSION,
    };
  }
}

/**
 * Check version and show alert if update required
 * Call this on app startup
 */
export async function checkVersionAndAlert(): Promise<boolean> {
  const result = await checkAppVersion();

  if (!result.allowed && result.minVersion !== null) {
    // Store result globally to block future queries
    setVersionCheckResult(false);
    
    Alert.alert(
      'Update Required',
      `Please update the app to the latest version to continue using it.\n\nCurrent version: ${result.currentVersion}\nMinimum required: ${result.minVersion}`,
      [
        {
          text: 'OK',
          onPress: () => {
            // Optionally: Open app store or prevent further app usage
          },
        },
      ],
      { cancelable: false }
    );
    return false;
  }

  // Store successful result
  setVersionCheckResult(true);
  return true;
}

