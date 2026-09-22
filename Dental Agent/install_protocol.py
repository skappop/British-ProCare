#!/usr/bin/env python3
"""
Registers the procare:// link handler on this Windows PC.

After running this, the "Open in Dental Agent" button on a patient's page
launches this agent (or brings it forward if it is already open) with that
patient selected.

    python install_protocol.py            install
    python install_protocol.py --uninstall  remove

Writes under HKEY_CURRENT_USER, so it needs no administrator rights and only
affects the Windows user who runs it. Run it once per user per PC.
"""

import sys
from pathlib import Path

KEY = r"Software\Classes\procare"


def interpreter() -> str:
    """pythonw.exe where available, so launching shows no console window."""
    exe = Path(sys.executable)
    windowless = exe.with_name("pythonw.exe")
    return str(windowless if windowless.exists() else exe)


def install() -> int:
    import winreg

    agent = Path(__file__).resolve().parent / "dental_agent_v2.py"
    if not agent.exists():
        print(f"ERROR: {agent.name} is not next to this script.")
        return 1

    command = f'"{interpreter()}" "{agent}" "%1"'

    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, KEY) as key:
        winreg.SetValueEx(key, "", 0, winreg.REG_SZ, "URL:ProCare Dental Agent")
        # This empty value is what marks the key as a URL scheme to Windows.
        winreg.SetValueEx(key, "URL Protocol", 0, winreg.REG_SZ, "")

    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, KEY + r"\shell\open\command") as key:
        winreg.SetValueEx(key, "", 0, winreg.REG_SZ, command)

    print("Registered procare:// on this PC.")
    print(f"  {command}")
    print()
    print("Open a patient in the web app and click 'Open in Dental Agent'.")
    print("The browser will ask permission the first time — tick 'always allow'.")
    return 0


def uninstall() -> int:
    import winreg

    for path in (KEY + r"\shell\open\command", KEY + r"\shell\open", KEY + r"\shell", KEY):
        try:
            winreg.DeleteKey(winreg.HKEY_CURRENT_USER, path)
        except FileNotFoundError:
            pass
        except OSError as exc:
            print(f"Could not remove {path}: {exc}")
            return 1

    print("Removed the procare:// handler.")
    return 0


def main() -> int:
    if sys.platform != "win32":
        print("This registers a Windows URL handler and only runs on Windows.")
        print("The agent itself still works normally without it; the button will not.")
        return 1

    return uninstall() if "--uninstall" in sys.argv else install()


if __name__ == "__main__":
    sys.exit(main())
