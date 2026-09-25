import os
import numpy as np
from pydicom.dataset import FileDataset, FileMetaDataset
from pydicom.uid import ExplicitVRLittleEndian, generate_uid
from PIL import Image

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

