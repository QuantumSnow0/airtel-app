# Deployment Guide - Version 3.0.0

This guide covers the deployment process for Airtel Router version 3.0.0.

## Pre-Deployment Checklist

### ✅ Version Updates
- [x] Updated `package.json` version to `3.0.0`
- [x] Updated `app.json` version to `3.0.0`
- [x] Updated Android `versionCode` to `3`
- [x] Updated iOS `buildNumber` to `3`

### ✅ Code Review
- [x] All features tested
- [x] No console errors
- [x] Notification permissions working
- [x] Tutorial displays correctly
- [x] Duplicate counting accurate

### ✅ Dependencies
- [x] `expo-notifications` installed
- [x] All dependencies up to date
- [x] No security vulnerabilities (review audit)

### ✅ Configuration
- [x] Android notification permission added
- [x] App icons and splash screens ready
- [x] Environment variables configured

## Build Commands

### Development Build (for testing notifications)

#### Android
```bash
eas build --profile development --platform android
```

#### iOS
```bash
eas build --profile development --platform ios
```

### Production Build

#### Android APK
```bash
eas build --profile production --platform android
```

#### Android AAB (for Play Store)
```bash
eas build --profile production --platform android --type app-bundle
```

#### iOS
```bash
eas build --profile production --platform ios
```

## Testing Checklist

### Tutorial/Onboarding
- [ ] Tutorial appears on first launch
- [ ] All 10 slides display correctly
- [ ] Images load properly (slider1, slider2, slider3)
- [ ] Navigation works (Previous/Next buttons)
- [ ] Swipe gestures work
- [ ] Progress indicators accurate
- [ ] Tutorial doesn't show after completion
- [ ] Minimum viewing times enforced

### Notifications
- [ ] Permission request appears on first launch
- [ ] Notifications work when permission granted
- [ ] Notification appears when new customer registered today
- [ ] Notification shows correct customer name
- [ ] Notification sound plays
- [ ] Badge updates correctly
- [ ] Works in background
- [ ] Only shows for today's registrations

### Home Dashboard
- [ ] Total registered shows unique count (minus duplicates)
- [ ] Today's count shows unique count (minus duplicates)
- [ ] Duplicate detection working correctly
- [ ] Real-time updates work
- [ ] Export functions work

### Messages Page
- [ ] No errors on load
- [ ] Conversations load correctly
- [ ] Search works
- [ ] Filters work
- [ ] All features functional

## Submission Commands

### Android (Google Play Store)

1. **Build AAB:**
   ```bash
   eas build --profile production --platform android --type app-bundle
   ```

2. **Submit to Play Store:**
   ```bash
   eas submit --platform android
   ```

### iOS (App Store)

1. **Build for App Store:**
   ```bash
   eas build --profile production --platform ios
   ```

2. **Submit to App Store:**
   ```bash
   eas submit --platform ios
   ```

## Post-Deployment

### Monitoring
- [ ] Monitor crash reports
- [ ] Check notification delivery rates
- [ ] Review user feedback
- [ ] Monitor app performance

### Rollback Plan
If critical issues are found:
1. Stop new installs in stores
2. Revert to previous version if needed
3. Fix issues in hotfix version
4. Deploy hotfix

## Important Notes

### Notification Limitations
- ⚠️ **Expo Go**: Notifications don't work in Expo Go
- ✅ **Development Build**: Notifications work in development builds
- ✅ **Production Build**: Notifications work in production builds

### Testing Notifications
To test notifications:
1. Build a development build (not Expo Go)
2. Install on physical device
3. Grant notification permissions
4. Register a new customer to trigger notification

### Tutorial Images
- Images are stored in `assets/silder/` (note: "silder" spelling)
- Current images: slider1.png, slider2.png, slider3.png
- Remaining slides use Ionicons
- Can add more images later if needed

## Version History

- **3.0.0**: Current version with tutorial and notifications
- **2.0.0**: Biometric auth and AI automation
- **1.0.0**: Initial release

## Support

For issues or questions:
- Check `CHANGELOG.md` for feature details
- Review `NOTIFICATION_PREVIEW.md` for notification examples
- Check `TUTORIAL_IMAGE_PROMPTS.md` for image generation





