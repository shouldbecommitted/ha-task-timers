# Task Timers Dashboard Card Redesign

## Overview

Replace the sidebar iframe admin panel with a native Lovelace custom card. The card has two
modes: a compact **summary view** (badge counts + timer list) that lives on dashboards, and a
**full-screen dialog** (CRUD management) activated by clicking "Manage all timers."

The sidebar panel (`__init__.py` iframe registration) is removed entirely. The backend gains
WebSocket subscription support for real-time updates. Auth moves from manual `localStorage`
token extraction to HA's built-in `hass` object.

## Goals

- **Dashboard integration**: Card goes on any HA dashboard, user controls placement
- **Better at-a-glance info**: Warning/expired counts visible without opening anything
- **Modern look**: HA theme-aware LitElement component, mobile-friendly responsive layout
- **Real-time updates**: WebSocket push replaces 30s REST polling
- **Remove sidebar panel**: No sidebar entry, no manual auth token dance

## Architecture

### Before (Current)

```
Sidebar click → iframe loads admin-panel.html
  ↳ localStorage.hassTokens → Bearer token
  ↳ fetch() to /api/task_timers/*  (REST, 30s poll)
  ↳ Manual auth expiry handling
```

### After (Target)

```
Dashboard loads task-timers-card (LitElement)
  ↳ hass.callApi() for CRUD            (REST, auto-auth)
  ↳ conn.subscribeMessage() for events (WebSocket, real-time)
  ↳ hass object handles all auth
```

### File Changes

| File | Change |
|------|--------|
| `__init__.py` | Remove `_async_register_admin_panel()`, add WebSocket registration, keep services |
| `views.py` | Keep REST views, add WebSocket command + subscription handlers |
| `www/admin-panel.html` | **Deleted** |
| `www/task-timers-card.js` | **New** — LitElement custom card (single file, no build step) |
| `sensor.py` | Unchanged |
| `timer_manager.py` | Unchanged |
| `storage.py` | Unchanged |
| `coordinator.py` | Unchanged |
| `services.yaml` | Unchanged |

## Component Design

### Summary Card (`task-timers-card`)

The card in its compact (summary) state:

```
┌─────────────────────────────────┐
│ 📋 Task Timers        [2] [1]   │  ← Badge counts (warn/expired)
│─────────────────────────────────│
│ 🔴 AC Filter        Expired 3d  │
│ 🟠 Mosquito Coils   Due in 5d   │
│ 🟠 Water Filter     Due in 6d   │
│ 🟢 Smoke Alarm      Due in 28d  │
│─────────────────────────────────│
│        Manage all timers →      │  ← Click opens dialog
└─────────────────────────────────┘
```

**Behavior:**
- Displays timer name with colored status dot and remaining time
- Sorted: expired first, then warning, then OK
- Expired timers get red dot, warning get orange, OK get green
- "Manage all timers →" opens the full-screen dialog
- Auto-refreshes via WebSocket subscription on `task_timers_timer_expired` events and dispatcher signals

**Configuration (YAML):**
```yaml
type: custom:task-timers-card
title: Task Timers           # optional, defaults to "Task Timers"
show_ok_timers: true         # show timers that aren't warn/expired
show_counts: true            # show the [2] [1] badge counts
```

### Management Dialog

A full-screen overlay that opens from the summary card's "Manage" button:

```
┌────────────────────────────────────────┐
│ 📋 Task Timers          [+ Add]  [✕]  │  ← Header bar
├────────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────┐      │
│ │ Smoke Alarm  │ │ AC Filter    │      │
│ │ Recurring    │ │ Recurring    │      │
│ │ 180d         │ │ 60d          │      │
│ │ Due in 28d   │ │ Expired 3d   │      │
│ │ Edit Reset ✕ │ │ Edit Reset ✕ │      │  ← Grid of timer cards
│ └──────────────┘ └──────────────┘      │
│ ┌──────────────┐ ┌──────────────┐      │
│ │ Mosquito     │ │ Water Filter │      │
│ │ One-time     │ │ Recurring    │      │
│ │ Aug 15       │ │ 30d          │      │
│ │ Due in 5d    │ │ Due in 6d    │      │
│ │ Edit Reset ✕ │ │ Edit Reset ✕ │      │
│ └──────────────┘ └──────────────┘      │
└────────────────────────────────────────┘
```

**Features:**
- 2-column grid on desktop, single column on mobile
- Each card: name, type badge, schedule, status (colored), action buttons
- "+ Add" opens create form (same modal pattern as current)
- "Edit" opens edit form pre-filled with current timer data
- "Reset" with confirmation
- "Delete" with confirmation
- Close button (✕) returns to dashboard
- Click outside dialog on backdrop also closes

**Forms (Create/Edit):**
Same form fields as current admin panel:
- Name (required)
- Type: Recurring / One-time
- Interval days / hours (recurring)
- Cron pattern (recurring, optional)
- Due date/time (one-time)
- Warning days

## Backend Changes

### Remove Sidebar Panel Registration

