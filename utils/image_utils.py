"""
TriVote Image Utilities
Helper functions for base64 / OpenCV conversions and face overlay drawing.
"""

import base64
import logging

import cv2
import numpy as np

logger = logging.getLogger(__name__)


def base64_to_cv2(base64_string: str) -> np.ndarray | None:
    """
    Decode a base64-encoded image (with or without data-URI prefix) into an
    OpenCV BGR numpy array.

    Args:
        base64_string: Base64 string, optionally prefixed with
                       ``data:image/...;base64,``.

    Returns:
        BGR numpy array, or ``None`` on failure.
    """
    try:
        # Strip the data-URI prefix if present
        if "," in base64_string:
            base64_string = base64_string.split(",", 1)[1]

        image_bytes = base64.b64decode(base64_string)
        np_array = np.frombuffer(image_bytes, dtype=np.uint8)
        frame = cv2.imdecode(np_array, cv2.IMREAD_COLOR)
        return frame
    except Exception as exc:
        logger.error("base64_to_cv2 failed: %s", exc)
        return None


def cv2_to_base64(frame: np.ndarray, quality: int = 85) -> str:
    """
    Encode an OpenCV BGR frame to a base64 JPEG data URI.

    Args:
        frame: BGR numpy array.
        quality: JPEG quality 0-100.

    Returns:
        Data URI string ``data:image/jpeg;base64,...``.
    """
    encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), quality]
    success, buffer = cv2.imencode(".jpg", frame, encode_params)
    if not success:
        logger.error("cv2_to_base64: imencode failed")
        return ""
    b64 = base64.b64encode(buffer).decode("utf-8")
    return f"data:image/jpeg;base64,{b64}"


def draw_face_overlay(frame: np.ndarray, bbox: tuple) -> np.ndarray:
    """
    Draw a green rectangle with decorative corner brackets around the detected
    face region.

    Args:
        frame: BGR numpy array (modified in-place and returned).
        bbox:  Tuple of (x, y, w, h).

    Returns:
        The same frame with overlays drawn.
    """
    if bbox is None:
        return frame

    x, y, w, h = bbox
    color = (0, 255, 0)  # Green
    thickness = 2
    corner_len = max(20, min(w, h) // 5)

    # Main rectangle (thin)
    cv2.rectangle(frame, (x, y), (x + w, y + h), color, 1)

    # Top-left corner
    cv2.line(frame, (x, y), (x + corner_len, y), color, thickness)
    cv2.line(frame, (x, y), (x, y + corner_len), color, thickness)

    # Top-right corner
    cv2.line(frame, (x + w, y), (x + w - corner_len, y), color, thickness)
    cv2.line(frame, (x + w, y), (x + w, y + corner_len), color, thickness)

    # Bottom-left corner
    cv2.line(frame, (x, y + h), (x + corner_len, y + h), color, thickness)
    cv2.line(frame, (x, y + h), (x, y + h - corner_len), color, thickness)

    # Bottom-right corner
    cv2.line(frame, (x + w, y + h), (x + w - corner_len, y + h), color, thickness)
    cv2.line(frame, (x + w, y + h), (x + w, y + h - corner_len), color, thickness)

    return frame
