<p align="center">
  <img src="images/icon.svg" alt="Task Timers" width="128" height="128"/>
</p>

# Task Timers for Home Assistant

A HACS integration for Home Assistant that tracks recurring maintenance tasks (filter changes, mosquito coils, water filter swaps, etc.) as **first-class sensor entities** with a **native Lovelace custom card** for dashboards. Every timer becomes a `sensor.*` with `device_class: timestamp`, so the rest of your dashboard, automations, voice assistants, and the mobile app all "just work".

## Features

- **One-time and recurring timers** — interval-based (every 30 days) or cron-style (1st of every month, 9am daily)
- **Native Lovelace card** — Drop `type: custom:task-timers-card` on any dashboard. Shows warning/expired pill badges, status dots, and a full-screen management dialog for CRUD.
- **Real-time updates** — Timer state syncs across dashboards instantly via WebSocket subscription (no polling).
- **Persistent storage** — timers survive HA restarts
- **Sensor entities** — one `sensor.*` per timer, `device_class: timestamp`, attributes for `is_expired`, `is_warning`, `remaining_seconds`, `last_reset`
- **Services** — `task_timers.create_timer`, `task_timers.reset_timer`, `task_timers.delete_timer`
- **History tracking** — every reset is recorded
- **Mushroom-compatible styling** — Uses `--mush-*` CSS variables and `rgb(var(--rgb-*))` colour tokens. Blends seamlessly with Mushroom cards with zero theme config.

## Installation

1. In HACS, add this repo as a custom **integration** repository.
2. Install **Task Timers**.
3. Restart Home Assistant.
4. Go to **Settings → Devices & Services → Add Integration → Task Timers** and finish the config flow.
5. Add the Lovelace resource: **Settings → Dashboards → Resources → Add Resource** with URL `/task_timers_panel/task-timers-card.js` (type: JavaScript Module).
6. Add the card to any dashboard: `type: custom:task-timers-card`

## Creating a timer

### Option 1 — Dashboard card (recommended)

Click **Manage all timers** on the task-timers card in your dashboard. Hit **+ Add Timer**, fill in the form, save. The list updates in real-time via WebSocket across all dashboards. Pill-shaped badges show warning/expired counts at a glance. Edit, reset, or delete any timer from the management dialog.

### Option 2 — Service call

From Developer Tools → Services (or a script/automation):

```yaml
service: task_timers.create_timer
data:
  name: AC Filter
  type: recurring
  interval_days: 90
  warning_days: 14
```

This creates a `sensor.task_timers_<uuid>` entity (the entity ID includes the timer UUID). The friendly name shown in the UI is the timer name:

| Field | Value |
|---|---|
| `state` | next due datetime (ISO timestamp — HA renders it as "in 3 days" / "5 hours ago") |
| `device_class` | `timestamp` |
| `attributes.timer_id` | UUID — pass to `reset_timer` / `delete_timer` |
| `attributes.is_expired` | `true` once due date has passed |
| `attributes.is_warning` | `true` within `warning_days` of the due date |
| `attributes.remaining_seconds` | Seconds until due (negative when overdue) |
| `attributes.last_reset` | ISO timestamp of last reset, or `null` |
| `attributes.type` | `one_time` or `recurring` |
| `attributes.warning_days` | Configured warning window |

### Resetting a timer

```yaml
service: task_timers.reset_timer
data:
  timer_id: "{{ state_attr('sensor.ac_filter', 'timer_id') }}"
```

A recurring timer's `next_due` rolls forward by its interval/cron. A one-time timer is marked completed and disappears from the active list.

## Dashboard recipes

### Option A — task-timers-card (recommended)

The integration ships its own Lovelace card that works out of the box:

```yaml
type: custom:task-timers-card
title: Task Timers   # optional
```

Shows all timers with green/orange/red status dots, pill-shaped warning/expired badges, and a
"Manage all timers" button for CRUD. Real-time updates via WebSocket. Styled to match Mushroom
cards using `--mush-*` CSS variables — it inherits your HA theme automatically.

### Option B — Mushroom template card

