"""End to end: the real Agent loop against a mock ProCare website."""
import json, sys, threading, time, tempfile, uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parents[2] / "Dental Agent"))
import agent_core
from dental_agent_service import Agent

# ------------------------------------------------------------- mock website
TRANSITIONS = {"requested": ["active", "failed"], "active": ["active", "uploading", "completed", "failed"],
               "uploading": ["uploading", "completed", "failed"]}
OPEN = ("requested", "active", "uploading")
W = {"stations": {}, "sessions": {}, "storage": {}, "images": [], "put_failures": 0,
     "session_500": 0, "down": False}
PATIENTS = {"p1": "Ahmed Hassan", "p2": "Mariam"}

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def _json(self, code, body):
        data = json.dumps(body).encode(); self.send_response(code)
        self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(data)))
        self.end_headers(); self.wfile.write(data)
    def _body(self):
        n = int(self.headers.get("Content-Length") or 0); return json.loads(self.rfile.read(n) or b"{}")
    def do_GET(self):
        if self.path.endswith("/clinics"): return self._json(200, {"clinics": [{"id": "c1", "name": "Clinic 1"}]})
        self._json(404, {})
    def do_PUT(self):
        n = int(self.headers.get("Content-Length") or 0); data = self.rfile.read(n)
        if W["put_failures"] > 0:
            W["put_failures"] -= 1; return self._json(500, {"error": "storage hiccup"})
        W["storage"][self.path] = data; self._json(200, {})
    def do_POST(self):
        if self.headers.get("Authorization") != "Bearer KEY": return self._json(401, {"error": "Unauthorized"})
        b = self._body(); p = self.path
        if p.endswith("/agent/poll"):
            W["stations"][b["station_id"]] = {**b, "last_seen": time.time()}
            mine = [s for s in W["sessions"].values() if s["station_id"] == b["station_id"] and s["status"] in OPEN]
            cur = W["sessions"].get(b.get("current_session_id"))
            s = mine[0] if mine else None
            return self._json(200, {"ok": True,
                "session": s and {"id": s["id"], "patient_id": s["patient_id"], "patient_name": PATIENTS[s["patient_id"]],
                                  "mode": s["mode"], "status": s["status"], "end_requested": s["end_requested"]},
                "current": cur and {"id": cur["id"], "status": cur["status"], "end_requested": cur["end_requested"]}})
        if p.endswith("/agent/session"):
            if W["session_500"] > 0:
                W["session_500"] -= 1; return self._json(500, {"error": "db timeout"})
            s = W["sessions"].get(b["session_id"])
            if not s or s["station_id"] != b["station_id"]: return self._json(404, {"error": "nope"})
            if s["status"] in ("completed", "failed", "cancelled"):
                return self._json(409, {"ok": False, "refused": True, "status": s["status"], "end_requested": s["end_requested"]})
            nxt = b.get("status")
            if nxt and nxt != s["status"]:
                if nxt not in TRANSITIONS.get(s["status"], []):
                    return self._json(409, {"ok": False, "refused": True, "status": s["status"], "end_requested": s["end_requested"]})
                s["status"] = nxt
            for k in ("images_captured", "images_uploaded", "images_failed", "message"):
                if k in b: s[k] = b[k]
            return self._json(200, {"ok": True, "status": s["status"], "end_requested": s["end_requested"]})
        if p.endswith("/upload-url"):
            ups = [{"filename": f, "path": f"{b['patient_id']}/{uuid.uuid4().hex}-{f}", "category": "intraoral",
                    "signed_url": f"http://127.0.0.1:{PORT}/storage/{uuid.uuid4().hex}"} for f in b["filenames"]]
            return self._json(200, {"uploads": ups})
        if p.endswith("/register"):
            for img in b["images"]: W["images"].append({**img, "patient_id": b["patient_id"], "meta": b["metadata"]})
            return self._json(200, {"ok": True})
        self._json(404, {})

srv = ThreadingHTTPServer(("127.0.0.1", 0), H); PORT = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()

class Toggleable(agent_core.Api):
    """The real Api, but 'down' simulates losing the network."""
    def _post(self, path, body, timeout=20):
        if W["down"]: raise agent_core.ApiError("Cannot reach the website: network is down")
        return super()._post(path, body, timeout)

