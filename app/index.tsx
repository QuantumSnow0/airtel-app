import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { hasPIN } from "../lib/auth";

export default function Index() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    // Always show auth screen for security
    setIsReady(true);
  };

  if (!isReady) {
    return null;
  }

  // Redirect to auth screen first
  return <Redirect href="/auth" />;
}
