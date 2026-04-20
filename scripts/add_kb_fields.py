"""
Migration: add office_locations, shift_flexible to jobs
        + company_kb to users

Safe to run multiple times — uses IF NOT EXISTS pattern via try/except.
Run: py -3.12 scripts/add_kb_fields.py
"""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "geply.db"

def run():
    conn = sqlite3.connect(str(DB_PATH))
    cur  = conn.cursor()
    added = []

    migrations = [
        ("jobs",  "ALTER TABLE jobs ADD COLUMN office_locations TEXT DEFAULT 'Hyderabad,Mumbai,Coimbatore'"),
        ("jobs",  "ALTER TABLE jobs ADD COLUMN shift_flexible INTEGER DEFAULT 1"),
        ("users", "ALTER TABLE users ADD COLUMN company_kb TEXT DEFAULT ''"),
    ]

    for table, sql in migrations:
        try:
            cur.execute(sql)
            added.append(sql.split("ADD COLUMN")[1].strip().split()[0])
            print(f"  ✓ Added column to {table}: {sql.split('ADD COLUMN')[1].strip().split()[0]}")
        except sqlite3.OperationalError as e:
            if "duplicate column" in str(e).lower():
                print(f"  – Already exists (skipped): {sql.split('ADD COLUMN')[1].strip().split()[0]}")
            else:
                raise

    conn.commit()
    conn.close()
    print(f"\nMigration complete. {len(added)} column(s) added.")

if __name__ == "__main__":
    run()
