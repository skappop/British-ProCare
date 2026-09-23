"""
Shared logic for the background Dental Agent.

Kept separate from the service shell so it can be tested without Windows,
imaging software or a tray: the website API client, the signed-URL uploader,
and the folder watcher that decides when a new capture is ready to send.
"""

import json
import logging
import mimetypes
import os
import re
import socket
import subprocess
import time
import uuid
from pathlib import Path
from typing import Callable, Dict, Iterable, List, Optional, Tuple

import requests

AGENT_VERSION = "3.0.0"
PROTOCOL_PORT = 47281

log = logging.getLogger("procare.agent")

PHOTO_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff"}
XRAY_TIMESTAMP_RE = re.compile(r"_(\d{8,10})_")


# ---------------------------------------------------------------------------
# Local files: config.json is shared with the old window; station.json is ours
# ---------------------------------------------------------------------------

def read_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default


def write_json(path: Path, data) -> None:
    # Write-then-rename, so a power cut mid-write never leaves a corrupt file.
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=2), encoding="utf-8")
    os.replace(tmp, path)


def load_station(folder: Path) -> Dict:
    """This PC's identity. The id is generated once and never changes."""
    station = read_json(folder / "station.json", {})
    if not station.get("id"):
        station["id"] = str(uuid.uuid4())
        station.setdefault("name", socket.gethostname() or "Imaging PC")
        write_json(folder / "station.json", station)
    return station


def capabilities(config: Dict) -> Dict[str, bool]:
    """What this PC can actually do, so the website only offers those buttons."""
    return {
        "intraoral": bool(config.get("one2_exe") and config.get("one2_export")),
        "xray": bool(config.get("ezdent_exe") and config.get("ezdent_export")),
    }


# ---------------------------------------------------------------------------
# Website API
# ---------------------------------------------------------------------------

class ApiError(Exception):
    pass


class Api:
    def __init__(self, base_url: str, key: str, http=None, sleep=time.sleep):
        self.base = (base_url or "").rstrip("/")
        self.http = http or requests.Session()
        self.http.headers.update({"Authorization": f"Bearer {key}"})
        self.sleep = sleep

    def _post(self, path: str, body: Dict, timeout: int = 20) -> Tuple[int, Dict]:
        try:
            response = self.http.post(f"{self.base}{path}", json=body, timeout=timeout)
        except requests.RequestException as exc:
            raise ApiError(f"Cannot reach {self.base}: {exc}") from exc
        try:
            payload = response.json()
        except ValueError:
            payload = {"error": (response.text or "")[:200]}
        return response.status_code, payload

    def poll(self, station: Dict, config: Dict, current_session_id: Optional[str]) -> Dict:
        status, payload = self._post(
            "/api/bridge/agent/poll",
            {
                "station_id": station["id"],
                "name": station.get("name") or "Imaging PC",
                "clinic_id": station.get("clinic_id"),
                "version": AGENT_VERSION,
                "capabilities": capabilities(config),
                "current_session_id": current_session_id,
            },
        )
        if status == 401:
            raise ApiError("The website rejected the Bridge API key — check the agent settings.")
        if status != 200:
            raise ApiError(payload.get("error") or f"Poll failed with HTTP {status}")
        return payload

    def update_session(self, station_id: str, session_id: str, **fields) -> Dict:
        status, payload = self._post(
            "/api/bridge/agent/session",
            {"station_id": station_id, "session_id": session_id, **fields},
        )
        if status in (200, 409):
            return payload
        raise ApiError(payload.get("error") or f"Session update failed with HTTP {status}")

    def clinics(self) -> List[Dict]:
        try:
            response = self.http.get(f"{self.base}/api/bridge/clinics", timeout=15)
        except requests.RequestException as exc:
            raise ApiError(f"Cannot reach {self.base}: {exc}") from exc
        if response.status_code != 200:
            raise ApiError(f"Could not load clinics (HTTP {response.status_code})")
        return response.json().get("clinics", [])

    def upload(self, patient_id: str, files: List[Path], metadata: Dict) -> Tuple[List[Path], List[Tuple[Path, str]]]:
        """
        Signed-URL upload: bytes go straight to storage, only metadata passes
        through the website. Returns (uploaded, [(file, reason), ...]).
        """
        if not files:
            return [], []

        status, payload = self._post(
            "/api/bridge/upload-url",
            {"patient_id": patient_id, "filenames": [f.name for f in files]},
        )
        if status != 200:
            reason = payload.get("error") or f"HTTP {status}"
            return [], [(f, reason) for f in files]

        slots: Dict[str, List[Dict]] = {}
        for item in payload.get("uploads", []):
            slots.setdefault(item["filename"], []).append(item)

        stored, failures = [], []
        for path in files:
            available = slots.get(path.name)
            if not available:
                failures.append((path, "no upload link returned"))
                continue
            slot = available.pop(0)
            error = self._put(path, slot["signed_url"])
            if error:
                failures.append((path, error))
            else:
                stored.append((path, slot))

        if not stored:
            return [], failures

        status, payload = self._post(
            "/api/bridge/register",
            {
                "patient_id": patient_id,
                "images": [
                    {
                        "path": slot["path"],
                        "filename": path.name,
                        "category": slot.get("category"),
                        "size": _size(path),
                    }
                    for path, slot in stored
                ],
                "metadata": metadata,
            },
            timeout=60,
        )
        if status != 200:
            reason = _describe(payload, status)
            return [], failures + [(path, reason) for path, _ in stored]

        # The register step can reject individual rows; map those back to files.
        rejected = {e.get("file"): e.get("error", "rejected") for e in payload.get("errors") or []}
        uploaded = [path for path, _ in stored if path.name not in rejected]
        failures += [(path, rejected[path.name]) for path, _ in stored if path.name in rejected]
        return uploaded, failures

    def _put(self, path: Path, url: str) -> Optional[str]:
        content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        last = "unknown error"
        for attempt in range(3):
            try:
                with open(path, "rb") as handle:
                    response = self.http.put(url, data=handle, headers={"Content-Type": content_type}, timeout=120)
                if response.status_code in (200, 201):
                    return None
                last = f"storage returned {response.status_code}"
            except (OSError, requests.RequestException) as exc:
                last = str(exc)
            if attempt < 2:
                self.sleep(2 ** attempt)
        return last


