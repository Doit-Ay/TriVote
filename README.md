# TriVote — Multi-Modal Biometric Voting Authentication System

[![Python](https://img.shields.io/badge/Python-3.9%2B-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.0%2B-black.svg)](https://flask.palletsprojects.com/)
[![OpenCV](https://img.shields.io/badge/OpenCV-LBPH-brightgreen.svg)](https://opencv.org/)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL-orange.svg)](https://threejs.org/)
[![License](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)

> **SECURE * TRANSPARENT * INCLUSIVE**  
> TriVote is an air-gapped, sovereign voting authentication terminal powered by **Triple-Vector Biometrics** (Facial Geometry, Capacitive Fingerprint, and Iris Demodulation) with a **Weighted Multi-Modal Score Fusion Engine**.

---

## Table of Contents
1. [Overview & Problem Statement](#overview--problem-statement)
2. [Triple-Biometric Architecture](#triple-biometric-architecture)
3. [Key Features](#key-features)
4. [Project Structure](#project-structure)
5. [Prerequisites](#prerequisites)
6. [Installation & Setup](#installation--setup)
7. [Running the Application](#running-the-application)
8. [Step-by-Step User Walkthrough](#step-by-step-user-walkthrough)
   - [A. Voter Registration](#a-voter-registration)
   - [B. Resuming an Incomplete Registration](#b-resuming-an-incomplete-registration)
   - [C. Voter Authentication](#c-voter-authentication)
   - [D. Casting the Ballot](#d-casting-the-ballot)
   - [E. Admin & Audit Dashboard](#e-admin--audit-dashboard)
9. [Configuration Reference](#configuration-reference)
10. [Presentation Deck Generator](#presentation-deck-generator)
11. [Troubleshooting & FAQs](#troubleshooting--faqs)

---

## Overview & Problem Statement

Conventional voting systems face critical vulnerabilities:
* **Voter Impersonation & Forgery:** Physical voter ID cards and indelible ink can be swapped, duplicated, or removed.
* **Single-Biometric Fragility:** Systems relying solely on a fingerprint scanner alienate senior citizens and manual laborers whose friction ridges have worn down (exhibiting an 8–12% false rejection rate).
* **Cloud Attack Surface:** Internet-connected voting terminals introduce foreign cyber-attack vectors, DDoS vulnerabilities, and central database leaks.

**TriVote** resolves these challenges by operating as an **air-gapped, zero-cloud sovereign polling terminal**. Rather than relying on an all-or-nothing check on a single body part, TriVote combines three physiological modalities into a mathematical weighted fusion score.

---

## Triple-Biometric Architecture

TriVote evaluates identity across three distinct modalities:

```
+---------------------------------------------------------------------------------------------------+
|                                 Multi-Modal Fusion Decision Model                                 |
+--------------------------+--------------------------+---------------------------------------------+
| Modality                 | Algorithm & Hardware     | Weight & Threshold                          |
+--------------------------+--------------------------+---------------------------------------------+
| 1. Facial Recognition    | OpenCV Haar Cascade +    | 45% of composite score                      |
|                          | LBPH (5 frames)          | Distance threshold <= 48                    |
|                          |                          |                                             |
| 2. Fingerprint Sensor    | Windows Biometric (WBF)  | 30% of composite score                      |
|                          | + Minutiae Engine        | Friction ridge bifurcation matching         |
|                          |                          |                                             |
| 3. Iris Demodulation     | Daugman 2D Gabor Wavelet | 25% of composite score                      |
|                          | (64x64 phase code)       | Fractional Hamming distance <= 0.32         |
+--------------------------+--------------------------+---------------------------------------------+
```

### Mathematical Decision Formula

$$\text{Composite Score } S = 0.45 \times S_{\text{Face}} + 0.30 \times S_{\text{Fingerprint}} + 0.25 \times S_{\text{Iris}}$$

* **Authorization Rule:** A voter is authenticated if and only if:
  $$S \ge 0.65 \quad \text{AND} \quad \min(S_{\text{Face}}, S_{\text{Fingerprint}}, S_{\text{Iris}}) \ge 0.50$$
* **Anti-Spoofing Modality Gate:** The `min(modality) >= 0.50` gate ensures that an attacker cannot bypass the system with a 100% score on one vector if any other vector completely fails or is spoofed.

---

## Key Features

* **5-Frame Facial Enrollment:** Captures 5 high-clarity frames, tracking face alignment in real time and training an illumination-invariant Local Binary Patterns Histograms (LBPH) model.
* **Dual-Mode Fingerprint Subsystem:**
  * *Hardware Sensor Mode:* Connects directly to laptop fingerprint readers using the native Windows Biometric Framework (`winbio.dll` / Windows Hello).
  * *Biometric Minutiae Engine:* Extracts synthetic ridge minutiae bifurcations and core loops for guests and demo voters without altering the host machine's Windows credentials.
* **Resume Incomplete Registration:** If registration is interrupted midway (power fluctuation, voter stepping away), entering the assigned Voter ID restores demographic details and saved biometrics, jumping directly to the first incomplete step.
* **Anti-Duplicate Voting Lock:** The second a ballot is cast, the database sets `has_voted = True` in an atomic transaction. Any re-authentication attempt is immediately rejected.
* **Interactive 3D Three.js Visualizers:** High-fidelity WebGL scenes render capacitive platens, dual-layer laser fans, dynamically locking minutiae nodes, and Daugman iris reticles over a clean transparent background.
* **Tamper-Evident Cryptographic Ledger:** Every authentication attempt, sub-score, and ballot is signed with SHA-256 hashes and timestamped locally in SQLite.
* **Sovereign Offline Execution:** Completely functional without internet or external third-party cloud services.

---

## Project Structure

```
TriVote/
│
├── app.py                            # Flask + Socket.IO server & event handlers
├── config.py                         # System thresholds, weights, and directory paths
├── generate_presentation.py          # Script generating 16:9 PowerPoint presentation
├── requirements.txt                  # Python dependencies
├── TriVote_Biometric_Voting_System.pptx # Widescreen presentation deck
│
├── biometrics/                       # Biometric algorithmic modules
│   ├── face_recognition_module.py    # OpenCV Haar Cascade + LBPH recognizer
│   ├── fingerprint_module.py         # WBF driver wrapper & Biometric Minutiae Engine
│   ├── iris_module.py                # Daugman 2D Gabor wavelet demodulation
│   └── fusion.py                     # Weighted score fusion & decision logic
│
├── database/                         # Database models & SQLite manager
│   ├── models.py                     # SQLAlchemy ORM models (Voter, Vote, AuditLog)
│   └── db_manager.py                 # Thread-safe database operations & queries
│
├── static/                           # Frontend assets
│   ├── css/                          # Modern glassmorphic dark-theme stylesheets
│   │   ├── main.css                  # Base layout, typography & CSS variables
│   │   ├── components.css            # Buttons, cards, gauges, modals & tables
│   │   ├── animations.css            # Keyframe transitions & laser sweeps
│   │   └── home-hero.css             # Header & voting center styling
│   │
│   └── js/                           # Frontend JavaScript architecture
│       ├── app.js                    # Screen routing & lifecycle controller
│       ├── camera.js                 # HTML5 video stream & frame grabber
│       ├── websocket.js              # Socket.IO client with single-dispatch protection
│       │
│       ├── components/               # Reusable UI widgets
│       │   ├── progress-stepper.js   # Multi-stage progress indicators
│       │   ├── score-gauge.js        # SVG radial gauge for biometric confidence
│       │   └── notification.js       # Toast notifications with duplicate debounce
│       │
│       ├── screens/                  # View controllers
│       │   ├── home.js               # Entrance screen & information modals
│       │   ├── register.js           # Multi-step voter registration & resume
│       │   ├── authenticate.js       # 5-stage live verification pipeline
│       │   ├── vote.js               # Ballot display & vote recording
│       │   └── admin.js              # Admin portal & voter ledger dashboard
│       │
│       └── three-scenes/             # 3D Three.js WebGL visualizations
│           ├── hero-scene.js         # Rotating security wireframe shield
│           ├── fingerprint-scene.js  # 3D capacitive platen, laser sweep & minutiae nodes
│           └── iris-scene.js         # 3D anatomical eye & Daugman reticle scan
│
├── templates/                        # HTML views
│   ├── index.html                    # Main terminal application UI
│   └── admin.html                    # Administrative audit & monitoring dashboard
│
├── tests/                            # Unit & integration test suites
│   └── test_fingerprint_module.py    # WBF & Minutiae module unit tests
│
├── tools/                            # Hardware diagnostic utilities
│   └── fp_probe.py                   # Windows Biometric Framework sensor probe
│
└── data/                             # Local SQLite vault & biometric encodings (ignored in git)
    ├── .gitkeep
    └── face_data/
        └── .gitkeep
```

---

## Prerequisites

* **Operating System:** Windows 10 / 11 (recommended for native Windows Biometric Framework sensor access) or Linux / macOS (runs in software Minutiae Engine mode).
* **Python:** Version **3.9 to 3.12** installed.
* **Camera:** Built-in webcam or USB camera for facial recognition.
* **Fingerprint Sensor:** (Optional) Built-in laptop fingerprint reader configured with Windows Hello, or use the built-in Biometric Minutiae Engine for guests.

---

## Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/Doit-Ay/TriVote.git
cd TriVote
```

### 2. Create a Virtual Environment (Recommended)
```bash
# On Windows
python -m venv venv
venv\Scripts\activate

# On Linux / macOS
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

---

## Running the Application

Start the Flask + Socket.IO server:
```bash
python app.py
```

Open your browser and navigate to:
```
http://127.0.0.1:5000
```

*The terminal will display the Indian Tricolor ribbon emblem, real-time system status, and prompt you to enter the voting terminal.*

---

## Step-by-Step User Walkthrough

### A. Voter Registration
1. Click **Admin Login** in the upper right corner, or select **New Registration**.
2. **Step 1 (Demographics):** Enter Full Name, Date of Birth, Address, and Phone Number. Click **NEXT STEP**.
3. **Step 2 (Facial Capture):** Align your face inside the camera guide and click **CAPTURE** 5 times.
4. **Step 3 (Fingerprint Enrollment):**
   * *If using your own laptop sensor:* Click **BEGIN SCAN (HARDWARE SENSOR)** and touch your reader.
   * *If testing with a friend/guest:* Click **ENROLL VIA BIOMETRIC ENGINE (GUEST / FRIEND)**.
5. **Step 4 (Iris Scan):** Click **BEGIN IRIS SCAN** and hold steady for the 3-second phase demodulation.
6. **Step 5 (Credential Summary):** A unique Voter Identification Number (e.g. `VTR-20261102-001`) is issued.

### B. Resuming an Incomplete Registration
If a user is interrupted at Step 3 or 4:
1. Return to the Registration screen.
2. Under *"Stopped midway or updating biometrics? Resume with Voter ID"*, enter the assigned Voter ID.
3. Click **RESUME PROGRESS** (or press Enter).
4. The system loads existing demographic details and saved face images, automatically jumping directly to the incomplete biometric step.

### C. Voter Authentication
1. Click **VOTER AUTHENTICATION** on the home screen.
2. Enter your assigned Voter ID and click **VERIFY**.
3. **Facial Authentication:** The camera streams live frames, running Haar Cascade detection and LBPH distance scoring.
4. **Fingerprint Authentication:** Touch the hardware sensor (or click **TEST UNMATCHED FINGER** to test impostor rejection).
5. **Iris Authentication:** Click **SCAN IRIS** to compute the fractional Hamming distance.
6. **Fusion Decision:** Live SVG radial gauges display individual scores. If the composite score meets or exceeds 65% (and all individual scores exceed 50%), access is granted.

### D. Casting the Ballot
1. After successful authentication, the ballot screen appears listing official candidates and their parties.
2. Select your chosen candidate and click **CONFIRM VOTE**.
3. A success confirmation screen appears. The voter's record is immediately flagged with `has_voted = True`.
4. If the same voter attempts to authenticate again, the terminal immediately displays:  
   *`This voter has already cast a vote (duplicate voting prohibited)`*

### E. Admin & Audit Dashboard
Navigate to `http://127.0.0.1:5000/admin` (or click Admin Login) to inspect:
* Real-time voting percentages and turn-out statistics.
* Audit log table recording every authentication attempt, sub-scores, decisions, and timestamps.
* Live candidate standings.

---

## Configuration Reference

Key system settings can be customized in [`config.py`](config.py):

| Parameter | Default Value | Description |
| :--- | :--- | :--- |
| `FACE_CAPTURE_COUNT` | `5` | Number of facial images required during enrollment |
| `FACE_CONFIDENCE_THRESHOLD` | `48` | LBPH distance threshold (<= 48 matches, > 48 rejects) |
| `FP_USE_REAL_SENSOR` | `True` | Interfacing with physical Windows Hello hardware sensor |
| `FP_CAPTURE_TIMEOUT` | `15` | Timeout in seconds waiting for finger touch |
| `IRIS_CODE_SIZE` | `64` | Resolution of the binary iris feature matrix ($64 \times 64$) |
| `IRIS_MATCH_THRESHOLD` | `0.32` | Maximum allowable Hamming distance for an iris match |
| `FUSION_WEIGHTS['face']` | `0.45` | Weight assigned to facial confidence score |
| `FUSION_WEIGHTS['fingerprint']`| `0.30` | Weight assigned to fingerprint minutiae score |
| `FUSION_WEIGHTS['iris']` | `0.25` | Weight assigned to iris demodulation score |
| `FUSION_THRESHOLD` | `0.65` | Minimum composite score required to authorize ballot |

---

## Presentation Deck Generator

A PowerPoint presentation generator is included with the project. It builds a 6-slide widescreen (16:9) presentation with custom cyber dark styling.

To rebuild the deck:
```bash
python generate_presentation.py
```
The generated presentation will be saved as:
```
TriVote_Biometric_Voting_System.pptx
```

---

## Troubleshooting & FAQs

**Q: My webcam isn't opening in the browser.**  
* Ensure your browser has granted camera access permissions for `http://127.0.0.1:5000`. On Chrome/Edge, click the site settings padlock next to the URL bar.

**Q: Why does Windows Hello pop up for fingerprints?**  
* TriVote utilizes the native Windows Biometric Framework (`winbio.dll`). When scanning, Windows prompts the user to verify a finger enrolled in the local Windows account. For demo voters or friends whose fingers are not registered in Windows, click **ENROLL VIA BIOMETRIC ENGINE (GUEST / FRIEND)**.

**Q: Port 5000 is already in use.**  
* In PowerShell, find and kill the process:
  ```powershell
  Get-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess | Stop-Process -Force
  ```
  Then restart with `python app.py`.

---

## Security & Ethics Notice
* All biometric encodings and templates in this repository are stored locally in the `data/` directory and are encrypted or hashed.
* This system is designed for sovereign, air-gapped democratic voting terminals and does not transmit biometric data to third-party cloud servers.
