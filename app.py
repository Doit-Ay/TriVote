"""
TriVote -- Biometric Voting Authentication System
Main Flask + SocketIO application.

Serves the web UI and exposes WebSocket events for voter registration,
biometric authentication, voting, and admin dashboards.
"""

import hashlib
import logging
import os
import pickle
import sys
from datetime import datetime, timezone

from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit

# Ensure project root is importable
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config
from database.db_manager import db_manager
from biometrics.face_recognition_module import FaceRecognitionModule
from biometrics.fingerprint_module import FingerprintModule, register_voter_fingerprint
from biometrics.iris_module import IrisModule
from biometrics.fusion import ScoreFusion
from utils.image_utils import base64_to_cv2, cv2_to_base64, draw_face_overlay

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Flask application
# ---------------------------------------------------------------------------
app = Flask(
    __name__,
    template_folder=os.path.join(config.BASE_DIR, "templates"),
    static_folder=os.path.join(config.BASE_DIR, "static"),
)
app.config["SECRET_KEY"] = config.SECRET_KEY
app.config["SQLALCHEMY_DATABASE_URI"] = config.SQLALCHEMY_DATABASE_URI

socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

# ---------------------------------------------------------------------------
# Initialise subsystems
# ---------------------------------------------------------------------------
db_manager.init_db(app)

face_module = FaceRecognitionModule()
fp_module = FingerprintModule()
logger.info("Fingerprint sensor status: %s", fp_module.get_status())
iris_module = IrisModule()
fusion_engine = ScoreFusion()

# Per-registration temporary frame storage: { voter_id: [frame, ...] }
_reg_frames: dict[str, list] = {}

# Active authentication sessions: { socket_sid: voter_id }
_current_auth_voters: dict[str, str] = {}
_fp_auth_in_progress: set[str] = set()
_fp_reg_in_progress: set[str] = set()


def seed_initial_dataset():
    """Seed initial sample voter records and stats if database is empty."""
    stats = db_manager.get_stats()
    if stats["total_voters"] > 0:
        return

    logger.info("Seeding initial dataset for interactive demonstration...")
    sample_voters = [
        {
            "voter_id": "VTR-20261023-001",
            "full_name": "Aarav Sharma",
            "date_of_birth": "1994-06-15",
            "address": "42 Rajpath Marg, New Delhi",
            "phone": "+91 98765 43210",
            "has_voted": False,
        },
        {
            "voter_id": "VTR-20261023-002",
            "full_name": "Neha Patel",
            "date_of_birth": "1998-11-22",
            "address": "18 Civil Lines, Ahmedabad",
            "phone": "+91 98234 56789",
            "has_voted": True,
        },
        {
            "voter_id": "VTR-20261023-003",
            "full_name": "Rohan Gupta",
            "date_of_birth": "1989-03-30",
            "address": "78 Marine Drive, Mumbai",
            "phone": "+91 91234 56780",
            "has_voted": False,
        },
    ]

    for data in sample_voters:
        has_voted = data.pop("has_voted", False)
        voter = db_manager.create_voter(data)
        # Generate and store synthetic biometric templates
        # Fingerprint: simulated template only when no real sensor is in use;
        # with the real sensor, demo voters must register a real finger.
        fp_bytes = None
        if not fp_module.real_mode:
            fp_seed = f"TRIVOTE_FP_ENROLLMENT:{voter.voter_id}".encode("utf-8")
            fp_raw = hashlib.sha256(fp_seed).digest() * 8
            fp_bytes = fp_module.compute_template(fp_raw)
        iris_bytes = iris_module.register(voter.voter_id)
        face_bytes = pickle.dumps({"voter_id": voter.voter_id, "frame_count": 5})

        db_manager.update_voter_biometrics(
            voter.voter_id,
            face_encoding=face_bytes,
            fingerprint_template=fp_bytes,
            iris_template=iris_bytes,
            face_image_path=os.path.join(config.FACE_DATA_DIR, voter.voter_id),
        )

        if has_voted:
            db_manager.record_vote(voter.voter_id, "Priya Sharma", "Progressive Citizens Front")
            db_manager.mark_voted(voter.voter_id)

    # Seed initial authentication logs
    db_manager.log_authentication(
        "VTR-20261023-002",
        face_score=0.925,
        fp_score=0.910,
        iris_score=0.880,
        fusion_score=0.908,
        decision="AUTHENTICATED",
        reason=None,
    )
    db_manager.log_authentication(
        "VTR-20261023-999",
        face_score=0.210,
        fp_score=0.150,
        iris_score=0.180,
        fusion_score=0.181,
        decision="REJECTED",
        reason="Biometric thresholds not met across multiple modalities",
    )
    logger.info("Initial dataset seeded successfully.")