# ------------------------------------------------------------- fixtures
class FakeLauncher:
    log = []
    def __init__(self): self.open = []
    def launch(self, exe): self.open.append(exe); FakeLauncher.log.append(("launch", exe))
    def close_all(self): FakeLauncher.log.append(("close", list(self.open))); self.open = []

class Clock:
    t = 5000.0
    def __call__(self): return self.t
clock = Clock()

root = Path(tempfile.mkdtemp())
one2, ez = root / "one2", root / "ez"; one2.mkdir(); ez.mkdir()
(root / "One2.exe").write_bytes(b"")
cfg = {"api_base_url": f"http://127.0.0.1:{PORT}", "bridge_api_key": "KEY",
       "one2_exe": str(root / "One2.exe"), "one2_export": str(one2), "ezdent_exe": "", "ezdent_export": ""}

def make_agent():
    return Agent(folder=root, api_factory=lambda u, k: Toggleable(u, k, sleep=lambda s: None),
                 launcher_factory=FakeLauncher, clock=clock, sleep=lambda s: None)

def request(patient, mode="intraoral"):
    sid = str(uuid.uuid4())
    W["sessions"][sid] = {"id": sid, "station_id": station_id(), "patient_id": patient, "mode": mode,
                          "status": "requested", "end_requested": False, "images_uploaded": 0}
    return sid

def station_id(): return json.loads((root / "station.json").read_text())["id"]
def photo(name, size=400):
    p = one2 / name; p.write_bytes(b"x" * size); return p
def run(agent, n=1, advance=1.0):
    for _ in range(n): agent.step(); clock.t += advance

fails = 0
def check(n, c):
    global fails
    print(("PASS  " if c else "FAIL  ") + n)
    if not c: fails += 1

# ------------------------------------------------------------- scenarios
agent = make_agent()
agent.step()
check("no config -> 'Needs setup', nothing sent", "Needs setup" in agent.state and not W["stations"])

(root / "config.json").write_text(json.dumps(cfg))
agent.step()
check("configured -> registers this PC with the website", station_id() in W["stations"] and agent.state.startswith("Ready"))
check("heartbeat advertises only the software that is set up",
      W["stations"][station_id()]["capabilities"] == {"intraoral": True, "xray": False})

# 1. Happy path
s1 = request("p1")
run(agent)
check("requested session picked up -> active", W["sessions"][s1]["status"] == "active")
check("One2 opened on request", ("launch", cfg["one2_exe"]) in FakeLauncher.log)
check("tray shows who is being imaged", "Ahmed Hassan" in agent.state)
time.sleep(1.1)
a, b = photo("IMG_0001.jpg"), photo("IMG_0002.jpg")
run(agent, 4)
check("photos uploaded while the patient is still in the chair",
      sum(1 for i in W["images"] if i["patient_id"] == "p1") == 2)
check("images tagged with their session", all(i["meta"]["imaging_session_id"] == s1 for i in W["images"]))
check("website sees live counts", W["sessions"][s1]["images_uploaded"] == 2)
c = photo("IMG_0003.jpg")
W["sessions"][s1]["end_requested"] = True
FakeLauncher.log.clear()
run(agent)
check("End: last photo flushed without waiting", sum(1 for i in W["images"] if i["patient_id"] == "p1") == 3)
check("End: session completed", W["sessions"][s1]["status"] == "completed")
check("End: One2 closed because everything uploaded", ("close", [cfg["one2_exe"]]) in FakeLauncher.log)
check("no image uploaded twice", len({i["filename"] for i in W["images"]}) == len(W["images"]))
check("session state cleaned up", not (root / "session_state.json").exists())
run(agent)
check("back to Ready afterwards", agent.state.startswith("Ready"))

# 1b. Back-to-back sessions: the previous patient's last capture must NOT
#     leak into the next patient's chart, even within the same second.
W["images"].clear()
sa = request("p1"); run(agent)
last_of_a = photo("AHMED_LAST.jpg")
W["sessions"][sa]["end_requested"] = True; run(agent)
sb = request("p2"); run(agent, 4)          # immediately, no real time passing
check("back-to-back: Ahmed's last image went to Ahmed",
      any(i["filename"] == "AHMED_LAST.jpg" and i["patient_id"] == "p1" for i in W["images"]))
check("back-to-back: nothing of Ahmed's ended up in Mariam's chart",
      not any(i["patient_id"] == "p2" for i in W["images"]))
