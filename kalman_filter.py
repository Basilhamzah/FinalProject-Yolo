from filterpy.kalman import KalmanFilter
import numpy as np

class KalmanBoxTracker:
    count = 0

    def __init__(self, bbox):
        self.kf = KalmanFilter(dim_x=7, dim_z=4)
        self.kf.F = np.array([[1,0,0,0,1,0,0],
                              [0,1,0,0,0,1,0],
                              [0,0,1,0,0,0,1],
                              [0,0,0,1,0,0,0],
                              [0,0,0,0,1,0,0],
                              [0,0,0,0,0,1,0],
                              [0,0,0,0,0,0,1]])

        self.kf.H = np.array([[1,0,0,0,0,0,0],
                              [0,1,0,0,0,0,0],
                              [0,0,1,0,0,0,0],
                              [0,0,0,1,0,0,0]])

        self.kf.R *= 10.
        self.kf.P *= 10.
        self.kf.Q *= 0.01

        self.kf.x[:4] = self.convert_bbox_to_z(bbox)
        self.time_since_update = 0
        KalmanBoxTracker.count += 1
        self.id = KalmanBoxTracker.count
        self.history = []

    def predict(self):
        self.kf.predict()
        self.time_since_update += 1
        self.history.append(self.kf.x)
        return self.convert_x_to_bbox(self.kf.x)

    def update(self, bbox):
        self.time_since_update = 0
        self.kf.update(self.convert_bbox_to_z(bbox))

    def get_state(self):
        return self.convert_x_to_bbox(self.kf.x)

    @staticmethod
    def convert_bbox_to_z(bbox):
        x1, y1, x2, y2 = bbox
        w = x2 - x1
        h = y2 - y1
        x = x1 + w/2.
        y = y1 + h/2.
        return np.array([[x], [y], [w], [h]])

    @staticmethod
    def convert_x_to_bbox(x):
        cx, cy, w, h = x[0], x[1], x[2], x[3]
        x1 = cx - w/2.
        y1 = cy - h/2.
        x2 = cx + w/2.
        y2 = cy + h/2.
        return [x1, y1, x2, y2]
