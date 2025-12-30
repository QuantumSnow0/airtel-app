/**
 * Version Blocker
 * 
 * Stores the version check result globally so we can block
 * Supabase queries if version is too old.
 */

let versionCheckPassed: boolean | null = null;
let versionCheckComplete = false;

export function setVersionCheckResult(passed: boolean) {
  versionCheckPassed = passed;
  versionCheckComplete = true;
}

export function isVersionCheckPassed(): boolean {
  // If check hasn't completed yet, allow (fail open during check)
  if (!versionCheckComplete) {
    return true;
  }
  return versionCheckPassed === true;
}

export function resetVersionCheck() {
  versionCheckPassed = null;
  versionCheckComplete = false;
}