seed_initial_dataset()


def build_admin_payload():
    """Build structured admin dashboard payload."""
    stats = db_manager.get_stats()
    raw_voters = db_manager.get_all_voters()
    raw_logs = db_manager.get_auth_logs(limit=50)
    raw_votes = db_manager.get_votes()

    total_attempts = stats["auth_success_count"] + stats["auth_fail_count"]
    success_rate = (
        round((stats["auth_success_count"] / total_attempts) * 100, 1)
        if total_attempts > 0
        else 0
    )

    formatted_voters = []
    for v in raw_voters:
        time_str = v.get("voted_at") or v.get("registered_at") or ""
        if "T" in time_str:
            time_str = time_str.replace("T", " ")[:19]
        formatted_voters.append({
            "voter_id": v["voter_id"],
            "name": v["full_name"],
            "status": "Voted" if v["has_voted"] else "Pending",
            "time": time_str,
        })

    formatted_logs = []
    for l in raw_logs:
        t_str = l.get("timestamp") or ""
        if "T" in t_str:
            t_str = t_str.replace("T", " ")[:19]
        formatted_logs.append({
            "time": t_str,
            "voter_id": l["voter_id"],
            "face_score": round(l["face_score"] * 100, 1) if l["face_score"] <= 1.0 else round(l["face_score"], 1),
            "fingerprint_score": round(l["fingerprint_score"] * 100, 1) if l["fingerprint_score"] <= 1.0 else round(l["fingerprint_score"], 1),
            "iris_score": round(l["iris_score"] * 100, 1) if l["iris_score"] <= 1.0 else round(l["iris_score"], 1),
            "fusion_score": round(l["fusion_score"] * 100, 1) if l["fusion_score"] <= 1.0 else round(l["fusion_score"], 1),
            "decision": l["decision"],
        })

    tally_map = {c["name"]: 0 for c in config.CANDIDATES}
    for v in raw_votes:
        c_name = v.get("candidate", "Unknown")
        tally_map[c_name] = tally_map.get(c_name, 0) + 1

    vote_tally = [{"name": name, "count": count} for name, count in tally_map.items()]

    return {
        "registeredVoters": stats["total_voters"],
        "votesCast": stats["total_votes"],
        "authSuccessRate": success_rate,
        "authFailures": stats["auth_fail_count"],
        "authLog": formatted_logs,
        "voteTally": vote_tally,
        "voters": formatted_voters,
        "stats": stats,
        "auth_logs": raw_logs,
        "votes": raw_votes,
    }


# ---------------------------------------------------------------------------
# HTTP routes
# ---------------------------------------------------------------------------


@app.route("/")
def index():
    """Serve the main voter-facing page."""
    return render_template("index.html")


@app.route("/admin")
def admin():
    """Serve the admin dashboard page."""
    return render_template("admin.html")


@app.route("/api/voter/<voter_id>")
def api_lookup_voter(voter_id):
    """REST endpoint to look up an existing voter to resume or inspect registration."""
    voter_id = (voter_id or "").strip().upper()
    if not voter_id:
        return jsonify({"success": False, "message": "Please enter a valid Voter ID."}), 400

    voter = db_manager.get_voter(voter_id)
    if voter is None:
        return jsonify({"success": False, "message": f"Voter ID '{voter_id}' was not found in the registry."}), 404

    if voter.has_voted:
        return jsonify({
            "success": False,
            "message": f"Voter {voter_id} has already cast a vote. Registration cannot be modified.",
        }), 400

    face_dir = os.path.join(config.FACE_DATA_DIR, voter_id)
    saved_frames = (
        len([f for f in os.listdir(face_dir) if f.lower().endswith((".png", ".jpg"))])
        if os.path.isdir(face_dir)
        else 0
    )

    return jsonify({
        "success": True,
        "voter": {
            "voter_id": voter.voter_id,
            "name": voter.full_name,
            "dob": voter.date_of_birth,
            "address": voter.address,
            "phone": voter.phone,
            "has_face": voter.face_encoding is not None or saved_frames >= config.FACE_CAPTURE_COUNT,
            "face_count": saved_frames,
            "has_fingerprint": voter.fingerprint_template is not None,
            "has_iris": voter.iris_template is not None,
        },
        "message": f"Loaded profile for {voter.full_name} ({voter_id}).",
    })


# ===================================================================
# REGISTRATION FLOW
# ===================================================================


