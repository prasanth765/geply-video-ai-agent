import sqlite3

conn = sqlite3.connect('geply.db')

conn.execute("""
    CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL DEFAULT '',
        updated_at TEXT DEFAULT (datetime('now'))
    )
""")

kb = conn.execute(
    "SELECT company_kb FROM users WHERE email = ?",
    ('admin@geply.local',)
).fetchone()

kb_text = kb[0] if kb and kb[0] else ''
conn.execute(
    "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)",
    ('company_kb', kb_text)
)
conn.commit()
print(f"Done. KB length: {len(kb_text)} chars")
conn.close()
