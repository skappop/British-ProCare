#!/usr/bin/env python3
"""
ProCare local backup.

Pulls every table and every patient image out of Supabase onto a machine the
clinic controls, in formats that stay readable if the clinic never touches
Supabase or Vercel again: CSV for the records, ordinary folders of JPEGs for
the images.

Run it manually, or daily from Windows Task Scheduler. See README.md.

Only dependency is `requests`, which the Dental Agent already needs.
"""

import csv
import json
import os
import re
import shutil
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

HERE = Path(__file__).resolve().parent
CONFIG_PATH = HERE / "backup.config.json"
PAGE_SIZE = 1000
TIMEOUT = 120

# Tables that exist but hold nothing worth restoring.
SKIP_TABLES = {"active_patient", "sheet_sync_logs", "rapid_scan_log"}

# Used only if the API will not list its own tables.
FALLBACK_TABLES = [
    "patients", "visits", "appointments", "payments", "image_records",
    "clinics", "profiles", "procedures", "treatment_plans",
    "treatment_plan_phases", "lab_cases", "suppliers", "inventory_batches",
    "purchase_orders", "purchase_order_items", "stock_movements",
    "containers", "container_items", "clinic_configuration",
]


class BackupError(Exception):
    pass


def log(message, level="INFO"):
    line = f"[{datetime.now():%Y-%m-%d %H:%M:%S}] [{level}] {message}"
    print(line, flush=True)
    try:
        with open(HERE / "backup.log", "a", encoding="utf-8") as handle:
            handle.write(line + "\n")
    except OSError:
        pass


def load_config():
    """Config file wins; environment variables are the fallback."""
    config = {}
    if CONFIG_PATH.exists():
        try:
            config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise BackupError(f"backup.config.json is not valid JSON: {exc}")

    url = (config.get("supabase_url") or os.environ.get("SUPABASE_URL") or "").rstrip("/")
    key = config.get("service_role_key") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""

    if not url or not key:
        raise BackupError(
            "Missing Supabase settings.\n"
            "Copy backup.config.example.json to backup.config.json and fill in\n"
            "your project URL and SERVICE ROLE key (Supabase -> Settings -> API)."
        )

    return {
        "url": url,
        "key": key,
        "bucket": config.get("bucket", "patient-images"),
        "dest": Path(config.get("destination") or HERE / "ProCare-Backup").expanduser(),
        "keep": int(config.get("keep_snapshots", 30)),
    }


def safe_name(value, fallback="unknown"):
    """A folder name Windows will accept, from arbitrary patient text."""
    text = (value or "").strip()
    text = re.sub(r'[<>:"/\\|?*]', "-", text)
    text = re.sub(r"[\x00-\x1f]", "", text)
    text = re.sub(r"\s+", " ", text).strip(" .")
    return text[:80] or fallback


def api_get(session, cfg, path, **kwargs):
    for attempt in range(3):
        try:
            response = session.get(f"{cfg['url']}{path}", timeout=TIMEOUT, **kwargs)
            if response.status_code < 500:
                return response
        except requests.RequestException as exc:
            if attempt == 2:
                raise BackupError(f"Cannot reach Supabase: {exc}")
        time.sleep(2 ** attempt)
    return response


def discover_tables(session, cfg):
    """
    Ask PostgREST what it exposes, so a table added later is backed up without
    anyone remembering to edit this script.
    """
    response = api_get(session, cfg, "/rest/v1/")
    if response.status_code == 200:
        try:
            spec = response.json()
            names = list((spec.get("definitions") or {}).keys())
            if not names:
                names = [
                    p.strip("/") for p in (spec.get("paths") or {})
                    if p.startswith("/") and p != "/" and "{" not in p
                ]
            found = sorted(n for n in names if n and n not in SKIP_TABLES)
            if found:
                return found
        except ValueError:
            pass

    log("Could not list tables from the API; using the built-in list.", "WARN")
    return [t for t in FALLBACK_TABLES if t not in SKIP_TABLES]


