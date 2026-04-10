# Task Timers GitHub Actions

This directory contains automated workflows for testing, linting, and releasing Task Timers.

## Workflows

### lint.yaml
Runs on push and pull requests to ensure code quality:
- Black formatter check
- Flake8 linting
- Pylint analysis

### hacs.yaml
Validates integration meets HACS standards before each release.

### release.yaml
Triggered on version tags (e.g., `v1.0.0`) to:
- Create GitHub release
- Validate manifest.json
- Register with HACS

## Local Development

Run linting locally before pushing:

```bash
# Install tools
pip install black flake8 pylint

# Format code
black custom_component/task_timers

# Check formatting
black --check custom_component/task_timers

# Run linters
flake8 custom_component/task_timers
pylint custom_component/task_timers
