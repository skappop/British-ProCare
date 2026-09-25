"""The real Dental Agent against the real website code (local Supabase stand-in)."""
import json, os, subprocess, sys, tempfile, time, uuid, io, random
from pathlib import Path
sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parents[2] / "Dental Agent"))
import agent_core
from dental_agent_service import Agent
from PIL import Image

def sql(q): return subprocess.run(["psql", "-q", "-h", "127.0.0.1", "-p", "55432", "-U", "postgres", "-tAc", q], capture_output=True, text=True).stdout.strip()
fails = 0
def check(n, c):
    global fails; print(("  ✓ " if c else "  ✗ ") + n); fails += (not c)

DOWN = {"on": False}
class Toggle(agent_core.Api):
    def _post(self, path, body, timeout=20):
        if DOWN["on"]: raise agent_core.ApiError("Cannot reach the website: network is down")
        return super()._post(path, body, timeout)
class FakeLauncher:
    def __init__(self): self.open = []
    def launch(self, exe): self.open.append(exe)
    def close_all(self): self.open = []

root = Path(tempfile.mkdtemp()); one2, ez = root / "one2", root / "ez"; one2.mkdir(); ez.mkdir()
(root / "One2.exe").write_bytes(b""); (root / "EzDent.exe").write_bytes(b"")
(root / "config.json").write_text(json.dumps({"api_base_url": "http://localhost:3000", "bridge_api_key": "KEY",
  "one2_exe": str(root / "One2.exe"), "one2_export": str(one2), "ezdent_exe": str(root / "EzDent.exe"), "ezdent_export": str(ez)}))
agent = Agent(folder=root, api_factory=lambda u, k: Toggle(u, k), launcher_factory=FakeLauncher)
def run(n=1, tag=""):
    for _ in range(n):
        agent.step(); open(os.devnull,"a").write(f"{time.strftime('%H:%M:%S')} DOWN={DOWN['on']} {agent.state[:70]}\n"); time.sleep(0.3)

run(2)
st = json.loads((root / "station.json").read_text())["id"]
check("PC registered with the website", sql(f"select count(*) from imaging_stations where id='{st}'") == "1")
patient = sql(f"insert into patients (full_name) values ('Agent Test {uuid.uuid4().hex[:6]}') returning id")
before = int(sql(f"select count(*) from image_records where patient_id='{patient}'") or 0)

def photo(i):
    # A real camera-sized photo: 4000x3000 noisy JPEG (~4-6 MB)
    im = Image.effect_noise((4000, 3000), 60).convert("RGB")
    b = io.BytesIO(); im.save(b, "JPEG", quality=95); p = one2 / f"IMG_{i:04d}.jpg"; p.write_bytes(b.getvalue()); return p

# 1. A long intraoral session: 40 big photos in bursts, with a 20 s network drop in the middle
sid = sql(f"insert into imaging_sessions (station_id, patient_id, mode) values ('{st}', '{patient}', 'intraoral') returning id")
t0 = time.time(); run(2)
check("session picked up", sql(f"select status from imaging_sessions where id='{sid}'") == "active")
time.sleep(1.1)
sizes = []
for i in range(40):
    sizes.append(photo(i).stat().st_size)
    if i % 8 == 7: run(3)
    if i == 20:
        DOWN["on"] = True; run(6); DOWN["on"] = False
(one2 / "IMG_BROKEN.jpg").write_bytes(b"\xff\xd8\xff garbage not really a jpeg")
for _ in range(30):
    run(1)
    if int(sql(f"select images_uploaded from imaging_sessions where id='{sid}'")) >= 41: break
sql(f"update imaging_sessions set end_requested=true where id='{sid}'")
for _ in range(20):
    run(1)
    if sql(f"select status from imaging_sessions where id='{sid}'") in ("completed", "failed"): break
el = time.time() - t0
got = int(sql(f"select count(*) from image_records where patient_id='{patient}'")) - before
print(f"   40 photos avg {sum(sizes)/len(sizes)/1e6:.1f} MB each; {got} registered in {el:.0f}s; session {sql(f'select status, images_uploaded, images_failed, coalesce(message,$$$$) from imaging_sessions where id=$${sid}$$')}")
check("all 40 photos + the unreadable file reached the patient's chart", got == 41)
check("session completed", sql(f"select status from imaging_sessions where id='{sid}'") == "completed")
stats = json.loads(subprocess.run(["curl", "-s", "localhost:54321/storage/v1/_stats"], capture_output=True, text=True).stdout)
print(f"   storage received {stats['puts']} files, {stats['bytes']/1e6:.0f} MB total (web copies, originals untouched)")
import glob
ups = glob.glob(str(__import__("pathlib").Path(__file__).resolve().parents[1] / "local-stack" / ".run" / "objects" / "patient-images" / patient / "*"))
def dim(u):
    try: return Image.open(u).size
    except Exception: return None
dims = [d for d in map(dim, ups) if d]
check(f"web copies at most 2400 px ({len(dims)} checked; largest {max(dims) if dims else None})", dims and all(max(d) <= 2400 for d in dims))
check("originals untouched on the PC", all((one2 / f"IMG_{i:04d}.jpg").stat().st_size == sizes[i] for i in range(40)))

# 2. X-ray: a full-mouth series of 18 films written by EzDent one after another
patient2 = sql(f"insert into patients (full_name) values ('Agent Xray {uuid.uuid4().hex[:6]}') returning id")
sid2 = sql(f"insert into imaging_sessions (station_id, patient_id, mode) values ('{st}', '{patient2}', 'xray') returning id")
run(2); time.sleep(1.1)
for i in range(18):
    im = Image.effect_noise((1600, 1200), 40).convert("L"); b = io.BytesIO(); im.save(b, "JPEG", quality=92)
    (ez / f"TEMP_IOSENSOR_{1758700000 + i*5}_.jpg").write_bytes(b.getvalue()); run(1)
sql(f"update imaging_sessions set end_requested=true where id='{sid2}'")
for _ in range(30):
    run(1)
    if sql(f"select status from imaging_sessions where id='{sid2}'") in ("completed", "failed"): break
n2 = int(sql(f"select count(*) from image_records where patient_id='{patient2}'"))
check(f"18-film X-ray series: {n2} of 18 registered", n2 == 18)
check("nothing from patient 1 went to patient 2", int(sql(f"select count(*) from image_records where patient_id='{patient}'")) - before == 41)
print("FAILS", fails)