@socketio.on("lookup_voter")
def handle_lookup_voter(data):
    """
    Look up an existing voter to resume or update an incomplete registration.

    Expects: { voter_id }
    Emits:   'voter_lookup_result' with { success, voter: {...}, message }
    """
    voter_id = (data.get("voter_id") or "").strip().upper()
    if not voter_id:
        emit("voter_lookup_result", {
            "success": False,
            "message": "Please enter a valid Voter ID.",
        })
        return

    voter = db_manager.get_voter(voter_id)
    if voter is None:
        emit("voter_lookup_result", {
            "success": False,
            "message": f"Voter ID '{voter_id}' was not found in the registry.",
        })
        return

    if voter.has_voted:
        emit("voter_lookup_result", {
            "success": False,
            "message": f"Voter {voter_id} has already cast a vote. Registration cannot be modified.",
        })
        return

    face_dir = os.path.join(config.FACE_DATA_DIR, voter_id)
    saved_frames = (
        len([f for f in os.listdir(face_dir) if f.lower().endswith((".png", ".jpg"))])
        if os.path.isdir(face_dir)
        else 0
    )

    emit("voter_lookup_result", {
        "success": True,
        "voter": {
            "voter_id": voter.voter_id,
            "name": voter.full_name,
            "dob": voter.date_of_birth,
            "address": voter.address,
            "phone": voter.phone,
            "has_face": voter.face_encoding is not None or saved_frames >= config.FACE_CAPTURE_COUNT,
            "face_count": saved_frames,
            "has_fingerprint": voter.fingerprint_template is not None,
            "has_iris": voter.iris_template is not None,
        },
        "message": f"Loaded profile for {voter.full_name} ({voter_id}).",
    })
    logger.info("Voter lookup for resume: %s (name=%s)", voter_id, voter.full_name)


@socketio.on("register_voter")
def handle_register_voter(data):
    """
    Begin voter registration — create new or update existing voter record.

    Expects: { name, dob, address, phone, voter_id?: str }
    Emits:   'registration_response' with { success, voter_id, message }
    """
    try:
        existing_id = (data.get("voter_id") or "").strip().upper()
        if existing_id:
            existing_voter = db_manager.get_voter(existing_id)
            if existing_voter is not None:
                if existing_voter.has_voted:
                    emit("registration_response", {
                        "success": False,
                        "voter_id": existing_id,
                        "message": "This voter has already voted and cannot be modified.",
                    })
                    return
                # Update demographic info
                db_manager.update_voter_info(existing_id, {
                    "full_name": data.get("name", ""),
                    "date_of_birth": data.get("dob", ""),
                    "address": data.get("address", ""),
                    "phone": data.get("phone", ""),
                })
                if existing_id not in _reg_frames:
                    _reg_frames[existing_id] = []
                emit("registration_response", {
                    "success": True,
                    "voter_id": existing_id,
                    "message": "Voter profile updated",
                    "resumed": True,
                })
                logger.info("Registration resumed/updated for %s", existing_id)
                socketio.emit("admin_update", build_admin_payload())
                return

        voter = db_manager.create_voter({
            "full_name": data.get("name", ""),
            "date_of_birth": data.get("dob", ""),
            "address": data.get("address", ""),
            "phone": data.get("phone", ""),
        })
        _reg_frames[voter.voter_id] = []
        emit("registration_response", {
            "success": True,
            "voter_id": voter.voter_id,
            "message": "Voter profile created",
            "resumed": False,
        })
        logger.info("Registration started for %s", voter.voter_id)
        socketio.emit("admin_update", build_admin_payload())
    except Exception as exc:
        logger.error("register_voter error: %s", exc)
        emit("registration_response", {
            "success": False,
            "voter_id": None,
            "message": str(exc),
        })


@socketio.on("capture_face")
def handle_capture_face(data):
    """
    Process a single face-capture frame during registration.

    Expects: { voter_id, frame, capture_index }
    Emits:   'face_capture_response' with { success, bbox, quality, count, total, message }
    """
    voter_id = data.get("voter_id", "")
    frame_b64 = data.get("frame", "")
    total = config.FACE_CAPTURE_COUNT

    frame = base64_to_cv2(frame_b64)
    if frame is None:
        emit("face_capture_response", {
            "success": False,
            "bbox": None,
            "quality": 0,
            "count": len(_reg_frames.get(voter_id, [])),
            "total": total,
            "message": "Invalid frame data",
        })
        return

    roi, bbox = face_module.detect_face(frame)
    success = roi is not None

    if success:
        if voter_id not in _reg_frames:
            _reg_frames[voter_id] = []
        _reg_frames[voter_id].append(frame)

    count = len(_reg_frames.get(voter_id, []))

    quality = 0
    if bbox is not None:
        _, _, w, h = bbox
        fh, fw = frame.shape[:2]
        quality = min(100, int((w * h) / (fw * fh) * 400))

    emit("face_capture_response", {
        "success": success,
        "bbox": list(bbox) if bbox else None,
        "quality": quality,
        "count": count,
        "total": total,
        "message": "Face captured" if success else "No face detected in frame",
    })

    if count >= total:
        _finalize_face_registration(voter_id)


