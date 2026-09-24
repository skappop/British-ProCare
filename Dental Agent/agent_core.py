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
import shutil
import socket
import subprocess
import tempfile
import time
import uuid
from pathlib import Path
from typing import Callable, Dict, Iterable, List, Optional, Tuple

import requests

AGENT_VERSION = "3.2.0"
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

        workdir = Path(tempfile.mkdtemp(prefix="procare-web-"))
        try:
            # (original on this PC, what actually goes up)
            pairs = [(f, web_copy(f, workdir)) for f in files]
            return self._upload_pairs(patient_id, pairs, metadata)
        finally:
            shutil.rmtree(workdir, ignore_errors=True)

    def _upload_pairs(
        self, patient_id: str, pairs: List[Tuple[Path, Path]], metadata: Dict
    ) -> Tuple[List[Path], List[Tuple[Path, str]]]:
        status, payload = self._post(
            "/api/bridge/upload-url",
            {"patient_id": patient_id, "filenames": [web.name for _, web in pairs]},
        )
        if status != 200:
            reason = payload.get("error") or f"HTTP {status}"
            return [], [(f, reason) for f, _ in pairs]

        slots: Dict[str, List[Dict]] = {}
        for item in payload.get("uploads", []):
            slots.setdefault(item["filename"], []).append(item)

        stored, failures = [], []
        for original, web in pairs:
            available = slots.get(web.name)
            if not available:
                failures.append((original, "no upload link returned"))
                continue
            slot = available.pop(0)
            error = self._put(web, slot["signed_url"])
            if error:
                failures.append((original, error))
            else:
                stored.append((original, web, slot))

        if not stored:
            return [], failures

        status, payload = self._post(
            "/api/bridge/register",
            {
                "patient_id": patient_id,
                "images": [
                    {
                        "path": slot["path"],
                        "filename": web.name,
                        "category": slot.get("category"),
                        "size": _size(web),
                    }
                    for _, web, slot in stored
                ],
                "metadata": metadata,
            },
            timeout=60,
        )
        if status != 200:
            reason = _describe(payload, status)
            return [], failures + [(original, reason) for original, _, _ in stored]

        # The register step can reject individual rows; map those back to files.
        rejected = {e.get("file"): e.get("error", "rejected") for e in payload.get("errors") or []}
        uploaded = [original for original, web, _ in stored if web.name not in rejected]
        failures += [(original, rejected[web.name]) for original, web, _ in stored if web.name in rejected]
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


# ---------------------------------------------------------------------------
# Web copies: the imaging software keeps the full-quality original on this PC
# (and the nightly backup copies it); the website only needs a copy good for
# viewing on screens and in PDFs. Shrinking it is what keeps online storage
# small enough for the free plan.
# ---------------------------------------------------------------------------

WEB_MAX_SIDE = 2400
WEB_QUALITY_COLOUR = 85
WEB_QUALITY_GREY = 90  # X-rays: grey only, so a little more quality costs little
WEB_SMALL_JPEG = 800_000  # bytes
SHRINKABLE = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff"}


