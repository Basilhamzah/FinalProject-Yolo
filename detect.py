import sqlite3
from datetime import datetime
from collections import Counter

# פונקציה לשמירת תוצאות במסד הנתונים
def save_detections_to_db(detected_names):
    if not detected_names:
        return

    conn = sqlite3.connect("detections.db")
    cursor = conn.cursor()

    # יצירת טבלה אם לא קיימת
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS detections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            class_name TEXT,
            count INTEGER,
            timestamp TEXT
        )
    ''')

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    counts = Counter(detected_names)

    for class_name, count in counts.items():
        cursor.execute('''
            INSERT INTO detections (class_name, count, timestamp)
            VALUES (?, ?, ?)
        ''', (class_name, count, now))

    conn.commit()
    conn.close()
