import pathlib

for p in ["src/_statements.py", "src/interpret.py"]:
    txt = pathlib.Path(p).read_text(encoding="utf-8")
    print(p, len(txt.splitlines()))
