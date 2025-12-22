import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";

const TUTORIAL_STORAGE_KEY = "@airtel_router:tutorial_completed";

export async function isTutorialCompleted(): Promise<boolean> {
  try {
    const completed = await AsyncStorage.getItem(TUTORIAL_STORAGE_KEY);
    return completed === "true";
  } catch (error) {
    console.error("Error checking tutorial status:", error);
    return false;
  }
}

export async function markTutorialCompleted(): Promise<void> {
  try {
    await AsyncStorage.setItem(TUTORIAL_STORAGE_KEY, "true");
  } catch (error) {
    console.error("Error saving tutorial status:", error);
  }
}

export async function navigateAfterAuth(): Promise<void> {
  const completed = await isTutorialCompleted();
  if (completed) {
    router.replace("/(tabs)/home");
  } else {
    router.replace("/onboarding");
  }
}

/**
 * Reset tutorial completion (for development/testing)
 * Call this to show tutorial again
 */
export async function resetTutorial(): Promise<void> {
  try {
    await AsyncStorage.removeItem(TUTORIAL_STORAGE_KEY);
    console.log("Tutorial reset - will show on next launch");
  } catch (error) {
    console.error("Error resetting tutorial:", error);
  }
}