def web_copy(path: Path, workdir: Path) -> Path:
    """
    A JPEG no larger than WEB_MAX_SIDE on its longest side, written into
    `workdir`, or the original path when shrinking would not help (already
    small, not a picture Pillow can read, DICOM, or Pillow missing).
    """
    if path.suffix.lower() == ".dcm":
        return dicom_picture(path, workdir) or path
    if path.suffix.lower() not in SHRINKABLE:
        return path
    try:
        from PIL import Image, ImageOps
    except ImportError:
        return path
    try:
        with Image.open(path) as im:
            # A JPEG that is already web-sized is left alone: compressing it a
            # second time costs quality for almost no saving.
            if im.format == "JPEG" and max(im.size) <= WEB_MAX_SIDE and (_size(path) or 0) <= WEB_SMALL_JPEG:
                return path
            im = ImageOps.exif_transpose(im)
            grey = im.mode in ("L", "I", "I;16", "1")
            if grey:
                im = im.convert("L")
            elif im.mode != "RGB":
                # Transparent PNGs get a white background; JPEG has no alpha.
                rgba = im.convert("RGBA")
                im = Image.new("RGB", rgba.size, (255, 255, 255))
                im.paste(rgba, mask=rgba.split()[-1])
            im.thumbnail((WEB_MAX_SIDE, WEB_MAX_SIDE), Image.LANCZOS)
            out = workdir / f"{path.stem}.jpg"
            n = 1
            while out.exists():
                out = workdir / f"{path.stem}_{n}.jpg"
                n += 1
            im.save(out, "JPEG", quality=WEB_QUALITY_GREY if grey else WEB_QUALITY_COLOUR, optimize=True)
    except Exception as exc:  # a picture we cannot read still uploads as-is
        log.info("Uploading %s unchanged (%s)", path.name, exc)
        return path
    original, shrunk = _size(path) or 0, _size(out) or 0
    if not shrunk or shrunk >= original * 0.9:
        return path
    log.info("Web copy of %s: %.1f MB -> %.2f MB", path.name, original / 1e6, shrunk / 1e6)
    return out


def dicom_picture(path: Path, workdir: Path) -> Optional[Path]:
    """
    A JPEG of a DICOM X-ray, for the website (browsers cannot show DICOM).
    None when it cannot be read (pydicom/numpy missing, or a compression they
    cannot decode): the DICOM is then sent as it is.
    """
    try:
        import numpy as np
        import pydicom
        from PIL import Image
    except ImportError:
        log.info("pydicom/numpy not installed: sending %s as DICOM", path.name)
        return None
    try:
        ds = pydicom.dcmread(str(path))
        pixels = ds.pixel_array.astype("float64")
        try:  # the contrast the sensor software chose, when it says
            from pydicom.pixels import apply_voi_lut
        except ImportError:
            try:
                from pydicom.pixel_data_handlers.util import apply_voi_lut
            except ImportError:
                apply_voi_lut = None
        if apply_voi_lut is not None:
            try:
                pixels = apply_voi_lut(pixels, ds).astype("float64")
            except Exception:
                pass
        if pixels.ndim == 3 and pixels.shape[-1] not in (3, 4):
            pixels = pixels[0]  # several frames: the first
        low, high = np.percentile(pixels, 0.5), np.percentile(pixels, 99.5)
        if high <= low:
            low, high = float(pixels.min()), float(pixels.max() or 1)
        pixels = np.clip((pixels - low) / (high - low), 0, 1) * 255
        if str(getattr(ds, "PhotometricInterpretation", "")).upper() == "MONOCHROME1":
            pixels = 255 - pixels
        im = Image.fromarray(pixels.astype("uint8"))
        im = im.convert("RGB") if im.mode not in ("L", "RGB") else im
        im.thumbnail((WEB_MAX_SIDE, WEB_MAX_SIDE), Image.LANCZOS)
        out = workdir / f"{path.stem}.jpg"
        im.save(out, "JPEG", quality=WEB_QUALITY_GREY, optimize=True)
        log.info("Picture of DICOM %s: %s", path.name, out.name)
        return out
    except Exception as exc:
        log.info("Could not turn %s into a picture (%s): sending the DICOM", path.name, exc)
        return None


def _ident(st: os.stat_result) -> str:
    return f"{st.st_size}:{st.st_mtime_ns}"


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


XRAY_PICTURE = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff"}