def fetch_table(session, cfg, table):
    """Every row, paged, or None when the table does not exist."""
    rows, offset = [], 0
    while True:
        response = api_get(
            session, cfg, f"/rest/v1/{table}",
            params={"select": "*", "limit": PAGE_SIZE, "offset": offset},
        )
        if response.status_code == 404:
            return None
        if response.status_code >= 400:
            log(f"{table}: skipped ({response.status_code} {response.text[:120]})", "WARN")
            return None

        page = response.json()
        rows.extend(page)
        if len(page) < PAGE_SIZE:
            return rows
        offset += PAGE_SIZE


def write_table(folder, table, rows):
    """JSON for exact restores, CSV so a human can open it in Excel."""
    (folder / f"{table}.json").write_text(
        json.dumps(rows, indent=2, ensure_ascii=False, default=str), encoding="utf-8"
    )

    if not rows:
        return

    columns = []
    for row in rows:
        for key in row:
            if key not in columns:
                columns.append(key)

    with open(folder / f"{table}.csv", "w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow({
                key: json.dumps(value, ensure_ascii=False)
                if isinstance(value, (dict, list)) else value
                for key, value in row.items()
            })


def download_images(session, cfg, images_root, image_records, patients):
    """
    Mirror the images into per-patient folders, skipping anything already held
    so a daily run costs only the new captures.
    """
    by_id = {p["id"]: p for p in patients}
    seen_dirs = {}
    downloaded = failed = skipped = 0
    missing = []

    for record in image_records:
        path = record.get("storage_path")
        if not path:
            continue

        patient = by_id.get(record.get("patient_id")) or {}
        label = safe_name(patient.get("full_name"), f"patient-{str(record.get('patient_id'))[:8]}")
        # Disambiguate two patients with the same name.
        if seen_dirs.setdefault(label, record.get("patient_id")) != record.get("patient_id"):
            label = f"{label} ({str(record.get('patient_id'))[:8]})"

        if patient.get("file_number"):
            label = f"{label} [{safe_name(str(patient['file_number']))}]"

        category = safe_name(record.get("category") or "other", "other")
        target_dir = images_root / label / category
        target = target_dir / safe_name(
            (record.get("metadata") or {}).get("original_filename")
            or Path(path).name,
            Path(path).name,
        )

        if target.exists() and target.stat().st_size > 0:
            skipped += 1
            continue

        response = api_get(
            session, cfg, f"/storage/v1/object/{cfg['bucket']}/{path}", stream=True
        )
        if response.status_code != 200:
            failed += 1
            missing.append({"storage_path": path, "reason": f"HTTP {response.status_code}"})
            continue

        target_dir.mkdir(parents=True, exist_ok=True)
        partial = target.with_suffix(target.suffix + ".partial")
        try:
            with open(partial, "wb") as handle:
                for chunk in response.iter_content(65536):
                    handle.write(chunk)
            partial.replace(target)
            downloaded += 1
        except OSError as exc:
            failed += 1
            missing.append({"storage_path": path, "reason": str(exc)})
            partial.unlink(missing_ok=True)

    return {
        "downloaded": downloaded, "skipped_already_held": skipped,
        "failed": failed, "missing": missing,
    }


def prune(snapshots_root, keep):
    folders = sorted(
        (p for p in snapshots_root.iterdir() if p.is_dir()),
        key=lambda p: p.name, reverse=True,
    )
    for folder in folders[keep:]:
        shutil.rmtree(folder, ignore_errors=True)
        log(f"Removed old snapshot {folder.name}")


