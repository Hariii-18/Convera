"""Production smoke test: run this once after every deploy.

Checks, in order:
  1. GET  /health                          -- no auth, platform health check
  2. POST /api/v1/auth/login               -- credentials work end-to-end
  3. GET  /api/v1/auth/me                  -- bearer token is accepted
  4. GET  /api/v1/meetings                 -- a real authenticated query works
  5. CORS -- response to a request carrying the production frontend's Origin
     header actually includes Access-Control-Allow-Origin for it
  6. Summary/Timeline services import cleanly (catches a broken deploy of
     app/services/summary_service.py or app/services/timeline_service.py
     before a real meeting ever hits them)
  7. Database connectivity (DATABASE_URL, same check as scripts/verify_db.py,
     included here so one command covers the whole checklist)

HTTP checks (1-5) run against a deployed backend from anywhere. Checks 6-7
import backend code directly, so run this from an environment with the
backend's dependencies installed and its .env / production env vars set
(e.g. `docker exec <container> python -m scripts.smoke_test_production`,
or a Render/Railway shell).

Usage:
    SMOKE_TEST_BASE_URL=https://api.converra.example \
    SMOKE_TEST_EMAIL=you@example.com \
    SMOKE_TEST_PASSWORD=your-password \
    SMOKE_TEST_FRONTEND_ORIGIN=https://converra.example \
    python -m scripts.smoke_test_production

SMOKE_TEST_EMAIL/PASSWORD and SMOKE_TEST_FRONTEND_ORIGIN are optional -- the
checks that need them are skipped (not failed) when they're not set, so this
also works as a bare `/health` + DB + import check with no arguments beyond
SMOKE_TEST_BASE_URL.
"""

from __future__ import annotations

import os
import sys

import httpx

BASE_URL = os.environ.get("SMOKE_TEST_BASE_URL", "http://localhost:8000").rstrip("/")
API_BASE = f"{BASE_URL}/api/v1"
EMAIL = os.environ.get("SMOKE_TEST_EMAIL")
PASSWORD = os.environ.get("SMOKE_TEST_PASSWORD")
FRONTEND_ORIGIN = os.environ.get("SMOKE_TEST_FRONTEND_ORIGIN")
TIMEOUT = 15.0

_failures = 0
_skipped = 0


def _ok(label: str) -> None:
    print(f"OK:      {label}")


def _fail(label: str, detail: str) -> None:
    global _failures
    _failures += 1
    print(f"FAILED:  {label} -- {detail}")


def _skip(label: str, reason: str) -> None:
    global _skipped
    _skipped += 1
    print(f"SKIPPED: {label} -- {reason}")


def check_health(client: httpx.Client) -> None:
    label = "GET /health"
    try:
        resp = client.get(f"{BASE_URL}/health")
    except httpx.HTTPError as exc:
        _fail(label, f"request error: {exc}")
        return
    if resp.status_code != 200:
        _fail(label, f"status {resp.status_code}: {resp.text[:200]}")
        return
    if resp.json().get("status") != "ok":
        _fail(label, f"unexpected body: {resp.text[:200]}")
        return
    _ok(label)


def check_auth_and_meetings(client: httpx.Client) -> None:
    login_label = "POST /api/v1/auth/login"
    me_label = "GET /api/v1/auth/me"
    meetings_label = "GET /api/v1/meetings"

    if not EMAIL or not PASSWORD:
        reason = "SMOKE_TEST_EMAIL / SMOKE_TEST_PASSWORD not set"
        _skip(login_label, reason)
        _skip(me_label, reason)
        _skip(meetings_label, reason)
        return

    try:
        resp = client.post(
            f"{API_BASE}/auth/login", json={"email": EMAIL, "password": PASSWORD}
        )
    except httpx.HTTPError as exc:
        _fail(login_label, f"request error: {exc}")
        _skip(me_label, "login failed")
        _skip(meetings_label, "login failed")
        return
    if resp.status_code != 200:
        _fail(login_label, f"status {resp.status_code}: {resp.text[:200]}")
        _skip(me_label, "login failed")
        _skip(meetings_label, "login failed")
        return
    token = resp.json().get("access_token")
    if not token:
        _fail(login_label, f"no access_token in response: {resp.text[:200]}")
        _skip(me_label, "login failed")
        _skip(meetings_label, "login failed")
        return
    _ok(login_label)

    headers = {"Authorization": f"Bearer {token}"}

    try:
        resp = client.get(f"{API_BASE}/auth/me", headers=headers)
        if resp.status_code != 200:
            _fail(me_label, f"status {resp.status_code}: {resp.text[:200]}")
        else:
            _ok(me_label)
    except httpx.HTTPError as exc:
        _fail(me_label, f"request error: {exc}")

    try:
        resp = client.get(f"{API_BASE}/meetings", headers=headers)
        if resp.status_code != 200:
            _fail(meetings_label, f"status {resp.status_code}: {resp.text[:200]}")
        else:
            _ok(meetings_label)
    except httpx.HTTPError as exc:
        _fail(meetings_label, f"request error: {exc}")


def check_cors(client: httpx.Client) -> None:
    label = "CORS for production frontend origin"
    if not FRONTEND_ORIGIN:
        _skip(label, "SMOKE_TEST_FRONTEND_ORIGIN not set")
        return
    try:
        resp = client.get(f"{BASE_URL}/health", headers={"Origin": FRONTEND_ORIGIN})
    except httpx.HTTPError as exc:
        _fail(label, f"request error: {exc}")
        return
    allow_origin = resp.headers.get("access-control-allow-origin")
    if allow_origin != FRONTEND_ORIGIN:
        _fail(
            label,
            f"Access-Control-Allow-Origin was '{allow_origin}', expected "
            f"'{FRONTEND_ORIGIN}' -- check CORS_ORIGINS on the backend",
        )
        return
    _ok(label)


def check_service_imports() -> None:
    label = "import summary_service / timeline_service"
    try:
        import app.services.summary_service  # noqa: F401
        import app.services.timeline_service  # noqa: F401
    except Exception as exc:  # noqa: BLE001 (top-level diagnostic script)
        _fail(label, f"{type(exc).__name__}: {exc}")
        return
    _ok(label)


def check_database() -> None:
    label = "database connectivity"
    try:
        from sqlalchemy import text

        from app.db.session import engine

        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001 (top-level diagnostic script)
        _fail(label, f"{type(exc).__name__}: {exc}")
        return
    _ok(label)


def main() -> int:
    print(f"Target: {BASE_URL}\n")

    with httpx.Client(timeout=TIMEOUT) as client:
        check_health(client)
        check_auth_and_meetings(client)
        check_cors(client)

    check_service_imports()
    check_database()

    print(f"\n{_failures} failed, {_skipped} skipped")
    return 1 if _failures else 0


if __name__ == "__main__":
    sys.exit(main())