In `__init__.py`, delete `_async_register_admin_panel()` and its call site.
Remove `StaticPathConfig` and `frontend.async_register_built_in_panel` import usage.
Remove `www/admin-panel.html`.

### Add WebSocket Support (views.py)

Add two WebSocket handlers following the scheduler integration pattern:

```python
# Command: request → response (alternative to REST list)
@websocket_api.websocket_command({
    vol.Required("type"): "task_timers/list",
})
@websocket_api.async_response
async def websocket_list_timers(hass, connection, msg):
    timers = [serialize_timer(t) for t in timer_manager.list_timers()]
    connection.send_result(msg["id"], {"timers": timers})

# Subscription: push updates when timers change
@websocket_api.websocket_command({
    vol.Required("type"): "task_timers/subscribe",
})
@websocket_api.async_response
async def websocket_subscribe_updates(hass, connection, msg):
    @callback
    def push_update():
        data = {"timers": [...]}
        connection.send_message({"id": msg["id"], "type": "event", "event": data})

    unsub_timer_added = async_dispatcher_connect(hass, SIGNAL_TIMER_ADDED, push_update)
    unsub_timer_removed = async_dispatcher_connect(hass, SIGNAL_TIMER_REMOVED, push_update)
    unsub_timer_expired = hass.bus.async_listen(EVENT_TIMER_EXPIRED, push_update)

    def unsubscribe():
        unsub_timer_added()
        unsub_timer_removed()
        unsub_timer_expired()

    connection.subscriptions[msg["id"]] = unsubscribe
    connection.send_result(msg["id"])
```

**Note:** The dispatcher signals (`SIGNAL_TIMER_ADDED`, `SIGNAL_TIMER_REMOVED`) already exist
in `const.py`. The coordinator already fires `EVENT_TIMER_EXPIRED`. We need to add dispatcher
fires in `timer_manager.py` when timers are created, updated, or deleted.

### Dispatcher Signals (timer_manager.py)

Add `async_dispatcher_send` calls in:
- `create_timer()`: fire `SIGNAL_TIMER_ADDED` after creation
- `reset_timer()`: fire a general update signal after reset
- `delete_timer()`: fire `SIGNAL_TIMER_REMOVED` after deletion
- `update_timer()`: fire a general update signal after update

## Data Flow

```
Dashboard card loads
  ↳ hass.callApi("GET", "task_timers/list")  → initial data
  ↳ conn.subscribeMessage(onUpdate, {type: "task_timers/subscribe"})  → live updates

User clicks "Manage"
  ↳ Card toggles dialogMode = true → renders dialog overlay
  ↳ Same data, different layout

User creates/edits/deletes a timer
  ↳ hass.callApi("POST", "task_timers/create", payload) → backend saves
  ↳ Backend fires dispatcher signal
  ↳ WebSocket pushes update to all subscribed clients
  ↳ Card re-renders with new data
```

## Technical Decisions

### Why LitElement (not vanilla JS)

- HA's entire frontend uses Lit — theme variables, CSS custom properties, and `hass` object
  are all available natively
- Lit provides reactive properties (`willUpdate`, `render`) that make state management simpler
- Can use `@customElement` decorator for clean HA card registration
- Smaller than a framework, no build step needed for a single-file component

### Why single file (no webpack/rollup)

- HA integration cards rarely change; a build pipeline adds maintenance overhead
- Import Lit from CDN-style `lit` import (same as other HA cards like scheduler-card)
- The card is <500 lines — a single file is manageable
- HACS can serve it as a module directly

### Why REST + WebSocket (not WebSocket-only)

- REST is simpler for mutations (create/update/delete) — synchronous request/response
- WebSocket subscription for real-time push — avoids polling
- This is the exact pattern used by scheduler-card (proven approach)

### Why dialog (not sub-view navigation)

- No dashboard reconfiguration needed — just place the card
- Works on mobile (full-width overlay)
- Single card type = simpler registration
- HA's `ha-dialog` provides backdrop and close behavior for free

## Mobile Responsiveness

- Summary card: single column, full width
- Dialog: single column grid (vs 2-column on desktop)
- Touch-friendly action buttons (min 44px tap targets)
- Font sizes scale with HA's theme
- No horizontal scroll

## Removal Checklist

When implementing, these must be removed/cleaned up:

1. `__init__.py`: Remove `PANEL_URL_PATH`, `PANEL_STATIC_URL`, `PANEL_FILE` constants
2. `__init__.py`: Remove `_async_register_admin_panel()` function
3. `__init__.py`: Remove call to `_async_register_admin_panel()` in `async_setup_entry()`
4. `__init__.py`: Remove `StaticPathConfig` import
5. `__init__.py`: Remove `frontend` import (unless used elsewhere)
6. `www/admin-panel.html`: Delete file
7. Remove `StaticPathConfig` from `async_unload_entry()` if present
8. `hacs.json`: Verify HACS config still valid (no panel references)

## Non-Goals

- No real-time updates via REST (WebSocket handles this)
- No configuration via card YAML for individual timer display (that's in the dialog)
- No multi-language support in this iteration
- No LDAP/local auth support (uses HA's built-in auth)
