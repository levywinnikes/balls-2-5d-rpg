import json
import re

target_file = 'public/newmap.json'

print(f"Reading {target_file}...")
with open(target_file, 'r') as f:
    data = json.load(f)

# Dump with indent to get the base structure (expanded)
json_str = json.dumps(data, indent=2)

print("Applying regex reformatting...")

pattern = re.compile(r'\[\s+((?:"[^"]+"\s*,\s*)+"[^"]+")\s+\]')

def compact_list(match):
    content = match.group(1)
    content = re.sub(r'\s+', ' ', content)
    items = [x.strip() for x in content.split(',')]
    joined = ', '.join(items)
    return f"[{joined}]"

new_json_str = pattern.sub(compact_list, json_str)

with open(target_file, 'w') as f:
    f.write(new_json_str)

print("Done. Map arrays restored to single lines.")
