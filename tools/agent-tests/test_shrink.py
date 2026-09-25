import sys, tempfile, random, hashlib
from pathlib import Path
sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parents[2] / "Dental Agent"))
import agent_core
from agent_core import web_copy, Api
from PIL import Image, ImageDraw, ImageFilter

fails = 0
def check(n, c, x=""):
    global fails
    print(("PASS  " if c else "FAIL  ") + n + ("" if c else f"   {x}"))
    if not c: fails += 1

root = Path(tempfile.mkdtemp()); src = root / "src"; src.mkdir(); work = root / "work"; work.mkdir()
random.seed(1)
# 1. Intraoral-camera-like photo: 4000x3000, detailed, saved at high quality
im = Image.new("RGB", (4000, 3000), (180, 90, 90)); d = ImageDraw.Draw(im)
for _ in range(4000):
    x, y = random.randrange(4000), random.randrange(3000); r = random.randrange(5, 60)
    d.ellipse((x, y, x + r, y + r), fill=(random.randrange(256), random.randrange(256), random.randrange(256)))
im = im.filter(ImageFilter.GaussianBlur(1.5)); photo = src / "IMG_0001.jpg"; im.save(photo, quality=97)
# 2. X-ray as uncompressed BMP, grey 1600x1200
xr = Image.new("L", (1600, 1200), 40); d = ImageDraw.Draw(xr)
for i in range(60): d.rectangle((i * 25, 200, i * 25 + 18, 1000), fill=120 + (i * 2) % 120)
xr = xr.filter(ImageFilter.GaussianBlur(2)); bmp = src / "TEMP_IOSENSOR_1758700001_.bmp"; xr.save(bmp)
# 3. Transparent PNG
png = src / "chart.png"; Image.new("RGBA", (3000, 2000), (0, 128, 255, 120)).save(png)
# 4. Already-small JPEG
small = src / "small.jpg"; Image.new("RGB", (640, 480), (200, 200, 200)).save(small, quality=70)
# 5. DICOM and 6. corrupt jpg
dcm = src / "TEMP_IOSENSOR_1_.dcm"; dcm.write_bytes(b"DICM" + b"\0" * 50000)
bad = src / "broken.jpg"; bad.write_bytes(b"\xff\xd8\xffnot really a jpeg" * 100)

mb = lambda p: p.stat().st_size / 1e6
out = web_copy(photo, work)
w = Image.open(out)
check(f"photo shrunk: {mb(photo):.1f} MB -> {mb(out):.2f} MB, {w.size}", out != photo and max(w.size) == 2400 and mb(out) < mb(photo) / 3)
out = web_copy(bmp, work)
check(f"BMP X-ray: {mb(bmp):.2f} MB -> {mb(out):.2f} MB, still grey, name kept", out.suffix == ".jpg" and Image.open(out).mode == "L" and out.stem == bmp.stem and mb(out) < mb(bmp) / 5)
out = web_copy(png, work)
check("transparent PNG -> JPEG on white", out.suffix == ".jpg" and Image.open(out).getpixel((10, 10))[0] > 100)
check("already-small JPEG uploaded unchanged", web_copy(small, work) == small)
check("DICOM uploaded unchanged", web_copy(dcm, work) == dcm)
check("corrupt file uploaded unchanged (no crash)", web_copy(bad, work) == bad)

# Upload path: the web copy goes up, the original stays on the PC untouched.
before = {p.name: hashlib.md5(p.read_bytes()).hexdigest() for p in src.iterdir()}
puts, calls = [], []
class Resp:
    def __init__(self, code, body=None): self.status_code = code; self._b = body or {}
    def json(self): return self._b
class HTTP:
    def post(self, url, json=None, timeout=None, headers=None):
        calls.append((url, json))
        if url.endswith("/upload-url"):
            return Resp(200, {"uploads": [{"filename": f, "signed_url": f"https://s/{i}", "path": f"p/{i}-{f}", "category": "x"} for i, f in enumerate(json["filenames"])]})
        return Resp(200, {"ok": True, "errors": []})
    def put(self, url, data=None, headers=None, timeout=None):
        puts.append((url, len(data.read()), headers["Content-Type"])); return Resp(200)
api = Api.__new__(Api)
api.base = "https://site"; api.http = HTTP(); api.sleep = lambda s: None
if hasattr(Api, "_post"):
    pass
files = [photo, bmp, small]
uploaded, failed = api.upload("pid", files, {"source": "agent"})
check("all three reported uploaded, as the originals", uploaded == files and not failed, (uploaded, failed))
names = calls[0][1]["filenames"]
check("upload-url asked for web names (.jpg)", names == ["IMG_0001.jpg", "TEMP_IOSENSOR_1758700001_.jpg", "small.jpg"], names)
sizes = [n for _, n, _ in puts]
check(f"bytes sent {sum(sizes)/1e6:.2f} MB vs originals {sum(mb(p) for p in files):.2f} MB", sum(sizes) < 0.4 * sum(p.stat().st_size for p in files))
check("sent as image/jpeg", all(ct == "image/jpeg" for _, _, ct in puts), puts)
reg = calls[-1][1]["images"]
check("register uses web names and web sizes", [i["filename"] for i in reg] == names and reg[0]["size"] == sizes[0], reg)
after = {p.name: hashlib.md5(p.read_bytes()).hexdigest() for p in src.iterdir()}
check("originals on the PC untouched", before == after)
check("temporary web copies cleaned up", not any(Path(tempfile.gettempdir()).glob("procare-web-*")))
print("\n%d failed" % fails)
