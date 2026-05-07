# Installation Guide for Task Timers

## Prerequisites

- Home Assistant 2024.1.0 or later
- HACS (Home Assistant Community Store) installed
- Administrator access to HA configuration

## Installation Steps

### 1. Add Repository to HACS

1. Open **Settings → Devices & Services → HACS**
2. Click the **⋯** menu and select **Custom repositories**
3. Enter repository URL: `https://github.com/shouldbecommitted/ha-task-timers`
4. Select category: **Integration**
5. Click **Create**

### 2. Install Integration

1. Go to **HACS → Integrations**
2. Search for "Task Timers"
3. Click **Install**
4. **Restart Home Assistant** (Settings > System > Restart)

### 3. Add the Lovelace Card

The integration ships with a native Lovelace custom card that shows all your timers with warning/expired badges and a full management dialog.

1. Go to **Settings → Dashboards → Resources** (three-dot menu, top right)
2. Click **Add Resource** and enter:
   ```
   URL: /task_timers_panel/task-timers-card.js
   Type: JavaScript Module
   ```
3. Click **Create** and close the dialog.
4. Edit any dashboard, click **Add Card**, and search for **Task Timers** under custom cards.
5. Configure it:
   ```yaml
   type: custom:task-timers-card
   title: Task Timers   # optional, defaults to "Task Timers"
   ```

The card **matches Mushroom's design language** out of the box — it uses `--mush-*` CSS variables
and `rgb(var(--rgb-*))` colour tokens, so it blends seamlessly alongside other Mushroom cards.
No theme configuration needed.

### 4. View Timers in Your Dashboard

Each timer is also exposed as a `sensor.*` entity with `device_class: timestamp` — useful for
automations, conditional cards, or composing your own dashboard layouts.

#### Using the built-in card (recommended):
```yaml
type: custom:task-timers-card
```
Shows all timers with status dots (green/orange/red), pill-shaped warning/expired count badges,
and a "Manage all timers" button that opens a full-screen CRUD dialog. Real-time updates
via WebSocket — no polling.

#### Mushroom Template Card:
```yaml
type: custom:mushroom-template-card
entity: sensor.my_task_timer
primary: '{{ state_attr(entity, "name") }}'
secondary: >
  {% if state_attr(entity, "is_expired") %}Overdue
  {% else %}{{ (state_attr(entity, "remaining_seconds") // 86400) }} days left
  {% endif %}
icon: mdi:clipboard-text-clock-outline
icon_color: >
  {% if state_attr(entity, "is_expired") %}red
  {% elif state_attr(entity, "is_warning") %}amber
  {% else %}green
{% endif %}
```

#### Entities Card:
```yaml
type: entities
entities:
  - entity: sensor.change_ac_filter
  - entity: sensor.clean_mosquito_filter
```

See [EXAMPLES.md](EXAMPLES.md) for more dashboard recipes.

### 5. Configure Timers

1. Click **Manage all timers** on the task-timers card in your dashboard
2. Click **+ Add Timer**, fill in the form, and save
3. Timers update in real-time across all dashboards via WebSocket

## Troubleshooting

### Timers not showing as entities
- Ensure Home Assistant has restarted after installation
- Check **Developer Tools → States** and filter for `sensor.` entities
- If entities exist but show as unavailable, check `home-assistant.log` for coordinator errors

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

- Issues: [GitHub Issues](https://github.com/shouldbecommitted/ha-task-timers/issues)
- Discussions: [GitHub Discussions](https://github.com/shouldbecommitted/ha-task-timers/discussions)
- Home Assistant Community: (link to your thread)
