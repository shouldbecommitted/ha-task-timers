# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.2] - 2026-04-10

### Added
- **Brand assets** — `custom_components/task_timers/brand/icon.png` (256×256) and `icon@2x.png` (512×512), rasterized from `images/icon.svg`. HACS's `brands` check now passes against local assets without requiring a PR to `home-assistant/brands`.
- `hacs.json` declares `hacs: "1.6.0"` as the minimum HACS version.

### Changed
- `manifest.json` cleaned up: removed the non-standard `manifests` key (HA doesn't recognise it) and the stale "Lovelace cards" description (we dropped those in v1.1.0). Reordered keys alphabetically for readability.
- Release workflow no longer passes `ignore: brands` to `hacs/action` — the check now passes legitimately via the local brand assets.

### Meta
- Ready for submission to `hacs/default`: six required manifest keys present, semver releases published, brand assets included, HACS validation workflow green, repository topics set.

## [1.2.1] - 2026-04-10

### Fixed
- **HACS validation** passes again. The v1.2.0 release workflow failed three HACS checks; this patch fixes all of them:
  - `hacs.json` no longer carries `documentation`, `issues`, or `iot_class` — those aren't valid HACS manifest keys (they belong in `manifest.json`).
  - `iot_class: local_polling` moved to `manifest.json` where HA actually reads it.
  - Repository topics set on GitHub (`home-assistant`, `hacs`, `hacs-integration`, `home-automation`, `homeassistant`) — HACS requires at least one valid topic.
  - HACS action now runs with `ignore: brands` until the integration is formally listed in the `home-assistant/brands` repository. Installation works either way; this just silences the validation badge.

## [1.2.0] - 2026-04-10

### Added
- **Sidebar admin panel** — a "Task Timers" entry now appears in HA's sidebar. Click it to open a full-page admin UI for creating, editing, resetting and deleting timers (no Developer Tools → Services trips required). Ships as a same-origin static HTML page registered via `frontend.async_register_built_in_panel` with `component_name="iframe"`.
- **REST API** (`views.py`) backing the panel: `GET /api/task_timers/list`, `POST /api/task_timers/create`, `POST /api/task_timers/update/{timer_id}`, `POST /api/task_timers/reset/{timer_id}`, `POST /api/task_timers/delete/{timer_id}`. All require HA auth (`requires_auth = True`).
- **`services.yaml`** describing the `create_timer` / `reset_timer` / `delete_timer` services with proper field selectors, defaults, and examples. Developer Tools → Services now shows a real form instead of a blank textarea. Also silences the `Failed to load services.yaml for integration: task_timers` warning in `home-assistant.log`.

### Changed
- Admin panel lifts HA's access token from `localStorage["hassTokens"]` (same-origin iframe) so it authenticates correctly without a hand-pasted long-lived token — fixes the broken `sessionStorage.getItem("ha_auth_token")` in the old `frontend/admin-panel.html` that never worked.
- Panel HTML rewritten with light/dark theming via `prefers-color-scheme`, status colouring (expired/warning/normal), toast notifications, a proper edit-populates-form flow, and a 30s auto-refresh.

### Removed
- Orphaned top-level `frontend/admin-panel.html` — it never shipped via HACS (wrong location) and called REST endpoints that didn't exist. Replaced by the working version under `custom_components/task_timers/www/admin-panel.html`.

## [1.1.0] - 2026-04-10

### Changed
- **BREAKING:** Dropped the bundled Lit-based Lovelace cards (`task-timer-card`, `task-expiry-card`) entirely. The no-build Lit CDN import was fragile and broke whenever jsdelivr's resolution shifted, leaving users with empty card pickers. Each timer is now exposed as a `sensor.*` entity (`device_class: timestamp`) so dashboards can be built with whatever cards the user already uses (Mushroom, Tile, Entities, auto-entities, etc.). See the README for ready-to-paste recipes.
- New sensor platform under `sensor.py` — one `TaskTimerSensor` per timer, with `is_expired` / `is_warning` / `remaining_seconds` / `last_reset` / `timer_id` / `type` / `warning_days` exposed as attributes for templating.
- `__init__.py` no longer registers static paths, no longer injects frontend JS, and no longer registers a `task_timers/list` WebSocket command — none of those are needed once timers are first-class entities.

### Added
- Dispatcher signals (`SIGNAL_TIMER_ADDED`, `SIGNAL_TIMER_REMOVED`) so the sensor platform can add/remove entities live as timers are created or deleted via services.

### Removed
- `custom_components/task_timers/www/` directory (the two Lit card JS files).
- `homeassistant.components.frontend.add_extra_js_url`, `StaticPathConfig`, and `websocket_api` imports from `__init__.py`.

### Migration
- If you had `type: custom:task-timer-card` or `type: custom:task-expiry-card` in your dashboards, replace them with one of the recipes in the README. Your stored timers and history are untouched.

## [1.0.5] - 2026-04-10

### Fixed
- Lovelace cards (`task-timer-card`, `task-expiry-card`) were never installed by HACS — they lived at `frontend/` outside the integration directory, so HACS skipped them. Moved them into `custom_components/task_timers/www/` so they ship with the integration.
- Cards are now auto-registered as static paths and added as extra JS URLs at startup, so they appear in the "Add card" picker without any manual Lovelace resource configuration. URL is cache-busted with the integration version.

## [1.0.4] - 2026-04-10

### Added
- `icons.json` mapping each service (`create_timer`, `reset_timer`, `delete_timer`) to a thematic MDI icon shown in HA's service picker
- `images/icon.svg` — repo logo displayed at the top of the README and rendered by HACS

## [1.0.3] - 2026-04-10

### Fixed
- Release workflow: granted `contents: write` permission so the workflow can actually create GitHub Releases
- Removed invalid `filename` field from `hacs.json` (only valid for plugins/themes, not integrations)
- Removed unused zip artifact step from release workflow (HACS downloads `custom_components/<domain>/` directly from the tagged commit for integrations)

## [1.0.2] - 2026-04-10

### Added
- `CHANGELOG.md` documenting release history
- `filename` field in `hacs.json` so HACS resolves the release zip asset

### Fixed
- Release workflow now validates that `manifest.json` version matches the git tag before publishing
- Release workflow attaches `task_timers.zip` so HACS downloads a versioned artifact instead of a commit hash
- Replaced deprecated `actions/create-release` with `softprops/action-gh-release@v2`

## [1.0.1] - 2026-04-10

### Fixed
- Removed invalid `Platform.TIMER` reference that broke integration setup
- Registered `task_timers/list` WebSocket command so the frontend cards actually receive data
- Replaced `hass.helpers.storage.Store` with a direct `Store` import (deprecated accessor)
- Replaced naive `datetime.now()` with `dt_util.now()` throughout for timezone safety
- One-time timer reset now uses a `completed` flag instead of scheduling 100 years into the future
- `list_warning_timers()` now respects each timer's individual `warning_days` setting
- Frontend cards clear their refresh interval on `disconnectedCallback` (no more leaks)

### Changed
- Timer IDs now generated with `uuid4` instead of millisecond timestamps (collision-safe)
- Service handlers now use `voluptuous` schema validation
- Removed redundant double storage load on setup

## [1.0.0] - 2026-04-10

### Added
- Initial release
- Persistent task timer storage backed by Home Assistant's `Store` API
- One-time and recurring timer types (interval-based and cron-based scheduling)
- `DataUpdateCoordinator` for periodic expiry/warning checks
- Services: `create_timer`, `reset_timer`, `delete_timer`
- Two Lovelace cards: `task-timer-card` and `task-expiry-card`
- Standalone admin panel (`admin-panel.html`)
- Config flow for UI setup
