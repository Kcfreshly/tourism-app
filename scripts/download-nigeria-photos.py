"""Download verified Commons photographs and produce web-sized assets and credits."""
from pathlib import Path
from urllib.request import Request, urlopen
from html import unescape
from io import BytesIO
import json
import re
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public/assets/photos"
PHOTOS = [
    {"id": "lekki-canopy", "file": "Canopy_Walkway_LCC.jpg", "title": "Canopy walkway, Lekki Conservation Centre, Lagos", "author": "Liesel81", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/", "categories": ["nature", "recreation"]},
    {"id": "lagos-beach", "file": "Bar_beach_lagos.jpg", "title": "Bar Beach, Lagos, Nigeria", "author": "ABORISADEADETONA", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/", "categories": ["waterfront"]},
    {"id": "nigeria-suya", "file": "Waina_and_Suya.jpg", "title": "Waina and suya, Nigerian cuisine", "author": "Halima Waziri", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/", "categories": ["food", "local-life"]},
    {"id": "lagos-theatre", "file": "National_Arts_Theatre,_Lagos.jpg", "title": "National Arts Theatre, Lagos, Nigeria", "author": "Juganutt", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/", "categories": ["culture", "nightlife", "shopping"]},
]

def fetch(url):
    with urlopen(Request(url, headers={"User-Agent": "LagosYourWayDemo/1.0 (local tourism prototype; photo attribution preserved)"}), timeout=30) as response:
        return response.read()

OUTPUT.mkdir(parents=True, exist_ok=True)
credits = json.loads((OUTPUT / "credits.json").read_text()) if (OUTPUT / "credits.json").exists() else []
for photo in PHOTOS:
    if any(c["id"] == photo["id"] and c["file"] == photo["file"] for c in credits) and (OUTPUT / (photo["id"] + ".webp")).exists():
        continue
    source = "https://commons.wikimedia.org/wiki/File:" + photo["file"]
    html = fetch(source).decode("utf-8")
    links = re.findall(r'href="(https://upload\.wikimedia\.org/wikipedia/commons/[^"]+)"', html)
    original = next((unescape(link).split("?")[0] for link in links if "/thumb/" not in link and link.split("?")[0].lower().endswith((".jpg", ".jpeg"))), None)
    if not original:
        raise RuntimeError("No original photograph found: " + source)
    image = ImageOps.exif_transpose(Image.open(BytesIO(fetch(original)))).convert("RGB")
    image.thumbnail((1600, 1200))
    path = OUTPUT / (photo["id"] + ".webp")
    image.save(path, "WEBP", quality=84, method=6)
    credits = [credit for credit in credits if credit["id"] != photo["id"]]
    credits.append({**photo, "src": "/assets/photos/" + path.name, "source": source, "original": original, "modifications": "Resized and converted to WebP; displayed with layout cropping. Photo adaptations remain under the linked licence.", "width": image.width, "height": image.height})
    print(f"Saved {path.name}: {image.width}x{image.height}, {path.stat().st_size} bytes", flush=True)
    (OUTPUT / "credits.json").write_text(json.dumps(credits, indent=2), encoding="utf-8")
