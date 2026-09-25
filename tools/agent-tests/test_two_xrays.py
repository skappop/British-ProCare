import sys, time, tempfile
from pathlib import Path
sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parents[2] / "Dental Agent"))
from agent_core import CaptureWatcher

class Clock:
    def __init__(self): self.t = 1000.0
    def __call__(self): return self.t
    def advance(self, s): self.t += s

def setup():
    root = Path(tempfile.mkdtemp()); ez = root / "ezdent"; ez.mkdir()
    time.sleep(0.05)
    c = Clock()
    return ez, c, CaptureWatcher([ez], since=time.time() - 1, clock=c, stable_seconds=2, settle_seconds=8)

def exposure(ez, token, dcm=False):
    for suffix in ("_Original.raw", "_Rotated.raw", "_.jpg", "_thumbnail.jpg") + (("_.dcm",) if dcm else ()):
        (ez / f"TEMP_IOSENSOR_{token}{suffix}").write_bytes(b"x" * 1000)

def run(w, c, steps=6, dt=3):
    out = []
    for _ in range(steps):
        c.advance(dt); out += w.scan()
    return out + w.flush()

def report(name, got):
    print(f"{name}: {len(got)} uploaded -> {[p.name for p in got]}")

# A: two X-rays 3 s apart (one sensor, back to back)
ez, c, w = setup(); exposure(ez, "1758700001"); c.advance(3); w.scan(); exposure(ez, "1758700004")
report("A back-to-back, 3 s apart", run(w, c))

# B: second X-ray lands while the first is still settling
ez, c, w = setup(); exposure(ez, "1758700001"); w.scan(); c.advance(1); exposure(ez, "1758700002")
report("B overlapping (1 s apart)", run(w, c))

# C: two sensors on one PC fire in the same second -> same token
ez, c, w = setup(); exposure(ez, "1758700001")
(ez / "TEMP_IOSENSOR_1758700001_2_Original.raw").write_bytes(b"y" * 1000)
report("C same-second, second sensor", run(w, c))

# D: 10 X-rays in a full-mouth series, ~5 s apart
ez, c, w = setup(); got = []
for i in range(10):
    exposure(ez, str(1758700000 + i * 5)); c.advance(5); got += w.scan()
report("D full-mouth series of 10", got + run(w, c))
