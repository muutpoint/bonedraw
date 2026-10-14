# Builds build/icon.png (1024 px) from build/icon-art.png: the artwork on a white rounded tile with an ink rim,
# laid out on Apple's icon grid (an 824 px tile with 100 px of margin), which macOS 26 needs to show it unboxed.
# Run with: python3 scripts/icon.py   (needs Pillow)
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
S, TILE, R, RIM, ART = 1024, 824, 185, 12, 750  # canvas, tile, corner radius, rim width, artwork size
X = 4  # supersampling for smooth edges

art = Image.open(ROOT / 'build' / 'icon-art.png').convert('RGB').resize((ART * X, ART * X), Image.LANCZOS)
o = (S - TILE) // 2 * X
box = [o, o, o + TILE * X - 1, o + TILE * X - 1]

mask = Image.new('L', (S * X, S * X), 0)
ImageDraw.Draw(mask).rounded_rectangle(box, R * X, fill=255)
tile = Image.new('RGB', (S * X, S * X), (255, 255, 255))
a = (S - ART) // 2 * X
tile.paste(art, (a, a))
ImageDraw.Draw(tile).rounded_rectangle(box, R * X, outline=(17, 17, 17), width=RIM * X)

icon = Image.new('RGBA', (S * X, S * X), (0, 0, 0, 0))
icon.paste(tile, (0, 0), mask)
icon.resize((S, S), Image.LANCZOS).save(ROOT / 'build' / 'icon.png', optimize=True)
print('wrote build/icon.png')
