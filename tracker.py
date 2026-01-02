# --- tracker.py (مُعدّل لتجنب الخطأ) ---
import numpy as np
from kalman_filter import KalmanBoxTracker
from scipy.optimize import linear_sum_assignment

class Tracker:
    def __init__(self, max_age=30, iou_threshold=0.3):
        self.trackers = []
        self.frame_count = 0
        self.max_age = max_age
        self.iou_threshold = iou_threshold

    def update(self, detections):
        self.frame_count += 1

        trks = np.zeros((len(self.trackers), 4))
        to_del = []
        for t, trk in enumerate(self.trackers):
            pos = trk.predict()
            trks[t] = np.array(pos).flatten()
            if np.any(np.isnan(pos)):
                to_del.append(t)

        trks = np.ma.compress_rows(np.ma.masked_invalid(trks))
        for t in reversed(to_del):
            self.trackers.pop(t)

        matched, unmatched_dets, unmatched_trks = self.associate_detections_to_trackers(detections, trks)

        for m in matched:
            self.trackers[m[1]].update(detections[m[0]])

        for i in unmatched_dets:
            trk = KalmanBoxTracker(detections[i])
            self.trackers.append(trk)

        i = len(self.trackers)
        for trk in reversed(self.trackers):
            if trk.time_since_update > self.max_age:
                self.trackers.pop(i-1)
            i -= 1

        results = []
        for trk in self.trackers:
            bbox = trk.get_state()
            results.append((bbox, trk.id + 1))  # يبدأ من 1

        return results

    def associate_detections_to_trackers(self, detections, trackers):
        if len(trackers) == 0:
            return [], list(range(len(detections))), []

        iou_matrix = np.zeros((len(detections), len(trackers)), dtype=np.float32)

        for d, det in enumerate(detections):
            for t, trk in enumerate(trackers):
                iou_matrix[d, t] = self.iou(det, trk)

        matched_indices = linear_sum_assignment(-iou_matrix)
        matched_indices = np.array(list(zip(*matched_indices)))

        unmatched_dets = []
        unmatched_trks = []

        if matched_indices.shape[0] > 0:
            matched_d = matched_indices[:, 0]
            matched_t = matched_indices[:, 1]
        else:
            matched_d, matched_t = [], []

        for d in range(len(detections)):
            if d not in matched_d:
                unmatched_dets.append(d)

        for t in range(len(trackers)):
            if t not in matched_t:
                unmatched_trks.append(t)

        matches = []
        for m in matched_indices:
            if iou_matrix[m[0], m[1]] < self.iou_threshold:
                unmatched_dets.append(m[0])
                unmatched_trks.append(m[1])
            else:
                matches.append(m.reshape(1, 2))

        if len(matches) == 0:
            matches = np.empty((0, 2), dtype=int)
        else:
            matches = np.concatenate(matches, axis=0)

        return matches, unmatched_dets, unmatched_trks

    def iou(self, bb_det, bb_trk):
        xx1 = np.maximum(bb_det[0], bb_trk[0])
        yy1 = np.maximum(bb_det[1], bb_trk[1])
        xx2 = np.minimum(bb_det[2], bb_trk[2])
        yy2 = np.minimum(bb_det[3], bb_trk[3])
        w = np.maximum(0., xx2 - xx1)
        h = np.maximum(0., yy2 - yy1)
        inter = w * h
        area_det = (bb_det[2] - bb_det[0]) * (bb_det[3] - bb_det[1])
        area_trk = (bb_trk[2] - bb_trk[0]) * (bb_trk[3] - bb_trk[1])
        union = area_det + area_trk - inter

        if union == 0:
            return 0.0  # أو return 1.0 حسب المطلوب

        ovr = inter / union
        return ovr

