"""
init_db.py — Initialize Geply database tables.
Run: py -3.12 scripts/init_db.py
"""
import asyncio
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "geply.db"

EXTRA_TABLES = """
CREATE TABLE IF NOT EXISTS app_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL DEFAULT '',
    updated_at TEXT DEFAULT (datetime('now'))
);
"""

async def main():
    # SQLAlchemy creates all ORM tables
    from app.core.database import engine, Base
    from app.models import user, job, candidate, interview, schedule, report, notification

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✓ ORM tables created")

    # Extra tables not managed by ORM
    conn2 = sqlite3.connect(str(DB_PATH))
    conn2.executescript(EXTRA_TABLES)
    conn2.commit()
    conn2.close()
    print("✓ app_settings table created")

    # Seed admin user if not exists
    conn3 = sqlite3.connect(str(DB_PATH))
    existing = conn3.execute("SELECT id FROM users WHERE email = 'admin@geply.local'").fetchone()
    if not existing:
        import bcrypt, uuid
        hashed = bcrypt.hashpw(b"admin123456", bcrypt.gensalt()).decode()
        conn3.execute(
            "INSERT INTO users (id, email, hashed_password, full_name, company, is_active, is_admin, company_kb) VALUES (?,?,?,?,?,1,1,'')",
            (str(uuid.uuid4()), "admin@geply.local", hashed, "Geply Admin", "Geply", )
        )
        conn3.commit()
        print("✓ Admin user seeded")
    else:
        print("– Admin user already exists")
    conn3.close()

    print("\nDB init complete.")

if __name__ == "__main__":
    asyncio.run(main())
