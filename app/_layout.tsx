import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import {
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
} from "@expo-google-fonts/montserrat";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { checkVersionAndAlert } from "../lib/version-checker";
import "../global.css";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
  });
  const [versionCheckPassed, setVersionCheckPassed] = useState<boolean | null>(null);

  useEffect(() => {
    if (fontsLoaded) {
      // Check app version first - block everything if version is too old
      checkVersionAndAlert()
        .then((passed) => {
          setVersionCheckPassed(passed);
          SplashScreen.hideAsync();
        })
        .catch((error) => {
          console.error('Version check failed:', error);
          // FAIL CLOSED: Block access on error to ensure security
          setVersionCheckPassed(false);
          SplashScreen.hideAsync();
        });
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  // Show blocking screen if version check failed
  if (versionCheckPassed === false) {
    return (
      <View style={styles.blockingContainer}>
        <Text style={styles.blockingTitle}>Update Required</Text>
        <Text style={styles.blockingMessage}>
          Please update the app to the latest version to continue using it.
        </Text>
        <Text style={styles.blockingSubtext}>
          The app will not function until you update.
        </Text>
      </View>
    );
  }

  // Wait for version check to complete
  if (versionCheckPassed === null) {
    return null; // Still checking, show splash screen
  }

  return (
    <>
      <StatusBar style="light" hidden={true} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  blockingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 20,
  },
  blockingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  blockingMessage: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  blockingSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
});
