# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
