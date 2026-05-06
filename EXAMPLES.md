# Example Configurations for Task Timers

## Example 1: Basic Recurring Timers

Create via the admin panel (sidebar → Task Timers → + Add Timer) or service call:

```yaml
service: task_timers.create_timer
data:
  name: "AC Filter"
  type: recurring
  interval_days: 90
  warning_days: 14
```

```yaml
service: task_timers.create_timer
data:
  name: "Mosquito Filter"
  type: recurring
  interval_days: 30
  warning_days: 7
```

## Example 2: Cron-Based Schedules

```yaml
# Monthly on the 1st at 9am
service: task_timers.create_timer
data:
  name: "Monthly Report"
  type: recurring
  cron_pattern: "0 9 1 * *"

# Every Monday at 7am
service: task_timers.create_timer
data:
  name: "Weekly Backup"
  type: recurring
  cron_pattern: "0 7 * * MON"

# Daily at 6pm
service: task_timers.create_timer
data:
  name: "Evening Check"
  type: recurring
  cron_pattern: "0 18 * * *"
```

## Example 3: One-Time Tasks

```yaml
service: task_timers.create_timer
data:
  name: "Update Home Assistant"
  type: one_time
  due_at: "2026-06-01T09:00:00"
  warning_days: 3
```

After the due date passes, resetting a one-time timer marks it completed and it disappears from the active list.

## Example 4: Dashboard Cards

### Mushroom Template Card (recommended)

```yaml
type: custom:mushroom-template-card
entity: sensor.task_timers_ac_filter_id
primary: AC Filter
secondary: >
  {% if state_attr(entity, 'is_expired') %}
    Overdue by {{ relative_time(states(entity) | as_datetime) }}
  {% else %}
    Due {{ relative_time(states(entity) | as_datetime) }}
  {% endif %}
icon: mdi:air-filter
icon_color: >
  {% if state_attr(entity, 'is_expired') %}red
  {% elif state_attr(entity, 'is_warning') %}orange
  {% else %}green{% endif %}
tap_action:
  action: call-service
  service: task_timers.reset_timer
  data:
    timer_id: "{{ state_attr(entity, 'timer_id') }}"
```

### Entities Card

```yaml
type: entities
title: Maintenance Tasks
entities:
  - entity: sensor.task_timers_ac_filter_id
    name: AC Filter
  - entity: sensor.task_timers_mosquito_filter_id
    name: Mosquito Filter
```

### Conditional Card for Overdue Items

```yaml
type: conditional
conditions:
  - condition: state
    entity: sensor.task_timers_ac_filter_id
    attribute: is_expired
    state: true
card:
  type: markdown
  content: "**AC Filter is overdue — change it now!**"
```

### Auto-Entities (all timers dynamically)

```yaml
type: custom:auto-entities
card:
  type: entities
  title: All Tasks
filter:
  include:
    - attributes:
        timer_id: "*"
      options:
        secondary_info: last-changed
sort:
  method: state
```

## Example 5: Automations with Notifications

### Trigger on timer expiry event

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

### Trigger on attribute change (specific timer)

```yaml
- alias: "AC filter due — notify"
  trigger:
    - platform: state
      entity_id: sensor.task_timers_ac_filter_id
      attribute: is_expired
      to: true
  action:
    - service: notify.mobile_app_phone
      data:
        title: "AC Filter"
        message: "Time to change the AC filter."
```

### Warn when expiring soon

```yaml
- alias: "AC filter expiring soon"
  trigger:
    - platform: state
      entity_id: sensor.task_timers_ac_filter_id
      attribute: is_warning
      to: true
  action:
    - service: notify.mobile_app_phone
      data:
        title: "AC Filter"
        message: >
          Filter due in {{ (state_attr('sensor.task_timers_ac_filter_id', 'remaining_seconds') // 86400) }} days
```

### Time-based poll for any overdue timer

```yaml
- alias: "Check for overdue tasks hourly"
  trigger:
    - platform: time_pattern
      minutes: "/60"
  action:
    - variables:
        overdue: >
          {{ states.sensor
             | selectattr('attributes.timer_id', 'defined')
             | selectattr('attributes.is_expired', 'eq', true)
             | map(attribute='name')
             | list }}
    - if:
        - "{{ overdue | count > 0 }}"
      then:
        - service: notify.notify
          data:
            message: "Overdue: {{ overdue | join(', ') }}"
```

## Example 6: Service Calls from Scripts

```yaml
# scripts.yaml
reset_all_maintenance_timers:
  alias: "Reset all maintenance timers"
  sequence:
    - service: task_timers.reset_timer
      data:
        timer_id: "{{ state_attr('sensor.task_timers_ac_filter_id', 'timer_id') }}"
    - delay:
        seconds: 2
    - service: task_timers.reset_timer
      data:
        timer_id: "{{ state_attr('sensor.task_timers_mosquito_filter_id', 'timer_id') }}"
```

## Example 7: Template Sensor for Days Remaining

```yaml
# configuration.yaml
template:
  - sensor:
      - name: "AC Filter Days Remaining"
        unique_id: ac_filter_days_remaining
        unit_of_measurement: "days"
        state: >
          {% set secs = state_attr('sensor.task_timers_ac_filter_id', 'remaining_seconds') %}
          {{ (secs / 86400) | round(1) if secs is number else 'unknown' }}
```

## Example 8: Multiple Zones (Per-Room Timers)

Create separate timers per area:

```yaml
# Bedroom AC filter
- name: "Bedroom AC Filter"
  type: recurring
  interval_days: 90
  tags: ["bedroom", "filter"]

# Living room AC filter
- name: "Living Room AC Filter"
  type: recurring
  interval_days: 90
  tags: ["living-room", "filter"]
```

Use auto-entities or a conditional card to group them by room.

## Mobile Notification with Action

Tap-to-open the Task Timers panel:

```yaml
- alias: "Filter change — actionable notification"
  trigger:
    - platform: event
      event_type: task_timers_timer_expired
  action:
    - service: notify.mobile_app_phone
      data:
        title: "Task due: {{ trigger.event.data.name }}"
        message: "Tap to open Task Timers"
        data:
          url: "/task-timers"
```

## Testing Timer Functionality

Use Developer Tools → Services:

```yaml
service: task_timers.create_timer
data:
  name: "Test Timer"
  type: recurring
  interval_days: 1
  warning_days: 0
```

Then use `task_timers.reset_timer` and `task_timers.delete_timer` to test the full lifecycle. Check the sensor entity in **Developer Tools → States** to verify attributes.
