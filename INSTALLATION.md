# Installation Guide for Task Timers

## Prerequisites

- Home Assistant 2024.1.0 or later
- HACS (Home Assistant Community Store) installed
- Administrator access to HA configuration

## Installation Steps

### 1. Add Repository to HACS

1. Open **Settings → Devices & Services → HACS**
2. Click the **⋯** menu and select **Custom repositories**
3. Enter repository URL: `https://github.com/yourusername/task-timers`
4. Select category: **Integration**
5. Click **Create**

### 2. Install Integration

1. Go to **HACS → Integrations**
2. Search for "Task Timers"
3. Click **Install**
4. **Restart Home Assistant** (Settings > System > Restart)

### 3. Add to Lovelace

After restart, add cards to your dashboard:

#### YAML Mode:
```yaml
views:
  - title: Home
    cards:
      - type: custom:task-timer-card
      - type: custom:task-expiry-card
        days_warning: 14
```

#### UI Mode:
1. Click **+ Create New Card**
2. Click on "Custom card"
3. Select **Task Timer Card** or **Task Expiry Card**

### 4. Configure Timers

1. Go to **Settings → Devices & Services → Task Timers**
2. Click **Create Automation** or access the admin panel
3. Enter timer details:
   - Name (e.g., "AC Filter")
   - Type (One-time or Recurring)
   - Interval or cron pattern
   - Notification preferences

## Troubleshooting

### Timers not showing in card
- Ensure Home Assistant has restarted
- Check browser console for JavaScript errors (F12)
- Clear browser cache and reload

### Integration not appearing in device list
- Verify installation completed (check logs)
- Try restarting HA: Settings > System > Restart the system
- Check `home-assistant.log` for errors

### Notifications not working
- Verify notify service is available
- Check automation rules are created
- Test with a manual service call in Developer Tools

## Uninstallation

1. Go to **HACS → Integrations**
2. Find "Task Timers"
3. Click **Remove**
4. Restart Home Assistant
5. Delete `/config/custom_components/task_timers/` (optional)

## Support

- Issues: [GitHub Issues](https://github.com/yourusername/task-timers/issues)
- Discussions: [GitHub Discussions](https://github.com/yourusername/task-timers/discussions)
- Home Assistant Community: (link to your thread)
