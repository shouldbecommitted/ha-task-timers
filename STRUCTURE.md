# Directory Structure

```
ha-task-timers/
├── README.md                           # Main documentation
├── INSTALLATION.md                     # Installation guide
├── API.md                              # REST API reference
├── EXAMPLES.md                         # Example configurations
├── CONTRIBUTING.md                     # Contribution guidelines
├── CHANGELOG.md                        # Version history
├── LICENSE                             # MIT License
├── hacs.json                           # HACS metadata
├── requirements-dev.txt                # Dev dependencies
├── .gitignore                          # Git ignore patterns
│
├── .github/
│   └── workflows/
│       ├── lint.yaml                   # Black + flake8 on push/PR
│       ├── hacs.yaml                   # HACS validation
│       ├── release.yaml                # Tag-triggered release automation
│       └── README.md                   # Workflow documentation
│
├── custom_components/
│   └── task_timers/
│       ├── __init__.py                 # Integration entry, services, admin panel
│       ├── manifest.json               # Integration metadata + version
│       ├── const.py                    # Constants, signals, event names
│       ├── config_flow.py              # UI config flow (single instance)
│       ├── coordinator.py              # 1-min polling, expiry detection, notifications
│       ├── sensor.py                   # TIMESTAMP sensor entity per timer
│       ├── storage.py                  # HA Store-backed persistence + history
│       ├── timer_manager.py            # Timer + TimerManager scheduling logic
│       ├── views.py                    # REST API (/api/task_timers/*)
│       ├── services.yaml               # HA service definitions
│       ├── icons.json                  # Service icons
│       ├── brand/
│       │   ├── icon.png
│       │   └── icon@2x.png
│       └── www/
│           └── admin-panel.html        # Sidebar iframe admin UI
│
└── images/
    └── icon.svg                        # Project logo
```

## Key Files

### Backend (Python)
- `__init__.py` — Entry setup, service registration, admin panel wiring
- `timer_manager.py` — `Timer` and `TimerManager` — all scheduling logic
- `coordinator.py` — 1-min polling loop, expiry detection, persistent notifications, events
- `storage.py` — HA `Store`-backed timer + history persistence
- `sensor.py` — One `TaskTimerSensor` entity per timer, dynamic add/remove via dispatcher
- `views.py` — REST API (`/api/task_timers/list`, `/create`, `/update/{id}`, `/reset/{id}`, `/delete/{id}`)
- `config_flow.py` — Single-instance UI config flow

### Frontend (HTML/CSS/JS)
- `www/admin-panel.html` — Self-contained sidebar iframe: timer CRUD, form validation, auto-refresh, light/dark theme

### CI/CD
- `.github/workflows/lint.yaml` — Black + flake8 on push/PR
- `.github/workflows/hacs.yaml` — HACS validation
- `.github/workflows/release.yaml` — Tag-triggered: lint gate → version check → GitHub Release → HACS validation
