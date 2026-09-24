# British ProCare Imaging (the Dental Agent)

A small program that runs in the background on each clinic PC with the
intraoral camera (Osstem One2) or X-ray software (EzDent-i). The doctor starts
imaging from the patient's page on the website; the agent opens the camera or
X-ray software, uploads each image as it is taken, and files it under that
patient. It starts with Windows and sits in the tray by the clock:

| Tray dot | Meaning |
|---|---|
| Teal | Ready |
| Red | Imaging a patient now |
| Grey | Offline, or not set up yet |

Right-click the tray icon for **Settings**, the website, the log, or **Quit**.

## Install or update

On the clinic PC, open a normal (not Administrator) Command Prompt in this
folder and run:

```
python setup_agent.py
```

It downloads the latest version, installs what it needs, moves any old files
into `old versions`, and starts the agent. Run the same command later to
update. Your settings are kept.

The first time, the **Settings** window opens: enter the Bridge API key (from
the owner), give the PC a name, pick its clinic, and choose the camera / X-ray
programs and their export folders.

## The files

| File | What it is |
|---|---|
| `dental_agent_service.py` | The agent itself |
| `agent_core.py` | Its engine: watching the export folders and uploading |
| `setup_agent.py` | Install and update |
| `install_service.py` | Makes it start with Windows (run by setup) |
| `doctor.py` | Troubleshooting: `python doctor.py` checks everything and says what to fix |
| `logo_mark.png` | The clinic's mark for the tray icon and window |

Created on each PC, never shared: `config.json` and `station.json` (this PC's
settings), `agent.log` (what it did, including every camera / X-ray file it
saw), `captures/` (copies of X-ray files, kept two weeks), and while working
`leftovers.json` / `session_state.json`.

## Images

The website keeps a copy sized for viewing (at most 2400 px, JPEG). The full
quality originals stay on this PC in One2 / EzDent-i and in the nightly
backup.

X-rays: EzDent-i writes several files per X-ray (picture, DICOM, sensor data,
thumbnail) and may delete them again, or reuse the same names, moments later.
The agent copies each one the moment it appears, sends one picture per X-ray,
and never the DICOM itself: when an X-ray only comes as DICOM, it is turned
into a JPEG for the website.

## If something is wrong

1. `python doctor.py` — it checks Python, the settings, the connection to the
   website and the export folders, and prints the fix for anything wrong.
2. Right-click the tray icon → **Open log**.
3. Quit from the tray and run `python setup_agent.py` again.
