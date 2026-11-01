"""
TriVote Score Fusion Engine
Weighted-sum multimodal biometric score fusion with configurable thresholds.
"""

import logging
import sys
import os

# Ensure project root is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config

logger = logging.getLogger(__name__)


class ScoreFusion:
    """
    Combines face, fingerprint, and iris match scores into a single fusion
    score using a weighted sum, then applies a threshold to decide
    AUTHENTICATED or REJECTED.
    """

    def __init__(self):
        self.weights = config.FUSION_WEIGHTS
        self.threshold = config.FUSION_THRESHOLD
        self.min_modality_threshold = 0.50  # Stricter threshold for individual modalities
        logger.info(
            "ScoreFusion initialised  weights=%s  threshold=%.2f  min_modality=%.2f",
            self.weights,
            self.threshold,
            self.min_modality_threshold,
        )

    def fuse(
        self, face_score: float, fingerprint_score: float, iris_score: float
    ) -> tuple[float, str]:
        """
        Compute the weighted fusion score and make an authentication decision.

        Args:
            face_score:        Normalised face match score in [0, 1].
            fingerprint_score: Normalised fingerprint match score in [0, 1].
            iris_score:        Normalised iris match score in [0, 1].

        Returns:
            (fusion_score, decision) where decision is ``"AUTHENTICATED"`` or
            ``"REJECTED"``.
        """
        fusion_score = (
            self.weights["face"] * face_score
            + self.weights["fingerprint"] * fingerprint_score
            + self.weights["iris"] * iris_score
        )
        fusion_score = round(fusion_score, 4)

        # Strict security rule: Any single biometric modality failure (< 0.40) results in REJECTED
        if (
            face_score < self.min_modality_threshold
            or fingerprint_score < self.min_modality_threshold
            or iris_score < self.min_modality_threshold
        ):
            decision = "REJECTED"
        else:
            decision = "AUTHENTICATED" if fusion_score >= self.threshold else "REJECTED"

        logger.info(
            "Fusion  face=%.3f  fp=%.3f  iris=%.3f  -> %.4f  %s",
            face_score,
            fingerprint_score,
            iris_score,
            fusion_score,
            decision,
        )
        return fusion_score, decision

    def get_rejection_reason(
        self, face_score: float, fingerprint_score: float, iris_score: float
    ) -> str:
        """
        Return a human-readable explanation when an authentication attempt is
        rejected.

        Args:
            face_score:        Normalised face match score.
            fingerprint_score: Normalised fingerprint match score.
            iris_score:        Normalised iris match score.

        Returns:
            Descriptive reason string.
        """
        reasons: list[str] = []

        if fingerprint_score < self.min_modality_threshold:
            reasons.append(f"Fingerprint biometric mismatch (score {fingerprint_score * 100:.1f}%)")
        if face_score < self.min_modality_threshold:
            reasons.append(f"Facial verification failed (score {face_score * 100:.1f}%)")
        if iris_score < self.min_modality_threshold:
            reasons.append(f"Iris scan failed (score {iris_score * 100:.1f}%)")

        if not reasons:
            fusion_score = (
                self.weights["face"] * face_score
                + self.weights["fingerprint"] * fingerprint_score
                + self.weights["iris"] * iris_score
            )
            reasons.append(
                f"Combined fusion score ({fusion_score * 100:.1f}%) below threshold "
                f"({self.threshold * 100:.1f}%)"
            )

        return "; ".join(reasons)
