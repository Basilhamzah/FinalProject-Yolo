import os

# הנתיב לתיקייה עם התמונות
folder_path = r"C:\Users\97252\Desktop\בלי מדבקות"

# קבלת כל הקבצים בתיקייה
files = sorted(os.listdir(folder_path))

# סינון רק קבצי תמונה (לפי סיומות נפוצות)
image_files = [f for f in files if f.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp'))]

# שינוי שמות הקבצים לפורמט הרצוי
for i, filename in enumerate(image_files, start=1):
    ext = os.path.splitext(filename)[1]  # שמירת סיומת הקובץ (כמו .jpg)
    new_name = f"tomato_defect{i}{ext}"
    src = os.path.join(folder_path, filename)
    dst = os.path.join(folder_path, new_name)
    os.rename(src, dst)
    print(f"שונה: {filename} --> {new_name}")
