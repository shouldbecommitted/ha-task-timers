# Contribution Guidelines

Thank you for your interest in contributing to Task Timers! Here's how to get started.

## Development Setup

1. **Fork and clone** the repository
2. **Create a branch** for your feature or fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Install dependencies**:
   ```bash
   pip install -r requirements-dev.txt
   ```
4. **Make your changes** and test locally

## Code Standards

- **Python**: Follow PEP 8 (enforced via Black)
- **JavaScript/Frontend**: Use standard Lit patterns
- **Commit messages**: Clear, descriptive (e.g., "Fix timer reset logic")

## Testing

Before submitting a PR:

```bash
# Format code
black custom_components/task_timers

# Run linters
flake8 custom_components/task_timers
pylint custom_components/task_timers
```

## Pull Request Process

1. Update README.md with any new features
2. Ensure all tests pass
3. Link any related issues (#123)
4. Describe your changes clearly in the PR description

## Reporting Issues

- **Bug reports**: Include steps to reproduce and HA version
- **Feature requests**: Explain the use case and expected behavior
- **Questions**: Use GitHub Discussions

## License

By contributing, you agree your code is licensed under the MIT License.
