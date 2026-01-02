import sqlite3

# יצירת חיבור למסד הנתונים (אם לא קיים – יווצר אוטומטית)
conn = sqlite3.connect("canned_detections.db")
cursor = conn.cursor()

# יצירת טבלה
cursor.execute("""
CREATE TABLE IF NOT EXISTS detections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT,
    class_name TEXT,
    confidence REAL,
    status TEXT DEFAULT 'OK'
)
""")

conn.commit()
conn.close()

print("✔️ מסד הנתונים נוצר בהצלחה.")