def _finalize_face_registration(voter_id):
    """Save face frames, train model, update DB."""
    frames = _reg_frames.pop(voter_id, [])
    if not frames:
        return

    registered = face_module.register_faces(voter_id, frames)
    if not registered:
        return

    face_module.train_model()

    face_encoding = pickle.dumps({"voter_id": voter_id, "frame_count": len(frames)})
    face_image_path = os.path.join(config.FACE_DATA_DIR, voter_id)
    db_manager.update_voter_biometrics(
        voter_id,
        face_encoding=face_encoding,
        face_image_path=face_image_path,
    )
    logger.info("Face registration complete for %s (%d frames)", voter_id, len(frames))


@socketio.on("capture_fingerprint")
def handle_capture_fingerprint(data):
    """
    Capture and register a fingerprint. Supports real hardware sensor
    (Windows Hello) or Biometric Minutiae Engine (virtual scanner).

    Expects: { voter_id, hardware_verified?: bool, use_virtual?: bool }
    Emits:   'fingerprint_status' with progress updates
    """
    voter_id = data.get("voter_id", "")
    client_sid = request.sid
    hardware_verified = bool(data.get("hardware_verified", False))
    use_virtual = bool(data.get("use_virtual", False))

    if hardware_verified:
        seed = f"HW_WINHELLO:{voter_id}".encode("utf-8")
        template = hashlib.sha256(seed).digest()
        db_manager.bind_fingerprint_template(voter_id, template)
        emit("fingerprint_status", {
            "status": "captured",
            "message": "Enrolled fingerprint verified on sensor (Windows Hello)",
            "mode": "hardware",
        })
        logger.info("Fingerprint enrolled via hardware sensor for %s", voter_id)
        return

    if client_sid in _fp_reg_in_progress:
        logger.warning("Fingerprint registration already in progress for sid=%s", client_sid)
        return
    _fp_reg_in_progress.add(client_sid)

    def _do_capture(sid, v_id, is_virtual):
        try:
            if is_virtual:
                waiting_msg = "Extracting ridge characteristics..."
            else:
                waiting_msg = "Touch your fingerprint sensor now..."

            socketio.emit("fingerprint_status", {
                "status": "waiting",
                "message": waiting_msg,
                "mode": "simulation" if is_virtual else fp_module.mode,
            }, to=sid)

            # Send staged progress updates for simulation / virtual mode
            if is_virtual or fp_module.mode == "simulation":
                socketio.sleep(0.8)
                socketio.emit("fingerprint_status", {
                    "status": "scanning",
                    "message": "Finger detected. Scanning ridge pattern...",
                    "mode": "simulation",
                }, to=sid)
                socketio.sleep(1.2)
                socketio.emit("fingerprint_status", {
                    "status": "scanning",
                    "message": "Extracting minutiae points...",
                    "mode": "simulation",
                }, to=sid)
                socketio.sleep(1.0)
                socketio.emit("fingerprint_status", {
                    "status": "scanning",
                    "message": "Building biometric template...",
                    "mode": "simulation",
                }, to=sid)
                socketio.sleep(0.5)

            res = register_voter_fingerprint(
                fp_module, db_manager, v_id, config.FP_CAPTURE_TIMEOUT, use_virtual=is_virtual
            )
            mode = res.get("mode", "simulation" if is_virtual else fp_module.mode)

            if res["success"]:
                socketio.emit("fingerprint_status", {
                    "status": "captured",
                    "message": res["message"],
                    "mode": mode,
                }, to=sid)
            else:
                socketio.emit("fingerprint_status", {
                    "status": "error",
                    "message": res["message"],
                    "mode": mode,
                    "reason": res["status"],
                }, to=sid)
            logger.info(
                "Fingerprint registration for %s: success=%s status=%s mode=%s",
                v_id, res["success"], res["status"], mode,
            )
        except Exception as exc:
            logger.error("Fingerprint capture error: %s", exc)
            socketio.emit("fingerprint_status", {
                "status": "error",
                "message": f"Capture failed: {exc}",
                "mode": fp_module.mode,
                "reason": "error",
            }, to=sid)
        finally:
            _fp_reg_in_progress.discard(sid)

    socketio.start_background_task(_do_capture, client_sid, voter_id, use_virtual)


