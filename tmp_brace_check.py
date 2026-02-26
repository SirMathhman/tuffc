from pathlib import Path
s = Path(r"c:/Users/mathm/Documents/Projects/Tuff-Toolchain/Tuffc/src/main/tuff/selfhost/resolver.tuff").read_text(encoding="utf-8")
i = 0
line = 1
col = 1
stack = []
in_str = False
in_line = False
in_block = False
esc = False
while i < len(s):
    ch = s[i]
    if in_line:
        if ch == "\n":
            in_line = False
            line += 1
            col = 1
            i += 1
            continue
        i += 1
        col += 1
        continue
    if in_block:
        if ch == "*" and i + 1 < len(s) and s[i + 1] == "/":
            in_block = False
            i += 2
            col += 2
            continue
        if ch == "\n":
            line += 1
            col = 1
            i += 1
            continue
        i += 1
        col += 1
        continue
    if in_str:
        if esc:
            esc = False
        elif ch == "\\":
            esc = True
        elif ch == '"':
            in_str = False
        if ch == "\n":
            line += 1
            col = 1
            i += 1
            continue
        i += 1
        col += 1
        continue

    if ch == "/" and i + 1 < len(s) and s[i + 1] == "/":
        in_line = True
        i += 2
        col += 2
        continue
    if ch == "/" and i + 1 < len(s) and s[i + 1] == "*":
        in_block = True
        i += 2
        col += 2
        continue
    if ch == '"':
        in_str = True
        i += 1
        col += 1
        continue

    if ch == "{":
        stack.append((line, col))
    elif ch == "}":
        if stack:
            stack.pop()
        else:
            print("extra close at", line, col)

    if ch == "\n":
        line += 1
        col = 1
        i += 1
        continue
    i += 1
    col += 1

print("unmatched opens", len(stack))
print("last", stack[-1] if stack else None)
