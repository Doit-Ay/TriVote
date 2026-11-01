"""
TriVote Configuration
Central configuration for all system parameters.
"""

import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
DATABASE_PATH = os.path.join(BASE_DIR, "data", "trivote.db")
SQLALCHEMY_DATABASE_URI = f"sqlite:///{DATABASE_PATH}"

# ---------------------------------------------------------------------------
# Face Recognition
# ---------------------------------------------------------------------------
FACE_DATA_DIR = os.path.join(BASE_DIR, "data", "face_data")
FACE_CAPTURE_COUNT = 5            # Number of frames to capture per registration
FACE_CONFIDENCE_THRESHOLD = 48    # LBPH distance threshold (<= 48 is same person, > 48 is impostor)
FACE_DETECTION_SCALE = 1.3
FACE_DETECTION_NEIGHBORS = 5
FACE_DETECTION_MIN_SIZE = (100, 100)
FACE_IMAGE_SIZE = (200, 200)

# ---------------------------------------------------------------------------
# Fingerprint
# ---------------------------------------------------------------------------
FP_USE_REAL_SENSOR = True         # Use the real WBF sensor (system pool / Windows Hello fingers)
FP_FALLBACK_SIMULATION = True     # Simulate ONLY if no sensor/winbio.dll at startup
FP_FALLBACK_ON_FAILURE = False    # Never simulate after a failed/timed-out real scan
FP_CAPTURE_TIMEOUT = 15           # Seconds to wait for finger placement
FP_FOCUS_MODE = "console"         # "console": bring server console to foreground during scans (WBF focus rule); "none": disable

# ---------------------------------------------------------------------------
# Iris (Simulated)
# ---------------------------------------------------------------------------
IRIS_CODE_SIZE = 64               # 64x64 binary iris code
IRIS_SCAN_DURATION = 3.0          # Animation duration in seconds
IRIS_MATCH_THRESHOLD = 0.32       # Daugman Hamming distance threshold

# ---------------------------------------------------------------------------
# Score Fusion
# ---------------------------------------------------------------------------
FUSION_WEIGHTS = {
    "face": 0.45,
    "fingerprint": 0.30,
    "iris": 0.25,
}
FUSION_THRESHOLD = 0.65           # Minimum fusion score to authenticate (stricter: 0.65)

# ---------------------------------------------------------------------------
# Flask / Admin
# ---------------------------------------------------------------------------
SECRET_KEY = "trivote-secure-key-2026"
HOST = "127.0.0.1"
PORT = 5000

# ---------------------------------------------------------------------------
# Candidates for the mock election
# ---------------------------------------------------------------------------
CANDIDATES = [
    {"name": "Arjun Mehta", "party": "National Democratic Alliance"},
    {"name": "Priya Sharma", "party": "Progressive Citizens Front"},
    {"name": "Vikram Desai", "party": "United Workers Party"},
    {"name": "NOTA", "party": "None of the Above"},
]
