# Changelog

All notable changes to the Airtel Router app will be documented in this file.

## [3.0.0] - 2025-01-XX

### 🎉 Major Features

#### Onboarding Tutorial

- **Beautiful multi-slide tutorial** with custom images and icons
- **10 comprehensive slides** covering all app features:
  1. Welcome to Airtel Router
  2. Secure Authentication
  3. Smart AI Automation
  4. Powerful Messages
  5. Pin Important Conversations
  6. Quick Reply Templates
  7. Enhanced Chat Experience
  8. Batch Operations
  9. Real-Time Notifications
  10. You're All Set!
- **Custom image support** for tutorial slides (slider1.png, slider2.png, slider3.png)
- **Bidirectional navigation** - swipe or use Previous/Next buttons
- **Minimum viewing time** per slide to ensure users read content
- **Non-skippable** tutorial on first launch
- **Smooth animations** and fade transitions between slides
- **Progress indicators** with dots and progress bar

#### Real-Time Notifications

- **Instant notifications** when new customers sign up today
- **Automatic permission requests** on app launch
- **Background notifications** - works even when app is closed
- **Smart filtering** - only notifies for today's registrations (not historical data)
- **Custom notification content** with customer name
- **Sound and badge support** for better visibility

#### Enhanced Home Dashboard

- **Improved duplicate detection** - total registered now shows unique count (minus duplicates)
- **Today's count** also excludes duplicates for accurate metrics
- **Better data accuracy** with duplicate-aware counting
- **Real-time updates** via Supabase Realtime subscriptions

### ✨ Improvements

#### Messages Page

- **Removed preloading feature** that was causing errors
- **Improved stability** and performance
- **Better error handling**

#### UI/UX Enhancements

- **Tutorial images** with responsive sizing
- **Full-width images** for horizontal compositions (AI Automation slide)
- **Consistent icon styling** without backgrounds
- **Better visual hierarchy** in tutorial slides

### 🔧 Technical Changes

#### Dependencies

- Added `expo-notifications` for push notifications
- Updated `expo-constants` compatibility

#### Configuration

- Added `RECEIVE_BOOT_COMPLETED` permission for Android notifications
- Updated version to 3.0.0
- Updated Android versionCode to 3
- Updated iOS buildNumber to 3

#### Code Quality

- Improved error handling in notification setup
- Better TypeScript types
- Cleaner code organization

### 📱 Platform Support

- ✅ Android (with notification support)
- ✅ iOS (with notification support)
- ⚠️ Expo Go limitations: Notifications don't work in Expo Go (requires development build)

### 🐛 Bug Fixes

- Fixed duplicate counting logic for today's registrations
- Fixed notification permission handling
- Improved tutorial navigation reliability
- Fixed image sizing issues in tutorial

### 📝 Documentation

- Created `CHANGELOG.md` for version tracking
- Created `NOTIFICATION_PREVIEW.md` with notification examples
- Updated `TUTORIAL_IMAGE_PROMPTS.md` with new slide prompts
- Created deployment guides

---

## [2.0.0] - Previous Version

### Features

- Biometric authentication with PIN fallback
- AI-powered WhatsApp message automation
- Message page improvements (copy, date separators, scroll to bottom, quick replies, pinning)
- Haptic feedback throughout the app
- Data preloading (removed in 3.0.0 due to stability issues)

---

## [1.0.0] - Initial Release

### Features

- Customer management dashboard
- WhatsApp messaging integration
- Lead tracking and export
- Basic authentication
