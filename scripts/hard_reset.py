"""Hard reset: Delete ALL data except admin user.
Run: py -3.12 scripts/hard_reset.py
"""
import sqlite3
from pathlib import Path
import shutil

DB_PATH = Path(__file__).resolve().parent.parent / "geply.db"
UPLOADS_PATH = Path(__file__).resolve().parent.parent / "uploads"

conn = sqlite3.connect(str(DB_PATH))

# Delete in correct order (foreign keys)
tables = ["notifications", "reports", "schedule_slots", "interviews", "candidates", "jobs"]
for table in tables:
    try:
        count = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        conn.execute(f"DELETE FROM {table}")
        print(f"  Deleted {count} rows from {table}")
    except Exception as e:
        print(f"  Skipped {table}: {e}")

conn.commit()
conn.close()

# Clean upload folders (keep avatars)
for folder in ["resumes", "screenshots", "jd"]:
    folder_path = UPLOADS_PATH / folder
    if folder_path.exists():
        shutil.rmtree(folder_path)
        folder_path.mkdir(parents=True, exist_ok=True)
        print(f"  Cleaned uploads/{folder}/")

print("\n✓ Hard reset complete. Admin user preserved.")
print("  Restart backend and test fresh!")
