"""For every ramp tile, ensure the tile directly above (level+1, same x,y) is void.

If the tile above is already void, skip.
If it is another ramp tile (stacked column), void all ramps above the bottom-most one.
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
        void_idx = atlas.index('...') if '...' in atlas else 0

        # Build set of ramp symbol indices
        ramp_indices = set()
        for sym in atlas:
            defn = data.get('tileDefinitions', {}).get(sym, {})
            gp = defn.get('geometryProfile', '')
            if gp.startswith('ramp-'):
                ramp_indices.add(atlas.index(sym))

        if not ramp_indices:
            continue

        levels = data.get('levels', {})
        # Load all numeric levels into memory
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
            level_map[nk] = dict(binfile=binfile, buf=buf,
                                  width=data.get('width', 0),
                                  height=data.get('height', 0))

        sorted_levels = sorted(level_map.keys())
        modified_buffers = set()
        total_voided = 0
        stacked_resolved = 0

        # Pass 1: void non-ramp tiles above ramps
        for lnum in sorted_levels:
            above = lnum + 1
            if above not in level_map:
                continue
            cur = level_map[lnum]
            nxt = level_map[above]
            w = cur['width']
            h = cur['height']
            buf = cur['buf']
            nxt_buf = nxt['buf']

            for y in range(h):
                for x in range(w):
                    idx = y * w + x
                    if buf[idx] in ramp_indices:
                        above_val = nxt_buf[idx]
                        if above_val == void_idx:
                            continue
                        if above_val in ramp_indices:
                            continue
                        nxt_buf[idx] = void_idx
                        total_voided += 1
                        modified_buffers.add(id(nxt_buf))

        # Pass 2: resolve stacked columns — from high levels down,
        # if a tile is a ramp and the tile below is also a ramp, void this one.
        for lnum in reversed(sorted_levels):
            below = lnum - 1
            if below not in level_map:
                continue
            cur = level_map[lnum]
            prv = level_map[below]
            w = cur['width']
            h = cur['height']
            buf = cur['buf']
            prv_buf = prv['buf']

            for y in range(h):
                for x in range(w):
                    idx = y * w + x
                    if buf[idx] in ramp_indices and prv_buf[idx] in ramp_indices:
                        buf[idx] = void_idx
                        stacked_resolved += 1
                        modified_buffers.add(id(buf))

        if total_voided or stacked_resolved:
            written = set()
            for entry in level_map.values():
                if id(entry['buf']) not in written and id(entry['buf']) in modified_buffers:
                    with open(entry['binfile'], 'wb') as bf:
                        bf.write(entry['buf'])
                    written.add(id(entry['buf']))
            print(f"{name}: voided {total_voided} holes, resolved {stacked_resolved} stacked ramps")
        else:
            print(f"{name}: no changes needed")

if __name__ == '__main__':
    main()
