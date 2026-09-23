#!/usr/bin/env python3
"""
ProCare Imaging — the Dental Agent running in the background.

Starts with Windows and sits in the tray by the clock. The doctor runs imaging
from the patient's page on the website; this opens the camera or X-ray
software on this PC when asked and uploads each image as it is taken.

    pythonw dental_agent_service.py              run in the tray (normal use)
    python  dental_agent_service.py --foreground run with output in the console
    python  dental_agent_service.py --settings   open the settings window

Everything it does is written to agent.log next to this file.
"""

import argparse
import logging
import logging.handlers
import os
import subprocess
import sys
import threading
import time
import webbrowser
from pathlib import Path
from typing import Dict, List, Optional

from agent_core import (
    AGENT_VERSION,
    Api,
    ApiError,
    Launcher,
    SessionRunner,
    claim_single_instance,
    load_station,
    read_json,
    write_json,
)

HERE = Path(__file__).resolve().parent
IDLE_POLL = 3.0
ACTIVE_POLL = 1.5
MAX_BACKOFF = 30.0

log = logging.getLogger("procare.agent")


def setup_logging(console: bool) -> None:
    handler = logging.handlers.RotatingFileHandler(
        HERE / "agent.log", maxBytes=1_000_000, backupCount=3, encoding="utf-8"
    )
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    root = logging.getLogger("procare")
    root.setLevel(logging.INFO)
    root.addHandler(handler)
    if console:
        root.addHandler(logging.StreamHandler(sys.stdout))


def windowless_python() -> str:
    exe = Path(sys.executable)
    candidate = exe.with_name("pythonw.exe")
    return str(candidate if candidate.exists() else exe)


def open_settings() -> None:
    """Separate process: tkinter and the tray each want the main thread."""
    subprocess.Popen([windowless_python(), str(HERE / Path(__file__).name), "--settings"])


# ---------------------------------------------------------------------------
# The loop
# ---------------------------------------------------------------------------