README = """ProCare local backup
====================

This folder is a complete, self-contained copy of the clinic's records. It does
not need Supabase, Vercel, or the ProCare app to be readable.

  images/     Every patient image, in folders named after the patient.
              Open them with any photo viewer.

  snapshots/  One folder per backup run, named by date and time. Each holds
              every database table twice:
                .csv   opens in Excel or Google Sheets
                .json  exact data, for restoring into a database

              MANIFEST.json records what that run captured and whether
              anything was missing.

Images are shared across snapshots rather than copied each time, so the folder
does not balloon. A snapshot is only the records, which are small.

RESTORING
  Records: the .json files can be loaded straight back into Supabase.
  Images:  the files in images/ can be re-uploaded to the patient-images bucket.
           image_records.csv maps each stored file to its patient.

IF THIS IS THE ONLY COPY LEFT
  Everything needed to reconstruct the clinic's history is here. patients.csv
  is the patient list; visits.csv is treatment history; payments.csv is the
  money; image_records.csv links images to patients.

KEEP THIS SAFE
  It contains patient medical data. Keep it encrypted, keep a copy off-site,
  and do not put it anywhere public.
"""


def main():
    started = time.time()
    try:
        cfg = load_config()
    except BackupError as exc:
        log(str(exc), "ERROR")
        return 1

    session = requests.Session()
    session.headers.update({
        "apikey": cfg["key"],
        "Authorization": f"Bearer {cfg['key']}",
    })

    dest = cfg["dest"]
    images_root = dest / "images"
    snapshots_root = dest / "snapshots"
    stamp = datetime.now().strftime("%Y-%m-%d_%H%M")
    staging = snapshots_root / f"{stamp}.partial"

    try:
        staging.mkdir(parents=True, exist_ok=True)
        images_root.mkdir(parents=True, exist_ok=True)
        (dest / "README.txt").write_text(README, encoding="utf-8")

        tables = discover_tables(session, cfg)
        log(f"Backing up {len(tables)} tables to {dest}")

        captured, table_counts = {}, {}
        for table in tables:
            rows = fetch_table(session, cfg, table)
            if rows is None:
                continue
            write_table(staging, table, rows)
            captured[table] = rows
            table_counts[table] = len(rows)
            log(f"  {table}: {len(rows)} rows")

        if "patients" not in table_counts:
            raise BackupError(
                "Could not read the patients table — check the service role key. "
                "Nothing was saved."
            )

        log("Downloading images…")
        image_result = download_images(
            session, cfg, images_root,
            captured.get("image_records", []), captured.get("patients", []),
        )
        log(
            f"  new {image_result['downloaded']}, "
            f"already held {image_result['skipped_already_held']}, "
            f"failed {image_result['failed']}"
        )

        manifest = {
            "taken_at": datetime.now(timezone.utc).isoformat(),
            "supabase_url": cfg["url"],
            "tables": table_counts,
            "total_rows": sum(table_counts.values()),
            "images": image_result,
            "duration_seconds": round(time.time() - started, 1),
            "complete": image_result["failed"] == 0,
        }
        (staging / "MANIFEST.json").write_text(
            json.dumps(manifest, indent=2), encoding="utf-8"
        )

        # Only now does the snapshot get its real name, so a run that dies
        # half-way never looks like a good backup.
        final = snapshots_root / stamp
        shutil.rmtree(final, ignore_errors=True)
        staging.rename(final)

        prune(snapshots_root, cfg["keep"])

        if image_result["failed"]:
            log(
                f"Finished with {image_result['failed']} image(s) missing — "
                f"see MANIFEST.json in {final.name}",
                "WARN",
            )
            return 2

        log(f"Backup complete: {manifest['total_rows']} rows, images up to date.")
        return 0

    except BackupError as exc:
        log(str(exc), "ERROR")
        shutil.rmtree(staging, ignore_errors=True)
        return 1
    except Exception as exc:  # noqa: BLE001 - a backup must report, never vanish
        log(f"Backup failed: {exc}", "ERROR")
        shutil.rmtree(staging, ignore_errors=True)
        return 1


if __name__ == "__main__":
    sys.exit(main())
