# Directory Structure

```
task-timers/
├── README.md                           # Main documentation
├── INSTALLATION.md                     # Installation guide
├── API.md                              # REST API reference
├── CONTRIBUTING.md                     # Contribution guidelines
├── LICENSE                             # MIT License
├── .gitignore                          # Git ignore patterns
│
├── custom_component/
│   └── task_timers/
│       ├── __init__.py                # Integration entry point
│       ├── manifest.json               # HACS metadata
│       ├── const.py                    # Constants and enums
│       ├── config_flow.py              # Configuration UI
│       ├── coordinator.py              # Data coordinator
│       ├── storage.py                  # Persistent storage handler
│       ├── timer_manager.py            # Timer business logic
│       └── translations/               # i18n files (future)
│
├── frontend/
│   ├── task-timer-card.js             # Main timer display card
│   ├── task-expiry-card.js            # Expiry alert card
│   └── admin-panel.html                # Admin configuration UI
│
├── .github/
│   └── workflows/
│       ├── lint.yaml                  # Code quality checks
│       ├── hacs.yaml                  # HACS validation
│       ├── release.yaml               # Release automation
│       └── README.md                  # Workflow documentation
│
└── docs/                               # Future: Detailed documentation
    ├── features.md
    ├── examples.md
    ├── troubleshooting.md
    └── cron-patterns.md
```

## Key Files

### Backend (Python)
- `__init__.py` — Registers services, sets up coordinator
- `manifest.json` — HACS configuration and requirements
- `timer_manager.py` — Core timer logic, scheduling, interval calculations
- `storage.py` — HA storage persistence layer
- `coordinator.py` — Data update coordinator for entity platform

### Frontend (JavaScript)
- `task-timer-card.js` — Displays all timers with reset buttons
- `task-expiry-card.js` — Shows expiring/expired timers
- `admin-panel.html` — Standalone admin UI for CRUD operations

### GitHub
- `.github/workflows/` — GitHub Actions for CI/CD
- `CONTRIBUTING.md` — Developer guidelines
- `LICENSE` — MIT License
- `.gitignore` — Git ignore patterns
