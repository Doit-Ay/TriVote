"""
TriVote Iris Recognition Module (Simulated)
Generates deterministic binary iris codes from voter IDs and computes
Hamming-distance-based match scores.
"""

import hashlib
import logging
import struct
import sys
import os

import numpy as np

# Ensure project root is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config

logger = logging.getLogger(__name__)


class IrisModule:
    """
    Simulated iris biometric module.

    Each voter's iris code is derived deterministically from their voter_id
    using SHA-512, producing a square binary matrix of size
    ``config.IRIS_CODE_SIZE x config.IRIS_CODE_SIZE``.
    """

    def __init__(self):
        self.code_size = config.IRIS_CODE_SIZE
        self.match_threshold = config.IRIS_MATCH_THRESHOLD
        logger.info(
            "IrisModule initialised  code_size=%d  threshold=%.2f",
            self.code_size,
            self.match_threshold,
        )

    # ------------------------------------------------------------------
    # Core methods
    # ------------------------------------------------------------------

    def generate_iris_code(
        self, voter_id: str, seed: int | None = None
    ) -> np.ndarray:
        """
        Generate a deterministic binary iris code from *voter_id*.

        The code is produced by hashing the voter_id with SHA-512 (optionally
        mixed with *seed*), expanding the digest into enough bits to fill a
        ``code_size x code_size`` matrix.

        Args:
            voter_id: Unique voter identifier string.
            seed:     Optional integer mixed into the hash for variation.

        Returns:
            2-D numpy uint8 array of shape ``(code_size, code_size)`` with
            values in {0, 1}.
        """
        total_bits = self.code_size * self.code_size

        # Build a long byte stream by repeatedly hashing with a counter
        hash_input = voter_id if seed is None else f"{voter_id}:{seed}"
        raw_bytes = b""
        counter = 0
        while len(raw_bytes) * 8 < total_bits:
            digest = hashlib.sha512(
                f"{hash_input}:{counter}".encode("utf-8")
            ).digest()
            raw_bytes += digest
            counter += 1

        # Unpack bytes to individual bits
        bits: list[int] = []
        for byte_val in raw_bytes:
            for bit_pos in range(8):
                bits.append((byte_val >> bit_pos) & 1)
                if len(bits) >= total_bits:
                    break
            if len(bits) >= total_bits:
                break

        code = np.array(bits[:total_bits], dtype=np.uint8).reshape(
            self.code_size, self.code_size
        )
        return code

    def match_iris_codes(self, code1: np.ndarray, code2: np.ndarray) -> float:
        """
        Compare two iris codes using normalised Hamming distance.

        Args:
            code1: Binary iris code array.
            code2: Binary iris code array of the same shape.

        Returns:
            Match score in [0, 1].  Higher is a better match.
            A Hamming distance below ``self.match_threshold`` yields high
            scores; distance near 0.5 (random) yields near-zero scores.
        """
        if code1.shape != code2.shape:
            logger.warning(
                "Iris code shape mismatch: %s vs %s", code1.shape, code2.shape
            )
            return 0.0

        total_bits = code1.size
        hamming_dist = float(np.count_nonzero(code1 != code2)) / total_bits

        # Normalise: HD=0 -> score=1.0, HD>=0.45 -> score=0.0
        score = max(0.0, 1.0 - hamming_dist / 0.45)
        return round(score, 4)

    # ------------------------------------------------------------------
    # Registration / authentication helpers
    # ------------------------------------------------------------------

    def register(self, voter_id: str) -> bytes:
        """
        Generate an iris code for *voter_id* and return it serialised as raw
        bytes suitable for database storage.

        Args:
            voter_id: Unique voter identifier.

        Returns:
            Raw bytes of the iris code (numpy ``tobytes``).
        """
        code = self.generate_iris_code(voter_id)
        raw = code.tobytes()
        logger.info("Iris registered for %s  (%d bytes)", voter_id, len(raw))
        return raw

    def authenticate(self, voter_id: str, stored_template: bytes) -> float:
        """
        Authenticate by generating a fresh iris code (with small noise) and
        comparing it to the stored template.

        For the **same** voter_id the fresh code is derived from the same hash
        root, so only the noise bits differ, yielding a high score (0.75-0.95).
        For a **different** voter_id the codes are unrelated, yielding a low
        score (0.1-0.3).

        Args:
            voter_id:        Voter identifier used to regenerate the iris code.
            stored_template: Raw bytes previously returned by ``register()``.

        Returns:
            Match score in [0, 1].
        """
        # Reconstruct stored code
        stored_code = np.frombuffer(stored_template, dtype=np.uint8).reshape(
            self.code_size, self.code_size
        )

        # Generate a fresh code for the same voter_id
        fresh_code = self.generate_iris_code(voter_id)

        # Simulate biological scan noise: flip ~5-12 % of bits randomly
        rng = np.random.default_rng()
        noise_rate = rng.uniform(0.05, 0.12)
        noise_mask = rng.random(fresh_code.shape) < noise_rate
        noisy_code = fresh_code.copy()
        noisy_code[noise_mask] = 1 - noisy_code[noise_mask]

        score = self.match_iris_codes(stored_code, noisy_code)
        logger.info("Iris auth for %s  score=%.4f", voter_id, score)
        return score
