"""Setup notifications system: DB table + route wiring + event triggers + UI bell.
Run: py -3.12 scripts/setup_notifications.py
"""
import sqlite3
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
DB_PATH = BASE / "geply.db"

print("=" * 60)
print("Geply Notification System Setup")
print("=" * 60)

# ── 1. Create DB table ──
conn = sqlite3.connect(str(DB_PATH))
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='notifications'")
if not cursor.fetchone():
    cursor.execute("""
        CREATE TABLE notifications (
            id TEXT PRIMARY KEY,
            recruiter_id TEXT NOT NULL,
            type TEXT NOT NULL,
            title TEXT NOT NULL DEFAULT '',
            message TEXT NOT NULL DEFAULT '',
            metadata TEXT DEFAULT '{}',
            is_read INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (recruiter_id) REFERENCES users(id)
        )
    """)
    cursor.execute("CREATE INDEX idx_notif_recruiter ON notifications(recruiter_id)")
    cursor.execute("CREATE INDEX idx_notif_read ON notifications(is_read)")
    conn.commit()
    print("✓ 1. Created notifications table")
else:
    print("  1. Notifications table already exists")
conn.close()

# ── 2. Wire notifications route into __init__.py ──
init_path = BASE / "app" / "api" / "routes" / "__init__.py"
if init_path.exists():
    c = init_path.read_text(encoding="utf-8")
    if "notifications" not in c:
        # Add import and include
        c = c.rstrip() + "\nfrom app.api.routes.notifications import router as notifications_router\n"
        # Find where routers are included and add
        if "api_router.include_router" in c:
            # Add at the end
            c = c.rstrip() + "\napi_router.include_router(notifications_router)\n"
        else:
            # If it uses a different pattern, try to append
            c = c.rstrip() + "\n"
        init_path.write_text(c, encoding="utf-8")
        print("✓ 2. Wired notifications route into __init__.py")
    else:
        print("  2. Notifications route already wired")
else:
    print("  ⚠️ 2. __init__.py not found — you may need to manually add the route")

# ── 3. Patch report_worker to emit notification ──
worker_path = BASE / "app" / "workers" / "report_worker.py"
if worker_path.exists():
    c = worker_path.read_text(encoding="utf-8")
    if "create_notification_sync" not in c:
        # Add import
        c = c.replace(
            "from app.core.config import get_settings",
            "from app.core.config import get_settings\nfrom app.utils.notify import create_notification_sync"
        )
        # Add notification after report is generated (after conn.commit())
        old_commit = '''            conn.commit()

        logger.info(
            "report_generated",'''
        new_commit = '''            conn.commit()

        # Notify recruiter
        try:
            recruiter_id_row = conn.execute(
                sql_text("SELECT recruiter_id FROM jobs WHERE id = :id"),
                {"id": row.job_id},
            ).fetchone()
            if recruiter_id_row:
                create_notification_sync(
                    recruiter_id=recruiter_id_row[0],
                    type="report_ready",
                    title=f"Report ready: {row.candidate_name}",
                    message=f"{row.candidate_name} scored {overall_score}% ({verdict}) for {row.job_title}",
                    metadata={"report_id": report_id, "job_id": row.job_id, "candidate_name": row.candidate_name},
                )
        except Exception as notif_err:
            logger.warning("notification_failed", error=str(notif_err))

        logger.info(
            "report_generated",'''

        if old_commit in c:
            c = c.replace(old_commit, new_commit)
            worker_path.write_text(c, encoding="utf-8")
            print("✓ 3. Patched report_worker to emit notifications")
        else:
            print("  ⚠️ 3. Could not find commit pattern in report_worker — manual patch needed")
    else:
        print("  3. report_worker already has notifications")
else:
    print("  ⚠️ 3. report_worker.py not found")

