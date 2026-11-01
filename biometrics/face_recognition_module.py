"""
TriVote Face Recognition Module
Face detection via Haar cascades and recognition via LBPH (OpenCV contrib).
"""

import logging
import os
import pickle
import sys

import cv2
import numpy as np

# Ensure project root is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config

logger = logging.getLogger(__name__)


class FaceRecognitionModule:
    """
    Handles face detection (Haar cascade) and recognition (LBPH).

    Captured face images are stored as 200x200 grayscale crops under
    ``config.FACE_DATA_DIR/<voter_id>/``.  The LBPH model is trained on
    all registered faces and can be retrained at any time.
    """

    def __init__(self):
        # Load Haar cascade
        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        self.face_cascade = cv2.CascadeClassifier(cascade_path)
        if self.face_cascade.empty():
            logger.error("Failed to load Haar cascade from %s", cascade_path)

        # LBPH recogniser (may be None until trained)
        self.recognizer: cv2.face.LBPHFaceRecognizer | None = None
        self.label_map: dict[int, str] = {}  # int label -> voter_id
        self.model_trained = False

        # Detection parameters from config
        self.scale_factor = config.FACE_DETECTION_SCALE
        self.min_neighbors = config.FACE_DETECTION_NEIGHBORS
        self.min_size = config.FACE_DETECTION_MIN_SIZE
        self.image_size = config.FACE_IMAGE_SIZE
        self.confidence_threshold = config.FACE_CONFIDENCE_THRESHOLD
        self.data_dir = config.FACE_DATA_DIR

        os.makedirs(self.data_dir, exist_ok=True)
        logger.info("FaceRecognitionModule initialised  data_dir=%s", self.data_dir)

        # Attempt to train on any existing data at startup
        self._try_initial_train()

    # ------------------------------------------------------------------
    # Detection
    # ------------------------------------------------------------------

    def detect_face(
        self, frame: np.ndarray
    ) -> tuple[np.ndarray | None, tuple | None]:
        """
        Detect the largest face in *frame*.

        Args:
            frame: BGR numpy array from a camera or decoded image.

        Returns:
            ``(face_roi_gray_200x200, (x, y, w, h))`` on success, or
            ``(None, None)`` if no face is detected.
        """
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = self.face_cascade.detectMultiScale(
            gray,
            scaleFactor=self.scale_factor,
            minNeighbors=self.min_neighbors,
            minSize=self.min_size,
        )

        if len(faces) == 0:
            return None, None

        # Pick the largest face by area
        areas = [w * h for (_, _, w, h) in faces]
        idx = int(np.argmax(areas))
        x, y, w, h = faces[idx]

        roi = gray[y : y + h, x : x + w]
        roi_resized = cv2.resize(roi, self.image_size)

        return roi_resized, (int(x), int(y), int(w), int(h))

    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------

    def register_faces(self, voter_id: str, frames: list[np.ndarray]) -> bool:
        """
        Process a list of BGR frames, extract face ROIs, and save them to
        disk under ``data/face_data/<voter_id>/``.

        Args:
            voter_id: Unique voter identifier.
            frames:   List of BGR numpy arrays.

        Returns:
            ``True`` if at least one face was successfully saved.
        """
        voter_dir = os.path.join(self.data_dir, voter_id)
        os.makedirs(voter_dir, exist_ok=True)

        saved = 0
        for i, frame in enumerate(frames):
            roi, bbox = self.detect_face(frame)
            if roi is not None:
                path = os.path.join(voter_dir, f"face_{i:03d}.png")
                cv2.imwrite(path, roi)
                saved += 1

        logger.info(
            "register_faces: %s  saved %d / %d frames",
            voter_id,
            saved,
            len(frames),
        )
        return saved > 0

    # ------------------------------------------------------------------
    # Training
    # ------------------------------------------------------------------

    def train_model(self) -> None:
        """
        Train (or retrain) the LBPH recogniser on all face images stored
        under ``config.FACE_DATA_DIR``.

        Each sub-directory name is treated as a voter_id label.
        """
        faces: list[np.ndarray] = []
        labels: list[int] = []
        self.label_map = {}
        label_counter = 0

        for voter_id in sorted(os.listdir(self.data_dir)):
            voter_dir = os.path.join(self.data_dir, voter_id)
            if not os.path.isdir(voter_dir):
                continue

            image_files = [
                f
                for f in os.listdir(voter_dir)
                if f.lower().endswith((".png", ".jpg", ".jpeg"))
            ]
            if not image_files:
                continue

            self.label_map[label_counter] = voter_id

            for fname in image_files:
                img = cv2.imread(
                    os.path.join(voter_dir, fname), cv2.IMREAD_GRAYSCALE
                )
                if img is not None:
                    img = cv2.resize(img, self.image_size)
                    faces.append(img)
                    labels.append(label_counter)

            label_counter += 1

        if not faces:
            logger.warning("train_model: no face images found, model not trained")
            self.model_trained = False
            return

        self.recognizer = cv2.face.LBPHFaceRecognizer_create()
        self.recognizer.train(faces, np.array(labels, dtype=np.int32))
        self.model_trained = True

        logger.info(
            "LBPH model trained on %d images across %d voters",
            len(faces),
            label_counter,
        )

    # ------------------------------------------------------------------
    # Authentication
    # ------------------------------------------------------------------

    def authenticate(
        self, frame: np.ndarray
    ) -> tuple[str | None, float, tuple | None]:
        """
        Attempt to recognise a face in *frame* against the trained model.

        Args:
            frame: BGR numpy array.

        Returns:
            ``(matched_voter_id, normalised_score, bbox)`` on a successful
            match, or ``(None, 0.0, None)`` otherwise.
        """
        if not self.model_trained or self.recognizer is None:
            # Model not trained — cannot perform recognition
            roi, bbox = self.detect_face(frame)
            if roi is None:
                return None, 0.0, None
            logger.warning(
                "authenticate: face detected but LBPH model is NOT trained — "
                "register and capture faces first"
            )
            return None, 0.0, bbox

        roi, bbox = self.detect_face(frame)
        if roi is None:
            return None, 0.0, None

        label, confidence = self.recognizer.predict(roi)

        # LBPH confidence is *distance* (lower = better match).
        # Same enrolled person: typically distance 25 to 45.
        # Different person (impostor): typically distance 52 to 85+.
        if confidence > self.confidence_threshold:
            logger.info(
                "authenticate: REJECTED impostor/mismatch (confidence=%.1f > threshold=%d)",
                confidence,
                self.confidence_threshold,
            )
            # Normalise impostor score to low range (0.10 to 0.35)
            impostor_score = max(0.10, min(0.35, 1.0 - (confidence / 100.0)))
            return None, round(impostor_score, 4), bbox

        # Enrolled person confirmed: map confidence [0, 48] -> score [1.0, 0.70]
        # at 25 distance -> 0.84
        # at 35 distance -> 0.78
        # at 45 distance -> 0.72
        score = max(0.70, min(0.98, 1.0 - (confidence / self.confidence_threshold) * 0.30))

        voter_id = self.label_map.get(label)
        if voter_id is None:
            logger.warning("authenticate: label %d not in label_map", label)
            return None, 0.20, bbox

        logger.info(
            "authenticate: MATCHED %s  confidence=%.1f  score=%.3f",
            voter_id,
            confidence,
            score,
        )
        return voter_id, round(score, 4), bbox

    # ------------------------------------------------------------------
    # UI overlay helper
    # ------------------------------------------------------------------

    def get_face_overlay_data(self, frame: np.ndarray) -> dict:
        """
        Detect a face and return metadata for UI overlay rendering.

        Args:
            frame: BGR numpy array.

        Returns:
            Dict with keys ``bbox`` (tuple or None) and ``is_detected`` (bool).
        """
        _, bbox = self.detect_face(frame)
        return {
            "bbox": bbox,
            "is_detected": bbox is not None,
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _try_initial_train(self) -> None:
        """Attempt to train the model from existing data at startup."""
        if os.path.isdir(self.data_dir) and os.listdir(self.data_dir):
            try:
                self.train_model()
            except Exception as exc:
                logger.warning("Initial model training failed: %s", exc)
