import os

base_path = "C:/Users/97252/PycharmProjects/moha/yachin_project/dataset/labels"
folders = ["train", "val"]

for folder in folders:
    folder_path = os.path.join(base_path, folder)
    for filename in os.listdir(folder_path):
        if filename.endswith(".txt"):
            file_path = os.path.join(folder_path, filename)
            with open(file_path, "r") as f:
                lines = f.readlines()
            new_lines = []
            for line in lines:
                parts = line.strip().split()
                if parts:
                    if parts[0] == "0":
                        parts[0] = "1"
                    elif parts[0] == "1":
                        parts[0] = "0"
                    new_lines.append(" ".join(parts) + "\n")
            with open(file_path, "w") as f:
                f.writelines(new_lines)

print("✅ כל התיוגים הוחלפו בהצלחה (0 ⇄ 1)")
import os

labels_dir = r"C:\Users\97252\PycharmProjects\moha\yachin_project\dataset\labels\train"

for filename in os.listdir(labels_dir):
    if filename.endswith(".txt"):
        file_path = os.path.join(labels_dir, filename)
        with open(file_path, 'r') as file:
            lines = file.readlines()

        new_lines = []
        for line in lines:
            parts = line.strip().split()
            if parts:
                if parts[0] == '0':
                    parts[0] = '1'
                elif parts[0] == '1':
                    parts[0] = '0'
                new_lines.append(' '.join(parts) + '\n')

        with open(file_path, 'w') as file:
            file.writelines(new_lines)

print("✔️ כל הקבצים עודכנו בהצלחה (0 ↔ 1)")
