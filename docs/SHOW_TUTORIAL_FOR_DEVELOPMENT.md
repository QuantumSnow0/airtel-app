# Show Tutorial for Development

## Quick Setup

The tutorial is now **always visible** for development purposes.

### Current Setting
In `app/index.tsx`, line 15:
```typescript
const FORCE_SHOW_TUTORIAL = true; // Always show tutorial
```

### To Disable (Production)
Change to:
```typescript
const FORCE_SHOW_TUTORIAL = false; // Check completion status
```

## Alternative: Reset Tutorial

You can also reset the tutorial completion status programmatically:

```typescript
import { resetTutorial } from "../lib/tutorial";

// Call this to reset tutorial
await resetTutorial();
```

Or manually clear AsyncStorage:
- Key: `@airtel_router:tutorial_completed`
- Delete this key to show tutorial again

## Home Screen Icon/Background

The home screen header currently shows:
- **Title**: "Airtel Dashboard" (text only, no icon)
- **Background**: Dark theme (#0A0A0A)

### To Add Your Icon/Background

1. **Add icon to header** (in `app/(tabs)/home.tsx`):
   - Place your icon in `assets/images/`
   - Import: `import { Image } from "react-native";`
   - Add before title:
   ```tsx
   <Image 
     source={require("../../assets/images/your-icon.png")} 
     style={styles.headerIcon} 
   />
   ```

2. **Add background image** (optional):
   ```tsx
   <ImageBackground 
     source={require("../../assets/images/your-background.png")} 
     style={styles.headerBackground}
   >
     {/* Header content */}
   </ImageBackground>
   ```

3. **Style the icon** (in styles):
   ```typescript
   headerIcon: {
     width: 32,  // Adjust size
     height: 32, // Adjust size
     marginRight: 12,
   },
   ```

### Current Header Styles
Located in `app/(tabs)/home.tsx` around line 1084:
- `headerTitle`: Font size 16, Montserrat_600SemiBold
- `header`: Padding, background color

Adjust these styles to make the icon/background fit properly.





