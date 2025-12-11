import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const PIN_KEY = 'app_pin';
const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';

/**
 * Check if biometric authentication is available on the device
 */
export async function isBiometricAvailable(): Promise<boolean> {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  if (!compatible) return false;

  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return enrolled;
}

/**
 * Get the type of biometric authentication available
 */
export async function getBiometricType(): Promise<LocalAuthentication.AuthenticationType[]> {
  return await LocalAuthentication.supportedAuthenticationTypesAsync();
}

/**
 * Check if a PIN has been set
 */
export async function hasPIN(): Promise<boolean> {
  const pin = await SecureStore.getItemAsync(PIN_KEY);
  return pin !== null;
}

/**
 * Set or update the PIN
 */
export async function setPIN(pin: string): Promise<void> {
  await SecureStore.setItemAsync(PIN_KEY, pin);
}

/**
 * Verify the PIN
 */
export async function verifyPIN(pin: string): Promise<boolean> {
  const storedPIN = await SecureStore.getItemAsync(PIN_KEY);
  return storedPIN === pin;
}

/**
 * Authenticate using biometrics
 */
export async function authenticateWithBiometrics(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const available = await isBiometricAvailable();
    if (!available) {
      return {
        success: false,
        error: 'Biometric authentication is not available on this device',
      };
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to access the app',
      fallbackLabel: 'Use PIN',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });

    if (result.success) {
      return { success: true };
    } else {
      return {
        success: false,
        error: result.error || 'Authentication failed',
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if biometric is enabled in settings
 */
export async function isBiometricEnabled(): Promise<boolean> {
  const enabled = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
  return enabled === 'true';
}

/**
 * Enable or disable biometric authentication
 */
export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, enabled ? 'true' : 'false');
}