@socketio.on("capture_iris")
def handle_capture_iris(data):
    """
    Generate and store an iris template for the voter.

    Expects: { voter_id }
    Emits:   'iris_status' with progress updates
    """
    voter_id = data.get("voter_id", "")
    client_sid = request.sid

    try:
        socketio.emit("iris_status", {"status": "scanning", "progress": 0.0, "message": "Scanning iris..."}, to=client_sid)
        socketio.sleep(0.4)
        socketio.emit("iris_status", {"status": "scanning", "progress": 0.35, "message": "Analyzing iris pattern..."}, to=client_sid)
        socketio.sleep(0.4)
        socketio.emit("iris_status", {"status": "scanning", "progress": 0.70, "message": "Extracting feature vectors..."}, to=client_sid)
        socketio.sleep(0.4)

        template_bytes = iris_module.register(voter_id)
        db_manager.update_voter_biometrics(voter_id, iris_template=template_bytes)

        socketio.emit("iris_status", {"status": "scanning", "progress": 1.0, "message": "Iris template generated"}, to=client_sid)
        socketio.sleep(0.3)
        socketio.emit("iris_status", {
            "status": "captured",
            "message": "Iris pattern registered successfully",
        }, to=client_sid)
        logger.info("Iris registered for %s", voter_id)
    except Exception as exc:
        logger.error("Iris registration error: %s", exc)
        socketio.emit("iris_status", {
            "status": "error",
            "message": f"Iris registration failed: {exc}",
        }, to=client_sid)


@socketio.on("complete_registration")
def handle_complete_registration(data):
    """
    Finalise the full registration process.

    Expects: { voter_id }
    Emits:   'registration_response' with completion status
    """
    voter_id = data.get("voter_id", "")
    voter = db_manager.get_voter(voter_id)

    if voter is None:
        emit("registration_response", {
            "success": False,
            "voter_id": voter_id,
            "message": "Voter not found",
        })
        return

    emit("registration_response", {
        "success": True,
        "voter_id": voter_id,
        "message": "Registration complete. You may now authenticate to vote.",
        "complete": True,
    })
    logger.info("Registration complete for %s", voter_id)
    socketio.emit("admin_update", build_admin_payload())


# ===================================================================
# AUTHENTICATION FLOW
# ===================================================================


@socketio.on("verify_voter")
def handle_verify_voter(data):
    """
    Verify a voter exists and is eligible to authenticate.

    Expects: { voter_id }
    Emits:   'voter_verified' with { success, message, voter_id, name }
    """
    voter_id = data.get("voter_id", "")
    voter = db_manager.get_voter(voter_id)

    if voter is None:
        emit("voter_verified", {
            "success": False,
            "message": f"Voter ID {voter_id} not found in the registry",
        })
        return

    if voter.has_voted:
        emit("voter_verified", {
            "success": False,
            "message": "This voter has already cast a vote (duplicate voting prohibited)",
        })
        return

    if voter.face_encoding is None and voter.fingerprint_template is None:
        emit("voter_verified", {
            "success": False,
            "message": "Voter biometrics not registered",
        })
        return

    # Track active authenticating voter for this connection
    _current_auth_voters[request.sid] = voter_id

    emit("voter_verified", {
        "success": True,
        "voter_id": voter_id,
        "name": voter.full_name,
        "message": "Voter verified",
    })
    logger.info("Voter verified for authentication: %s (sid=%s)", voter_id, request.sid)


@socketio.on("start_face_auth")
def handle_start_face_auth(data):
    """
    Notification that face auth streaming is starting.
    Expects: { voter_id }
    """
    voter_id = data.get("voter_id", "")
    if voter_id:
        _current_auth_voters[request.sid] = voter_id
    logger.info("Face auth streaming started for %s", voter_id)


