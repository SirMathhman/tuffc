from pathlib import Path
import re

root = Path("src/main/tuff/selfhost")
for p in sorted(root.glob("*.tuff")):
    s = p.read_text(encoding="utf-8", errors="ignore")
    s = re.sub(r"/\*.*?\*/", "", s, flags=re.S)
    eff = 0
    for raw in s.splitlines():
        ln = raw.strip()
        if not ln or ln.startswith("//"):
            continue
        eff += 1
    if eff > 500:
        print(f"{p.as_posix()}\t{eff}")