class Agent:
    def __init__(self, folder: Path = HERE, api_factory=Api, launcher_factory=Launcher,
                 clock=time.time, sleep=time.sleep):
        self.folder = folder
        self.api_factory = api_factory
        self.launcher_factory = launcher_factory
        self.clock = clock
        self.sleep = sleep
        self.stop = threading.Event()
        self.runner: Optional[SessionRunner] = None
        self.finishing: List[SessionRunner] = []
        self.state = "Starting…"
        self.busy = False
        self.online = False
        self._api = None
        self._api_key = None
        self._failures = 0

    def load(self):
        config = read_json(self.folder / "config.json", {})
        station = load_station(self.folder)
        return config, station

    def api(self, config: Dict) -> Api:
        key = (config.get("api_base_url"), config.get("bridge_api_key"))
        if self._api is None or key != self._api_key:
            self._api = self.api_factory(*key)
            self._api_key = key
        return self._api

    def configured(self, config: Dict) -> bool:
        return bool((config.get("api_base_url") or "").startswith("http") and config.get("bridge_api_key"))

    def step(self) -> float:
        """One heartbeat. Returns how long to wait before the next."""
        config, station = self.load()

        if not self.configured(config):
            self.state, self.online = "Needs setup — right-click → Settings", False
            return 5.0

        api = self.api(config)

        # Finished sessions whose final status the website has not yet heard.
        for runner in list(self.finishing):
            runner.retry_report()
            if runner.delivered:
                self.finishing.remove(runner)

        try:
            reply = api.poll(station, config, self.runner.id if self.runner else None)
        except ApiError as exc:
            self._failures += 1
            self.online = False
            self.state = f"Offline — {exc}"
            if self.runner:
                # Keep collecting captures while the network is down; they are
                # queued and go up when it comes back.
                self.runner.tick()
            return min(MAX_BACKOFF, 2.0 * self._failures)

        self._failures = 0
        self.online = True
        current = reply.get("current")
        session = reply.get("session")

        handled = self.runner is not None
        if self.runner:
            status = current.get("status") if current else None
            if status == "cancelled":
                self.runner.cancel()
                self.runner = None
            elif status in ("completed", "failed") or current is None:
                # Closed elsewhere; nothing more to do for it.
                self.runner.clear_state()
                self.runner = None
            elif current.get("end_requested"):
                self.state = "Uploading the last images…"
                self.runner.finish()
                if not self.runner.delivered:
                    self.finishing.append(self.runner)
                self.runner = None
            else:
                self.runner.tick()

        # `session` was read before the block above ran. If we just finished or
        # cancelled a session, that snapshot is stale — it can still show the
        # session we closed as open — so wait for the next heartbeat.
        closed_this_round = handled and self.runner is None
        if not self.runner and session and not closed_this_round:
            self._take(api, station, config, session)

        self.busy = self.runner is not None
        if self.runner:
            s = self.runner.session
            self.state = (f"Imaging {s.get('patient_name') or 'a patient'} — "
                          f"{self.runner.uploaded} uploaded")
        else:
            self.state = f"Ready — {station.get('name')}"
        return ACTIVE_POLL if self.runner else IDLE_POLL

    def _take(self, api: Api, station: Dict, config: Dict, session: Dict) -> None:
        runner = SessionRunner(api, station, config, session, self.folder,
                               launcher=self.launcher_factory(), clock=self.clock, sleep=self.sleep)

        if session["status"] == "requested":
            if runner.start():
                self.runner = runner
            elif not runner.delivered:
                self.finishing.append(runner)
            return

        # Active or uploading, but we are not running it: this agent restarted
        # mid-session. Resume if we saved our place, otherwise say so.
        saved = read_json(self.folder / "session_state.json", {})
        if saved.get("session_id") == session["id"]:
            runner.start(resume=saved)
            self.runner = runner
        else:
            runner._report(status="failed",
                           message="The agent restarted during this session. Start a new one to continue.")
            if not runner.delivered:
                self.finishing.append(runner)

    def run(self) -> None:
        log.info("ProCare Imaging %s started", AGENT_VERSION)
        while not self.stop.is_set():
            try:
                delay = self.step()
            except Exception:  # noqa: BLE001 - the loop must never die
                log.exception("unexpected error in the agent loop")
                self.state = "Error — see agent.log"
                delay = 5.0
            self.stop.wait(delay)
        log.info("ProCare Imaging stopped")


# ---------------------------------------------------------------------------
# Tray
# ---------------------------------------------------------------------------

def run_tray(agent: Agent) -> bool:
    try:
        import pystray
        from PIL import Image, ImageDraw
    except ImportError:
        log.warning("pystray/Pillow not installed — running without a tray icon")
        return False

    def image(fill):
        img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        draw.ellipse((4, 4, 60, 60), fill=fill)
        draw.ellipse((22, 22, 42, 42), fill=(255, 255, 255, 255))
        return img

    icons = {
        "ready": image((29, 122, 118, 255)),   # teal
        "busy": image((200, 55, 45, 255)),     # red while imaging
        "off": image((150, 150, 150, 255)),    # grey when offline / not set up
    }

    def config_url():
        return (read_json(HERE / "config.json", {}).get("api_base_url") or "").rstrip("/")

    def quit_app(icon, _item):
        agent.stop.set()
        icon.stop()

    icon = pystray.Icon(
        "procare-imaging",
        icons["off"],
        "ProCare Imaging",
        menu=pystray.Menu(
            pystray.MenuItem(lambda _item: agent.state, None, enabled=False),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Settings…", lambda: open_settings()),
            pystray.MenuItem("Open ProCare website", lambda: config_url() and webbrowser.open(config_url())),
            pystray.MenuItem("Open log", lambda: os.startfile(HERE / "agent.log") if os.name == "nt" else None),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Quit", quit_app),
        ),
    )

    def refresh():
        while not agent.stop.is_set():
            key = "busy" if agent.busy else "ready" if agent.online else "off"
            icon.icon = icons[key]
            icon.title = f"ProCare Imaging — {agent.state}"[:120]
            try:
                icon.update_menu()
            except Exception:
                pass
            agent.stop.wait(2)

    agent.notify = lambda text: _safe_notify(icon, text)
    agent.on_quit = icon.stop
    threading.Thread(target=refresh, daemon=True).start()
    icon.run()
    return True


