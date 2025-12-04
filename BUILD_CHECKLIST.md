# Airtel Router - APK Build Checklist

## ✅ Configuration Complete

### App Identity

- **App Name**: Airtel Router
- **Package Name**: `com.airtel.router`
- **Version**: 1.0.0
- **Version Code**: 1 (increment for each release)

### Icons & Assets

- ✅ **Main Icon**: `./assets/images/icon.png` (transparent background)
- ✅ **Android Adaptive Icon**: Configured
  - Foreground: `./assets/images/icon.png`
  - Background Color: `#0A0A0A` (dark theme)
- ✅ **Splash Screen**: Configured

### Android Configuration

- ✅ **Package**: `com.airtel.router`
- ✅ **Version Code**: `1`
- ✅ **Permissions**:
  - `CALL_PHONE` - Required for phone calling functionality
  - `INTERNET` - Required for Supabase connection
- ✅ **Adaptive Icon**: Configured with dark background

### Features Enabled

- ✅ Real-time data updates (Supabase Realtime)
- ✅ Phone number calling (long press)
- ✅ Copy to clipboard (tap)
- ✅ Dark theme UI
- ✅ Duplicate customer detection
- ✅ Search and filter functionality

## ⚠️ Required Before Build

### 1. Environment Variables

Make sure these are configured in your build environment:

**For EAS Build (recommended):**

```bash
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**For local build:**
Create a `.env` file in the project root:

```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

⚠️ **Important**: Use the ANON KEY (public key), NOT the service role key!

### 2. Supabase Configuration

- Ensure Row Level Security (RLS) policies are configured in Supabase
- Verify the `leads` table is accessible with your anon key
- Test real-time subscriptions are working

### 3. Build Commands

**Using EAS Build (recommended):**

```bash
# Install EAS CLI if not already installed
npm install -g eas-cli

# Login to Expo
eas login

# Configure build
eas build:configure

# Build APK
eas build --platform android --profile preview
```

**Using Expo Development Build:**

```bash
npx expo prebuild
npx expo run:android
```

### 4. Testing Checklist

Before releasing:

- [ ] Test on multiple Android devices/versions
- [ ] Verify phone calling works
- [ ] Test copy to clipboard
- [ ] Verify Supabase connection
- [ ] Test real-time updates
- [ ] Test search and filters
- [ ] Verify duplicate detection
- [ ] Test pull-to-refresh

## 📝 Version Management

For future releases, remember to:

1. Update `version` in `app.json` (e.g., "1.0.1")
2. Increment `versionCode` in Android config (e.g., 2)
3. Update this checklist

## 🔐 Security Notes

- ✅ Using ANON KEY (not service role key) - Correct!
- ✅ Environment variables properly scoped with `EXPO_PUBLIC_` prefix
- ⚠️ Ensure Supabase RLS policies are properly configured for production

## 📱 Current App Configuration

### Permissions Used

- **CALL_PHONE**: Opens dialer when user long-presses phone numbers
- **INTERNET**: Required for Supabase API calls

### Network Access

- App connects to Supabase for data
- Real-time subscriptions enabled
- No additional network permissions needed

## 🎨 Theme Configuration

- **Primary Color**: Golden/Yellow (#FFD700)
- **Background**: Dark (#0A0A0A)
- **Text**: White/Gray
- **Accents**: Green (success), Red (errors/duplicates), Orange (warnings)

---

**Last Updated**: Ready for first build
**Build Status**: ✅ All configurations complete
