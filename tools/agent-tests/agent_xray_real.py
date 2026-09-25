import json, subprocess, sys, tempfile, time, uuid, glob, threading
from pathlib import Path
sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parents[2] / "Dental Agent"))
sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent))
from dental_agent_service import Agent
from PIL import Image
from xray_files import exposure, dcm   # real JPEG / DICOM makers
def sql(q): return subprocess.run(["psql","-q","-h","127.0.0.1","-p","55432","-U","postgres","-tAc",q],capture_output=True,text=True).stdout.strip()
fails = 0
def check(n, c, extra=""):
    global fails; print(("  ✓ " if c else "  ✗ ") + n + (f"  [{extra}]" if extra else "")); fails += (not c)
class L:
    def launch(self, e): pass
    def close_all(self): pass
root = Path(tempfile.mkdtemp()); ez = root / "ez"; ez.mkdir(); (root / "EzDent.exe").write_bytes(b"")
(root / "config.json").write_text(json.dumps({"api_base_url": "http://localhost:3000", "bridge_api_key": "KEY",
  "one2_exe": "", "one2_export": "", "ezdent_exe": str(root / "EzDent.exe"), "ezdent_export": str(ez)}))
agent = Agent(folder=root, launcher_factory=L)
agent.step(); st = json.loads((root / "station.json").read_text())["id"]
p = sql(f"insert into patients (full_name) values ('Xray Real {uuid.uuid4().hex[:5]}') returning id")
sid = sql(f"insert into imaging_sessions (station_id, patient_id, mode) values ('{st}', '{p}', 'xray') returning id")
agent.step(); agent.step()
check("X-ray session active", sql(f"select status from imaging_sessions where id='{sid}'") == "active")
time.sleep(1.1)
# The service's between-heartbeat checking, for real: a background loop as in Agent.run
stop = threading.Event()
def loop():
    while not stop.is_set():
        agent.step(); agent._wait(1.5)
t = threading.Thread(target=loop, daemon=True); t.start()
for token in ("1758800001", "1758800020"):
    exposure(ez, f"TEMP_IOSENSOR_{token}")
    time.sleep(0.8)                                  # EzDent keeps them under a second...
    for f in list(ez.iterdir()): f.unlink()          # ...then removes them
    time.sleep(10)
dcm(ez / "TEMP_IOSENSOR_1758800050_.dcm", seed=7)   # a DICOM-only X-ray
time.sleep(12)
sql(f"update imaging_sessions set end_requested=true where id='{sid}'")
for _ in range(30):
    time.sleep(1)
    if sql(f"select status from imaging_sessions where id='{sid}'") in ("completed", "failed"): break
stop.set(); t.join(timeout=10)
rows = sql(f"select metadata->>'original_filename' from image_records where patient_id='{p}' order by created_at").split("\n")
rows = [r for r in rows if r]
check("all 3 X-rays reached the patient's chart", len(rows) == 3, rows)
check("every one is a JPEG picture (no .dcm)", rows and all(r.lower().endswith(".jpg") for r in rows))
files = glob.glob(str(__import__("pathlib").Path(__file__).resolve().parents[1] / "local-stack" / ".run" / "objects" / "patient-images" / p / "*"))
kinds = [Image.open(f).format for f in files]
check("stored files open as images", len(files) == 3 and all(k == "JPEG" for k in kinds), kinds)
log = (root / "agent.log").read_text() if (root / "agent.log").exists() else ""
print("FAILS", fails)