def _safe_notify(icon, text: str) -> None:
    try:
        icon.notify(text, "ProCare Imaging")
    except Exception:
        pass


def listen(server, agent: Agent) -> None:
    """Another launch (the website link, a Startup entry) hands its URL here."""
    while not agent.stop.is_set():
        try:
            connection, _ = server.accept()
        except OSError:
            return
        with connection:
            try:
                payload = connection.recv(512).decode("utf-8", "replace")
            except OSError:
                continue
        if payload.strip() == "quit":
            # Sent by the installer so an update replaces the running copy
            # instead of handing off to it and leaving old code in charge.
            log.info("quit requested (update or uninstall)")
            agent.stop.set()
            getattr(agent, "on_quit", lambda: None)()
            return
        if "settings" in payload:
            open_settings()
        else:
            getattr(agent, "notify", lambda _t: None)("Already running in the background.")


# ---------------------------------------------------------------------------
# Settings window
# ---------------------------------------------------------------------------

def run_settings() -> None:
    import tkinter as tk
    from tkinter import filedialog, messagebox, ttk

    config = read_json(HERE / "config.json", {})
    station = load_station(HERE)

    root = tk.Tk()
    root.title("ProCare Imaging — Settings")
    root.geometry("620x560")
    frame = ttk.Frame(root, padding=18)
    frame.pack(fill="both", expand=True)

    fields = {
        "api_base_url": tk.StringVar(value=config.get("api_base_url", "https://british-pro-care.vercel.app")),
        "bridge_api_key": tk.StringVar(value=config.get("bridge_api_key", "")),
        "name": tk.StringVar(value=station.get("name", "")),
        "one2_exe": tk.StringVar(value=config.get("one2_exe", "")),
        "one2_export": tk.StringVar(value=config.get("one2_export", "")),
        "ezdent_exe": tk.StringVar(value=config.get("ezdent_exe", "")),
        "ezdent_export": tk.StringVar(value=config.get("ezdent_export", "")),
    }
    clinics: List[Dict] = []
    clinic_var = tk.StringVar()

    row = 0

    def heading(text):
        nonlocal row
        ttk.Label(frame, text=text, font=("Segoe UI", 10, "bold")).grid(row=row, column=0, columnspan=3, sticky="w", pady=(10, 4))
        row += 1

    def entry(label, key, browse=None, secret=False):
        nonlocal row
        ttk.Label(frame, text=label).grid(row=row, column=0, sticky="w", pady=3)
        ttk.Entry(frame, textvariable=fields[key], width=48, show="•" if secret else "").grid(row=row, column=1, sticky="we", pady=3)
        if browse:
            ttk.Button(frame, text="Browse…", command=browse).grid(row=row, column=2, padx=(6, 0))
        row += 1

    def pick_file(key):
        path = filedialog.askopenfilename(filetypes=[("Programs", "*.exe"), ("All files", "*.*")])
        if path:
            fields[key].set(path)

    def pick_dir(key):
        path = filedialog.askdirectory()
        if path:
            fields[key].set(path)

    heading("Connection")
    entry("Website", "api_base_url")
    entry("Bridge API key", "bridge_api_key", secret=True)

    heading("This computer")
    entry("Name (e.g. Clinic 1 — Chair 1)", "name")
    ttk.Label(frame, text="Clinic").grid(row=row, column=0, sticky="w", pady=3)
    clinic_box = ttk.Combobox(frame, textvariable=clinic_var, state="readonly", width=45)
    clinic_box.grid(row=row, column=1, sticky="we", pady=3)

    def load_clinics():
        nonlocal clinics
        try:
            clinics = Api(fields["api_base_url"].get(), fields["bridge_api_key"].get()).clinics()
        except ApiError as exc:
            messagebox.showerror("Could not connect", str(exc))
            return
        clinic_box["values"] = [c["name"] for c in clinics]
        current = next((c for c in clinics if c["id"] == station.get("clinic_id")), None)
        if current:
            clinic_var.set(current["name"])
        elif clinics:
            clinic_var.set(clinics[0]["name"])

    ttk.Button(frame, text="Load / test", command=load_clinics).grid(row=row, column=2, padx=(6, 0))
    row += 1

    heading("Intraoral camera (One2)")
    entry("Program", "one2_exe", browse=lambda: pick_file("one2_exe"))
    entry("Export folder", "one2_export", browse=lambda: pick_dir("one2_export"))

    heading("X-ray (EzDent-i)")
    entry("Program", "ezdent_exe", browse=lambda: pick_file("ezdent_exe"))
    entry("Export folder", "ezdent_export", browse=lambda: pick_dir("ezdent_export"))

    frame.columnconfigure(1, weight=1)

    def save():
        url = fields["api_base_url"].get().strip().rstrip("/")
        if not url.startswith("http"):
            messagebox.showerror("Settings", "The website address should start with https://")
            return
        if not fields["bridge_api_key"].get().strip():
            messagebox.showerror("Settings", "Enter the Bridge API key.")
            return

        merged = read_json(HERE / "config.json", {})  # keep keys the old window uses
        merged.update({k: fields[k].get().strip() for k in
                       ("bridge_api_key", "one2_exe", "one2_export", "ezdent_exe", "ezdent_export")})
        merged["api_base_url"] = url
        write_json(HERE / "config.json", merged)

        chosen = next((c for c in clinics if c["name"] == clinic_var.get()), None)
        station_data = load_station(HERE)
        station_data["name"] = fields["name"].get().strip() or station_data.get("name")
        if chosen:
            station_data["clinic_id"] = chosen["id"]
        write_json(HERE / "station.json", station_data)

        messagebox.showinfo("Settings", "Saved. The agent picks this up within a few seconds.")
        root.destroy()

    buttons = ttk.Frame(frame)
    buttons.grid(row=row, column=0, columnspan=3, sticky="e", pady=(18, 0))
    ttk.Button(buttons, text="Cancel", command=root.destroy).pack(side="right", padx=(6, 0))
    ttk.Button(buttons, text="Save", command=save).pack(side="right")

    if fields["bridge_api_key"].get():
        root.after(200, load_clinics)
    root.mainloop()


# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="ProCare Imaging background agent")
    parser.add_argument("--settings", action="store_true")
    parser.add_argument("--foreground", action="store_true")
    parser.add_argument("url", nargs="?")
    args = parser.parse_args()

    if args.settings:
        run_settings()
        return 0

    payload = args.url or ""
    server, handed_off = claim_single_instance(payload)
    if handed_off:
        return 0

    setup_logging(console=args.foreground)
    agent = Agent()

    if server:
        threading.Thread(target=listen, args=(server, agent), daemon=True).start()

    config, _ = agent.load()
    if not agent.configured(config) or "settings" in payload:
        open_settings()

    worker = threading.Thread(target=agent.run, daemon=True)
    worker.start()

    if args.foreground or not run_tray(agent):
        try:
            while worker.is_alive():
                worker.join(1)
        except KeyboardInterrupt:
            agent.stop.set()

    agent.stop.set()
    return 0


if __name__ == "__main__":
    sys.exit(main())