@socketio.on("match_face")
def handle_match_face(data):
    """
    Run face recognition on a streamed frame during authentication.
    Expects: { frame } (base64 JPEG, no prefix)
    Emits:   'face_match_result' with { success, score, bbox, voter_id }
    """
    frame_b64 = data.get("frame", "")
    expected_id = data.get("voter_id") or _current_auth_voters.get(request.sid, "")
    frame = base64_to_cv2(frame_b64)
    if frame is None:
        # No valid camera frame — cannot authenticate without real image
        emit("face_match_result", {
            "success": False,
            "score": 0.0,
            "bbox": None,
            "voter_id": expected_id,
            "message": "No camera frame received. Ensure camera access is granted.",
        })
        return

    # Check if model is trained before attempting auth
    if not face_module.model_trained:
        roi, bbox = face_module.detect_face(frame)
        bbox_data = {"x": bbox[0], "y": bbox[1], "width": bbox[2], "height": bbox[3]} if bbox else None
        emit("face_match_result", {
            "success": False,
            "score": 0.0,
            "bbox": bbox_data,
            "voter_id": expected_id,
            "message": "Face model not trained. Please register biometrics first.",
        })
        return

    matched_id, score, bbox = face_module.authenticate(frame)

    if bbox is not None:
        # Only match if LBPH recognizer identified the correct voter
        is_match = (matched_id is not None and matched_id == expected_id)
        final_score = score if is_match else min(0.30, score)

        # Explicit rejection for voter_id mismatch
        if matched_id is not None and matched_id != expected_id:
            logger.warning(
                "Face REJECTED: wrong voter (expected=%s, matched=%s, score=%.1f%%)",
                expected_id, matched_id, score * 100
            )
            final_score = 0.0  # Force failure score
            is_match = False

        bbox_data = {"x": bbox[0], "y": bbox[1], "width": bbox[2], "height": bbox[3]}

        emit("face_match_result", {
            "success": is_match and final_score >= 0.70,
            "score": round(final_score * 100, 1),
            "bbox": bbox_data,
            "voter_id": expected_id,
        })
        logger.info(
            "Face match: expected=%s matched=%s score=%.1f%% success=%s",
            expected_id, matched_id, final_score * 100, is_match,
        )


@socketio.on("match_fingerprint")
def handle_match_fingerprint(data):
    """
    Capture a fingerprint and verify against the enrolled biometric identity.
    Uses WinBioIdentify to actively verify matching finger touches vs
    unregistered/impostor finger touches.

    Expects: { voter_id, test_impostor?: bool, hardware_verified?: bool }
    Emits:   'fingerprint_status' with progress
             'fingerprint_match_result' with { success, score, voter_id, message }
    """
    voter_id = data.get("voter_id") or _current_auth_voters.get(request.sid, "")
    client_sid = request.sid
    test_impostor = bool(data.get("test_impostor", False))
    hardware_verified = bool(data.get("hardware_verified", False))

    if hardware_verified and not test_impostor:
        socketio.emit("fingerprint_status", {
            "status": "captured",
            "message": "Enrolled fingerprint verified on sensor (Windows Hello)",
            "mode": "hardware",
        }, to=client_sid)
        socketio.emit("fingerprint_match_result", {
            "success": True,
            "score": 95.8,
            "voter_id": voter_id,
            "message": "Enrolled fingerprint verified on sensor (Windows Hello)",
            "status": "match",
            "mode": "hardware",
        }, to=client_sid)
        logger.info("Fingerprint authenticated via hardware sensor for %s", voter_id)
        return

    if client_sid in _fp_auth_in_progress:
        logger.warning("Fingerprint auth already in progress for sid=%s", client_sid)
        return
    _fp_auth_in_progress.add(client_sid)

    def _do_auth(sid, v_id, is_impostor):
        try:
            voter = db_manager.get_voter(v_id)
            if voter is None:
                socketio.emit("fingerprint_status", {
                    "status": "error",
                    "message": "Voter record not found",
                    "mode": fp_module.mode,
                }, to=sid)
                socketio.emit("fingerprint_match_result", {
                    "success": False,
                    "score": 0.0,
                    "voter_id": v_id,
                    "message": "Voter record not found",
                    "status": "error",
                    "mode": fp_module.mode,
                }, to=sid)
                return

            from biometrics.fingerprint_module import is_real_template
            is_hw = is_real_template(voter.fingerprint_template) if voter.fingerprint_template else False

            if is_hw and not is_impostor:
                waiting_msg = "Touch your fingerprint sensor now..."
                auth_mode = "hardware_sensor"
            else:
                waiting_msg = "Scanning fingerprint ridge patterns..."
                auth_mode = "simulation"

            socketio.emit("fingerprint_status", {
                "status": "waiting",
                "message": waiting_msg,
                "mode": auth_mode,
            }, to=sid)

            # Intermediate simulated analysis feedback
            if (not is_hw or fp_module.mode == "simulation") and not is_impostor:
                socketio.sleep(0.8)
                socketio.emit("fingerprint_status", {
                    "status": "scanning",
                    "message": "Scanning fingerprint ridge patterns...",
                    "mode": "simulation",
                }, to=sid)
                socketio.sleep(1.0)
                socketio.emit("fingerprint_status", {
                    "status": "scanning",
                    "message": "Comparing minutiae points against enrolled record...",
                    "mode": "simulation",
                }, to=sid)
                socketio.sleep(0.6)

            res = fp_module.verify_candidate(
                voter.fingerprint_template, timeout=config.FP_CAPTURE_TIMEOUT,
                test_impostor=is_impostor, voter_id=v_id
            )
            score_pct = round(res["score"] * 100, 1)
            res_mode = res.get("mode", auth_mode)

            if res["success"]:
                socketio.emit("fingerprint_status", {
                    "status": "captured",
                    "message": res.get("message", "Fingerprint verified"),
                    "mode": res_mode,
                }, to=sid)
                socketio.emit("fingerprint_match_result", {
                    "success": True,
                    "score": score_pct,
                    "voter_id": v_id,
                    "message": res.get("message", "Fingerprint verified"),
                    "status": res["status"],
                    "mode": res_mode,
                }, to=sid)
            else:
                socketio.emit("fingerprint_status", {
                    "status": "error",
                    "message": res.get("message", "Fingerprint match failed"),
                    "mode": res_mode,
                }, to=sid)
                socketio.emit("fingerprint_match_result", {
                    "success": False,
                    "score": score_pct,
                    "voter_id": v_id,
                    "message": res.get("message", "Fingerprint match failed"),
                    "status": res["status"],
                    "mode": res_mode,
                }, to=sid)

            logger.info(
                "Fingerprint auth for %s: success=%s score=%.1f%% status=%s",
                v_id, res["success"], score_pct, res["status"],
            )
        except Exception as exc:
            logger.error("Fingerprint auth error: %s", exc)
            socketio.emit("fingerprint_status", {
                "status": "error", "message": f"Sensor error: {exc}", "mode": fp_module.mode,
            }, to=sid)
            socketio.emit("fingerprint_match_result", {
                "success": False,
                "score": 0.0,
                "voter_id": v_id,
                "message": f"Sensor error: {exc}",
                "status": "error",
                "mode": fp_module.mode,
            }, to=sid)
        finally:
            _fp_auth_in_progress.discard(sid)

    socketio.start_background_task(_do_auth, client_sid, voter_id, test_impostor)


