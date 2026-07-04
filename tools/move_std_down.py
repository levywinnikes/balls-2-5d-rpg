"""Move all std tiles one level down in every map's binary files.

After this migration, every ramp tile sits on its LOWER level going UP.
Positions where std was removed become void.
"""
import json, os, glob

MAPS_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'maps')

def parse_level_key(key: str) -> int | None:
    try:
        return int(key)
    except ValueError:
        return None

def main():
    for fpath in sorted(glob.glob(os.path.join(MAPS_DIR, '*.json'))):
        name = os.path.basename(fpath)
        with open(fpath, encoding='utf-8') as f:
            data = json.load(f)

        atlas = data.get('tileAtlas', [])
        if 'std' not in atlas:
            continue
        std_idx = atlas.index('std')

        levels = data.get('levels', {})
        level_map: dict[int, dict] = {}
        for lkey, ldata in levels.items():
            nk = parse_level_key(lkey)
            if nk is None:
                continue
            binfile = os.path.join(MAPS_DIR, ldata.get('binFile', ''))
            if not os.path.exists(binfile):
                continue
            with open(binfile, 'rb') as bf:
                buf = bytearray(bf.read())
            width = data.get('width', 0)
            height = data.get('height', 0)
            level_map[nk] = dict(binfile=binfile, buf=buf,
                                  width=width, height=height)

        sorted_levels = sorted(level_map.keys())
        moved_total = 0

        for level_num in sorted_levels:
            target = level_num - 1
            if target not in level_map:
                continue
            cur = level_map[level_num]
            tgt = level_map[target]
            w = cur['width']
            h = cur['height']
            buf = cur['buf']
            tgt_buf = tgt['buf']
            moved = 0

            for y in range(h):
                for x in range(w):
                    idx = y * w + x
                    if buf[idx] == std_idx:
                        tgt_buf[idx] = std_idx
                        buf[idx] = 0
                        moved += 1

            if moved:
                print(f'  Level {level_num} -> {target}: {moved}')
                moved_total += moved

        if moved_total:
            # Write all unique buffers
            written = set()
            for entry in level_map.values():
                if id(entry['buf']) not in written:
                    with open(entry['binfile'], 'wb') as bf:
                        bf.write(entry['buf'])
                    written.add(id(entry['buf']))
            print(f'{name}: total {moved_total} std tiles moved down')

if __name__ == '__main__':
    main()
