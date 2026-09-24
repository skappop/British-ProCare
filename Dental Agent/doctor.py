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


def say(text=""):
    print(text, flush=True)


def section(title):
    say(f"\n--- {title} " + "-" * max(0, 46 - len(title)))


def ok(text):
    say(f"  [ok]   {text}")


def bad(text):
    say(f"  [BAD]  {text}")


def info(text):
    say(f"         {text}")


def is_elevated() -> bool:
    if sys.platform != "win32":
        return False
    try:
        import ctypes
        return bool(ctypes.windll.shell32.IsUserAnAdmin())
    except Exception:
        return False


def check_python():
    section("Python")
    ok(f"{sys.version.split()[0]} at {sys.executable}")

    windowless = Path(sys.executable).with_name("pythonw.exe")
    if sys.platform == "win32":
        (ok if windowless.exists() else bad)(
            f"pythonw.exe {'found' if windowless.exists() else 'MISSING (agent will flash a console)'}"
        )

    for module, package, why in (
        ("requests", "requests", "required"),
        ("pystray", "pystray", "tray icon"),
        ("PIL", "Pillow", "tray icon"),
    ):
        try:
            __import__(module)
            ok(f"{package} installed")
        except ImportError:
            bad(f"{package} NOT installed ({why})  ->  python -m pip install {package}")


def check_files():
    section("Files in this folder")
    info(str(HERE))

    for name in ("agent_core.py", "dental_agent_service.py", "install_service.py", "config.json"):
        path = HERE / name
        if path.exists():
            ok(f"{name}  ({path.stat().st_size:,} bytes)")
        else:
            bad(f"{name} MISSING")

    agent = HERE / "dental_agent_service.py"
    if not agent.exists():
        bad("background agent not installed  ->  python setup_agent.py")
        return

    # Is this the current version, or an old copy?
    try:
        with urllib.request.urlopen(f"{RAW}/dental_agent_service.py", timeout=15) as response:
            latest = response.read()
    except (urllib.error.URLError, OSError) as exc:
        info(f"could not check GitHub for a newer version: {exc}")
        return

    local = agent.read_bytes()
    if local == latest:
        ok("background agent is the current version")
    else:
        bad(
            f"background agent is OUT OF DATE "
            f"(this PC {len(local):,} bytes, GitHub {len(latest):,})"
        )
        info("fix:  python setup_agent.py")



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
        info("fix:  python install_service.py")
        return
    except OSError as exc:
        bad(f"could not read the registry: {exc}")
        return

    ok("registered")
    info(command)
    if "dental_agent_service.py" not in command:
        bad("it opens the OLD agent window, not ProCare Imaging  ->  python install_service.py")

    # A handler pointing at a file that is not there is the usual reason the
    # button silently does nothing.
    parts = [p for p in command.split('"') if p.strip() and p.strip() != "%1"]
    for part in parts:
        candidate = Path(part.strip())
        if candidate.suffix in (".py", ".exe"):
            (ok if candidate.exists() else bad)(
                f"{'exists' if candidate.exists() else 'DOES NOT EXIST'}: {candidate}"
            )


def check_station():
    section("This computer (station.json)")
    station_file = HERE / "station.json"
    if not station_file.exists():
        bad("not registered yet — start the agent and fill in its Settings")
        return
    try:
        station = json.loads(station_file.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        bad(f"unreadable: {exc}")
        return
    ok(f"name: {station.get('name') or '(none)'}")
    (ok if station.get("clinic_id") else bad)(
        "clinic chosen" if station.get("clinic_id")
        else "no clinic chosen — the agent's Settings -> Load / test -> pick one"
    )


def check_autostart():
    section("Starts with Windows")
    if sys.platform != "win32":
        info("not Windows — nothing to check")
        return
    import winreg
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Run") as key:
            command, _ = winreg.QueryValueEx(key, "ProCareImaging")
        ok("yes")
        info(command)
    except FileNotFoundError:
        bad("NO — it will not come back after a restart  ->  python install_service.py")


def check_log():
    section("Recent activity (agent.log)")
    log_file = HERE / "agent.log"
    if not log_file.exists():
        info("no log yet — the agent has not run on this PC")
        return
    try:
        lines = log_file.read_text(encoding="utf-8", errors="replace").splitlines()[-6:]
    except OSError as exc:
        bad(f"unreadable: {exc}")
        return
    for line in lines:
        info(line[:140])


def check_running():
    section("Is the agent running?")
    try:
        with socket.create_connection(("127.0.0.1", PROTOCOL_PORT), timeout=2):
            ok(f"yes — running in the background")
    except OSError:
        bad("NOT running — imaging from the website will not work on this PC")
        info("start it:  python install_service.py   (also restores autostart)")


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
            with urllib.request.urlopen(request, timeout=10) as response:
                payload = json.loads(response.read().decode())
            ok(f"server reachable — active patient: {payload.get('patient_name') or 'none set'}")
        except urllib.error.HTTPError as exc:
            bad(f"server returned {exc.code} — {'wrong API key' if exc.code == 401 else exc.reason}")
        except (urllib.error.URLError, OSError, ValueError) as exc:
            bad(f"cannot reach the server: {exc}")


def main():
    say("ProCare Dental Agent - setup check")
    say(f"Windows user: {os.environ.get('USERNAME', 'unknown')}")

    if is_elevated():
        say()
        bad("This window is running as Administrator.")
        info("The procare:// handler is registered per Windows user, so setting")
        info("it up from an elevated window can register it for the wrong one.")
        info("Close this and use an ordinary Command Prompt.")
    check_python()
    check_files()
    check_config()
    check_station()
    check_protocol()
    check_autostart()
    check_running()
    check_log()
    say("\nDone. Copy everything above when reporting a problem.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
