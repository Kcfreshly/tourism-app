"""Download verified Commons photographs and produce web-sized assets and credits.

Each photo's licence and author are checked against the Commons API metadata
before saving. `experiences` lists catalogue seed keys that use the photo as
destination inspiration; `categories` supplies category fallbacks.
"""
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from io import BytesIO
import json
import re
import time
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public/assets/photos"
SA4 = ("CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0/")
PHOTOS = [
    {"id": "lekki-canopy", "file": "Canopy_Walkway_LCC.jpg", "title": "Canopy walkway, Lekki Conservation Centre, Lagos", "author": "Liesel81", "license": SA4[0], "licenseUrl": SA4[1], "categories": ["nature"], "experiences": ["nature-walk", "gardens"]},
    {"id": "lagos-beach", "file": "Bar_beach_lagos.jpg", "title": "Bar Beach, Lagos, Nigeria", "author": "ABORISADEADETONA", "license": SA4[0], "licenseUrl": SA4[1], "categories": [], "experiences": []},
    {"id": "nigeria-suya", "file": "Waina_and_Suya.jpg", "title": "Waina and suya, Nigerian cuisine", "author": "Halima Waziri", "license": SA4[0], "licenseUrl": SA4[1], "categories": [], "experiences": ["suya"]},
    {"id": "lagos-theatre", "file": "National_Arts_Theatre,_Lagos.jpg", "title": "National Arts Theatre, Lagos, Nigeria", "author": "Juganutt", "license": SA4[0], "licenseUrl": SA4[1], "categories": [], "experiences": ["history"]},
    {"id": "elegushi-evening", "file": "Evening-at-elegushi-beach.jpg", "title": "Evening at Elegushi Beach, Lekki, Lagos", "author": "S.aderogba", "license": SA4[0], "licenseUrl": SA4[1], "categories": ["waterfront"], "experiences": ["beach"]},
    {"id": "lagoon-dusk", "file": "Lagos_Lagoon_-_Brothers_at_Dusk.jpg", "title": "Fishermen on the Lagos Lagoon at dusk", "author": "Obii Okongwu", "license": SA4[0], "licenseUrl": SA4[1], "categories": [], "experiences": []},
    {"id": "balogun-market", "file": "Balogun_Market,_Lagos_Island.jpg", "title": "Balogun Market, Lagos Island", "author": "Yellowcrunchy", "license": SA4[0], "licenseUrl": SA4[1], "categories": ["local-life"], "experiences": ["local-market"]},
    {"id": "palm-grove-street", "file": "Fruit_Seller_on_Wheel_Bairo_at_Palm_Grove_Bus-stop,_Jan_2017.jpg", "title": "Fruit seller at Palm Grove bus stop, Lagos", "author": "Olusola David, Ayibiowu", "license": SA4[0], "licenseUrl": SA4[1], "categories": [], "experiences": ["neighbourhood"]},
    {"id": "jollof-dodo", "file": "Jollof_rice_and_Dodo.jpg", "title": "Jollof rice and dodo (fried plantain)", "author": "Skarfmacaronne", "license": SA4[0], "licenseUrl": SA4[1], "categories": ["food"], "experiences": ["cooking"]},
    {"id": "freedom-park-festival", "file": "Freedom_Park_Festival_2.jpg", "title": "Performers at a festival in Freedom Park, Lagos", "author": "Agbaje Isabella", "license": SA4[0], "licenseUrl": SA4[1], "categories": ["nightlife"], "experiences": ["music"]},
    {"id": "nike-gallery-paintings", "file": "Lagos_Lekki_Nike_Art_Gallery_Aug_2026_IMG_6978b.jpg", "title": "Paintings at Nike Art Gallery, Lekki, Lagos", "author": "FrankvEck", "license": SA4[0], "licenseUrl": SA4[1], "categories": ["culture"], "experiences": ["gallery"]},
    {"id": "nike-gallery-crafts", "file": "Lagos_Lekki_Nike_Art_Gallery_Aug_2026_IMG_6957b.jpg", "title": "Sculpture and crafts at Nike Art Gallery, Lekki, Lagos", "author": "FrankvEck", "license": SA4[0], "licenseUrl": SA4[1], "categories": ["shopping"], "experiences": ["makers"]},
    {"id": "lekki-link-bridge", "file": "Lekki_link_bridge.jpg", "title": "Lekki–Ikoyi Link Bridge at night, Lagos", "author": "Olasunkanmiariyo", "license": SA4[0], "licenseUrl": SA4[1], "categories": ["recreation"], "experiences": ["games"]},
]
UA = {"User-Agent": "OnaLagosDemo/1.0 (local tourism prototype; photo attribution preserved)"}


def fetch(url):
    for attempt in range(5):
        try:
            with urlopen(Request(url, headers=UA), timeout=60) as response:
                return response.read()
        except Exception as error:  # Commons rate-limits bursts; back off.
            if "429" not in str(error) or attempt == 4:
                raise
            time.sleep(20 * (attempt + 1))


def metadata(file):
    query = urlencode({"action": "query", "format": "json", "titles": "File:" + file.replace("_", " "), "prop": "imageinfo", "iiprop": "url|extmetadata", "iiurlwidth": 1600})
    page = next(iter(json.loads(fetch("https://commons.wikimedia.org/w/api.php?" + query))["query"]["pages"].values()))
    return page["imageinfo"][0]


OUTPUT.mkdir(parents=True, exist_ok=True)
credits = json.loads((OUTPUT / "credits.json").read_text()) if (OUTPUT / "credits.json").exists() else []
for photo in PHOTOS:
    existing = next((c for c in credits if c["id"] == photo["id"] and c["file"] == photo["file"]), None)
    if existing and (OUTPUT / (photo["id"] + ".webp")).exists():
        existing.update(categories=photo["categories"], experiences=photo["experiences"])
        continue
    info = metadata(photo["file"])
    meta = info["extmetadata"]
    licence = meta.get("LicenseShortName", {}).get("value")
    artist = re.sub("<[^>]+>", "", meta.get("Artist", {}).get("value", "")).strip()
    if licence != photo["license"] or photo["author"] not in artist:
        raise RuntimeError(f"Licence/author mismatch for {photo['file']}: {licence} / {artist}")
    image = ImageOps.exif_transpose(Image.open(BytesIO(fetch(info["thumburl"])))).convert("RGB")
    image.thumbnail((1600, 1200))
    path = OUTPUT / (photo["id"] + ".webp")
    image.save(path, "WEBP", quality=82, method=6)
    credits = [credit for credit in credits if credit["id"] != photo["id"]]
    credits.append({**photo, "src": "/assets/photos/" + path.name, "source": info["descriptionurl"], "original": info["url"], "modifications": "Resized and converted to WebP; displayed with layout cropping. Photo adaptations remain under the linked licence.", "width": image.width, "height": image.height})
    print(f"Saved {path.name}: {image.width}x{image.height}, {path.stat().st_size} bytes", flush=True)
    time.sleep(3)
(OUTPUT / "credits.json").write_text(json.dumps(credits, indent=2) + "\n", encoding="utf-8")
