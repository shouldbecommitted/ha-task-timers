# API Reference for Task Timers

Task Timers exposes a REST API for advanced automation and integration.

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
      "id": "1711500000001",
      "name": "AC Filter",
      "type": "recurring",
      "next_due": "2026-04-10T12:00:00",
      "last_reset": "2026-03-10T12:00:00",
      "remaining_seconds": 2592000,
      "is_expired": false,
      "is_warning": false
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
  "interval_hours": 0,
  "cron_pattern": null,
  "warning_days": 7,
  "notify_type": "persistent_notification",
  "tags": ["filter", "maintenance"]
}
```

**Response:**
```json
{
  "id": "1711500000002",
  "message": "Timer created successfully"
}
```

### Get Timer
```
GET /api/task_timers/{timer_id}
```

**Response:** Single timer object (see List Timers format)

### Update Timer
```
POST /api/task_timers/update/{timer_id}
```

**Request body:** Same as Create Timer (only modified fields)

**Response:**
```json
{
  "message": "Timer updated successfully"
}
```

### Reset Timer
```
POST /api/task_timers/reset/{timer_id}
```

**Response:**
```json
{
  "message": "Timer reset successfully",
  "next_due": "2026-05-10T12:00:00"
}
```

### Delete Timer
```
POST /api/task_timers/delete/{timer_id}
```

**Response:**
```json
{
  "message": "Timer deleted successfully"
}
```

### Get Timer History
```
GET /api/task_timers/{timer_id}/history
```

**Request parameters:**
- `limit` (optional, default 50): Number of history entries to return

**Response:**
```json
{
  "history": [
    {
      "timer_id": "1711500000001",
      "action": "reset",
      "timestamp": "2026-03-10T12:00:00"
    },
    {
      "timer_id": "1711500000001",
      "action": "created",
      "timestamp": "2026-02-10T12:00:00"
    }
  ]
}
```

## Home Assistant Services

### Create Timer Service
```yaml
service: task_timers.create_timer
data:
  name: "AC Filter Change"
  type: "recurring"
  interval_days: 90
  warning_days: 14
  notify_type: "persistent_notification"
```

### Reset Timer Service
```yaml
service: task_timers.reset_timer
data:
  timer_id: "1711500000001"
```

### Delete Timer Service
```yaml
service: task_timers.delete_timer
data:
  timer_id: "1711500000001"
```

## Timer Data Structure

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique timer identifier |
| `name` | string | Human-readable name |
| `type` | string | `one_time` or `recurring` |
| `next_due` | ISO datetime | Next due date/time |
| `last_reset` | ISO datetime | Last reset timestamp |
| `remaining_seconds` | number | Seconds until due |
| `is_expired` | boolean | Timer is past due |
| `is_warning` | boolean | Timer in warning period |
| `interval_days` | number | Days between resets (recurring) |
| `interval_hours` | number | Hours between resets (recurring) |
| `cron_pattern` | string | Cron schedule (optional) |
| `warning_days` | number | Days before expiry to warn |
| `notify_type` | string | `none`, `persistent_notification`, `event`, or `service_call` |
| `tags` | array | Categories (e.g., `["filter", "maintenance"]`) |

## Examples

### Automation: Notify on Timer Expiry
```yaml
- alias: "Notify when timer expires"
  trigger:
    platform: webhook
    webhook_id: task_timer_expired
  condition:
    condition: template
    value_template: "{{ trigger.json.action == 'expired' }}"
  action:
    service: notify.notify
    data:
      title: "Task Due"
      message: "{{ trigger.json.timer_name }} is now due"
      data:
        tag: "task_timer"
```

### Automation: Reset Timer from Script
```yaml
- alias: "Reset weekly tasks"
  trigger:
    platform: time
    at: "06:00:00"
  action:
    service: task_timers.reset_timer
    data:
      timer_id: "1711500000001"
```

### Template Sensor: Days Until Task Due
```yaml
template:
  - sensor:
      - name: "AC Filter Days Remaining"
        unique_id: ac_filter_remaining
        unit_of_measurement: "days"
        state: >
          {% set timer = state_attr('task_timers', 'ac_filter') %}
          {% if timer %}
            {{ (timer.remaining_seconds / 86400) | round(1) }}
          {% else %}
            unknown
          {% endif %}
```

## Error Responses

All errors return appropriate HTTP status codes:

```json
{
  "error": "Timer not found",
  "code": 404
}
```

### Common Status Codes
- `200` — Success
- `400` — Bad request (invalid parameters)
- `401` — Unauthorized (missing/invalid token)
- `404` — Timer not found
- `500` — Server error
