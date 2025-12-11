# Version 2.0.0 Deployment Checklist

## Pre-Deployment Checklist

### ✅ Version Updates
- [x] Updated `package.json` version to `2.0.0`
- [x] Updated `app.json` version to `2.0.0`
- [x] Updated Android `versionCode` to `2`
- [x] Updated iOS `buildNumber` to `2`

### ✅ Configuration Files
- [x] EAS build configuration verified (`eas.json`)
- [x] App permissions updated (biometric permissions added)
- [x] CHANGELOG.md created with version 2.0.0 notes

### ✅ Features Verified
- [x] Biometric authentication implemented
- [x] PIN fallback functionality working
- [x] Secure storage for PINs configured
- [x] Authentication flow integrated into app entry point

## Build Commands

### Development Build
```bash
eas build --profile development --platform android
eas build --profile development --platform ios
```

### Preview Build (Internal Testing)
```bash
eas build --profile preview --platform android
eas build --profile preview --platform ios
```

### Production Build
```bash
eas build --profile production --platform android
eas build --profile production --platform ios
```

### Build for Both Platforms
```bash
eas build --profile production --platform all
```

## Submission Commands

### Submit to Google Play Store
```bash
eas submit --platform android --profile production
```

### Submit to Apple App Store
```bash
eas submit --platform ios --profile production
```

## Post-Deployment

### Testing Checklist
- [ ] Test biometric authentication on physical devices
- [ ] Test PIN fallback on devices without biometrics
- [ ] Verify first-time PIN setup flow
- [ ] Test app launch authentication flow
- [ ] Verify all existing features still work
- [ ] Test on both Android and iOS devices

### Release Notes for App Stores

**Version 2.0.0 - Security Enhancement**

We've added enhanced security features to protect your data:

- 🔐 **Biometric Authentication**: Unlock the app with your fingerprint or face recognition
- 🔑 **PIN Fallback**: Use a secure PIN if biometric authentication isn't available
- 🛡️ **Enhanced Security**: All sensitive data is now stored securely

Your app is now more secure than ever!

## Notes

- The EAS production build profile has `autoIncrement: true`, which will automatically increment version codes for future builds
- Make sure to test the authentication flow thoroughly before submitting to app stores
- Consider adding a "Forgot PIN" or "Reset PIN" feature in future versions if needed

## Troubleshooting

If you encounter issues during build:
1. Check that all dependencies are installed: `npm install`
2. Verify EAS CLI is up to date: `npm install -g eas-cli`
3. Check EAS project configuration: `eas project:info`
4. Review build logs in Expo dashboard

