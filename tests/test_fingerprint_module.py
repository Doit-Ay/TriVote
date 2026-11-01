"""
Unit tests for the real-sensor fingerprint logic.

Most tests fake the sensor (no hardware needed). The ``HardwareNoTouchTests``
class runs only when a real WBF sensor is present: do NOT touch the sensor
while the tests run.

Run:  python -m unittest discover -s tests -v
"""

import ctypes
import hashlib
import os
import shutil
import sys
import tempfile
import threading
import time
import unittest
from types import SimpleNamespace
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import config  # noqa: E402
from biometrics import fingerprint_module as fpm  # noqa: E402
from biometrics.fingerprint_module import (  # noqa: E402
    FingerprintModule,
    WINBIO_IDENTITY,
    is_real_template,
    make_template,
    register_voter_fingerprint,
    templates_equal,
)
from database.db_manager import DBManager  # noqa: E402

SID_A = (3, bytes(range(28)))
SID_B = (3, bytes(range(1, 29)))

# The legacy simulated template stored for seeded voter VTR-20261023-001
LEGACY_001 = hashlib.sha256(
    hashlib.sha256(b"TRIVOTE_FP_ENROLLMENT:VTR-20261023-001").digest() * 8
).digest()


def _fake_real_module():
    """A FingerprintModule that believes it is in real mode, without hardware."""
    fp = FingerprintModule.__new__(FingerprintModule)
    fp.mode = "real"
    fp.mode_reason = "test"
    fp.real_mode = True
    fp._lock = threading.Lock()
    fp._winbio = None
    fp._session_handle = None
    fp._last_open_hr = 0
    # Simulation must never be reached in real mode
    fp._simulate_identify = mock.Mock(side_effect=AssertionError("simulation called"))
    fp._simulate_capture = mock.Mock(side_effect=AssertionError("simulation called"))
    return fp


def _identify_stub(status, identity=None, subfactor=None, calls=None):
    def stub(timeout=15.0, focus_mode=None):
        if calls is not None:
            calls.append(timeout)
        success = status == "match"
        return {
            "status": status,
            "success": success,
            "score": 0.95 if success else 0.0,
            "message": f"stub {status}",
            "subfactor": subfactor,
            "unit_id": 1,
            "hresult": 0 if success else 0x80098004,
            "identity": identity,
            "mode": "real",
            "focus_acquired": None,
        }
    return stub


class TemplateFormatTests(unittest.TestCase):
    def test_identity_struct_size(self):
        self.assertEqual(ctypes.sizeof(WINBIO_IDENTITY), 76)

    def test_make_template_format(self):
        t1 = make_template(*SID_A, 2)
        t2 = make_template(*SID_A, 2)
        self.assertEqual(t1, t2)
        self.assertEqual(len(t1), 37)
        self.assertTrue(t1.startswith(b"WBF1:"))
        self.assertTrue(is_real_template(t1))
        self.assertFalse(is_real_template(LEGACY_001))
        self.assertFalse(is_real_template(None))
        self.assertTrue(templates_equal(t1, t2))
        self.assertFalse(templates_equal(t1, None))
        self.assertNotEqual(make_template(*SID_A, 2), make_template(*SID_A, 7))
        self.assertNotEqual(make_template(*SID_A, 2), make_template(*SID_B, 2))

    def test_identity_to_bytes(self):
        ident = WINBIO_IDENTITY()
        ident.Type = fpm.WINBIO_ID_TYPE_SID
        ident.Value.AccountSid.Size = 28
        for i in range(28):
            ident.Value.AccountSid.Data[i] = i
        self.assertEqual(fpm.identity_to_bytes(ident), SID_A)
        ident.Type = fpm.WINBIO_ID_TYPE_NULL
        self.assertIsNone(fpm.identity_to_bytes(ident))
        ident.Type = fpm.WINBIO_ID_TYPE_WILDCARD
        self.assertIsNone(fpm.identity_to_bytes(ident))


