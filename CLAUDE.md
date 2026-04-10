# task-timers — Claude Instructions

## Project
HA custom integration (`custom_components/task_timers/`) that exposes
maintenance timers as `sensor.*` timestamp entities with a sidebar admin panel.

## Architecture
| File | Role |
|---|---|
| `__init__.py` | Entry setup, service registration, admin panel wiring |
| `coordinator.py` | 1-min polling loop, expiry detection, notifications |
| `timer_manager.py` | `Timer` and `TimerManager` — all scheduling logic |
| `storage.py` | HA `Store`-backed persistence |
| `sensor.py` | One `TaskTimerSensor` entity per timer, dynamic add/remove |
| `views.py` | REST API (`/api/task_timers/*`) backing the admin panel |
| `www/admin-panel.html` | Sidebar iframe UI |

## Lint rules
All Python must pass `black` and `flake8 --max-line-length=100 --ignore=E203,E501,W503`.
A PostToolUse hook runs both automatically after every Edit/Write — check stderr for issues.
The CI release workflow gates on the lint job; a lint failure blocks the release.

## Releasing
1. Bump `version` in `manifest.json`
2. Add a `## [x.y.z]` entry to `CHANGELOG.md`
3. Commit, `git tag vx.y.z`, `git push origin main vx.y.z`

## Agent and skill guidance

### Use the Explore subagent for broad searches
When you need to understand the codebase (find all callers of a function,
trace a data flow, audit a pattern across files) delegate to `Explore` instead
of running multiple Grep/Read calls inline. This keeps the search results out
of the main context and returns a concise summary.

```
Agent(subagent_type="Explore", prompt="Find every place Timer.reset is called and what arguments are passed")
```

### Use /simplify after non-trivial changes
After implementing a feature or fixing a bug, invoke the `simplify` skill to
get a second pass on quality, duplication, and efficiency before committing.

### Parallelise independent work
When multiple files need the same kind of change (e.g. adding a field to
`_serialize_timer`, the admin panel, and `services.yaml`) make all three
Edit calls in a single response rather than sequentially.

### Don't inline large file reads
Read only the sections you need (use `offset`/`limit` on large files).
For questions that span many files, use the Explore subagent — its findings
come back as a single summary token, not raw file contents.
