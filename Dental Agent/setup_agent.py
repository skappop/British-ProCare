#!/usr/bin/env python3
"""
Sets up (or updates) British ProCare Imaging — the Dental Agent — on a clinic PC.

    python setup_agent.py

Downloads the current agent from GitHub, checks each file is valid before
replacing anything, installs what it needs (requests, and pystray + Pillow for
the tray icon), then installs ProCare Imaging to run in the background: it
starts with Windows, sits by the clock, and is driven from the patient's page.

Your config.json is never touched — export folders and the API key are kept.
Run it again any time to pick up the latest version.
"""

import ast
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

RAW = "https://raw.githubusercontent.com/skappop/British-ProCare/main/Dental%20Agent"
FILES = [
    "agent_core.py",
    "dental_agent_service.py",
    "install_service.py",
    "doctor.py",
]
# Pictures: the clinic's tooth mark for the tray icon and settings window.
ASSETS = ["logo_mark.png"]
HERE = Path(__file__).resolve().parent
OLD = HERE / "old versions"

# Earlier versions of the agent and their guides. Setup moves them out of the
# way (into "old versions", never deleted) so the folder shows only what runs.
OBSOLETE = [
    "dental_agent.py", "dental_agent_branded.py", "dental_agent_clean.py", "dental_agent_v2.py",
    "install_protocol.py", "mock_server.py", "test_agent.py", "test_imaging",
    "ASSISTANT_WORKFLOW.md", "CLINIC_SETUP_GUIDE.txt", "COMPLETE_CLINIC_SETUP.txt",
    "DEPLOYMENT_CHECKLIST.txt", "DOCTOR_WORKFLOW.md", "QUICKSTART.md", "QUICK_START.md",
    "RECEPTIONIST_WORKFLOW.md", "REDESIGN_SUMMARY.md",
]


def step(text):
    print(f"\n==> {text}")


def fetch(name: str) -> bytes:
    with urllib.request.urlopen(f"{RAW}/{name}", timeout=60) as response:
        return response.read()


def update_file(name: str) -> bool:
    target = HERE / name

    try:
        payload = fetch(name)
    except (urllib.error.URLError, OSError) as exc:
        print(f"  ! Could not download {name}: {exc}")
        return False

    # A proxy error page or a truncated transfer would otherwise overwrite a
    # working agent with something that cannot run.
    try:
        ast.parse(payload.decode("utf-8"))
    except (SyntaxError, UnicodeDecodeError):
        print(f"  ! {name} did not arrive intact — keeping the copy you have.")
        return False

    if target.exists():
        if target.read_bytes() == payload:
            print(f"  = {name} already up to date")
            return True

        OLD.mkdir(exist_ok=True)
        backup = OLD / f"{target.stem}.backup-{datetime.now():%Y%m%d-%H%M}{target.suffix}"
        shutil.copy2(target, backup)
        print(f"  . previous version saved in 'old versions'")

    target.write_bytes(payload)
    print(f"  + {name} updated ({len(payload):,} bytes)")
    return True


def update_asset(name: str) -> bool:
    target = HERE / name
    try:
        payload = fetch(name)
    except (urllib.error.URLError, OSError) as exc:
        print(f"  ! Could not download {name}: {exc}")
        return target.exists()
    if not payload.startswith(b"\x89PNG"):
        print(f"  ! {name} did not arrive intact — skipped")
        return target.exists()
    if target.exists() and target.read_bytes() == payload:
        print(f"  = {name} already up to date")
    else:
        target.write_bytes(payload)
        print(f"  + {name} updated")
    return True


def tidy_folder() -> None:
    """Moves earlier versions out of the way; nothing is deleted."""
    moved = []
    for name in OBSOLETE:
        path = HERE / name
        if path.exists():
            OLD.mkdir(exist_ok=True)
            dest = OLD / name
            if dest.exists():
                dest = OLD / f"{path.stem}-{datetime.now():%Y%m%d-%H%M%S}{path.suffix}"
            shutil.move(str(path), str(dest))
            moved.append(name)
    # Backups left by earlier updates, and Python's cache folder.
    for path in HERE.glob("*.backup-*"):
        OLD.mkdir(exist_ok=True)
        shutil.move(str(path), str(OLD / path.name))
        moved.append(path.name)
    shutil.rmtree(HERE / "__pycache__", ignore_errors=True)
    if moved:
        print(f"  + moved {len(moved)} old file(s) into 'old versions'")
    else:
        print("  = nothing to tidy")


PACKAGES = {"requests": "requests", "pystray": "pystray", "PIL": "Pillow"}


def ensure_packages() -> bool:
    missing = []
    for module, package in PACKAGES.items():
        try:
            __import__(module)
            print(f"  = {package} already installed")
        except ImportError:
            missing.append(package)

    if not missing:
        return True

    print(f"  . installing {', '.join(missing)}…")
    result = subprocess.run(
        [sys.executable, "-m", "pip", "install", "--quiet", *missing],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        print("  ! pip failed:")
        print("   ", (result.stderr or result.stdout).strip()[:400])
        if "requests" in missing:
            return False
        # Without pystray the agent still runs, just without a tray icon.
        print("  - continuing: the agent will run without a tray icon")
        return True

    print(f"  + installed {', '.join(missing)}")
    return True


def install_background() -> bool:
    if sys.platform != "win32":
        print("  - not Windows, so there is nothing to install to start with Windows")
        return True

    result = subprocess.run(
        [sys.executable, str(HERE / "install_service.py")],
        capture_output=True, text=True,
    )
    print("   ", (result.stdout or result.stderr).strip().replace("\n", "\n    "))
    return result.returncode == 0


def main() -> int:
    print("British ProCare Imaging — setup")
    print(f"Folder: {HERE}")
    print(f"Python: {sys.version.split()[0]} ({sys.executable})")

    if not (HERE / "config.json").exists():
        print("\nNote: no config.json here yet. After this finishes, open the agent")
        print("and fill in the Settings tab (export folders and Bridge API Key).")

    step("Downloading the latest agent")
    print("  Close the Dental Agent first if it is open.")
    ok = all([update_file(name) for name in FILES])
    for name in ASSETS:
        update_asset(name)

    step("Tidying the folder")
    tidy_folder()

    step("Checking dependencies")
    ok = ensure_packages() and ok

    step("Installing British ProCare Imaging to run in the background")
    ok = install_background() and ok

    print()
    if ok:
        print("Setup complete. British ProCare Imaging is running by the clock and will")
        print("start by itself whenever this Windows user signs in.")
        print("Imaging is now started from the patient's page on the website.")
    else:
        print("Setup finished with problems — see the messages above.")
        print("Your existing agent and config.json were left alone.")

    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