@socketio.on("match_iris")
def handle_match_iris(data):
    """
    Run iris matching simulation.
    Expects: { voter_id }
    Emits:   'iris_match_result' with { success, score, voter_id }
    """
    voter_id = data.get("voter_id") or _current_auth_voters.get(request.sid, "")
    client_sid = request.sid
    voter = db_manager.get_voter(voter_id)

    if voter is None or voter.iris_template is None:
        socketio.emit("iris_match_result", {
            "success": False,
            "score": 0.0,
            "voter_id": voter_id,
            "message": "No iris template on file",
        }, to=client_sid)
        return

    socketio.emit("iris_status", {"status": "scanning", "progress": 0.0, "message": "Scanning iris..."}, to=client_sid)
    socketio.sleep(0.4)
    socketio.emit("iris_status", {"status": "scanning", "progress": 0.45, "message": "Analyzing iris patterns..."}, to=client_sid)
    socketio.sleep(0.4)

    score = iris_module.authenticate(voter_id, voter.iris_template)
    score_pct = round(score * 100, 1)

    socketio.emit("iris_status", {"status": "scanning", "progress": 0.85, "message": "Matching template..."}, to=client_sid)
    socketio.sleep(0.3)
    socketio.emit("iris_status", {"status": "scanning", "progress": 1.0, "message": "Iris matched"}, to=client_sid)
    socketio.sleep(0.2)

    socketio.emit("iris_match_result", {
        "success": score >= 0.5,
        "score": score_pct,
        "voter_id": voter_id,
    }, to=client_sid)
    logger.info("Iris auth for %s: score=%.1f%%", voter_id, score_pct)
    logger.info("Iris auth for %s: score=%.1f%%", voter_id, score_pct)


@socketio.on("request_auth_decision")
def handle_request_auth_decision(data):
    """
    Compute the final multimodal fusion score and log the result.

    Expects: { voter_id, scores: { face, fingerprint, iris } }
    Emits:   'auth_decision' with { authenticated, fusion_score, voter_id, ... }
    """
    voter_id = data.get("voter_id") or _current_auth_voters.get(request.sid, "")
    raw_scores = data.get("scores", {})

    face_score = (raw_scores.get("face") or 0) / 100.0
    fp_score = (raw_scores.get("fingerprint") or 0) / 100.0
    iris_score = (raw_scores.get("iris") or 0) / 100.0

    fusion_score, decision = fusion_engine.fuse(face_score, fp_score, iris_score)

    reason = None
    if decision == "REJECTED":
        reason = fusion_engine.get_rejection_reason(face_score, fp_score, iris_score)

    db_manager.log_authentication(
        voter_id, face_score, fp_score, iris_score, fusion_score, decision, reason
    )

    emit("auth_decision", {
        "voter_id": voter_id,
        "authenticated": decision == "AUTHENTICATED",
        "decision": decision,
        "face_score": round(face_score * 100, 1),
        "fingerprint_score": round(fp_score * 100, 1),
        "iris_score": round(iris_score * 100, 1),
        "fusion_score": round(fusion_score * 100, 1),
        "rejection_reason": reason,
    })
    logger.info(
        "Auth complete for %s: fusion=%.1f%% decision=%s",
        voter_id, fusion_score * 100, decision,
    )
    socketio.emit("admin_update", build_admin_payload())


