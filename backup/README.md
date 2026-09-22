# Local backup

A complete copy of the clinic's records on a machine you control, so the clinic
keeps working if Vercel goes away, the Supabase project is lost, or data is
corrupted.

It writes records as **CSV and JSON**, and images as **ordinary folders of
JPEGs named after the patient** — readable with Excel and a photo viewer, with
no app, no database and no internet.

## Setup (once, on the clinic PC)

1. `pip install requests` — already installed if the Dental Agent runs here.
2. Copy `backup.config.example.json` to `backup.config.json`.
3. Fill it in:
   - `supabase_url` — Supabase → Settings → API → Project URL
   - `service_role_key` — the **service_role** key on that same page, not `anon`
   - `destination` — where backups go. **Use a different physical disk from
     this PC's main drive**, e.g. `D:/ProCare-Backup` or an external drive.
     A backup on the same failing disk is not a backup.
4. Run it: `python procare_backup.py`

The service role key can read every patient record, so `backup.config.json` is
git-ignored and must never be committed or emailed.

## Run it daily (Windows Task Scheduler)

Task Scheduler → Create Basic Task → Daily, pick a time the clinic is closed →
Start a program:

- Program: `python`
- Arguments: `procare_backup.py`
- Start in: this folder's full path

Tick "Run whether user is logged on or not".

## What you get

```
ProCare-Backup/
  README.txt                  how to read this without the app
  images/
    Ahmed Hassan [A-102]/
      radiograph/TEMP_IOSENSOR_5.jpg
      intraoral/one2_001.jpg
  snapshots/
    2026-09-22_0200/
      patients.csv    patients.json
      visits.csv      visits.json
      payments.csv    payments.json
      image_records.csv  ...
      MANIFEST.json
```

Images are stored once and shared across snapshots, so a daily run only
downloads new captures. Snapshots hold just the records, which are small.
`keep_snapshots` controls how many are kept; images are never pruned.

Tables are discovered from the API, so anything added later is picked up
without editing this script.

## Checking it worked

`MANIFEST.json` in the newest snapshot has row counts per table and
`"complete": true` when every image was saved. Anything missing is listed
under `images.missing` with the reason.

Exit codes, for scheduled runs: `0` fine, `2` finished but some images are
missing, `1` failed and nothing was written.

A backup nobody checks is not a backup. Once a month, open the newest
`patients.csv` and a few images by hand.

## Restoring

- **Records** — the `.json` files load straight back into Supabase.
- **Images** — re-upload `images/` to the `patient-images` bucket;
  `image_records.csv` maps each stored file to its patient.

A run never overwrites a good backup: each snapshot is written to a `.partial`
folder and only renamed once it finishes, so an interrupted run leaves the
previous one intact.

## Keep it safe

This contains patient medical data. Keep the drive encrypted (BitLocker), keep
a copy off-site, and do not put it anywhere public.
