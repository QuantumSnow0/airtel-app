# New Customer Notification Preview

## Notification Appearance

When a new customer registers today, you'll receive a notification that looks like this:

### Android Notification

```
┌─────────────────────────────────────────┐
│  🎉 New Customer Registered!           │
│                                         │
│  John Doe just signed up today         │
│                                         │
│  [Airtel Router]  Just now             │
└─────────────────────────────────────────┘
```

### iOS Notification

```
┌─────────────────────────────────────────┐
│  Airtel Router                          │
│  🎉 New Customer Registered!            │
│                                         │
│  John Doe just signed up today         │
│                                         │
│  [Just now]                            │
└─────────────────────────────────────────┘
```

## Notification Details

### Title

**"New Customer Registered! 🎉"**

### Body

**"[Customer Name] just signed up today"**

- If customer name exists: Shows the actual name (e.g., "John Doe just signed up today")
- If no name: Shows "A new customer just signed up today"

### Features

- ✅ **Sound**: Plays a notification sound
- ✅ **Badge**: Updates app badge count
- ✅ **Alert**: Shows as a banner/alert
- ✅ **Works in background**: Notification appears even when app is closed

## Example Scenarios

### Scenario 1: Customer with Name

```
Title: New Customer Registered! 🎉
Body:  Alex Maina just signed up today
```

### Scenario 2: Customer without Name

```
Title: New Customer Registered! 🎉
Body:  A new customer just signed up today
```

### Scenario 3: Multiple Customers

Each new customer gets their own notification:

```
Notification 1:
Title: New Customer Registered! 🎉
Body:  Sarah Kimani just signed up today

Notification 2:
Title: New Customer Registered! 🎉
Body:  Peter Ochieng just signed up today
```

## Notification Behavior

1. **Real-time**: Notification appears immediately when a new customer is registered
2. **Today only**: Only shows notifications for customers registered today (not historical data)
3. **Automatic**: No manual action needed - works automatically via Supabase Realtime
4. **Non-intrusive**: Can be dismissed or tapped to open the app

## Visual Style

- **Icon**: App icon (Airtel Router)
- **Color**: System default (follows device theme)
- **Sound**: Default notification sound
- **Priority**: Normal priority (won't interrupt important notifications)

## Testing Notes

⚠️ **Expo Go Limitation**: Notifications don't work in Expo Go. To test:

1. Build a development build: `eas build --profile development --platform android`
2. Install on a physical device
3. Grant notification permissions when prompted
4. Register a new customer to see the notification

## Notification Permissions

On first launch, users will see:

- **Android**: "Allow Airtel Router to send you notifications?"
- **iOS**: "Airtel Router Would Like to Send You Notifications"

Users can grant or deny permissions. If denied, notifications won't appear but the app will still function normally.




