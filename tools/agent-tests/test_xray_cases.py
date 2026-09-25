"""X-ray capture cases, with real JPEG and DICOM files."""
import io, os, sys, tempfile, time
from pathlib import Path
sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parents[2] / "Dental Agent"))
import numpy as np
import pydicom
from pydicom.dataset import FileDataset, FileMetaDataset
from pydicom.uid import ExplicitVRLittleEndian, generate_uid
from PIL import Image
from agent_core import CaptureWatcher, web_copy, pick_best_xray

fails = 0
def check(name, cond, extra=""):
    global fails
    print(("  ✓ " if cond else "  ✗ ") + name + (f"  [{extra}]" if extra else ""))
    fails += (not cond)

class Clock:
    def __init__(self): self.t = 1000.0
    def __call__(self): return self.t

def jpg(path, size=(1600, 1200), seed=0):
    rng = np.random.default_rng(seed)
    arr = (rng.random((size[1], size[0])) * 60 + np.linspace(40, 200, size[0])).astype("uint8")
    Image.fromarray(arr).save(path, "JPEG", quality=92)

def dcm(path, seed=0, mono1=False):
    meta = FileMetaDataset(); meta.MediaStorageSOPClassUID = "1.2.840.10008.5.1.4.1.1.1.3"
    meta.MediaStorageSOPInstanceUID = generate_uid(); meta.TransferSyntaxUID = ExplicitVRLittleEndian
    ds = FileDataset(str(path), {}, file_meta=meta, preamble=b"\0" * 128)
    rng = np.random.default_rng(seed)
    px = (np.linspace(200, 3800, 1000)[None, :] + rng.random((800, 1000)) * 300).astype("uint16")
    ds.Rows, ds.Columns = px.shape; ds.SamplesPerPixel = 1
    ds.PhotometricInterpretation = "MONOCHROME1" if mono1 else "MONOCHROME2"
    ds.BitsAllocated, ds.BitsStored, ds.HighBit, ds.PixelRepresentation = 16, 12, 11, 0
    ds.PixelData = px.tobytes(); ds.save_as(str(path), enforce_file_format=True)

SEED = [0]
def exposure(folder, stem, with_dcm=True, with_jpg=True):
    SEED[0] += 1
    (folder / f"{stem}_Original.raw").write_bytes(os.urandom(5000))
    if with_jpg:
        jpg(folder / f"{stem}_.jpg", seed=SEED[0])
        jpg(folder / f"{stem}_thumbnail.jpg", size=(120, 90))
    if with_dcm:
        dcm(folder / f"{stem}_.dcm", seed=SEED[0])

def setup(preexisting=None):
    root = Path(tempfile.mkdtemp()); ez = root / "ez"; ez.mkdir(); hold = root / "hold"
    if preexisting: preexisting(ez)
    time.sleep(0.02)
    clock = Clock()
    w = CaptureWatcher([ez], since=time.time(), clock=clock, stable_seconds=2, settle_seconds=8,
                       baseline=CaptureWatcher.snapshot([ez]), hold_dir=hold)
    return ez, clock, w, root

def advance(w, clock, seconds, step=1.0):
    out = []
    t = 0.0
    while t < seconds:
        clock.t += step; t += step; out += w.scan()
    return out

print("1. Two X-rays; EzDent deletes its temp files a moment after writing them")
ez, clock, w, root = setup()
got = []
for i, token in enumerate(("1758700001", "1758700015")):
    exposure(ez, f"TEMP_IOSENSOR_{token}")
    w.grab()                      # the service's 0.3 s check sees them
    for f in list(ez.iterdir()): f.unlink()   # ...then EzDent removes them
    got += advance(w, clock, 12)
got += w.flush()
check("both X-rays uploaded", len(got) == 2, [p.name for p in got])
check("as pictures, not DICOM", all(p.suffix == ".jpg" and "thumbnail" not in p.name for p in got))

