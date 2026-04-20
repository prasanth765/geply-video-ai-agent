"""Cleanup: Remove temporary patch/test/debug scripts.
Run: py -3.12 scripts/cleanup.py
"""
from pathlib import Path

BASE = Path(__file__).resolve().parent

# Scripts to KEEP
keep = {"init_db.py", "cleanup.py", "setup_notifications.py", "create_notifications_table.py", "add_reinterview_columns.py"}

# Scripts to REMOVE (temp patches, tests, debug)
removed = 0
for f in BASE.iterdir():
    if f.suffix == ".py" and f.name not in keep:
        if any(x in f.name for x in ["fix_", "patch_", "debug_", "test_", "clean_old"]):
            f.unlink()
            print(f"  Removed: {f.name}")
            removed += 1

print(f"\n✓ Cleaned up {removed} temporary script(s)")
print(f"  Kept: {', '.join(sorted(keep))}")
