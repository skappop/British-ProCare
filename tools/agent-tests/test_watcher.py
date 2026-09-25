import sys, time, tempfile
from pathlib import Path
sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parents[2] / "Dental Agent"))
from agent_core import CaptureWatcher, pick_best_xray

fails = 0
def check(n, c):
    global fails
    print(("PASS  " if c else "FAIL  ") + n)
    if not c: fails += 1

class Clock:
    def __init__(self): self.t = 1000.0
    def __call__(self): return self.t
    def advance(self, s): self.t += s

root = Path(tempfile.mkdtemp())
one2, ez = root / "one2", root / "ezdent"
one2.mkdir(); ez.mkdir()
old = one2 / "from_yesterday.jpg"; old.write_bytes(b"x" * 100)
time.sleep(1.1)  # ctime resolution
clock = Clock()
w = CaptureWatcher([one2, ez], since=time.time() - 0.5, clock=clock, stable_seconds=2, settle_seconds=8)

# --- intraoral photos ---
check("nothing new -> nothing ready", w.scan() == [])
photo = one2 / "IMG_0001.jpg"; photo.write_bytes(b"x" * 500)
check("brand-new photo not sent while it may still be writing", w.scan() == [])
clock.advance(1); photo.write_bytes(b"x" * 900)   # still growing
check("growing photo held back", w.scan() == [])
clock.advance(2.5)
ready = w.scan()
check("photo sent once it stops growing", ready == [photo])
check("file from before the session ignored", old not in ready)
clock.advance(5)
check("same photo never sent twice", w.scan() == [])
(one2 / "Thumbs.db").write_bytes(b"junk"); (one2 / "notes.ini").write_bytes(b"x")
clock.advance(3)
check("Windows Thumbs.db and non-images ignored", w.scan() == [])
(one2 / "empty.jpg").write_bytes(b"")
clock.advance(3)
check("zero-byte file (still being created) not sent", w.scan() == [])

# --- EzDent-i X-ray groups ---
names = ["TEMP_IOSENSOR_1234567890_Original.raw", "TEMP_IOSENSOR_1234567890_Rotated.raw",
         "TEMP_IOSENSOR_1234567890_thumbnail.jpg", "TEMP_IOSENSOR_1234567890_.jpg"]
for n in names[:3]: (ez / n).write_bytes(b"x" * 300)
w.scan()
clock.advance(5)
check("X-ray group held while EzDent is still writing", w.scan() == [])
(ez / names[3]).write_bytes(b"x" * 300)   # the processed image arrives late
w.scan()                                   # the agent scans every tick; it sees it at once
clock.advance(5)
check("a new file restarts the group's quiet period", w.scan() == [])
clock.advance(4)
ready = w.scan()
check("one file per X-ray, not four", len(ready) == 1)
check("best version chosen (image over Original/Rotated), thumbnail never", ready and ready[0].name == names[3])
clock.advance(20)
check("X-ray group never sent twice", w.scan() == [])
(ez / "TEMP_nodate.raw").write_bytes(b"x")
clock.advance(20)
check("sensor raw data alone is never sent", w.scan() == [])

# --- End pressed: flush without waiting ---
p2 = one2 / "IMG_0002.jpg"; p2.write_bytes(b"x" * 10)
(ez / "TEMP_IOSENSOR_2222222222_Original.raw").write_bytes(b"x" * 10)
(ez / "TEMP_IOSENSOR_2222222222_.dcm").write_bytes(b"x" * 10)
flushed = w.flush()
check("flush sends pending photo immediately", p2 in flushed)
check("flush sends unsettled X-ray group (DICOM when there is no picture)",
      any(f.name == "TEMP_IOSENSOR_2222222222_.dcm" for f in flushed) and len(flushed) == 2)
check("captured count = distinct captures", w.captured == 4)

# --- resume after a restart ---
w2 = CaptureWatcher([one2, ez], since=w.since, clock=clock, already_sent=w.sent)
clock.advance(30)
check("after restart, already-sent photos are not re-sent", all(f.suffix != ".jpg" or "IMG" not in f.name for f in w2.scan()))

check("pick_best: picture > DICOM; raw sensor data never sent",
      pick_best_xray([Path("a_Rotated.raw"), Path("a_Original.raw")]) is None
      and pick_best_xray([Path("x.png"), Path("x.dcm")]).name == "x.png"
      and pick_best_xray([Path("x.raw"), Path("x.dcm")]).name == "x.dcm")

print(f"\n{fails} failure(s)"); sys.exit(1 if fails else 0)
