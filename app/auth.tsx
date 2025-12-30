import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  authenticateWithBiometrics,
  hasPIN,
  isBiometricAvailable,
  setPIN,
  verifyPIN,
  setBiometricEnabled,
} from '../lib/auth';
import { navigateAfterAuth } from '../lib/tutorial';

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [showPinInput, setShowPinInput] = useState(false);
  const [pinError, setPinError] = useState('');

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    const hasPin = await hasPIN();
    const bioAvailable = await isBiometricAvailable();

    setBiometricAvailable(bioAvailable);
    setIsSettingUp(!hasPin);

    // If PIN exists and biometric is available, try biometric first
    if (hasPin && bioAvailable) {
      attemptBiometricAuth();
    } else if (hasPin) {
      // PIN exists but no biometric, show PIN input
      setShowPinInput(true);
    }
  };

  const attemptBiometricAuth = async () => {
    setIsAuthenticating(true);
    const result = await authenticateWithBiometrics();

    if (result.success) {
      await setBiometricEnabled(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigateAfterAuth();
    } else {
      // Biometric failed or cancelled, show PIN fallback
      setShowPinInput(true);
    }
    setIsAuthenticating(false);
  };

  const handlePinSetup = async () => {
    if (pin.length < 4) {
      setPinError('PIN must be at least 4 digits');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (isSettingUp) {
      if (!confirmPin) {
        setPinError('Please confirm your PIN');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      if (pin !== confirmPin) {
        setPinError('PINs do not match');
        setPin('');
        setConfirmPin('');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      // Save PIN
      await setPIN(pin);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // If biometric is available, ask if user wants to enable it
      if (biometricAvailable) {
        Alert.alert(
          'Enable Biometric Authentication?',
          'Would you like to use fingerprint or face recognition to unlock the app?',
          [
            {
              text: 'Skip',
              style: 'cancel',
              onPress: () => {
                navigateAfterAuth();
              },
            },
            {
              text: 'Enable',
              onPress: async () => {
                await setBiometricEnabled(true);
                const result = await authenticateWithBiometrics();
                if (result.success) {
                  navigateAfterAuth();
                } else {
                  navigateAfterAuth();
                }
              },
            },
          ]
        );
      } else {
        navigateAfterAuth();
      }
    } else {
      // Verifying PIN
      const isValid = await verifyPIN(pin);
      if (isValid) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        navigateAfterAuth();
      } else {
        setPinError('Incorrect PIN');
        setPin('');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }
  };

  const handleUsePin = () => {
    setShowPinInput(true);
  };

  const renderPinInput = () => (
    <View style={styles.pinContainer}>
      <Text style={styles.title}>
        {isSettingUp ? 'Create Your PIN' : 'Enter Your PIN'}
      </Text>
      <Text style={styles.subtitle}>
        {isSettingUp
          ? 'Enter a 4-digit PIN to secure your app'
          : 'Enter your PIN to continue'}
      </Text>

      <TextInput
        style={[styles.pinInput, pinError && styles.pinInputError]}
        value={pin}
        onChangeText={(text) => {
          setPin(text.replace(/[^0-9]/g, ''));
          setPinError('');
        }}
        placeholder={isSettingUp ? 'Enter PIN' : 'PIN'}
        placeholderTextColor="#666"
        secureTextEntry
        keyboardType="number-pad"
        maxLength={6}
        autoFocus
      />

      {isSettingUp && (
        <TextInput
          style={[styles.pinInput, pinError && styles.pinInputError]}
          value={confirmPin}
          onChangeText={(text) => {
            setConfirmPin(text.replace(/[^0-9]/g, ''));
            setPinError('');
          }}
          placeholder="Confirm PIN"
          placeholderTextColor="#666"
          secureTextEntry
          keyboardType="number-pad"
          maxLength={6}
        />
      )}

      {pinError ? <Text style={styles.errorText}>{pinError}</Text> : null}

      <TouchableOpacity
        style={[styles.button, pin.length < 4 && styles.buttonDisabled]}
        onPress={handlePinSetup}
        disabled={pin.length < 4}
      >
        <Text style={styles.buttonText}>
          {isSettingUp ? 'Set PIN' : 'Verify'}
        </Text>
      </TouchableOpacity>

      {!isSettingUp && biometricAvailable && (
        <TouchableOpacity
          style={styles.biometricButton}
          onPress={attemptBiometricAuth}
        >
          <Ionicons name="finger-print" size={24} color="#FFD700" />
          <Text style={styles.biometricButtonText}>Use Biometric</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (isAuthenticating && !showPinInput) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loadingText}>Authenticating...</Text>
      </View>
    );
  }

  if (showPinInput || isSettingUp) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.container, { paddingTop: insets.top }]}
      >
        {renderPinInput()}
      </KeyboardAvoidingView>
    );
  }

  // Initial state - show biometric prompt if available
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.biometricPrompt}>
        <Ionicons name="finger-print" size={80} color="#FFD700" />
        <Text style={styles.promptTitle}>Unlock App</Text>
        <Text style={styles.promptSubtitle}>
          Use your fingerprint or PIN to continue
        </Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={attemptBiometricAuth}
        >
          <Ionicons name="finger-print" size={24} color="#000" />
          <Text style={styles.primaryButtonText}>Authenticate</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={handleUsePin}>
          <Text style={styles.secondaryButtonText}>Use PIN Instead</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#FFF',
    marginTop: 20,
    fontSize: 16,
  },
  biometricPrompt: {
    alignItems: 'center',
    width: '100%',
  },
  promptTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 24,
    marginBottom: 8,
  },
  promptSubtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    marginBottom: 40,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#FFD700',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    maxWidth: 300,
    marginBottom: 16,
    gap: 8,
  },
  primaryButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  secondaryButtonText: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: '500',
  },
  pinContainer: {
    width: '100%',
    maxWidth: 400,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    marginBottom: 32,
    textAlign: 'center',
  },
  pinInput: {
    backgroundColor: '#1F1F1F',
    color: '#FFF',
    fontSize: 18,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 16,
    textAlign: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  pinInputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#FFD700',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '600',
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 16,
    gap: 8,
  },
  biometricButtonText: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: '500',
  },
});

