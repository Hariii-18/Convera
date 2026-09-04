# Converra backend

FastAPI backend for the Converra application.

## Development

```bash
# from backend/, with the virtualenv activated
uvicorn app.main:app --reload --reload-dir app --reload-dir alembic
```

`--reload-dir app --reload-dir alembic` scopes the auto-reload file watcher to
the application source and migration directories. Without it, uvicorn watches
the entire current working directory — including `.venv` — and on OneDrive-synced
checkouts, background file churn inside `.venv` can trigger spurious server
restarts mid-request. This does not affect production: run without `--reload`
for production/staging (e.g. `uvicorn app.main:app --host 0.0.0.0 --port 8000`).