def _size(path: Path) -> Optional[int]:
    try:
        return path.stat().st_size
    except OSError:
        return None


def _describe(payload: Dict, status: int) -> str:
    detail = payload.get("error") or f"HTTP {status}"
    rows = payload.get("details") or []
    if rows and isinstance(rows[0], dict):
        detail += f" ({rows[0].get('error')})"
    return detail


# ---------------------------------------------------------------------------
# Watching the export folders
# ---------------------------------------------------------------------------

def is_xray_temp(name: str) -> bool:
    lower = name.lower()
    return "temp_iosensor" in lower or "temp_" in lower


def pick_best_xray(files: List[Path]) -> Optional[Path]:
    """Same priority the agent has always used: .dcm > image > Original > Rotated."""
    for test in (
        lambda f: f.suffix.lower() == ".dcm",
        lambda f: f.suffix.lower() in (".jpg", ".jpeg", ".png", ".bmp"),
        lambda f: "original" in f.name.lower(),
        lambda f: "rotated" in f.name.lower(),
    ):
        hits = sorted(f for f in files if test(f))
        if hits:
            return hits[0]
    return None


class CaptureWatcher:
    """
    Decides when a new capture is ready to upload.

    Intraoral photos go as soon as the file has stopped growing. EzDent-i
    writes several temporary files per X-ray, so those are grouped by the
    timestamp in their names and one best file is sent once the group has
    been quiet for a few seconds — uploading each file as it appeared would
    put every X-ray in the gallery several times over.
    """

    def __init__(
        self,
        folders: Iterable[Path],
        since: float,
        stable_seconds: float = 2.0,
        settle_seconds: float = 8.0,
        clock: Callable[[], float] = time.time,
        already_sent: Iterable[str] = (),
        baseline: Iterable[str] = (),
    ):
        self.folders = [Path(f) for f in folders if f]
        self.since = since
        # Files already in the folders when the session began. They belong to
        # someone else's session, whatever their timestamps say — relying on
        # time alone let the previous patient's last capture leak into the next
        # patient's chart when sessions ran back to back.
        self.baseline = set(baseline)
        self.stable = stable_seconds
        self.settle = settle_seconds
        self.clock = clock
        self.sent = set(already_sent)  # absolute paths already handed out
        self.seen: Dict[str, Tuple[int, float]] = {}  # path -> (size, last change)
        self.done_groups = set()

    def _new_files(self) -> List[Path]:
        found = []
        for folder in self.folders:
            try:
                entries = list(folder.iterdir())
            except OSError:
                continue
            for path in entries:
                if str(path) in self.baseline:
                    continue
                try:
                    if path.is_file() and os.path.getctime(path) >= self.since:
                        found.append(path)
                except OSError:
                    continue
        return found

    def _observe(self, files: List[Path]) -> None:
        now = self.clock()
        for path in files:
            size = _size(path)
            if size is None:
                continue
            key = str(path)
            previous = self.seen.get(key)
            if previous is None or previous[0] != size:
                self.seen[key] = (size, now)

    def _quiet_for(self, path: Path) -> float:
        entry = self.seen.get(str(path))
        return self.clock() - entry[1] if entry else 0.0

    def _groups(self, files: List[Path]) -> Dict[str, List[Path]]:
        groups: Dict[str, List[Path]] = {}
        for path in files:
            lower = path.name.lower()
            if any(skip in lower for skip in ("thumbnail", ".tag", "_tag_")):
                continue
            match = XRAY_TIMESTAMP_RE.search(path.name)
            if match:
                key = f"{path.parent}|{match.group(1)}"
                groups.setdefault(key, []).append(path)
        return groups

    def _collect(self, force: bool) -> List[Path]:
        files = self._new_files()
        self._observe(files)
        ready: List[Path] = []

        photos = [f for f in files if not is_xray_temp(f.name) and f.suffix.lower() in PHOTO_EXTENSIONS]
        for path in photos:
            if str(path) in self.sent or (self.seen.get(str(path), (0,))[0] == 0):
                continue
            if force or self._quiet_for(path) >= self.stable:
                self.sent.add(str(path))
                ready.append(path)

        for key, members in self._groups([f for f in files if is_xray_temp(f.name)]).items():
            if key in self.done_groups:
                continue
            quiet = min(self._quiet_for(m) for m in members)
            if not force and quiet < self.settle:
                continue
            best = pick_best_xray(members)
            self.done_groups.add(key)
            if best and str(best) not in self.sent:
                self.sent.add(str(best))
                ready.append(best)

        return ready

    def scan(self) -> List[Path]:
        """Captures that have finished being written."""
        return self._collect(force=False)

    def flush(self) -> List[Path]:
        """Everything outstanding, for when the session ends."""
        return self._collect(force=True)

    @property
    def captured(self) -> int:
        return len(self.sent)

    @staticmethod
    def snapshot(folders: Iterable[Path]) -> List[str]:
        """Every file currently in the folders."""
        found = []
        for folder in folders:
            try:
                found.extend(str(p) for p in Path(folder).iterdir())
            except OSError:
                continue
        return found


