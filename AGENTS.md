# Repository checks

Before committing, pushing, or merging changes:

- Run `uvx pre-commit run --all-files` using the hooks pinned in `.pre-commit-config.yaml`. Checking only edited files or running a different Ruff version is not sufficient for CI.
- If hooks modify files, review those changes and rerun until every hook passes. Include the fixes in the commit.
- Preserve intentional import order for authentication and handler registration; use a targeted lint suppression with a reason when reordering would change runtime behavior.
- Run `uv run pytest` for Python code changes and `git diff --check` before committing.
- Report any checks that could not be completed. Do not claim CI passes based only on pytest.
