1# Example Configurations for Task Timers

## Example 1: Basic Filter Changes (Recurring)

```yaml
# Create via admin panel or service call
- name: "AC Filter"
  type: "recurring"
  interval_days: 90
  interval_hours: 0
  warning_days: 14
  notify_type: "persistent_notification"
  tags: ["filter", "hvac"]

- name: "Mosquito Filter"
  type: "recurring"
  interval_days: 30
  warning_days: 7
  notify_type: "persistent_notification"
  tags: ["filter", "hvac"]
```

## Example 2: Using Cron for Complex Schedules

```yaml
# Monthly on the 1st
- name: "Monthly Report"
  type: "recurring"
  cron_pattern: "0 9 1 * *"  # 9am on 1st of month
  notify_type: "persistent_notification"
  tags: ["report"]

# Every Monday at 7am
- name: "Weekly Backup"
  type: "recurring"
  cron_pattern: "0 7 ? * MON"
  notify_type: "event"
  tags: ["backup"]

# Daily at 6pm
- name: "Evening Check"
  type: "recurring"
  cron_pattern: "0 18 * * *"
  notify_type: "none"
```

## Example 3: One-time Tasks

```yaml
# One-time timer (no recurrence)
- name: "Update Home Assistant"
  type: "one_time"
  warning_days: 0
  notify_type: "none"
```

## Example 4: Automation with Notifications

### Template Sensor for Display
```yaml
# configuration.yaml
template:
  - sensor:
      - name: "AC Filter Remaining"
        unique_id: sensor_ac_filter_remaining
        unit_of_measurement: "days"
        availability: "{{ states('timer.ac_filter') != 'unknown' }}"
        state: >
          {% set state_attr = states.timer.ac_filter if states('timer.ac_filter') != 'unknown' else {} %}
          {{ (state_attr('timer.ac_filter').remaining_seconds / 86400) | round(1) if 'timer' in state_attr else 'unknown' }}
```

### Automations for Notifications
```yaml
# automations.yaml
- id: '1711500000001'
  alias: "Notify when AC filter expires"
  trigger:
    platform: numeric_state
    entity_id: sensor.ac_filter_remaining
    below: 0
  action:
    service: notify.persistent_notification
    data:
      title: "AC Filter Maintenance"
      message: "Time to change the AC filter!"

- id: '1711500000002'
  alias: "Warn when AC filter expiring soon"
  trigger:
    platform: numeric_state
    entity_id: sensor.ac_filter_remaining
    below: 14
    above: 0
  action:
    service: notify.mobile_app_iphone
    data:
      title: "AC Filter"
      message: "Filter change due in {{ states('sensor.ac_filter_remaining') }} days"

- id: '1711500000003'
  alias: "Reset AC filter on schedule"
  trigger:
    platform: time
    at: "09:00:00"
  condition:
    condition: time
    weekday:
      - sun
  action:
    service: task_timers.reset_timer
    data:
      timer_id: "ac_filter_timer_id_here"
```

## Example 5: Dashboard Configuration

### YAML Mode
```yaml
views:
  - title: Maintenance
    icon: mdi:tools
    cards:
      - type: entities
        title: "Upcoming Tasks"
        entities:
          - sensor.ac_filter_remaining
          - sensor.mosquito_filter_remaining

      - type: custom:task-timer-card
        title: "All Timers"

      - type: custom:task-expiry-card
        days_warning: 30
        title: "Expiring This Month"
```

### Using Custom:button-card
```yaml
type: custom:button-card
entity: timer.ac_filter
name: AC Filter
template: colorful_icon
tap_action:
  action: call-service
  service: task_timers.reset_timer
  service_data:
    timer_id: "ac_filter_id"
```

## Example 6: Service Calls from Scripts

```yaml
# scripts.yaml
reset_all_maintenance_timers:
  description: "Reset all maintenance timers"
  sequence:
    - service: task_timers.reset_timer
      data:
        timer_id: "ac_filter_id"
    - delay:
        seconds: 2
    - service: task_timers.reset_timer
      data:
        timer_id: "mosquito_filter_id"
    - service: notify.persistent_notification
      data:
        message: "All maintenance timers reset!"
```

### Call Script from Card
```yaml
type: custom:button-card
name: "Reset All Timers"
tap_action:
  action: call-service
  service: script.reset_all_maintenance_timers
```

## Example 7: History Tracking

```yaml
# Automation: Track when filters are changed
- id: '1711500000004'
  alias: "Create note about filter change"
  trigger:
    platform: call_service
    service: task_timers.reset_timer
  action:
    service: note.create
    data:
      note: "{{ trigger.data.timer_id }} was reset at {{ now().isoformat() }}"
```

## Example 8: Multiple Zones (with areas)

If you want per-room timers, create separate timers per area:

```yaml
# Bedroom AC filter
- name: "Bedroom AC Filter"
  type: "recurring"
  interval_days: 90
  tags: ["bedroom", "filter"]

# Living room AC filter
- name: "Living Room AC Filter"
  type: "recurring"
  interval_days: 90
  tags: ["living-room", "filter"]

# Filter the card to show only bedroom
type: custom:task-timer-card
tags:
  - bedroom
```

## Mobile Notification Example

Use with `notify.mobile_app_*` or `notify.telegram`:

```yaml
- id: '1711500000005'
  alias: "Mobile notification for filter change"
  trigger:
    platform: state
    entity_id: timer.ac_filter
    to: "expired"
  action:
    - service: notify.mobile_app_iphone
      data:
        title: "🔧 AC Filter"
        message: "Time to change the AC filter"
        data:
          group: "maintenance"
          tag: "ac_filter"
          click_action: "/lovelace/maintenance"
```

## Testing Timer Functionality

Use Developer Tools → Services to test:

```json
{
  "name": "Test Timer",
  "type": "one_time",
  "interval_days": 0,
  "interval_hours": 0,
  "warning_days": 0,
  "notify_type": "persistent_notification"
}
```

Then call `task_timers.reset_timer` to test reset functionality.