[Mushroom](https://github.com/piitaya/lovelace-mushroom) is a HACS frontend collection. If you already use it (or are happy to install it), `mushroom-template-card` lets you build a tidy "tasks due" tile that colours itself by status:

```yaml
type: custom:mushroom-template-card
entity: sensor.ac_filter
primary: AC Filter
secondary: >-
  {% if state_attr(entity, 'is_expired') %}
    Overdue by {{ relative_time(states(entity) | as_datetime) }}
  {% else %}
    Due {{ relative_time(states(entity) | as_datetime) }}
  {% endif %}
icon: mdi:air-filter
icon_color: >-
  {% if state_attr(entity, 'is_expired') %}red
  {% elif state_attr(entity, 'is_warning') %}orange
  {% else %}green{% endif %}
tap_action:
  action: call-service
  service: task_timers.reset_timer
  data:
    timer_id: "{{ state_attr('sensor.ac_filter', 'timer_id') }}"
```

Wrap several of these in a `vertical-stack` (or `mushroom-chips-card`) to get a dashboard of all your maintenance tasks.

### Option C — No HACS frontend dependency (built-in entities card)

If you'd rather not pull in mushroom, the native `entities` card works fine:

```yaml
type: entities
title: Maintenance
entities:
  - entity: sensor.ac_filter
    name: AC Filter
    secondary_info: last-changed
  - entity: sensor.mosquito_coil
    name: Mosquito Coil
  - entity: sensor.water_filter
    name: Water Filter
```

Pair it with a `conditional` card to highlight overdue items:

```yaml
type: conditional
conditions:
  - entity: sensor.ac_filter
    attribute: is_expired
    state: true
card:
  type: markdown
  content: "**AC Filter is overdue!**"
```

### Option D — Auto-entities (one card, all your timers)

If you have [auto-entities](https://github.com/thomasloven/lovelace-auto-entities) installed, you can render every task timer dynamically without listing them:

```yaml
type: custom:auto-entities
card:
  type: entities
  title: Tasks due
filter:
  include:
    - attributes:
        timer_id: "*"
      options:
        secondary_info: last-changed
sort:
  method: state
```

## Automations

Because each timer is a normal sensor, the standard state/attribute triggers all work:

```yaml
- alias: "AC filter due — notify"
  trigger:
    - platform: state
      entity_id: sensor.ac_filter
      attribute: is_expired
      to: true
  action:
    - service: notify.mobile_app_phone
      data:
        title: "Task due"
        message: "Time to change the AC filter."
```

Or trigger off the timestamp directly:

```yaml
- alias: "Any task hits its due time"
  trigger:
    - platform: time_pattern
      minutes: "/5"
  condition:
    - condition: template
      value_template: >-
        {{ states.sensor
           | selectattr('attributes.timer_id', 'defined')
           | selectattr('attributes.is_expired', 'eq', true)
           | list | count > 0 }}
  action:
    - service: notify.notify
      data:
        message: "You have overdue maintenance tasks."
```

## Services

| Service | Fields | Description |
|---|---|---|
| `task_timers.create_timer` | `name` (required), `type`, `interval_days`, `interval_hours`, `cron_pattern`, `due_at`, `warning_days`, `tags` | Create a new timer (sensor entity is added immediately) |
| `task_timers.reset_timer` | `timer_id` (required) | Reset a recurring timer; mark a one-time timer completed |
| `task_timers.delete_timer` | `timer_id` (required) | Permanently remove the timer and its sensor entity |

### Cron pattern examples

- `0 9 * * *` — daily at 9:00 AM
- `0 0 1 * *` — 1st of every month
- `0 0 * * MON` — every Monday at midnight
- `0 0 1 1 *` — January 1st

## Design

The integration takes a "sensors first, card optional" approach. Every timer is a native
`sensor.*` entity so automations, templates, voice assistants, and any dashboard card work
without this integration's card being present.

The included `task-timers-card` is a vanilla `HTMLElement` custom card — no Lit, no Webpack,
no build step. It uses HA's `hass.callApi()` and WebSocket subscription for real-time updates,
and inherits your theme automatically via Mushroom-compatible CSS variables. The full-screen
CRUD dialog keeps dashboards clean while giving you full timer management in one click.

## Support

- Issues: [GitHub Issues](https://github.com/shouldbecommitted/ha-task-timers/issues)
- Discussions: [GitHub Discussions](https://github.com/shouldbecommitted/ha-task-timers/discussions)

## License

MIT License — see LICENSE file
