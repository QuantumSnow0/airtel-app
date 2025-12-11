# Changelog

All notable changes to the Airtel Router app will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2024-12-XX

### Added
- **Biometric Authentication**: Added fingerprint and face recognition authentication for enhanced app security
  - Automatic biometric prompt on app launch
  - PIN fallback option when biometric authentication is unavailable or fails
  - Secure PIN storage using Expo Secure Store
  - First-time PIN setup flow for new users
  - Support for both fingerprint and face ID authentication
- **App Security**: Implemented app-level security with authentication required before accessing main features
- **Biometric Permissions**: Added necessary permissions for biometric authentication on Android and iOS

### Security
- All sensitive data (PINs) are now stored securely using Expo Secure Store
- App requires authentication (biometric or PIN) before accessing any features
- Enhanced security with automatic authentication prompts on app launch

### Changed
- App entry flow now redirects to authentication screen before accessing main tabs
- Updated navigation stack to include authentication screen

### Technical
- Added `expo-local-authentication` package for biometric authentication
- Added `expo-secure-store` package for secure data storage
- Updated Android version code to 2
- Updated iOS build number to 2

## [1.0.0] - Initial Release

### Added
- Lead management system with real-time updates
- Customer management interface
- WhatsApp messaging integration
- Data export functionality (Excel)
- Calendar integration for visit scheduling
- Supabase integration for data storage
- Real-time data synchronization
- Dark theme UI with modern design
- Tab-based navigation (Home, Customers, Messages)

---

[2.0.0]: https://github.com/your-repo/airtel-router/releases/tag/v2.0.0
[1.0.0]: https://github.com/your-repo/airtel-router/releases/tag/v1.0.0

