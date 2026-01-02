import os

def check_labels(images_dir, labels_dir):
    image_files = [f[:-4] for f in os.listdir(images_dir) if f.endswith(".jpg")]
    label_files = [f[:-4] for f in os.listdir(labels_dir) if f.endswith(".txt")]

    images_without_labels = sorted(set(image_files) - set(label_files))
    labels_without_images = sorted(set(label_files) - set(image_files))

    if images_without_labels:
        print("❌ תמונות ללא קובץ תיוג:")
        for img in images_without_labels:
            print(f"- {img}.jpg")
    else:
        print("✅ כל התמונות עם קובץ תיוג.")

    if labels_without_images:
        print("\n❌ קבצי תיוג ללא תמונה תואמת:")
        for lbl in labels_without_images:
            print(f"- {lbl}.txt")
    else:
        print("✅ כל קובצי התיוג תואמים לתמונות.")

# הפעלת הבדיקה עבור train
print("\n📁 בדיקה בתיקיית TRAIN:")
check_labels(
    r"C:\Users\Basil\OneDrive\Desktop\moha\yachin_project\dataset\images\train",
    r"C:\Users\Basil\OneDrive\Desktop\moha\yachin_project\dataset\labels\train"
)

# הפעלת הבדיקה עבור val
print("\n📁 בדיקה בתיקיית VAL:")
check_labels(
    r"C:\Users\Basil\OneDrive\Desktop\moha\yachin_project\dataset\images\val",
    r"C:\Users\Basil\OneDrive\Desktop\moha\yachin_project\dataset\labels\val"
)