class VerifyTests(unittest.TestCase):
    def setUp(self):
        self.fp = _fake_real_module()
        self.stored = make_template(*SID_A, 2)

    def test_match(self):
        self.fp.identify = _identify_stub("match", SID_A, 2)
        r = self.fp.verify_candidate(self.stored, timeout=1)
        self.assertTrue(r["success"])
        self.assertEqual(r["status"], "match")

    def test_different_subfactor(self):
        self.fp.identify = _identify_stub("match", SID_A, 7)
        r = self.fp.verify_candidate(self.stored, timeout=1)
        self.assertFalse(r["success"])
        self.assertEqual(r["status"], "no_match")
        self.assertLessEqual(r["score"], 0.15)

    def test_different_sid(self):
        self.fp.identify = _identify_stub("match", SID_B, 2)
        r = self.fp.verify_candidate(self.stored, timeout=1)
        self.assertFalse(r["success"])
        self.assertEqual(r["status"], "no_match")

    def test_legacy_template_no_sensor_call(self):
        calls = []
        self.fp.identify = _identify_stub("match", SID_A, 2, calls)
        r = self.fp.verify_candidate(LEGACY_001, timeout=1, voter_id="VTR-20261023-001")
        self.assertFalse(r["success"])
        self.assertEqual(r["status"], "legacy_template")
        self.assertEqual(r["score"], 0.0)
        self.assertIn("re-registered on the real sensor", r["message"])
        self.assertEqual(calls, [])

    def test_not_enrolled(self):
        calls = []
        self.fp.identify = _identify_stub("match", SID_A, 2, calls)
        r = self.fp.verify_candidate(None, timeout=1)
        self.assertEqual(r["status"], "not_enrolled")
        self.assertFalse(r["success"])
        self.assertEqual(calls, [])

    def test_timeout_is_failure_not_simulation(self):
        self.fp.identify = _identify_stub("timeout")
        r = self.fp.verify_candidate(self.stored, timeout=1)
        self.assertEqual(r["status"], "timeout")
        self.assertFalse(r["success"])
        self.fp._simulate_identify.assert_not_called()

    def test_unenrolled_finger(self):
        self.fp.identify = _identify_stub("no_match")
        r = self.fp.verify_candidate(self.stored, timeout=1)
        self.assertEqual(r["status"], "no_match")
        self.assertFalse(r["success"])

    def test_impostor_still_rejected(self):
        with mock.patch.object(fpm.time, "sleep"):
            r = self.fp.verify_candidate(self.stored, timeout=1, test_impostor=True)
        self.assertEqual(r["status"], "no_match")
        self.assertFalse(r["success"])


class EnrollTests(unittest.TestCase):
    def setUp(self):
        self.fp = _fake_real_module()

    def test_failures_return_no_template(self):
        for status in ("timeout", "bad_capture", "error", "busy"):
            with self.subTest(status=status):
                self.fp.identify = _identify_stub(status)
                r = self.fp.enroll(timeout=1, voter_id="V1")
                self.assertFalse(r["success"])
                self.assertIsNone(r["template"])
                self.assertEqual(r["status"], status)
                self.assertIsNone(self.fp.capture(timeout=1, voter_id="V1"))
        self.fp._simulate_capture.assert_not_called()

    def test_unenrolled_windows_finger(self):
        self.fp.identify = _identify_stub("no_match")
        r = self.fp.enroll(timeout=1, voter_id="V1")
        self.assertFalse(r["success"])
        self.assertIsNone(r["template"])
        self.assertEqual(r["status"], "not_enrolled_windows")
        self.assertEqual(r["message"], fpm.NOT_ENROLLED_WINDOWS_MSG)
        self.assertEqual(
            r["message"],
            "This finger is not enrolled in Windows Hello on this PC. Enroll it in "
            "Settings > Accounts > Sign-in options > Fingerprint, then retry",
        )

    def test_success(self):
        self.fp.identify = _identify_stub("match", SID_A, 2)
        r = self.fp.enroll(timeout=1, voter_id="V1")
        self.assertTrue(r["success"])
        self.assertEqual(r["template"], make_template(*SID_A, 2))

    def test_fallback_flag_default_off(self):
        self.assertFalse(config.FP_FALLBACK_ON_FAILURE)


class RegistrationDBTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.db = DBManager()
        uri = "sqlite:///" + os.path.join(self.tmp, "test.db").replace("\\", "/")
        self.db.init_db(SimpleNamespace(config={"SQLALCHEMY_DATABASE_URI": uri}))
        for vid in ("T-001", "T-002"):
            self.db.create_voter({
                "voter_id": vid, "full_name": "Test " + vid, "date_of_birth": "2000-01-01",
                "address": "Test address", "phone": "000",
            })
        self.fp = _fake_real_module()

    def tearDown(self):
        self.db.engine.dispose()
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_timeout_stores_nothing(self):
        for status in ("timeout", "bad_capture", "no_match", "error"):
            with self.subTest(status=status):
                self.fp.identify = _identify_stub(status)
                r = register_voter_fingerprint(self.fp, self.db, "T-001", 1)
                self.assertFalse(r["success"])
                self.assertIsNone(self.db.get_voter("T-001").fingerprint_template)

    def test_success_and_duplicate(self):
        self.fp.identify = _identify_stub("match", SID_A, 2)
        r = register_voter_fingerprint(self.fp, self.db, "T-001", 1)
        self.assertTrue(r["success"])
        self.assertNotIn("template", r)
        self.assertEqual(self.db.get_voter("T-001").fingerprint_template, make_template(*SID_A, 2))

        # Same finger again for the same voter is allowed (re-scan)
        r = register_voter_fingerprint(self.fp, self.db, "T-001", 1)
        self.assertTrue(r["success"])

        # Same finger for another voter is rejected and nothing is stored
        r = register_voter_fingerprint(self.fp, self.db, "T-002", 1)
        self.assertFalse(r["success"])
        self.assertEqual(r["status"], "duplicate")
        self.assertNotIn("T-001", r["message"])
        self.assertIsNone(self.db.get_voter("T-002").fingerprint_template)

        # A different finger works for the second voter
        self.fp.identify = _identify_stub("match", SID_A, 7)
        r = register_voter_fingerprint(self.fp, self.db, "T-002", 1)
        self.assertTrue(r["success"])
        self.assertEqual(self.db.get_voter("T-002").fingerprint_template, make_template(*SID_A, 7))

    def test_missing_voter(self):
        self.fp.identify = _identify_stub("match", SID_A, 2)
        r = register_voter_fingerprint(self.fp, self.db, "T-404", 1)
        self.assertFalse(r["success"])
        self.assertEqual(r["status"], "error")


class CancelSafetyTests(unittest.TestCase):
    def test_safe_cancel_never_raises(self):
        fp = _fake_real_module()
        fp._safe_cancel(12345)  # no winbio loaded
        fp._winbio = SimpleNamespace(WinBioCancel=mock.Mock(side_effect=OSError("bad handle")))
        fp._safe_cancel(12345)
        fp._winbio.WinBioCancel.assert_called_once_with(12345)


def _real_module_or_none():
    try:
        fp = FingerprintModule()
        return fp if fp.real_mode else None
    except Exception:
        return None


_REAL_FP = _real_module_or_none()


@unittest.skipUnless(_REAL_FP is not None, "real WBF fingerprint sensor not available")
class HardwareNoTouchTests(unittest.TestCase):
    """Requires the real sensor. Do NOT touch the sensor while these run."""

    def test_identify_times_out_without_touch(self):
        start = time.monotonic()
        r = _REAL_FP.identify(timeout=3)
        elapsed = time.monotonic() - start
        self.assertEqual(r["status"], "timeout", r)
        self.assertFalse(r["success"])
        self.assertEqual(r["mode"], "real")
        self.assertLess(elapsed, 8)

    def test_registration_stores_nothing_on_real_timeout(self):
        tmp = tempfile.mkdtemp()
        db = DBManager()
        try:
            uri = "sqlite:///" + os.path.join(tmp, "hw.db").replace("\\", "/")
            db.init_db(SimpleNamespace(config={"SQLALCHEMY_DATABASE_URI": uri}))
            db.create_voter({
                "voter_id": "HW-001", "full_name": "HW", "date_of_birth": "2000-01-01",
                "address": "x", "phone": "0",
            })
            r = register_voter_fingerprint(_REAL_FP, db, "HW-001", 3)
            self.assertFalse(r["success"])
            self.assertEqual(r["status"], "timeout")
            self.assertIsNone(db.get_voter("HW-001").fingerprint_template)
        finally:
            db.engine.dispose()
            shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