W["sessions"][sb]["end_requested"] = True; run(agent)

# 2. Cancel
W["images"].clear(); FakeLauncher.log.clear()
s2 = request("p2")
run(agent); time.sleep(1.1); photo("IMG_0101.jpg"); run(agent, 4)
W["sessions"][s2]["status"] = "cancelled"
run(agent)
check("cancel: agent stops and closes the software it opened", any(e[0] == "close" for e in FakeLauncher.log) and agent.runner is None)
check("cancel: images already uploaded stay", len(W["images"]) == 1)
check("cancel: late report cannot reopen it", W["sessions"][s2]["status"] == "cancelled")

# 3. Storage keeps failing -> software left open, leftovers kept, picked up next time
W["images"].clear(); FakeLauncher.log.clear()
s3 = request("p1")
run(agent); time.sleep(1.1); stuck = photo("IMG_0201.jpg")
W["put_failures"] = 10**6
run(agent, 4)
W["sessions"][s3]["end_requested"] = True
run(agent)
check("upload failure: session marked failed", W["sessions"][s3]["status"] == "failed")
check("upload failure: website told why", "did not upload" in (W["sessions"][s3].get("message") or ""))
check("upload failure: One2 NOT closed", not any(e[0] == "close" for e in FakeLauncher.log))
left = json.loads((root / "leftovers.json").read_text())
check("upload failure: file remembered for this patient", str(stuck) in left.get("p1", []))
W["put_failures"] = 0
s4 = request("p1")
run(agent, 2)
check("next session for the same patient sends the leftover first",
      any(i["filename"] == "IMG_0201.jpg" for i in W["images"]))
check("leftover no longer pending", "p1" not in json.loads((root / "leftovers.json").read_text()))
W["sessions"][s4]["end_requested"] = True; run(agent)

# 4. Network drops mid-session
W["images"].clear()
s5 = request("p1"); run(agent); time.sleep(1.1)
W["down"] = True
photo("IMG_0301.jpg"); run(agent, 4)
check("offline: tray says offline, session keeps running", "Offline" in agent.state and agent.runner is not None)
check("offline: nothing lost, just waiting", len(W["images"]) == 0)
W["down"] = False
run(agent, 3)
check("back online: queued photo uploads", any(i["filename"] == "IMG_0301.jpg" for i in W["images"]))
W["sessions"][s5]["end_requested"] = True; run(agent)
check("and the session still completes", W["sessions"][s5]["status"] == "completed")

# 5. Agent restarts mid-session (PC rebooted, agent crashed)
W["images"].clear()
s6 = request("p2"); run(agent); time.sleep(1.1)
photo("IMG_0401.jpg"); run(agent, 4)
agent2 = make_agent()   # fresh process, same folder
time.sleep(1.1); photo("IMG_0402.jpg"); run(agent2, 4)
names = [i["filename"] for i in W["images"]]
check("restart: resumes the same session", agent2.runner is not None and agent2.runner.id == s6)
check("restart: already-uploaded photo not sent again", names.count("IMG_0401.jpg") == 1)
check("restart: new photo after restart still uploads", "IMG_0402.jpg" in names)
W["sessions"][s6]["end_requested"] = True; run(agent2)
agent = agent2

# 6. Restart with no saved state -> honest failure
s7 = request("p1"); W["sessions"][s7]["status"] = "active"
make_agent().step()
check("unknown in-progress session: reported failed with a reason",
      W["sessions"][s7]["status"] == "failed" and "restarted" in W["sessions"][s7]["message"])

# 7. X-ray requested but EzDent not configured on this PC
s8 = request("p1", mode="xray"); run(agent)
check("missing software: fails with a message naming it",
      W["sessions"][s8]["status"] == "failed" and "EzDent" in W["sessions"][s8]["message"])

# 8. The 'completed' report is lost on the way
s9 = request("p2"); run(agent)
W["sessions"][s9]["end_requested"] = True
W["session_500"] = 1_000
run(agent)
check("lost final report: session not wrongly completed yet", W["sessions"][s9]["status"] != "completed")
W["session_500"] = 0
run(agent, 2)
check("lost final report: delivered on a later heartbeat", W["sessions"][s9]["status"] == "completed")

print(f"\n{fails} failure(s)"); srv.shutdown(); sys.exit(1 if fails else 0)
