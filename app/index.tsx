import { Redirect, router } from "expo-router";
import { useEffect, useState } from "react";
import { isTutorialCompleted } from "../lib/tutorial";

export default function Index() {
  const [isReady, setIsReady] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    checkTutorialAndAuth();
  }, []);

  const checkTutorialAndAuth = async () => {
    try {
      // FOR DEVELOPMENT: Set to true to always show tutorial
      const FORCE_SHOW_TUTORIAL = false; // Change to false to check completion status
      
      if (FORCE_SHOW_TUTORIAL) {
        // Always show tutorial (development mode)
        setShowTutorial(true);
        setIsReady(true);
        return;
      }
      
      // Check if tutorial has been completed
      const tutorialCompleted = await isTutorialCompleted();
      
      if (!tutorialCompleted) {
        // Show tutorial first
        setShowTutorial(true);
        setIsReady(true);
        return;
      }

      // Tutorial completed, proceed to auth
      setIsReady(true);
    } catch (error) {
      console.error("Error checking tutorial status:", error);
      setIsReady(true);
    }
  };

  if (!isReady) {
    return null;
  }

  // Show tutorial if not completed
  if (showTutorial) {
    router.replace("/onboarding");
    return null;
  }

  // Redirect to auth screen
  return <Redirect href="/auth" />;
}
