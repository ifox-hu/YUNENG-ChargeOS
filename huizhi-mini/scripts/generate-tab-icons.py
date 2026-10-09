"""Generate local PNG icons for the B bottom navigation (no font dependencies)."""
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1] / 'static' / 'image'
scale = 4

def icon(name, color):
    canvas = Image.new('RGBA', (96 * scale, 96 * scale))
    draw = ImageDraw.Draw(canvas)
    def line(points):
        draw.line([(x * scale, y * scale) for x, y in points], fill=color, width=6 * scale, joint='curve')
    if name == 'home':
        line([(14, 42), (48, 14), (82, 42)])
        line([(24, 39), (24, 80), (41, 80), (41, 57), (55, 57), (55, 80), (72, 80), (72, 39)])
    elif name == 'user':
        draw.ellipse((33*scale, 13*scale, 63*scale, 43*scale), outline=color, width=6*scale)
        draw.arc((19*scale, 49*scale, 77*scale, 105*scale), 180, 360, fill=color, width=6*scale)
        line([(19, 78), (77, 78)])
    else:
        for points in [[(17, 36), (17, 17), (36, 17)], [(60, 17), (79, 17), (79, 36)],
                       [(17, 60), (17, 79), (36, 79)], [(60, 79), (79, 79), (79, 60)],
                       [(29, 48), (67, 48)]]:
            line(points)
    return canvas.resize((96, 96), Image.Resampling.LANCZOS)

for name in ['home', 'user']:
    icon(name, '#73867e').save(root / f'tab-{name}-b.png')
    icon(name, '#008773').save(root / f'tab-{name}-b-active.png')
icon('scan', '#ffffff').save(root / 'tab-scan-b.png')
