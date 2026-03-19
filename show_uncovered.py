#!/usr/bin/env python3
"""
show_uncovered.py  –  Display uncovered code chunks from an llvm-cov JSON report.

Usage:
    py show_uncovered.py [cov-json] [source-file] [--context N]

Defaults:
    cov-json    cov-current.json
    source-file src/main.rs
    context     3  (lines of context above/below each chunk)
"""

import json
import pathlib
import sys
import itertools

CONTEXT = 3


def parse_args():
    args = sys.argv[1:]
    cov_path = pathlib.Path("cov-current.json")
    src_path = pathlib.Path("src/main.rs")
    context = CONTEXT
    positional = [a for a in args if not a.startswith("--")]
    if len(positional) >= 1:
        cov_path = pathlib.Path(positional[0])
    if len(positional) >= 2:
        src_path = pathlib.Path(positional[1])
    for a in args:
        if a.startswith("--context="):
            context = int(a.split("=", 1)[1])
        elif a == "--context" and args.index(a) + 1 < len(args):
            context = int(args[args.index(a) + 1])
    return cov_path, src_path, context


def collect_uncovered_lines(cov_path: pathlib.Path) -> set[int]:
    """Return set of 1-based line numbers that have zero-count coverage regions."""
    data = json.loads(cov_path.read_text(encoding="utf-8"))
    # Map: line -> max execution count across all regions touching that line
    line_count: dict[int, int] = {}
    for fn in data["data"][0]["functions"]:
        for region in fn["regions"]:
            start_line, _sc, end_line, _ec, count = (
                region[0],
                region[1],
                region[2],
                region[3],
                region[4],
            )
            # region type 0 = code region; skip expansion/skipped regions (type != 0)
            region_kind = region[5] if len(region) > 5 else 0
            if region_kind != 0:
                continue
            for ln in range(start_line, end_line + 1):
                if ln not in line_count or count > line_count[ln]:
                    line_count[ln] = count
    return {ln for ln, cnt in line_count.items() if cnt == 0}


def group_into_chunks(lines: set[int]) -> list[tuple[int, int]]:
    """Group a set of line numbers into contiguous (start, end) pairs."""
    if not lines:
        return []
    sorted_lines = sorted(lines)
    chunks = []
    start = prev = sorted_lines[0]
    for ln in sorted_lines[1:]:
        if ln == prev + 1:
            prev = ln
        else:
            chunks.append((start, prev))
            start = prev = ln
    chunks.append((start, prev))
    return chunks


def display_chunks(
    chunks: list[tuple[int, int]],
    source_lines: list[str],
    uncovered: set[int],
    context: int,
) -> None:
    total_lines = len(source_lines)
    printed_up_to = 0  # last line printed (1-based), to avoid re-printing context

    for chunk_start, chunk_end in chunks:
        view_start = max(1, chunk_start - context)
        view_end = min(total_lines, chunk_end + context)

        # Separator
        if view_start > printed_up_to + 1:
            print(f"\n{'─' * 60}")
        else:
            # Overlap — start right after what we already printed
            view_start = printed_up_to + 1

        if view_start > view_end:
            continue

        print(f"  Lines {chunk_start}–{chunk_end} NOT COVERED\n")

        for ln in range(view_start, view_end + 1):
            marker = "!!" if ln in uncovered else "  "
            text = source_lines[ln - 1].rstrip()
            print(f"{marker} {ln:4d}  {text}")

        printed_up_to = view_end

    if not chunks:
        print("All lines covered.")


def main() -> None:
    cov_path, src_path, context = parse_args()

    if not cov_path.exists():
        sys.exit(f"Coverage file not found: {cov_path}")
    if not src_path.exists():
        sys.exit(f"Source file not found: {src_path}")

    uncovered = collect_uncovered_lines(cov_path)
    source_lines = src_path.read_text(encoding="utf-8").splitlines()

    # Remove blank lines – they're never meaningful misses
    uncovered = {ln for ln in uncovered if source_lines[ln - 1].strip() != ""}

    chunks = group_into_chunks(uncovered)
    print(f"Uncovered chunks: {len(chunks)}   Uncovered lines: {len(uncovered)}")
    display_chunks(chunks, source_lines, uncovered, context)


if __name__ == "__main__":
    main()
