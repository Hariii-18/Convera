"""Verify the configured DATABASE_URL can reach Supabase Postgres.

Usage: python -m scripts.verify_db
"""

import sys

from sqlalchemy import text

from app.db.session import engine


def main() -> int:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            db_name, user = conn.execute(text("SELECT current_database(), current_user")).one()
    except Exception as exc:  # noqa: BLE001  (top-level diagnostic script)
        print(f"FAILED: could not connect to the database: {exc}")
        return 1

    print(f"OK: connected to database '{db_name}' as '{user}'")
    return 0


if __name__ == "__main__":
    sys.exit(main())
