#!/usr/bin/env python3
"""
Installs ProCare Imaging (the background Dental Agent) on this Windows PC.

    python install_service.py              install, and start it now
    python install_service.py --uninstall  remove

It does two things, both under HKEY_CURRENT_USER so no administrator rights
are needed, and both only for the Windows user who runs this:

  * starts the agent automatically when this user signs in to Windows
  * sends procare:// links from the website to it, so "start the agent" on
    a patient's page works if it has been closed

Running it again after an update restarts the agent on the new version.
"""

import socket
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
SERVICE = HERE / "dental_agent_service.py"
RUN_KEY = r"Software\Microsoft\Windows\CurrentVersion\Run"
RUN_NAME = "ProCareImaging"
PROTOCOL_KEY = r"Software\Classes\procare"
PORT = 47281


def pythonw() -> str:
    exe = Path(sys.executable)
    windowless = exe.with_name("pythonw.exe")
    return str(windowless if windowless.exists() else exe)


def is_elevated() -> bool:
    try:
        import ctypes
        return bool(ctypes.windll.shell32.IsUserAnAdmin())
    except Exception:
        return False


def stop_running_agent() -> bool:
    """Ask a running copy to quit, so the new version takes over."""
    try:
        with socket.create_connection(("127.0.0.1", PORT), timeout=2) as client:
            client.sendall(b"quit")
    except OSError:
        return False
    for _ in range(20):
        time.sleep(0.5)
        try:
            with socket.create_connection(("127.0.0.1", PORT), timeout=1):
                pass
        except OSError:
            return True
    return False


def install() -> int:
    import winreg

    if not SERVICE.exists():
        print(f"ERROR: {SERVICE.name} is not in this folder. Run setup_agent.py first.")
        return 1

    if is_elevated():
        print("WARNING: this window is running as Administrator. Autostart and the")
        print("procare:// link are set up for the Windows user running this script;")
        print("if that is not the account used at the chair, close this window and")
        print("run it again from an ordinary Command Prompt.\n")

    command = f'"{pythonw()}" "{SERVICE}"'

    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, RUN_KEY) as key:
        winreg.SetValueEx(key, RUN_NAME, 0, winreg.REG_SZ, command)
    print("Autostart: ProCare Imaging will start when you sign in to Windows.")

    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, PROTOCOL_KEY) as key:
        winreg.SetValueEx(key, "", 0, winreg.REG_SZ, "URL:ProCare Imaging")
        winreg.SetValueEx(key, "URL Protocol", 0, winreg.REG_SZ, "")
    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, PROTOCOL_KEY + r"\shell\open\command") as key:
        winreg.SetValueEx(key, "", 0, winreg.REG_SZ, f'{command} "%1"')
    print("Website link: procare:// now opens ProCare Imaging.")

    if stop_running_agent():
        print("Stopped the running copy so the new version takes over.")

    flags = 0x00000008 | 0x00000200  # DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP
    subprocess.Popen([pythonw(), str(SERVICE)], cwd=str(HERE), creationflags=flags, close_fds=True)
    print("\nStarted. Look for the round ProCare icon by the clock (it may be under the ^ arrow).")
    if not (HERE / "config.json").exists() or not (HERE / "station.json").exists():
        print("The settings window will open — fill in the website, API key, this")
        print("computer's name and clinic, and where One2 and EzDent-i are.")
    return 0


def uninstall() -> int:
    import winreg

    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY, 0, winreg.KEY_SET_VALUE) as key:
            winreg.DeleteValue(key, RUN_NAME)
    except FileNotFoundError:
        pass

    for path in (PROTOCOL_KEY + r"\shell\open\command", PROTOCOL_KEY + r"\shell\open",
                 PROTOCOL_KEY + r"\shell", PROTOCOL_KEY):
        try:
            winreg.DeleteKey(winreg.HKEY_CURRENT_USER, path)
        except FileNotFoundError:
            pass

    stopped = stop_running_agent()
    print("Removed autostart and the procare:// link." + (" Stopped the agent." if stopped else ""))
    return 0


def main() -> int:
    if sys.platform != "win32":
        print("This sets up Windows autostart and only runs on Windows.")
        return 1
    return uninstall() if "--uninstall" in sys.argv else install()


if __name__ == "__main__":
    sys.exit(main())
