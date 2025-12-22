# Onboarding Tutorial

## Overview
A beautiful, non-skippable onboarding tutorial that introduces users to all the key features of the Airtel Router app. The tutorial appears on first launch and cannot be skipped until minimum viewing times are met.

## Features

### ✨ Beautiful Design
- Smooth slide animations
- Color-coded slides with unique icons
- Progress bar showing completion status
- Dot indicators for slide navigation
- Fade animations between slides

### 🔒 Non-Skippable
- Users cannot proceed to the next slide until minimum viewing time is met
- Minimum time is calculated based on content length:
  - Short slides (welcome/ending): 3 seconds
  - Medium slides (simple features): 4 seconds
  - Long slides (complex features with lists): 4.5-5 seconds

### 📱 Slide Content

1. **Welcome Slide** (3s)
   - Introduction to the app
   - Sets the tone for the experience

2. **Secure Authentication** (4s)
   - Biometric authentication
   - PIN fallback
   - Security features

3. **Smart AI Automation** (5s)
   - Automatic message responses
   - Smart intent detection
   - AI-tagged responses
   - Agent review system

4. **Powerful Messages** (4s)
   - Real-time sync
   - Advanced search
   - Smart filters
   - Unread indicators

5. **Pin Important Conversations** (4s)
   - Long-press to pin
   - Pinned conversations stay on top
   - Quick access to VIPs

6. **Quick Reply Templates** (4s)
   - 5 pre-built templates
   - One-tap insertion
   - Editable before sending

7. **Enhanced Chat Experience** (4.5s)
   - Date separators
   - Scroll to bottom
   - Copy messages
   - Smooth animations

8. **Batch Operations** (4s)
   - Multi-select conversations
   - Batch message sending
   - Progress tracking

9. **You're All Set!** (3s)
   - Completion message
   - Encouragement to start using

## Technical Implementation

### Files Created
- `app/onboarding.tsx` - Main tutorial component
- `lib/tutorial.ts` - Tutorial state management utilities

### Files Modified
- `app/index.tsx` - Checks tutorial status on app launch
- `app/_layout.tsx` - Added onboarding route
- `app/auth.tsx` - Redirects to tutorial if not completed

### Storage
- Uses AsyncStorage to track completion
- Key: `@airtel_router:tutorial_completed`
- Value: `"true"` when completed

### Flow
1. App launches → `app/index.tsx`
2. Checks if tutorial completed
3. If not completed → Shows `app/onboarding.tsx`
4. User goes through slides (minimum time enforced)
5. On completion → Saves status and redirects to home
6. On subsequent launches → Skips tutorial, goes to auth

## Minimum Time Calculation

The minimum time per slide is based on:
- **Content length**: Longer descriptions need more time
- **Feature lists**: Slides with bullet points need more time
- **Complexity**: More complex features need more time to understand

Current times:
- Welcome/Ending: 3000ms (3 seconds)
- Simple features: 4000ms (4 seconds)
- Complex features: 4500-5000ms (4.5-5 seconds)

## Customization

### Adding New Slides
Edit `TUTORIAL_SLIDES` array in `app/onboarding.tsx`:

```typescript
{
  id: 10,
  title: "New Feature",
  description: "Description here",
  icon: "icon-name",
  color: "#HEXCOLOR",
  minTime: 4000,
  features: ["Feature 1", "Feature 2"] // Optional
}
```

### Changing Minimum Times
Update the `minTime` property for each slide based on:
- Reading speed (average 200-250 words per minute)
- Content complexity
- Number of features listed

### Styling
All styles are in the `styles` object in `app/onboarding.tsx`. Key areas:
- `slide` - Individual slide container
- `iconContainer` - Icon background circle
- `content` - Text content area
- `navigation` - Bottom navigation area

## User Experience

### First Launch
1. User opens app
2. Tutorial appears immediately
3. User must view each slide for minimum time
4. "Next" button is disabled until minimum time passes
5. Progress bar shows completion
6. Dot indicators show current position
7. On last slide, button changes to "Get Started"
8. Completing tutorial saves status and enters app

### Subsequent Launches
1. User opens app
2. Tutorial status checked
3. If completed → Goes directly to auth screen
4. Tutorial never shows again (unless storage is cleared)

## Testing

To test the tutorial again:
1. Clear app data, OR
2. Delete AsyncStorage key: `@airtel_router:tutorial_completed`
3. Restart the app

## Future Enhancements

Potential improvements:
- Add skip option (if needed) with confirmation
- Add tutorial replay option in settings
- Add video/gif demonstrations
- Add interactive elements
- Add haptic feedback on slide transitions
- Add sound effects (optional)





