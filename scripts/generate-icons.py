"""Generate the two install icons without external image dependencies."""
import struct
import zlib
from pathlib import Path

DEST = Path(__file__).resolve().parents[1] / 'public'


def inside_polygon(x, y, points):
    result = False
    previous = points[-1]
    for current in points:
        x1, y1 = previous
        x2, y2 = current
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            result = not result
        previous = current
    return result


def chunk(name, data):
    return struct.pack('!I', len(data)) + name + data + struct.pack('!I', zlib.crc32(name + data))


def make_icon(size):
    # A dark rounded tile, lime M, and coral accent point. Generous inset keeps the mark maskable.
    polygon = [(0.25, 0.67), (0.25, 0.32), (0.35, 0.32), (0.5, 0.52), (0.65, 0.32), (0.75, 0.32), (0.75, 0.67), (0.65, 0.67), (0.65, 0.48), (0.53, 0.65), (0.47, 0.65), (0.35, 0.48), (0.35, 0.67)]
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            nx, ny = (x + .5) / size, (y + .5) / size
            corner = min(nx, 1 - nx, ny, 1 - ny)
            rounded = corner >= .08 or (min(nx, 1 - nx) - .08) ** 2 + (min(ny, 1 - ny) - .08) ** 2 <= .08 ** 2
            if not rounded:
                color = (16, 21, 16, 255)
            elif inside_polygon(nx, ny, polygon):
                color = (209, 247, 107, 255)
            elif (nx - .795) ** 2 + (ny - .645) ** 2 < .034 ** 2:
                color = (239, 117, 76, 255)
            else:
                color = (28, 40, 29, 255)
            row.extend(color)
        rows.append(row)
    raw = b''.join(rows)
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!2I5B', size, size, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    (DEST / f'icon-{size}.png').write_bytes(data)


for dimension in (192, 512):
    make_icon(dimension)
