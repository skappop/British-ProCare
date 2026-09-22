#!/usr/bin/env python3
"""
Sets up (or updates) the Dental Agent on a clinic PC.

    python setup_agent.py

Downloads the current agent from GitHub, checks it is valid before replacing
anything, makes sure `requests` is installed, and registers the procare://
button handler so a patient's page can open the agent.

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
FILES = ["dental_agent_v2.py", "install_protocol.py"]
HERE = Path(__file__).resolve().parent


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

        backup = target.with_name(
            f"{target.stem}.backup-{datetime.now():%Y%m%d-%H%M}{target.suffix}"
        )
        shutil.copy2(target, backup)
        print(f"  . previous version saved as {backup.name}")

    target.write_bytes(payload)
    print(f"  + {name} updated ({len(payload):,} bytes)")
    return True


def ensure_requests() -> bool:
    try:
        import requests  # noqa: F401
        print("  = requests already installed")
        return True
    except ImportError:
        pass

    print("  . installing requests…")
    result = subprocess.run(
        [sys.executable, "-m", "pip", "install", "--quiet", "requests"],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        print("  ! pip failed:")
        print("   ", (result.stderr or result.stdout).strip()[:400])
        return False

    print("  + requests installed")
    return True


def register_protocol() -> bool:
    if sys.platform != "win32":
        print("  - not Windows, so there is no procare:// handler to register")
        return True

    result = subprocess.run(
        [sys.executable, str(HERE / "install_protocol.py")],
        capture_output=True, text=True,
    )
    print("   ", (result.stdout or result.stderr).strip().replace("\n", "\n    "))
    return result.returncode == 0


def main() -> int:
    print("ProCare Dental Agent — setup")
    print(f"Folder: {HERE}")
    print(f"Python: {sys.version.split()[0]} ({sys.executable})")

    if not (HERE / "config.json").exists():
        print("\nNote: no config.json here yet. After this finishes, open the agent")
        print("and fill in the Settings tab (export folders and Bridge API Key).")

    step("Downloading the latest agent")
    print("  Close the Dental Agent first if it is open.")
    ok = all([update_file(name) for name in FILES])

    step("Checking dependencies")
    ok = ensure_requests() and ok

    step("Registering the 'Open in Dental Agent' button")
    ok = register_protocol() and ok

    print()
    if ok:
        print("Setup complete. Start the agent with:")
        print(f'    python "{HERE / "dental_agent_v2.py"}"')
    else:
        print("Setup finished with problems — see the messages above.")
        print("Your existing agent and config.json were left alone.")

    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
