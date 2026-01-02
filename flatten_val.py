import os
import cv2
import imgaug.augmenters as iaa

# נתיב התמונות המקוריות
input_dir = r"C:\Users\97252\Desktop\few_samples\tomato_ok"  # שנה לפי הצורך
# נתיב לשמירת התמונות החדשות
output_dir = r"C:\Users\97252\Desktop\augmented\tomato_ok"

# מספר שכפולים לכל תמונה
copies_per_image = 5

# אוגמנטציות בסיסיות
augmentations = iaa.Sequential([
    iaa.Fliplr(0.5),           # היפוך אופקי
    iaa.Affine(rotate=(-15, 15)),  # סיבוב
    iaa.Multiply((0.8, 1.2)),  # שינוי בהירות
    iaa.AdditiveGaussianNoise(scale=(0, 0.02*255)),  # רעש
    iaa.ScaleX((0.8, 1.2))     # שינוי גודל בציר X
])

# יצירת תיקייה אם לא קיימת
os.makedirs(output_dir, exist_ok=True)

# עיבוד כל תמונה בתיקייה
for filename in os.listdir(input_dir):
    if filename.lower().endswith((".jpg", ".jpeg", ".png")):
        image_path = os.path.join(input_dir, filename)
        image = cv2.imread(image_path)

        for i in range(copies_per_image):
            augmented = augmentations(image=image)
            new_name = f"{os.path.splitext(filename)[0]}_aug{i+1}.jpg"
            cv2.imwrite(os.path.join(output_dir, new_name), augmented)

print("✅ הסתיים תהליך יצירת התמונות המוגברות.")