print("2. EzDent reuses the same file names for every X-ray (no timestamp)")
ez, clock, w, root = setup()
got = []
for i in range(2):
    time.sleep(0.02)
    exposure(ez, "TEMP_IOSENSOR")
    got += advance(w, clock, 12)
got += w.flush()
check("both X-rays uploaded", len(got) == 2, [p.name for p in got])
check("two different pictures", len(got) == 2 and got[0].read_bytes() != got[1].read_bytes())

print("3. Names already in the folder before the session, overwritten by the new X-ray")
ez, clock, w, root = setup(preexisting=lambda f: exposure(f, "TEMP_IOSENSOR"))
got = advance(w, clock, 12)
check("old files from before the session ignored", got == [], [p.name for p in got])
time.sleep(0.02); exposure(ez, "TEMP_IOSENSOR")
got = advance(w, clock, 12) + w.flush()
check("overwritten with a new X-ray: uploaded", len(got) == 1, [p.name for p in got])

print("4. Only a DICOM is written")
ez, clock, w, root = setup()
exposure(ez, "TEMP_IOSENSOR_1758700100", with_jpg=False)
got = advance(w, clock, 12) + w.flush()
check("one X-ray", len(got) == 1, [p.name for p in got])
work = Path(tempfile.mkdtemp())
web = web_copy(got[0], work) if got else None
ok_pic = bool(web) and web.suffix == ".jpg"
if ok_pic:
    im = Image.open(web); arr = np.asarray(im)
    check("DICOM turned into a JPEG picture for the website", True, f"{web.name} {im.size} {im.mode}")
    check("with real contrast (not blank)", arr.std() > 20 and arr.min() < 60 and arr.max() > 190, f"min {arr.min()} max {arr.max()} std {arr.std():.0f}")
else:
    check("DICOM turned into a JPEG picture for the website", False, str(web))
d1 = Path(tempfile.mkdtemp()) / "x.dcm"; dcm(d1, mono1=True)
w1 = web_copy(d1, work); a1 = np.asarray(Image.open(w1))
check("MONOCHROME1 DICOM comes out the right way round", a1[:, :50].mean() > a1[:, -50:].mean(), f"left {a1[:, :50].mean():.0f} right {a1[:, -50:].mean():.0f}")

print("5. Picture, DICOM, raw and thumbnail of one X-ray")
fs = Path(tempfile.mkdtemp()); exposure(fs, "TEMP_IOSENSOR_1758700200")
best = pick_best_xray(list(fs.iterdir()))
check("the full-size picture is chosen", best and best.name == "TEMP_IOSENSOR_1758700200_.jpg", best and best.name)
check("raw only: nothing sent (not viewable)", pick_best_xray([fs / "TEMP_IOSENSOR_1758700200_Original.raw"]) is None)

print("6. Full-mouth series: 18 X-rays, 5 s apart")
ez, clock, w, root = setup()
got = []
for i in range(18):
    exposure(ez, f"TEMP_IOSENSOR_{1758701000 + i * 5}", with_dcm=(i % 2 == 0))
    got += advance(w, clock, 5)
got += w.flush()
check("18 of 18 uploaded", len(got) == 18, len(got))
check("no X-ray twice", len({p.read_bytes() for p in got}) == 18)

print("7. Agent restarts mid-session: state saved and restored")
ez, clock, w, root = setup(preexisting=lambda f: exposure(f, "TEMP_IOSENSOR"))
saved = sorted(f"{p}\t{i}" if i else p for p, i in w.baseline.items())
w2 = CaptureWatcher([ez], since=w.since, clock=clock, baseline=saved, hold_dir=root / "hold")
check("baseline identities survive a restart", w2.baseline == w.baseline)
check("old-style saved state (paths only) still works", CaptureWatcher([ez], since=w.since, baseline=[str(ez / "a.jpg")]).baseline == {str(ez / "a.jpg"): None})

print(f"\n{fails} failed")
sys.exit(1 if fails else 0)