def pick_best_xray(files: List[Path]) -> Optional[Path]:
    """
    The one file of an X-ray to put on the website: a picture a browser can
    show, not the DICOM. The processed image first, then the rotated one, then
    the sensor's original; the largest (full size) of equals. A DICOM only
    when there is no picture (it is turned into a JPEG for the website).
    Sensor raw data and thumbnails are never sent.
    """
    def size(f: Path) -> int:
        return _size(f) or 0

    pictures = [f for f in files if f.suffix.lower() in XRAY_PICTURE and "thumb" not in f.name.lower()]
    if pictures:
        def rank(f: Path):
            name = f.name.lower()
            kind = 2 if "original" in name else 1 if "rotated" in name else 0
            return (kind, -size(f), f.name)
        return sorted(pictures, key=rank)[0]
    dicoms = [f for f in files if f.suffix.lower() == ".dcm"]
    if dicoms:
        return sorted(dicoms, key=lambda f: (-size(f), f.name))[0]
    return None


class CaptureWatcher:
    """
    Decides when a new capture is ready to upload.

    Intraoral photos go as soon as the file has stopped growing.

    EzDent-i writes several temporary files per X-ray (picture, DICOM, raw,
    thumbnail), may delete them again moments later, and may reuse the same
    file names for the next X-ray. So X-ray files are copied into this PC's
    hold folder the moment they appear (and again whenever they change), the
    copies of one X-ray are grouped, and one best picture per X-ray is sent
    once its group has been quiet for a few seconds. A file rewritten under
    the same name after its X-ray was sent is a new X-ray.
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
        hold_dir: Optional[Path] = None,
    ):
        self.folders = [Path(f) for f in folders if f]
        self.since = since
        # Files already in the folders when the session began. They belong to
        # someone else's session, whatever their timestamps say — relying on
        # time alone let the previous patient's last capture leak into the next
        # patient's chart when sessions ran back to back.
        # "path\tsize\tmtime" entries: a file rewritten since (same name, new
        # content) is new. Plain paths (older saved state) mean "ignore it".
        self.baseline: Dict[str, Optional[str]] = {}
        for entry in baseline:
            path, _, ident = entry.partition("\t")
            self.baseline[path] = ident or None
        self.stable = stable_seconds
        self.settle = settle_seconds
        self.clock = clock
        self.sent = set(already_sent)  # absolute paths already handed out
        self.seen: Dict[str, Tuple[int, float]] = {}  # path -> (size, last change)
        self.done_groups = set()
        # X-rays: where copies are kept (None: use the files where they are).
        self.hold_dir = Path(hold_dir) if hold_dir else None
        if self.hold_dir:
            self.hold_dir.mkdir(parents=True, exist_ok=True)
        self.held: Dict[str, Tuple[Tuple[int, int], Path, str]] = {}  # source -> (identity, copy, group)
        self.xgroups: Dict[str, Dict] = {}  # group -> {"files": {source: copy}, "last": clock}
        self.open_group: Dict[str, str] = {}  # group base -> the group still collecting
        self._copies = 0

    def _new_files(self) -> List[Path]:
        found = []
        for folder in self.folders:
            try:
                entries = list(folder.iterdir())
            except OSError:
                continue
            for path in entries:
                try:
                    if not path.is_file():
                        continue
                    st = path.stat()
                    key = str(path)
                    if key in self.baseline:
                        known = self.baseline[key]
                        if known is None or known == _ident(st):
                            continue  # there before the session, unchanged
                    # Creation time, or modification time for a file overwritten
                    # under an old name (Windows keeps the creation time).
                    elif max(st.st_ctime, st.st_mtime) < self.since:
                        continue
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

    def _group_base(self, path: Path) -> str:
        match = XRAY_TIMESTAMP_RE.search(path.name)
        return f"{path.parent}|{match.group(1)}" if match else f"{path.parent}|-"

    def grab(self, files: Optional[List[Path]] = None) -> None:
        """
        Copy new or changed X-ray files into the hold folder now. Called on
        every scan, and between scans by the service, so a file EzDent-i
        deletes a second after writing it is still caught.
        """
        if files is None:
            files = self._new_files()
        now = self.clock()
        for path in files:
            lower = path.name.lower()
            if not is_xray_temp(path.name) or any(skip in lower for skip in (".tag", "_tag_")):
                continue
            try:
                st = path.stat()
            except OSError:
                continue
            if st.st_size == 0:
                continue
            identity = (st.st_size, st.st_mtime_ns)
            key = str(path)
            previous = self.held.get(key)
            if previous and previous[0] == identity:
                continue

            # Still being written (its X-ray not yet sent): same group, same copy.
            # Otherwise it is a new X-ray, even under a name used before.
            if previous and previous[2] not in self.done_groups:
                group, copy = previous[2], previous[1]
            else:
                base = self._group_base(path)
                group = self.open_group.get(base)
                if not group or group in self.done_groups:
                    group = base if base not in self.xgroups else f"{base}#{len(self.xgroups)}"
                    self.open_group[base] = group
                    self.xgroups[group] = {"files": {}, "last": now}
                copy = self._hold_path(path)
            if not self._copy(path, copy):
                continue
            if not previous or previous[1] != copy:
                log.info("X-ray file %s (%d bytes)", path.name, st.st_size)
            self.held[key] = (identity, copy, group)
            self.xgroups[group]["files"][key] = copy
            self.xgroups[group]["last"] = now

    def _hold_path(self, path: Path) -> Path:
        if not self.hold_dir:
            return path
        # One folder per copy, so the file keeps EzDent-i's own name.
        self._copies += 1
        folder = self.hold_dir / f"{int(time.time())}_{self._copies:04d}"
        folder.mkdir(parents=True, exist_ok=True)
        return folder / path.name

    def _copy(self, source: Path, copy: Path) -> bool:
        if copy == source:
            return True
        try:
            shutil.copy2(source, copy)
            return True
        except OSError as exc:  # locked while being written, or already gone
            log.info("could not copy %s yet (%s)", source.name, exc)
            return False

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
                log.info("photo ready: %s (%d bytes)", path.name, _size(path) or 0)
                ready.append(path)

        self.grab(files)
        for key, group in self.xgroups.items():
            if key in self.done_groups:
                continue
            if not force and self.clock() - group["last"] < self.settle:
                continue
            self.done_groups.add(key)
            members = list(group["files"].values())
            best = pick_best_xray(members)
            if not best:
                log.warning("X-ray with no picture or DICOM to send: %s", ", ".join(p.name for p in members))
                continue
            sent_as = f"{key}|{best}"
            if sent_as not in self.sent:
                self.sent.add(sent_as)
                log.info("X-ray ready: %s (from %d file(s))", best.name, len(members))
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
        """Every file currently in the folders, with its size and time."""
        found = []
        for folder in folders:
            try:
                for p in Path(folder).iterdir():
                    try:
                        found.append(f"{p}\t{_ident(p.stat())}")
                    except OSError:
                        found.append(str(p))
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

    def _hold_dir(self) -> Path:
        """Copies of X-ray files, kept two weeks (the originals stay in EzDent-i)."""
        hold = self.folder / "captures"
        try:
            hold.mkdir(exist_ok=True)
            cutoff = time.time() - 14 * 86400
            for old in hold.iterdir():
                if old.stat().st_mtime < cutoff:
                    shutil.rmtree(old, ignore_errors=True) if old.is_dir() else old.unlink()
        except OSError:
            pass
        return hold

    def _state_path(self) -> Path:
        return self.folder / "session_state.json"

    def save_state(self) -> None:
        write_json(self._state_path(), {
            "session_id": self.id,
            "patient_id": self.session["patient_id"],
            "mode": self.session["mode"],
            "since": self.watcher.since if self.watcher else self.clock(),
            "sent": sorted(self.watcher.sent) if self.watcher else [],
            "baseline": sorted(f"{p}\t{i}" if i else p for p, i in self.watcher.baseline.items()) if self.watcher else [],
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
                                          baseline=resume.get("baseline", []),
                                          hold_dir=self._hold_dir())
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
                                      baseline=CaptureWatcher.snapshot(folders),
                                      hold_dir=self._hold_dir())
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
