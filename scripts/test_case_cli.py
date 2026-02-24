#!/usr/bin/env python3
"""
CLI interface to the Tuff compiler test case database.
Complements test_case_gui.py with a scriptable terminal interface.

Usage examples:
  python test_case_cli.py list
  python test_case_cli.py list "constraints:parameter-function-calls"
  python test_case_cli.py show 42
  python test_case_cli.py add "mycat" --source "fn f() : I32 => 0"
  python test_case_cli.py add "mycat" --fail --source "fn bad() : I32 => unknownVar"
  python test_case_cli.py delete 42
  python test_case_cli.py edit 42
"""

import argparse
import importlib.util
import os
import subprocess
import sys
import tempfile
import types
from pathlib import Path


# ---------------------------------------------------------------------------
# Headless import of TestCaseRepository from test_case_gui.py
# (avoids duplicating the schema/migration logic)
# ---------------------------------------------------------------------------

def _load_repository_class():
    script_dir = Path(__file__).parent
    gui_path = script_dir / "test_case_gui.py"

    # Stub tkinter so the GUI module loads without a display
    for mod_name in ("tkinter", "tkinter.ttk", "tkinter.messagebox", "tkinter.simpledialog"):
        if mod_name not in sys.modules:
            stub = types.ModuleType(mod_name)
            sys.modules[mod_name] = stub

    # Make tkinter.ttk accessible as an attribute of tkinter
    sys.modules["tkinter"].ttk = sys.modules["tkinter.ttk"]          # type: ignore[attr-defined]
    sys.modules["tkinter"].messagebox = sys.modules["tkinter.messagebox"]  # type: ignore[attr-defined]
    sys.modules["tkinter"].simpledialog = sys.modules["tkinter.simpledialog"]  # type: ignore[attr-defined]

    spec = importlib.util.spec_from_file_location("test_case_gui", gui_path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.TestCaseRepository


TestCaseRepository = _load_repository_class()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _default_db() -> Path:
    return Path(__file__).parent / "test_cases.db"


def _open_editor(initial: str = "") -> str:
    """Open $EDITOR (or notepad on Windows, nano elsewhere) and return saved content."""
    editor = os.environ.get("EDITOR") or (
        "notepad" if sys.platform == "win32" else "nano"
    )
    with tempfile.NamedTemporaryFile(
        suffix=".tuff", mode="w", delete=False, encoding="utf-8"
    ) as f:
        f.write(initial)
        tmp = f.name
    try:
        subprocess.run([editor, tmp], check=True)
        return Path(tmp).read_text(encoding="utf-8")
    finally:
        os.unlink(tmp)


def _flag(row) -> str:
    return " [FAIL]" if row["expects_compile_error"] else ""


def _preview(source: str, width: int = 72) -> str:
    one_line = source.strip().replace("\n", " \u21b5 ")
    return one_line[:width] + ("..." if len(one_line) > width else "")


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

def cmd_list(repo: TestCaseRepository, args) -> None:
    if args.category:
        cat_id = repo.get_category_id_by_name(args.category)
        if cat_id is None:
            print(f"error: category not found: {args.category!r}", file=sys.stderr)
            sys.exit(1)
        cases = repo.list_cases_for_category(cat_id)
        print(f"{args.category}  ({len(cases)} case(s))")
        for c in cases:
            print(f"  #{c['id']}{_flag(c)}  {_preview(c['source_code'])!r}")
    else:
        categories = repo.list_categories()
        if not categories:
            print("(no categories)")
            return
        for cat in categories:
            cases = repo.list_cases_for_category(cat["id"])
            print(f"  [{cat['id']}]  {cat['name']}  ({len(cases)} case(s))")


def cmd_show(repo: TestCaseRepository, args) -> None:
    case = repo.get_case(args.case_id)
    if case is None:
        print(f"error: case #{args.case_id} not found", file=sys.stderr)
        sys.exit(1)
    print(f"id:                    #{case['id']}")
    print(f"category:              {case['category_name']}")
    print(f"exit_code:             {case['exit_code']}")
    print(f"expects_compile_error: {case['expects_compile_error']}")
        print(f"execution_mode:        {case['execution_mode']}")
        print(f"backend:               {case['backend']}")
        print(f"target:                {case['target']}")
        print(f"compile_options_json:  {case['compile_options_json']}")
        print(f"entry_path:            {case['entry_path']}")
        print(f"expected_diag_code:    {case['expected_diagnostic_code']}")
        print(f"expected_runtime_json: {case['expected_runtime_json']}")
        print(f"expected_snapshot:     {('<set>' if case['expected_snapshot'] else '')}")
        print(f"skip_reason:           {case['skip_reason']}")
    print("source:")
    print("  " + case["source_code"].replace("\n", "\n  "))
        files = repo.list_case_files(case["id"])
        print(f"files:                 {len(files)}")
        for f in files:
            print(
                f"  - {f['file_path']} (role={f['role']}, sort={f['sort_order']}, bytes={len(f['source_code'])})"
            )


    def _parse_inline_file(value: str) -> tuple[str, str]:
        sep = "::"
        idx = value.find(sep)
        if idx <= 0:
            raise ValueError("inline file must be in format <path>::<source>")
        file_path = value[:idx].strip()
        source = value[idx + len(sep) :]
        if not file_path:
            raise ValueError("inline file path cannot be empty")
        return (file_path, source)


    def _collect_case_files(args) -> list[tuple[str, str, str, int]]:
        files: list[tuple[str, str, str, int]] = []
        sort = 0
        for file_spec in args.file_from_disk or []:
            relative = file_spec.strip().replace("\\", "/")
            if not relative:
                continue
            content = Path(relative).read_text(encoding="utf-8")
            files.append((relative, content, "module", sort))
            sort += 1

        for inline_spec in args.inline_file or []:
            rel, content = _parse_inline_file(inline_spec)
            files.append((rel.strip().replace("\\", "/"), content, "module", sort))
            sort += 1

        return files


def cmd_add(repo: TestCaseRepository, args) -> None:
    cat_id = repo.get_category_id_by_name(args.category)
    if cat_id is None:
        cat_id = repo.create_category(args.category)
        print(f"created category {args.category!r} (id={cat_id})")

    if args.source is not None:
        source = args.source.replace("\\n", "\n")
    else:
        print(f"opening editor for new case in {args.category!r} ...")
        source = _open_editor()

    source = source.strip()
    if not source:
        print("aborted -- empty source", file=sys.stderr)
        sys.exit(1)

    case_id = repo.create_case(
        category_id=cat_id,
        source_code=source,
        exit_code=args.exit_code,
        expects_compile_error=args.fail,
            execution_mode=args.execution_mode,
            backend=args.backend,
            target=args.target,
            compile_options_json=args.compile_options_json,
            entry_path=args.entry_path,
            expected_diagnostic_code=args.expected_diag_code,
            expected_runtime_json=args.expected_runtime_json,
            expected_snapshot=args.expected_snapshot,
            skip_reason=args.skip_reason,
    )
        files = _collect_case_files(args)
        if files:
            repo.replace_case_files(case_id, files)
    flag = "  [expects_compile_error]" if args.fail else ""
    print(f"added case #{case_id} to {args.category!r}{flag}")


def cmd_edit(repo: TestCaseRepository, args) -> None:
    case = repo.get_case(args.case_id)
    if case is None:
        print(f"error: case #{args.case_id} not found", file=sys.stderr)
        sys.exit(1)
    source = _open_editor(case["source_code"])
    source = source.strip()
    if not source:
        print("aborted -- empty source", file=sys.stderr)
        sys.exit(1)
    repo.update_case(
        case_id=args.case_id,
        category_id=case["category_id"],
        source_code=source,
        exit_code=case["exit_code"],
        expects_compile_error=bool(case["expects_compile_error"]),
            execution_mode=case["execution_mode"],
            backend=case["backend"],
            target=case["target"],
            compile_options_json=case["compile_options_json"],
            entry_path=case["entry_path"],
            expected_diagnostic_code=case["expected_diagnostic_code"],
            expected_runtime_json=case["expected_runtime_json"],
            expected_snapshot=case["expected_snapshot"],
            skip_reason=case["skip_reason"],
    )
    print(f"updated case #{args.case_id}")


def cmd_delete(repo: TestCaseRepository, args) -> None:
    case = repo.get_case(args.case_id)
    if case is None:
        print(f"error: case #{args.case_id} not found", file=sys.stderr)
        sys.exit(1)
    repo.delete_case(args.case_id)
    print(f"deleted case #{args.case_id}")


# ---------------------------------------------------------------------------
# Argument parsing + entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        prog="test_case_cli",
        description="Tuff compiler test case database CLI",
    )
    parser.add_argument(
        "--db", type=Path, default=None,
        help="Path to test_cases.db (default: scripts/test_cases.db)",
    )

    sub = parser.add_subparsers(dest="cmd", required=True)

    # list
    p_list = sub.add_parser("list", help="List categories or cases within a category")
    p_list.add_argument("category", nargs="?", help="Category name to filter by")

    # show
    p_show = sub.add_parser("show", help="Print source and metadata for a case")
    p_show.add_argument("case_id", type=int)

    # add
    p_add = sub.add_parser("add", help="Add a new test case")
    p_add.add_argument("category", help="Category name (created automatically if absent)")
    p_add.add_argument("--fail", action="store_true", help="Set expects_compile_error=1")
    p_add.add_argument("--exit-code", type=int, default=0, dest="exit_code",
                       help="Expected process exit code (default 0)")
    p_add.add_argument("--source", type=str, default=None,
                       help="Inline source code; use \\\\n for newlines. Omit to open $EDITOR.")
        p_add.add_argument(
            "--execution-mode",
            type=str,
            default="js-runtime",
            choices=["js-runtime", "compile-only"],
            help="How to execute this DB case",
        )
        p_add.add_argument(
            "--backend",
            type=str,
            default="selfhost",
            help="Compiler backend (default: selfhost)",
        )
        p_add.add_argument(
            "--target",
            type=str,
            default="js",
            help="Compiler target (default: js)",
        )
        p_add.add_argument(
            "--entry-path",
            type=str,
            default=None,
            help="Entry file path for multi-file test cases",
        )
        p_add.add_argument(
            "--compile-options-json",
            type=str,
            default="",
            help="Compiler options JSON merged into backend/target defaults",
        )
        p_add.add_argument(
            "--expected-diag-code",
            type=str,
            default=None,
            dest="expected_diag_code",
            help="Exact expected diagnostic code when compile fails",
        )
        p_add.add_argument(
            "--expected-runtime-json",
            type=str,
            default="",
            help="Expected runtime value encoded as JSON",
        )
        p_add.add_argument(
            "--expected-snapshot",
            type=str,
            default=None,
            help="Expected emitted output snapshot text",
        )
        p_add.add_argument(
            "--skip-reason",
            type=str,
            default=None,
            help="Optional known-gap skip reason",
        )
        p_add.add_argument(
            "--file-from-disk",
            action="append",
            default=[],
            help="Embed a module file from disk path (repeatable)",
        )
        p_add.add_argument(
            "--inline-file",
            action="append",
            default=[],
            help="Embed module file as '<path>::<source>' (repeatable)",
        )

    # edit
    p_edit = sub.add_parser("edit", help="Edit an existing test case source in $EDITOR")
    p_edit.add_argument("case_id", type=int)

    # delete
    p_del = sub.add_parser("delete", help="Delete a test case")
    p_del.add_argument("case_id", type=int)

    args = parser.parse_args()

    db_path = args.db or _default_db()
    repo = TestCaseRepository(db_path)

    try:
        if args.cmd == "list":    cmd_list(repo, args)
        elif args.cmd == "show":  cmd_show(repo, args)
        elif args.cmd == "add":   cmd_add(repo, args)
        elif args.cmd == "edit":  cmd_edit(repo, args)
        elif args.cmd == "delete": cmd_delete(repo, args)
    finally:
        repo.close()


if __name__ == "__main__":
    main()