# ===================================================================
# VOTING FLOW
# ===================================================================


@socketio.on("cast_vote")
def handle_cast_vote(data):
    """
    Record a vote after successful authentication.

    Expects: { voter_id, candidate_id }
    Emits:   'vote_response' with { success, message, receipt_hash, ... }
    """
    voter_id = data.get("voter_id") or _current_auth_voters.get(request.sid, "")
    candidate_id = data.get("candidate_id")

    candidate = None
    if candidate_id is not None:
        try:
            idx = int(candidate_id)
            if 0 <= idx < len(config.CANDIDATES):
                candidate = config.CANDIDATES[idx]
        except (ValueError, TypeError):
            pass

    if candidate is None:
        emit("vote_response", {
            "success": False,
            "message": "Invalid candidate selection",
        })
        return

    if db_manager.has_voted(voter_id):
        emit("vote_response", {
            "success": False,
            "message": "This voter has already cast a vote",
        })
        return

    db_manager.record_vote(voter_id, candidate["name"], candidate["party"])
    db_manager.mark_voted(voter_id)

    timestamp_str = datetime.now(timezone.utc).isoformat()
    receipt_raw = f"{voter_id}:{candidate['name']}:{timestamp_str}"
    receipt_hash = hashlib.sha256(receipt_raw.encode("utf-8")).hexdigest()

    emit("vote_response", {
        "success": True,
        "voter_id": voter_id,
        "candidate": candidate["name"],
        "party": candidate["party"],
        "receipt_hash": receipt_hash,
        "message": "Your vote has been recorded securely",
    })
    logger.info("Vote recorded for %s -> %s (%s)", voter_id, candidate["name"], candidate["party"])
    socketio.emit("admin_update", build_admin_payload())


# ===================================================================
# ADMIN
# ===================================================================


@socketio.on("get_admin_data")
def handle_get_admin_data(data=None):
    """
    Return all admin dashboard data.
    Emits: 'admin_data' with structured payload.
    """
    emit("admin_data", build_admin_payload())


@socketio.on("get_candidates")
def handle_get_candidates(data=None):
    """
    Return candidate list from config.
    Emits: 'candidates_list' with { candidates: [...] }
    """
    candidates_with_ids = []
    for idx, c in enumerate(config.CANDIDATES):
        candidates_with_ids.append({
            "id": idx,
            "name": c["name"],
            "party": c["party"],
        })
    emit("candidates_list", {"candidates": candidates_with_ids})


@socketio.on("delete_voter")
def handle_delete_voter(data):
    """
    Delete a voter record and all associated data (auth logs, votes, face images).

    Expects: { voter_id }
    Emits:   'voter_deleted' with { success, voter_id, message }
    """
    voter_id = data.get("voter_id", "")
    if not voter_id:
        emit("voter_deleted", {
            "success": False,
            "voter_id": "",
            "message": "No voter ID provided",
        })
        return

    # Delete face data files
    face_dir = os.path.join(config.FACE_DATA_DIR, voter_id)
    if os.path.isdir(face_dir):
        import shutil
        shutil.rmtree(face_dir, ignore_errors=True)
        logger.info("Deleted face data directory: %s", face_dir)
        # Retrain the face model without the deleted voter
        face_module.train_model()

    deleted = db_manager.delete_voter(voter_id)

    if deleted:
        emit("voter_deleted", {
            "success": True,
            "voter_id": voter_id,
            "message": f"Voter {voter_id} has been removed from the system",
        })
        logger.info("Voter deleted via admin: %s", voter_id)
        socketio.emit("admin_update", build_admin_payload())
    else:
        emit("voter_deleted", {
            "success": False,
            "voter_id": voter_id,
            "message": f"Voter {voter_id} not found",
        })


# ===================================================================
# Entry point
# ===================================================================

if __name__ == "__main__":
    logger.info("Starting TriVote server on %s:%d", config.HOST, config.PORT)
    socketio.run(
        app,
        host=config.HOST,
        port=config.PORT,
        debug=False,
        allow_unsafe_werkzeug=True,
    )
