# Task Timers for Home Assistant

A HACS integration for Home Assistant that provides task-based timers with Lovelace cards for tracking recurring maintenance tasks, filter changes, and time-sensitive activities.

## Features

- ✅ **One-time and recurring timers** — interval-based (every 30 days) or cron-style (1st Monday monthly, 9am daily)
- ✅ **Persistent storage** — timers survive HA restarts
- ✅ **HA Timer Entities** — create `timer.*` entities for use in automations
- ✅ **Task Timer Card** — display active timers with countdown & reset buttons
- ✅ **Expiry Card** — show timers expiring soon or already expired
- ✅ **Admin UI** — web panel to add/edit/delete timers
- ✅ **History tracking** — see when tasks were last completed
- ✅ **Configurable notifications** — visual alerts, service calls, or automations

## Installation

1. Add this repo to HACS as a custom repository
2. Install "Task Timers"
3. Restart Home Assistant
4. Add cards to your Lovelace dashboard
5. Configure timers via the admin panel

## Quick Start

1. Open the admin panel: **Settings → Devices & Services → Task Timers**
2. Click **+ Add Timer**
3. Enter a name (e.g., "Air Conditioner Filter") and configure:
   - **Type:** One-time or Recurring
   - **Interval:** Days/hours between resets (if recurring)
   - **Schedule:** Optional cron pattern (if cron scheduling preferred)
4. Click **Save**
5. Add cards to dashboard to view timers

### Cards Available

#### Task Timer Card
Shows a list of all active timers with countdown and reset buttons.

```yaml
type: custom:task-timer-card
```

#### Expiry Alert Card
Shows timers that are expiring soon or already expired.

```yaml
type: custom:task-expiry-card
days_warning: 7  # Show timers expiring in next 7 days
```

## Configuration

### Timer Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | string | Yes | Human-readable timer name |
| `type` | string | Yes | `one_time` or `recurring` |
| `interval_days` | number | For recurring | Days between resets |
| `interval_hours` | number | For recurring | Hours between resets (if < 1 day) |
| `cron_pattern` | string | Optional | Cron expression (overrides interval) |
| `notify_enabled` | boolean | No | Enable notifications at expiry |
| `notify_type` | string | No | `persistent_notification`, `event`, or `service_call` |
| `service_call` | dict | Optional | HA service to call on expiry |
| `tags` | list | No | Categories (`filter`, `maintenance`, etc.) |

### Cron Pattern Examples

- `0 9 * * *` — Daily at 9:00 AM
- `0 0 1 * *` — 1st of every month
- `0 0 ? * MON` — Every Monday
- `0 0 1 1 *` — January 1st

## Home Assistant Entities

Each timer creates:
- `timer.task_name_timer` — HA timer entity (can be used in automations)
- `sensor.task_name_remaining` — Countdown sensor
- `sensor.task_name_last_reset` — Last reset timestamp

## Examples

### Dashboard YAML
```yaml
- type: custom:task-timer-card
- type: custom:task-expiry-card
  days_warning: 14
```

### Automation (Notify on expiry)
```yaml
- alias: "Notify when AC filter is due"
  trigger:
    platform: state
    entity_id: timer.ac_filter_timer
    to: "expired"
  action:
    service: notify.notify
    data:
      message: "Time to change the AC filter!"
```

## Support

- Issues: [GitHub Issues](https://github.com/shouldbecommitted/task-timers/issues)
- Discussions: [GitHub Discussions](https://github.com/shouldbecommitted/task-timers/discussions)

## License

MIT License — see LICENSE file