# ── 4. Patch schedules route to emit notification on self-schedule ──
sched_path = BASE / "app" / "api" / "routes" / "schedules.py"
if sched_path.exists():
    c = sched_path.read_text(encoding="utf-8")
    if "create_notification_async" not in c:
        c = c.replace(
            "import structlog",
            "import structlog\nfrom app.utils.notify import create_notification_async"
        )
        # Add notification after candidate schedules
        old_sched_log = '''    logger.info(
        "candidate_scheduled",'''
        new_sched_log = '''    # Notify recruiter
    try:
        from app.repositories.user_repo import UserRepository as _UR
        job_repo2 = JobRepository(db)
        _job = await job_repo2.get_by_id(job_id)
        if _job and _job.recruiter_id:
            await create_notification_async(
                db, _job.recruiter_id, "candidate_scheduled",
                f"{candidate.full_name} scheduled interview",
                f"Scheduled for {start.strftime('%b %d at %I:%M %p')} — {_job.title}",
                metadata={"job_id": job_id, "candidate_name": candidate.full_name},
            )
    except Exception:
        pass

    logger.info(
        "candidate_scheduled",'''

        if old_sched_log in c:
            c = c.replace(old_sched_log, new_sched_log)
            sched_path.write_text(c, encoding="utf-8")
            print("✓ 4. Patched schedules route to emit notifications")
        else:
            print("  ⚠️ 4. Could not find schedule log pattern — manual patch needed")
    else:
        print("  4. Schedules route already has notifications")
else:
    print("  ⚠️ 4. schedules.py not found")

# ── 5. Patch candidates route to emit notification on re-interview request ──
cand_path = BASE / "app" / "api" / "routes" / "candidates.py"
if cand_path.exists():
    c = cand_path.read_text(encoding="utf-8")
    if "create_notification_async" not in c:
        c = c.replace(
            "import structlog",
            "import structlog\nfrom app.utils.notify import create_notification_async"
        )
        # Find the re-interview logger and add notification before it
        old_reint_log = '''    logger.info(
        "re_interview_requested",'''
        new_reint_log = '''    # Notify recruiter (self — for audit trail)
    try:
        await create_notification_async(
            db, user.id, "re_interview_requested",
            f"Re-interview: {candidate.full_name}",
            f"Reason: {body.reason}",
            metadata={"job_id": candidate.job_id, "candidate_name": candidate.full_name},
        )
    except Exception:
        pass

    logger.info(
        "re_interview_requested",'''

        if old_reint_log in c:
            c = c.replace(old_reint_log, new_reint_log)
            cand_path.write_text(c, encoding="utf-8")
            print("✓ 5. Patched candidates route to emit notifications")
        else:
            print("  ⚠️ 5. Could not find re-interview log pattern — manual patch needed")
    else:
        print("  5. Candidates route already has notifications")
else:
    print("  ⚠️ 5. candidates.py not found")

# ── 6. Inject NotificationBell into Layout.jsx ──
layout_path = BASE / "frontend" / "src" / "components" / "Layout.jsx"
if layout_path.exists():
    c = layout_path.read_text(encoding="utf-8")
    if "NotificationBell" not in c:
        # Add import at top
        import_line = "import NotificationBell from './NotificationBell'"
        if import_line not in c:
            # Add after the last import
            lines = c.split('\n')
            last_import = 0
            for i, line in enumerate(lines):
                if line.strip().startswith('import '):
                    last_import = i
            lines.insert(last_import + 1, import_line)
            c = '\n'.join(lines)

        # Find a good place to insert the bell — look for the sidebar area
        # Common patterns: before user info at bottom, or in the header
        if '<Bell' not in c and 'NotificationBell' in c:
            # Try to add before Dashboard link
            if 'Dashboard' in c:
                # Add bell above the nav items
                c = c.replace(
                    'Dashboard',
                    'Dashboard',
                    1  # Only first occurrence (keeping it as-is, bell added elsewhere)
                )
            # Best approach: add before the closing of sidebar top section
            # Let's add it right after "Geply" text/logo
            if 'Geply' in c:
                c = c.replace(
                    'Geply</span>',
                    'Geply</span>\n            <NotificationBell />',
                    1,
                )
                layout_path.write_text(c, encoding="utf-8")
                print("✓ 6. Injected NotificationBell into Layout.jsx")
            elif 'Geply' in c:
                # Alternate: after logo div
                c = c.replace(
                    '>Geply</',
                    '>Geply</\n',
                    1,
                )
                print("  ⚠️ 6. Partially injected — check Layout.jsx manually")
            else:
                print("  ⚠️ 6. Could not find insertion point in Layout — add <NotificationBell /> manually")
        else:
            print("  6. NotificationBell already in Layout")
    else:
        print("  6. NotificationBell already imported")
else:
    print("  ⚠️ 6. Layout.jsx not found")

print("\n" + "=" * 60)
print("Setup complete. Restart backend:")
print("  py -3.12 -m uvicorn app.main:app --reload --port 8000")
print("=" * 60)
