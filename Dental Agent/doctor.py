#!/usr/bin/env python3
"""
Checks this PC's Dental Agent setup and prints a report.

    python doctor.py

Reads only — it changes nothing. Paste the output when something is not
working. It never prints your API key, only whether one is set.
"""

import json
import os
import socket
import sys
import urllib.error
import urllib.request
from pathlib import Path

RAW = "https://raw.githubusercontent.com/skappop/British-ProCare/main/Dental%20Agent"
HERE = Path(__file__).resolve().parent
PROTOCOL_PORT = 47281


def section(title):
    print(f"\n--- {title} " + "-" * max(0, 46 - len(title)))


def ok(text):
    print(f"  [ok]   {text}")


def bad(text):
    print(f"  [BAD]  {text}")


def info(text):
    print(f"         {text}")


def check_python():
    section("Python")
    ok(f"{sys.version.split()[0]} at {sys.executable}")

    windowless = Path(sys.executable).with_name("pythonw.exe")
    if sys.platform == "win32":
        (ok if windowless.exists() else bad)(
            f"pythonw.exe {'found' if windowless.exists() else 'MISSING (agent will flash a console)'}"
        )

    try:
        import requests  # noqa: F401
        ok("requests installed")
    except ImportError:
        bad("requests NOT installed  ->  python -m pip install requests")


def check_files():
    section("Files in this folder")
    info(str(HERE))

    for name in ("dental_agent_v2.py", "install_protocol.py", "config.json"):
        path = HERE / name
        if path.exists():
            ok(f"{name}  ({path.stat().st_size:,} bytes)")
        else:
            bad(f"{name} MISSING")

    agent = HERE / "dental_agent_v2.py"
    if not agent.exists():
        return

    # Is this the current version, or an old copy?
    try:
        with urllib.request.urlopen(f"{RAW}/dental_agent_v2.py", timeout=30) as response:
            latest = response.read()
    except (urllib.error.URLError, OSError) as exc:
        info(f"could not check GitHub for a newer version: {exc}")
        return

    local = agent.read_bytes()
    if local == latest:
        ok("dental_agent_v2.py is the current version")
    else:
        bad(
            f"dental_agent_v2.py is OUT OF DATE "
            f"(this PC {len(local):,} bytes, GitHub {len(latest):,})"
        )
        info("fix:  python setup_agent.py")

    has_protocol = b"claim_single_instance" in local
    (ok if has_protocol else bad)(
        "agent supports the procare:// button"
        if has_protocol
        else "this agent PREDATES the button — it cannot be opened from the web app"
    )


def check_protocol():
    section("procare:// handler (the web app's button)")

    if sys.platform != "win32":
        info("not Windows — nothing to check")
        return

    import winreg

    try:
        with winreg.OpenKey(
            winreg.HKEY_CURRENT_USER, r"Software\Classes\procare\shell\open\command"
        ) as key:
            command, _ = winreg.QueryValueEx(key, "")
    except FileNotFoundError:
        bad("NOT REGISTERED on this Windows user")
        info("fix:  python install_protocol.py")
        return
    except OSError as exc:
        bad(f"could not read the registry: {exc}")
        return

    ok("registered")
    info(command)

    # A handler pointing at a file that is not there is the usual reason the
    # button silently does nothing.
    parts = [p for p in command.split('"') if p.strip() and p.strip() != "%1"]
    for part in parts:
        candidate = Path(part.strip())
        if candidate.suffix in (".py", ".exe"):
            (ok if candidate.exists() else bad)(
                f"{'exists' if candidate.exists() else 'DOES NOT EXIST'}: {candidate}"
            )


def check_running():
    section("Is the agent running?")
    try:
        with socket.create_connection(("127.0.0.1", PROTOCOL_PORT), timeout=2):
            ok(f"yes — listening on 127.0.0.1:{PROTOCOL_PORT}")
    except OSError:
        info("not running (that is fine; the button will start it)")


def check_config():
    section("config.json")
    path = HERE / "config.json"
    if not path.exists():
        bad("missing — open the agent and fill in the Settings tab")
        return

    try:
        config = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        bad(f"unreadable: {exc}")
        return

    url = (config.get("api_base_url") or "").strip()
    key = (config.get("bridge_api_key") or "").strip()

    (ok if url else bad)(f"api_base_url: {url or 'EMPTY'}")
    # Never print the key itself.
    (ok if key else bad)(
        f"bridge_api_key: set ({len(key)} characters)" if key
        else "bridge_api_key: EMPTY — the agent will never see an active patient"
    )

    for field in ("one2_export", "ezdent_export"):
        value = (config.get(field) or "").strip()
        if not value:
            info(f"{field}: empty")
        elif Path(value).is_dir():
            ok(f"{field}: {value}")
        else:
            bad(f"{field}: {value}  (folder not found)")

    if url and key:
        try:
            request = urllib.request.Request(
                f"{url.rstrip('/')}/api/bridge/active-patient",
                headers={"Authorization": f"Bearer {key}"},
            )
            with urllib.request.urlopen(request, timeout=20) as response:
                payload = json.loads(response.read().decode())
            ok(f"server reachable — active patient: {payload.get('patient_name') or 'none set'}")
        except urllib.error.HTTPError as exc:
            bad(f"server returned {exc.code} — {'wrong API key' if exc.code == 401 else exc.reason}")
        except (urllib.error.URLError, OSError, ValueError) as exc:
            bad(f"cannot reach the server: {exc}")


def main():
    print("ProCare Dental Agent — setup check")
    print(f"Windows user: {os.environ.get('USERNAME', 'unknown')}")
    check_python()
    check_files()
    check_config()
    check_protocol()
    check_running()
    print("\nDone. Copy everything above when reporting a problem.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