# ---------------------------------------------------------------------------
# Imaging software
# ---------------------------------------------------------------------------

class Launcher:
    """Starts and stops the imaging programs the agent opened itself."""

    def __init__(self):
        self.processes: List[subprocess.Popen] = []

    def launch(self, exe: str) -> None:
        flags = subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0
        self.processes.append(subprocess.Popen([exe], creationflags=flags))

    def close_all(self) -> None:
        for process in self.processes:
            try:
                process.terminate()
                process.wait(timeout=5)
            except Exception:
                try:
                    process.kill()
                except Exception:
                    pass
        self.processes = []


# ---------------------------------------------------------------------------
# One imaging session, from request to the last upload
# ---------------------------------------------------------------------------

FINISH_RETRY_ROUNDS = 3


class SessionRunner:
    """
    Carries out one session the website asked for.

    It never closes the imaging software unless every capture reached the
    gallery. After a failure the software stays open, the session is marked
    failed with the reason, and the files that did not make it are kept in
    leftovers.json so the next session for that patient sends them first.
    """

    def __init__(self, api: Api, station: Dict, config: Dict, session: Dict, folder: Path,
                 launcher=None, clock=time.time, sleep=time.sleep):
        self.api = api
        self.station = station
        self.config = config
        self.session = session
        self.folder = folder
        self.launcher = launcher or Launcher()
        self.clock = clock
        self.sleep = sleep
        self.uploaded = 0
        self.failed: Dict[str, str] = {}
        self.pending: List[Path] = []
        self.watcher: Optional[CaptureWatcher] = None
        self.reported = None
        # Status changes wait here until the website has acknowledged them, so
        # a dropped connection at the wrong moment cannot lose "started" or
        # "completed" — they go out again with the next report.
        self.outbox: Dict = {}

    # -- persistence, so a restart mid-session can pick up where it left off --

    @property
    def id(self) -> str:
        return self.session["id"]

    def _state_path(self) -> Path:
        return self.folder / "session_state.json"

    def save_state(self) -> None:
        write_json(self._state_path(), {
            "session_id": self.id,
            "patient_id": self.session["patient_id"],
            "mode": self.session["mode"],
            "since": self.watcher.since if self.watcher else self.clock(),
            "sent": sorted(self.watcher.sent) if self.watcher else [],
            "baseline": sorted(self.watcher.baseline) if self.watcher else [],
            "uploaded": self.uploaded,
        })

    def clear_state(self) -> None:
        try:
            self._state_path().unlink()
        except OSError:
            pass

    def _folders(self) -> List[Path]:
        mode = self.session["mode"]
        folders = []
        if mode in ("intraoral", "both") and self.config.get("one2_export"):
            folders.append(Path(self.config["one2_export"]))
        if mode in ("xray", "both") and self.config.get("ezdent_export"):
            folders.append(Path(self.config["ezdent_export"]))
        return folders

    def _programs(self) -> List[Tuple[str, str]]:
        mode = self.session["mode"]
        wanted = []
        if mode in ("intraoral", "both"):
            wanted.append(("One2", self.config.get("one2_exe", "")))
        if mode in ("xray", "both"):
            wanted.append(("EzDent-i", self.config.get("ezdent_exe", "")))
        return wanted

    def _report(self, **fields) -> Dict:
        self.outbox.update(fields)
        body = {
            "images_captured": self.watcher.captured if self.watcher else 0,
            "images_uploaded": self.uploaded,
            "images_failed": len(self.failed),
            **self.outbox,
        }
        if body == self.reported:
            return {}
        try:
            result = self.api.update_session(self.station["id"], self.id, **body)
        except ApiError as exc:
            log.warning("could not report session progress (will retry): %s", exc)
            return {}
        self.reported = body
        self.outbox = {}
        return result

    @property
    def delivered(self) -> bool:
        """True once the website has the final word on this session."""
        return not self.outbox

    def retry_report(self) -> None:
        self._report()

    # -- lifecycle --

    def start(self, resume: Optional[Dict] = None) -> bool:
        if resume:
            self.watcher = CaptureWatcher(self._folders(), since=resume["since"], clock=self.clock,
                                          already_sent=resume.get("sent", []),
                                          baseline=resume.get("baseline", []))
            self.uploaded = resume.get("uploaded", 0)
            log.info("resumed session %s after a restart", self.id)
            return True

        for label, exe in self._programs():
            if not exe or not Path(exe).exists():
                self._report(status="failed",
                             message=f"{label} is not set up on {self.station.get('name')} — open the agent settings.")
                return False

        # Only files that appear after this moment belong to this patient: a
        # snapshot of what is already there, plus the real wall-clock time
        # (compared against the files' own timestamps, so not the injectable
        # clock used for quiet periods). No slack — nothing can be captured
        # before the software below is opened.
        folders = self._folders()
        self.watcher = CaptureWatcher(folders, since=time.time(), clock=self.clock,
                                      baseline=CaptureWatcher.snapshot(folders))
        self.pending = self._take_leftovers()

        started = self._report(status="active", message=None)
        if started.get("refused"):
            log.info("session %s was %s before it started", self.id, started.get("status"))
            return False

        for label, exe in self._programs():
            try:
                self.launcher.launch(exe)
            except OSError as exc:
                self._report(status="failed", message=f"Could not open {label}: {exc}")
                return False

        self.save_state()
        log.info("session %s started (%s) for patient %s", self.id, self.session["mode"], self.session["patient_id"])
        return True

    def tick(self) -> None:
        """Send whatever has finished being captured since the last tick."""
        self.pending += self.watcher.scan()
        if self.pending:
            self._send()
        self._report()

    def finish(self) -> str:
        """End pressed: send everything, then close the software only if all of it landed."""
        self._report(status="uploading")
        self.pending += self.watcher.flush()

        for round_number in range(FINISH_RETRY_ROUNDS):
            self._send()
            if not self.pending:
                break
            if round_number < FINISH_RETRY_ROUNDS - 1:
                self.sleep(3 * (round_number + 1))

        if self.pending:
            self._keep_leftovers(self.pending)
            reason = next(iter(self.failed.values()), "upload failed")
            self._report(status="failed",
                         message=f"{len(self.pending)} image(s) did not upload ({reason}). "
                                 f"The imaging software was left open.")
            self.clear_state()
            log.warning("session %s finished with %d image(s) not uploaded", self.id, len(self.pending))
            return "failed"

        self.launcher.close_all()
        self._report(status="completed", message=None)
        self.clear_state()
        log.info("session %s completed: %d image(s)", self.id, self.uploaded)
        return "completed"

    def cancel(self) -> None:
        """Cancelled on the website: stop, and close what we opened."""
        if self.pending:
            self._keep_leftovers(self.pending)
        self.launcher.close_all()
        self.clear_state()
        log.info("session %s cancelled from the website", self.id)

    def _send(self) -> None:
        batch, self.pending = self.pending, []
        batch = [p for p in batch if p.exists()]
        if not batch:
            return
        try:
            uploaded, failures = self.api.upload(
                self.session["patient_id"],
                batch,
                {"source": "dental-agent", "imaging_session_id": self.id,
                 "station": self.station.get("name"), "captured_at": time.strftime("%Y-%m-%dT%H:%M:%S")},
            )
        except ApiError as exc:
            # Network down: keep everything queued and try again next tick.
            uploaded, failures = [], [(path, str(exc)) for path in batch]
        self.uploaded += len(uploaded)
        for path in uploaded:
            self.failed.pop(str(path), None)
        for path, reason in failures:
            self.failed[str(path)] = reason
            self.pending.append(path)
        self.save_state()

    # -- leftovers: files a failed session could not send, per patient --

    def _leftovers_path(self) -> Path:
        return self.folder / "leftovers.json"

    def _keep_leftovers(self, files: List[Path]) -> None:
        data = read_json(self._leftovers_path(), {})
        existing = set(data.get(self.session["patient_id"], []))
        data[self.session["patient_id"]] = sorted(existing | {str(f) for f in files})
        write_json(self._leftovers_path(), data)

    def _take_leftovers(self) -> List[Path]:
        data = read_json(self._leftovers_path(), {})
        mine = [Path(p) for p in data.pop(self.session["patient_id"], []) if Path(p).exists()]
        write_json(self._leftovers_path(), data)
        for path in mine:
            self.watcher.sent.add(str(path))
        if mine:
            log.info("picking up %d image(s) left over from an earlier session", len(mine))
        return mine


# ---------------------------------------------------------------------------
# Single instance
# ---------------------------------------------------------------------------

def claim_single_instance(payload: Optional[str]):
    """
    First instance gets a listening socket back. If one is already running,
    the payload is handed to it and (None, True) is returned so this process
    can exit. If the port is held by something unrelated we start anyway.
    """
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        server.bind(("127.0.0.1", PROTOCOL_PORT))
        server.listen(5)
        return server, False
    except OSError:
        server.close()

    try:
        with socket.create_connection(("127.0.0.1", PROTOCOL_PORT), timeout=3) as client:
            client.sendall((payload or "focus").encode("utf-8"))
        return None, True
    except OSError:
        return None, False
