import cv2
import torch
import numpy as np
from yolov5.models.common import DetectMultiBackend
from yolov5.utils.general import non_max_suppression, scale_boxes
from yolov5.utils.dataloaders import letterbox
from kalman_filter import KalmanBoxTracker
KalmanBoxTracker.count = 0
from tracker import Tracker
import sqlite3
from datetime import datetime
import json
import sys
import os
import subprocess
from pathlib import Path

# ✅ اسم ملف الفيديو الناتج يجي من الـ server.js
input_video = sys.argv[1]
output_filename = sys.argv[2]  # مثال: out-169876321-video.mp4

# ✣️ حذف قاعدة البيانات إذا موجودة
if os.path.exists("detections.db"):
    os.remove("detections.db")

# ✣️ إنشاء قاعدة البيانات
conn = sqlite3.connect("detections.db")
cursor = conn.cursor()
cursor.execute("""
    CREATE TABLE IF NOT EXISTS detections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        class_name TEXT,
        count INTEGER,
        timestamp TEXT
    )
""")
conn.commit()
conn.close()

# ✅ تحميل النموذج
model = DetectMultiBackend(r'C:\Users\Basil\OneDrive\Desktop\moha\runs\train\canned_model_defect6\weights\best.pt', device='cpu')
model.eval()

conf_thres = 0.62
iou_thres = 0.7

cap = cv2.VideoCapture(input_video)

# ✅ إخراج الفيديو النهائي
os.makedirs("temp_results", exist_ok=True)
out_video_path = f"temp_results/{output_filename}"
fourcc = cv2.VideoWriter_fourcc(*'mp4v')
fps = cap.get(cv2.CAP_PROP_FPS)
width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
out = cv2.VideoWriter(out_video_path, fourcc, fps, (width, height))

tracker = Tracker()
frame_skip = 3
names = model.names

line_x = 320
previous_center_x = {}
id_to_fixed_class = {}

class_counts = {
    "pea_ok": 0,
    "pea_defect": 0,
    "tomato_ok": 0,
    "tomato_defect": 0
}
frame_id = 0

while True:
    ret, frame = cap.read()
    if not ret:
        break

    frame_id += 1
    if frame_id % frame_skip != 0:
        out.write(frame)
        continue

    img_resized = letterbox(frame, new_shape=410)[0]
    img = img_resized[:, :, ::-1].transpose(2, 0, 1)
    img = np.ascontiguousarray(img)
    img = torch.from_numpy(img).float() / 255.0
    img = img.unsqueeze(0)

    with torch.no_grad():
        pred = model(img)[0]
        pred = non_max_suppression(pred, conf_thres=conf_thres, iou_thres=iou_thres)[0]

    if pred is not None and len(pred):
        pred[:, :4] = scale_boxes(img.shape[2:], pred[:, :4], frame.shape).round()

        detections = pred[:, :4].cpu().numpy()
        classes = pred[:, 5].int().cpu().numpy()
        dets_with_classes = [(detections[i], classes[i]) for i in range(len(detections))]
        tracked = tracker.update([d[0] for d in dets_with_classes])

        for j, (bbox, track_id) in enumerate(tracked):
            x1, y1, x2, y2 = [int(v.item()) if hasattr(v, 'item') else int(v) for v in bbox]
            track_id += 1

            if j < len(dets_with_classes):
                class_id = dets_with_classes[j][1]
                label_name = model.names[class_id]
            else:
                label_name = "Unknown"

            center_x = (x1 + x2) // 2

            if track_id not in previous_center_x:
                previous_center_x[track_id] = center_x

            crossed = previous_center_x[track_id] < line_x <= center_x
            if crossed and track_id not in id_to_fixed_class:
                id_to_fixed_class[track_id] = label_name
                if label_name in class_counts:
                    class_counts[label_name] += 1

                try:
                    conn = sqlite3.connect("detections.db", timeout=5)
                    cursor = conn.cursor()
                    cursor.execute("SELECT COUNT(*) FROM detections WHERE class_name = ?", (label_name,))
                    current_count = cursor.fetchone()[0]

                    cursor.execute(
                        "INSERT INTO detections (class_name, count, timestamp) VALUES (?, ?, ?)",
                        (label_name, current_count + 1, datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
                    )

                    conn.commit()
                    conn.close()
                except sqlite3.OperationalError as e:
                    print("SQLite Error:", e)

            previous_center_x[track_id] = center_x
            label_text = f'ID={track_id-2} {id_to_fixed_class.get(track_id, label_name)}'

            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.putText(frame, label_text, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

    cv2.line(frame, (line_x, 0), (line_x, frame.shape[0]), (0, 0, 255), 2)
    out.write(frame)

cap.release()
out.release()
cv2.destroyAllWindows()

# ✅ تحويل الفيديو باستخدام FFmpeg إلى صيغة مضبوطة
input_path = out_video_path
final_path = f"{out_video_path.rsplit('.', 1)[0]}_final.mp4"

ffmpeg_cmd = [
    "ffmpeg",
    "-y",
    "-i", input_path,
    "-vcodec", "libx264",
    "-crf", "23",
    "-preset", "veryfast",
    final_path
]
subprocess.run(ffmpeg_cmd)

# ✅ إخراج النتائج بصيغة JSON (الفيديو والعدّات)
sys.stdout.write(json.dumps({
    "video": f"/temp_results/{Path(final_path).name}",
    "counts": class_counts
}))
