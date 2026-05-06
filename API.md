# API Reference for Task Timers

Task Timers exposes a REST API for the admin panel and external automation.

## Configuration

Base URL: `http://YOUR_HA_ADDRESS:8123/api/task_timers/`

**Authentication**: Requires valid Home Assistant Bearer token in `Authorization` header.

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://homeassistant.local:8123/api/task_timers/list
```

## Endpoints

### List Timers
```
GET /api/task_timers/list
```

**Response:**
```json
{
  "timers": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "name": "AC Filter",
      "type": "recurring",
      "next_due": "2026-05-10T12:00:00+12:00",
      "due_at": null,
      "remaining_seconds": 2592000,
      "is_expired": false,
      "is_warning": false,
      "warning_days": 7,
      "last_reset": "2026-04-10T12:00:00+12:00",
      "interval_days": 30,
      "interval_hours": 0,
      "cron_pattern": null,
      "tags": []
    }
  ]
}
```

### Create Timer
```
POST /api/task_timers/create
```

**Request body:**
```json
{
  "name": "Mosquito Filter",
  "type": "recurring",
  "interval_days": 30,
  "warning_days": 7,
  "tags": ["filter"]
}
```

**For one-time timers** (requires `due_at`):
```json
{
  "name": "Update Home Assistant",
  "type": "one_time",
  "due_at": "2026-05-20T09:00:00",
  "warning_days": 3
}
```

**For cron-scheduled recurring timers:**
```json
{
  "name": "Monthly Report",
  "type": "recurring",
  "cron_pattern": "0 9 1 * *",
  "warning_days": 5
}
```

**Response** (returns the full serialized timer):
```json
{
  "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "name": "Mosquito Filter",
  "type": "recurring",
  "next_due": "2026-06-05T12:00:00+12:00",
  "due_at": null,
  "remaining_seconds": 2592000,
  "is_expired": false,
  "is_warning": false,
  "warning_days": 7,
  "last_reset": null,
  "interval_days": 30,
  "interval_hours": 0,
  "cron_pattern": null,
  "tags": ["filter"]
}
```

**Validation errors** (HTTP 400):
```json
{"message": "Recurring timer requires 'interval_days', 'interval_hours', or 'cron_pattern'"}
```

### Update Timer
```
POST /api/task_timers/update/{timer_id}
```

**Request body** (only fields to change):
```json
{
  "name": "AC Filter (Bedroom)",
  "interval_days": 60,
  "warning_days": 14
}
```

**Response** (returns the updated serialized timer):
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "AC Filter (Bedroom)",
  ...
}
```

### Reset Timer
```
POST /api/task_timers/reset/{timer_id}
```

**Response:**
```json
{"success": true}
```

### Delete Timer
```
POST /api/task_timers/delete/{timer_id}
```

**Response:**
```json
{"success": true}
```

## Home Assistant Services

### Create Timer
```yaml
service: task_timers.create_timer
data:
  name: "AC Filter Change"
  type: "recurring"
  interval_days: 90
  warning_days: 14
```

For one-time timers, add `due_at`:
```yaml
service: task_timers.create_timer
data:
  name: "Service Appointment"
  type: "one_time"
  due_at: "2026-06-01T09:00:00"
  warning_days: 7
```

### Reset Timer
```yaml
service: task_timers.reset_timer
data:
  timer_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

### Delete Timer
```yaml
service: task_timers.delete_timer
data:
  timer_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

## Services table

| Service | Fields | Description |
|---|---|---|
| `task_timers.create_timer` | `name` (required), `type`, `interval_days`, `interval_hours`, `cron_pattern`, `due_at`, `warning_days`, `tags` | Create a new timer |
| `task_timers.reset_timer` | `timer_id` (required) | Reset a recurring timer; mark a one-time timer completed |
| `task_timers.delete_timer` | `timer_id` (required) | Permanently remove the timer |

## Timer Data Structure

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Unique timer identifier |
| `name` | string | Human-readable name |
| `type` | string | `one_time` or `recurring` |
| `next_due` | ISO datetime | Next due date/time (timezone-aware) |
| `due_at` | ISO datetime or null | For one-time timers: the target date (alias for `next_due` in serialization) |
| `last_reset` | ISO datetime or null | Last reset timestamp |
| `remaining_seconds` | integer | Seconds until due (negative when overdue) |
| `is_expired` | boolean | Timer is past due |
| `is_warning` | boolean | Timer in warning period |
| `warning_days` | integer | Days before expiry to warn (default 7) |
| `interval_days` | integer | Days between resets (recurring only) |
| `interval_hours` | integer | Hours between resets (recurring only) |
| `cron_pattern` | string or null | Cron schedule (recurring only, e.g. `"0 9 1 * *"`) |
| `tags` | array of strings | User-defined labels |

## Cron Pattern Examples

- `0 9 * * *` — daily at 9:00 AM
- `0 0 1 * *` — 1st of every month
- `0 0 * * MON` — every Monday at midnight
- `0 0 1 1 *` — January 1st

## Sensor Entities

Each timer is exposed as a `sensor.*` entity with `device_class: timestamp`.

### Entity Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `timer_id` | string | Timer UUID |
| `type` | string | `one_time` or `recurring` |
| `is_expired` | boolean | `true` once due date has passed |
| `is_warning` | boolean | `true` within `warning_days` of the due date |
| `warning_days` | integer | Configured warning window |
| `remaining_seconds` | integer | Seconds until due (negative when overdue) |
| `last_reset` | ISO datetime or null | Last reset timestamp |

### Template Sensor: Days Until Due

```yaml
template:
  - sensor:
      - name: "AC Filter Days Remaining"
        unique_id: ac_filter_days_remaining
        unit_of_measurement: "days"
        state: >
          {{ (state_attr('sensor.change_ac_filter', 'remaining_seconds', 0) / 86400) | round(1) }}
```

### Automation Examples

**Notify on expiry via state attribute:**
```yaml
- alias: "AC filter due — notify"
  trigger:
    - platform: state
      entity_id: sensor.change_ac_filter
      attribute: is_expired
      to: true
  action:
    - service: notify.mobile_app_phone
      data:
        title: "Task due"
        message: "Time to change the AC filter."
```

**Notify via `task_timers_timer_expired` event:**
```yaml
- alias: "Timer expired — push notification"
  trigger:
    - platform: event
      event_type: task_timers_timer_expired
  action:
    - service: notify.mobile_app_phone
      data:
        title: "Task due: {{ trigger.event.data.name }}"
        message: "Open Task Timers to reset it."
```

**Reset timer from script:**
```yaml
- alias: "Reset weekly tasks"
  trigger:
    - platform: time
      at: "09:00:00"
  action:
    - service: task_timers.reset_timer
      data:
        timer_id: "{{ state_attr('sensor.change_ac_filter', 'timer_id') }}"
```

## Error Responses

All errors return appropriate HTTP status codes with a `message` field:

| Code | Meaning |
|------|---------|
| `200` | Success |
| `400` | Bad request — `{"message": "Invalid JSON body"}` or `{"message": "'name' is required"}` |
| `401` | Unauthorized — missing or invalid Bearer token |
| `404` | Timer not found — `{"message": "Timer not found"}` |
| `500` | Server error |
