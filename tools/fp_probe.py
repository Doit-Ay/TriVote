"""
TriVote fingerprint sensor probe (diagnostic tool).

Checks that the real WBF fingerprint sensor works and lets you test a touch.
It never writes to the TriVote database, never touches the registry (only a
read-only query of the Enhanced Sign-in Security flag) and never changes
system settings.

Usage (from the project root, in a visible Command Prompt):
    python tools\\fp_probe.py                  status report, then interactive touch test
    python tools\\fp_probe.py --report         status report only
    python tools\\fp_probe.py --focus none     interactive test without the console-focus helper
    python tools\\fp_probe.py --no-touch-test --timeout 3
                                              do NOT touch; exits 0 only if the scan times out
"""

import argparse
import ctypes
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from biometrics import fingerprint_module as fpm  # noqa: E402
from biometrics.fingerprint_module import FingerprintModule, make_template  # noqa: E402


def _ess_state() -> str:
    try:
        import winreg
        key = winreg.OpenKey(
            winreg.HKEY_LOCAL_MACHINE,
            r"SYSTEM\CurrentControlSet\Control\DeviceGuard\Scenarios\SecureBiometrics",
        )
        try:
            value, _ = winreg.QueryValueEx(key, "Enabled")
        finally:
            winreg.CloseKey(key)
        return str(value)
    except Exception:
        return "unknown"


def report(fp: FingerprintModule) -> None:
    print("=== TriVote fingerprint probe ===")
    print("Python               :", sys.version.split()[0])
    try:
        admin = bool(ctypes.windll.shell32.IsUserAnAdmin())
    except Exception:
        admin = "unknown"
    print("Elevated (admin)     :", admin)

    try:
        wb = ctypes.WinDLL("winbio.dll")
        print("winbio.dll           : loaded")
    except OSError as exc:
        print("winbio.dll           : NOT available (%s)" % exc)
        wb = None

    if wb is not None:
        probe = FingerprintModule.__new__(FingerprintModule)
        probe._winbio = wb
        probe._session_handle = None
        probe._last_open_hr = 0
        probe._setup_prototypes()
        ok = probe.open_session()
        print("WinBioOpenSession    : HRESULT 0x%08X" % (probe._last_open_hr & 0xFFFFFFFF))
        if ok:
            probe.close_session()
        schema = ctypes.c_void_p()
        count = ctypes.c_size_t(0)
        hr = wb.WinBioEnumBiometricUnits(
            fpm.WINBIO_TYPE_FINGERPRINT, ctypes.byref(schema), ctypes.byref(count)
        )
        if schema.value:
            wb.WinBioFree(schema)
        print("WinBioEnumBiometricUnits: HRESULT 0x%08X, units=%d" % (hr & 0xFFFFFFFF, count.value))

    print("ESS (SecureBiometrics Enabled):", _ess_state())
    try:
        _, k32 = fpm._win_apis()
        print("Console window hwnd  :", k32.GetConsoleWindow() or 0)
    except Exception as exc:
        print("Console window hwnd  : error (%s)" % exc)
    print("Module status        :", fp.get_status())


def scan(fp: FingerprintModule, timeout: float, focus: str) -> dict:
    r = fp.identify(timeout=timeout, focus_mode=focus)
    print("  status        :", r["status"])
    print("  success       :", r["success"])
    print("  HRESULT       :", "0x%08X" % r["hresult"] if r.get("hresult") is not None else "n/a")
    print("  subfactor     :", r.get("subfactor"))
    print("  focus mode    :", focus, "| focus acquired:", r.get("focus_acquired"))
    ident = r.get("identity")
    if ident:
        id_type, id_bytes = ident
        print("  identity      : type=%d, %d bytes" % (id_type, len(id_bytes)))
        if r.get("subfactor") is not None:
            t = make_template(id_type, id_bytes, r["subfactor"])
            print("  identity hash :", t[5:13].hex(), "(first 8 bytes of WBF1 template)")
    else:
        print("  identity      : none")
    print("  message       :", r["message"])
    return r


def main() -> int:
    parser = argparse.ArgumentParser(description="TriVote fingerprint sensor probe")
    parser.add_argument("--report", action="store_true", help="print the status report only")
    parser.add_argument("--no-touch-test", action="store_true",
                        help="do NOT touch the sensor; exit 0 only if the scan times out")
    parser.add_argument("--timeout", type=float, default=None,
                        help="seconds to wait for a touch (default 15, or 3 for --no-touch-test)")
    parser.add_argument("--focus", choices=["console", "none"], default="console",
                        help="console-focus helper mode (default: console)")
    args = parser.parse_args()

    fp = FingerprintModule()
    report(fp)

    if args.report:
        return 0

    if args.no_touch_test:
        timeout = args.timeout if args.timeout is not None else 3
        print("\nNo-touch test: do NOT touch the sensor (%ss)..." % timeout)
        r = scan(fp, timeout, args.focus)
        if r["status"] == "timeout" and not r["success"] and r.get("mode") == "real":
            print("PASS: no touch -> timeout (real sensor, no simulation)")
            return 0
        print("FAIL: expected status=timeout, success=False, mode=real; got %s / %s / %s"
              % (r["status"], r["success"], r.get("mode")))
        return 1

    if not fp.real_mode:
        print("\nReal sensor not available; nothing to scan.")
        return 1

    timeout = args.timeout if args.timeout is not None else 15
    while True:
        try:
            input("\nPress Enter, then touch the fingerprint sensor within %ss (Ctrl+C to quit)... " % timeout)
        except (EOFError, KeyboardInterrupt):
            print()
            return 0
        print("Listening... touch the sensor now.")
        scan(fp, timeout, args.focus)
        try:
            again = input("Scan again? [y/N] ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            print()
            return 0
        if again != "y":
            return 0


if __name__ == "__main__":
    sys.exit(main())
