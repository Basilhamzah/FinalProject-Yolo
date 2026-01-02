import os

# נתיב בסיס לתיקיות התמונות
base_path = r"C:\Users\97252\PycharmProjects\moha\yachin_project\dataset\images\train"

# שמות המחלקות
folders = ["pea_ok", "pea_defect", "tomato_ok", "tomato_defect"]

# יצירת התיקיות אם הן לא קיימות
for folder in folders:
    dir_path = os.path.join(base_path, folder)
    os.makedirs(dir_path, exist_ok=True)
    print(f"תיקייה נוצרה (או כבר קיימת): {dir_path}")
