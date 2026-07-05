"""Merge std and stu into a single 'ramp' symbol across all maps.

Both symbols are identical (geometryProfile: ramp-s). The algorithm:
1. In binary: replace stu_idx with std_idx (stu tiles become std)
2. In atlas: remove 'stu' entry
3. In binary: decrement all values > stu_idx (atlas shifted after removal)
4. Rename 'std' to 'ramp' in atlas and tileDefinitions
"""
import json, os, glob

MAPS_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'maps')

def main():
    for fpath in sorted(glob.glob(os.path.join(MAPS_DIR, '*.json'))):
        name = os.path.basename(fpath)
        with open(fpath, encoding='utf-8') as f:
            data = json.load(f)

        atlas = data.get('tileAtlas', [])
        td = data.get('tileDefinitions', {})

        if 'std' not in atlas and 'stu' not in atlas:
            continue

        try:
            std_idx = atlas.index('std') if 'std' in atlas else None
        except ValueError:
            std_idx = None
        try:
            stu_idx = atlas.index('stu') if 'stu' in atlas else None
        except ValueError:
            stu_idx = None

        levels = data.get('levels', {})
        replaced_count = 0

        # Step 1: In binary, replace stu_idx with std_idx
        if std_idx is not None and stu_idx is not None and std_idx != stu_idx:
            for lkey, ldata in levels.items():
                binfile = os.path.join(MAPS_DIR, ldata.get('binFile', ''))
                if not os.path.exists(binfile):
                    continue
                with open(binfile, 'rb') as bf:
                    buf = bytearray(bf.read())
                changed = False
                for i in range(len(buf)):
                    if buf[i] == stu_idx:
                        buf[i] = std_idx
                        replaced_count += 1
                        changed = True
                if changed:
                    with open(binfile, 'wb') as bf:
                        bf.write(buf)

        # Step 2: Remove 'stu' from atlas
        if stu_idx is not None:
            atlas.pop(stu_idx)

        # Step 3: In binary, decrement values > stu_idx (atlas shifted)
        if stu_idx is not None:
            for lkey, ldata in levels.items():
                binfile = os.path.join(MAPS_DIR, ldata.get('binFile', ''))
                if not os.path.exists(binfile):
                    continue
                with open(binfile, 'rb') as bf:
                    buf = bytearray(bf.read())
                changed = False
                for i in range(len(buf)):
                    if buf[i] > stu_idx:
                        buf[i] -= 1
                        if buf[i] not in (0, 1):
                            pass
                        changed = True
                if changed:
                    with open(binfile, 'wb') as bf:
                        bf.write(buf)

        # Step 4: Rename 'std' to 'ramp' in atlas
        if std_idx is not None:
            # Find std's NEW index in atlas (may have shifted if stu was before std)
            if 'std' in atlas:
                new_std_idx = atlas.index('std')
                atlas[new_std_idx] = 'ramp'

            # Rename in tileDefinitions
            if 'std' in td:
                td['ramp'] = td.pop('std')

        # Remove stu from tileDefinitions if still present
        if 'stu' in td:
            del td['stu']

        with open(fpath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        parts = []
        if stu_idx is not None:
            parts.append(f"removed 'stu'")
        if std_idx is not None:
            parts.append(f"renamed 'std' -> 'ramp'")
        if replaced_count:
            parts.append(f"updated {replaced_count} tile refs in bin files")
        print(f"{name}: {'; '.join(parts)}")

if __name__ == '__main__':
    main()
