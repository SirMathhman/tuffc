import sqlite3
import tkinter as tk
from pathlib import Path
from tkinter import messagebox, simpledialog, ttk


DB_FILENAME = "test_cases.db"
CASE_PREVIEW_LENGTH = 80


def _ensure_json_string(value: str | None) -> str:
    return value if value is not None else ""


class TestCaseRepository:
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA foreign_keys = ON;")
        self._init_schema()

    def _init_schema(self) -> None:
        self.conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE
            );

            CREATE TABLE IF NOT EXISTS test_cases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category_id INTEGER NOT NULL,
                source_code TEXT NOT NULL,
                exit_code INTEGER NOT NULL,
                expects_compile_error INTEGER NOT NULL DEFAULT 0,
                execution_mode TEXT NOT NULL DEFAULT 'js-runtime',
                backend TEXT NOT NULL DEFAULT 'selfhost',
                target TEXT NOT NULL DEFAULT 'js',
                compile_options_json TEXT NOT NULL DEFAULT '',
                entry_path TEXT,
                expected_diagnostic_code TEXT,
                expected_runtime_json TEXT,
                expected_snapshot TEXT,
                skip_reason TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS test_case_files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                case_id INTEGER NOT NULL,
                file_path TEXT NOT NULL,
                source_code TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'module',
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (case_id) REFERENCES test_cases(id) ON DELETE CASCADE,
                UNIQUE (case_id, file_path)
            );

            CREATE TRIGGER IF NOT EXISTS trg_test_case_files_updated
            AFTER UPDATE ON test_case_files
            FOR EACH ROW
            BEGIN
                UPDATE test_case_files
                SET updated_at = CURRENT_TIMESTAMP
                WHERE id = NEW.id;
            END;

            CREATE TRIGGER IF NOT EXISTS trg_test_cases_updated
            AFTER UPDATE ON test_cases
            FOR EACH ROW
            BEGIN
                UPDATE test_cases
                SET updated_at = CURRENT_TIMESTAMP
                WHERE id = NEW.id;
            END;
            """
        )

        # Lightweight migration for existing DBs created before
        # expects_compile_error support.
        existing_columns = {
            row["name"]
            for row in self.conn.execute("PRAGMA table_info(test_cases);").fetchall()
        }
        if "expects_compile_error" not in existing_columns:
            self.conn.execute(
                "ALTER TABLE test_cases ADD COLUMN expects_compile_error INTEGER NOT NULL DEFAULT 0"
            )

        added_columns: list[tuple[str, str]] = [
            ("execution_mode", "TEXT NOT NULL DEFAULT 'js-runtime'"),
            ("backend", "TEXT NOT NULL DEFAULT 'selfhost'"),
            ("target", "TEXT NOT NULL DEFAULT 'js'"),
            ("compile_options_json", "TEXT NOT NULL DEFAULT ''"),
            ("entry_path", "TEXT"),
            ("expected_diagnostic_code", "TEXT"),
            ("expected_runtime_json", "TEXT"),
            ("expected_snapshot", "TEXT"),
            ("skip_reason", "TEXT"),
        ]
        for column_name, column_sql in added_columns:
            if column_name not in existing_columns:
                self.conn.execute(
                    f"ALTER TABLE test_cases ADD COLUMN {column_name} {column_sql}"
                )

        self.conn.commit()

    def close(self) -> None:
        self.conn.close()

    def list_categories(self) -> list[sqlite3.Row]:
        cur = self.conn.execute(
            "SELECT id, name FROM categories ORDER BY name COLLATE NOCASE;"
        )
        return list(cur.fetchall())

    def create_category(self, name: str) -> int:
        cur = self.conn.execute(
            "INSERT INTO categories(name) VALUES (?)", (name.strip(),)
        )
        self.conn.commit()
        return int(cur.lastrowid)

    def delete_category(self, category_id: int) -> None:
        self.conn.execute("DELETE FROM categories WHERE id = ?", (category_id,))
        self.conn.commit()

    def get_category_id_by_name(self, name: str) -> int | None:
        cur = self.conn.execute("SELECT id FROM categories WHERE name = ?", (name,))
        row = cur.fetchone()
        return int(row["id"]) if row else None

    def list_cases_for_category(self, category_id: int) -> list[sqlite3.Row]:
        cur = self.conn.execute(
            """
            SELECT id,
                   source_code,
                   exit_code,
                   expects_compile_error,
                   execution_mode,
                   backend,
                   target,
                   compile_options_json,
                   entry_path,
                   expected_diagnostic_code,
                   expected_runtime_json,
                   expected_snapshot,
                   skip_reason
            FROM test_cases
            WHERE category_id = ?
            ORDER BY id ASC;
            """,
            (category_id,),
        )
        return list(cur.fetchall())

    def get_case(self, case_id: int) -> sqlite3.Row | None:
        cur = self.conn.execute(
            """
            SELECT tc.id,
                   tc.source_code,
                   tc.exit_code,
                     tc.expects_compile_error,
                     tc.execution_mode,
                     tc.backend,
                     tc.target,
                       tc.compile_options_json,
                     tc.entry_path,
                     tc.expected_diagnostic_code,
                     tc.expected_runtime_json,
                     tc.expected_snapshot,
                     tc.skip_reason,
                   c.id AS category_id,
                   c.name AS category_name
            FROM test_cases tc
            JOIN categories c ON c.id = tc.category_id
            WHERE tc.id = ?;
            """,
            (case_id,),
        )
        return cur.fetchone()

    def create_case(
        self,
        category_id: int,
        source_code: str,
        exit_code: int,
        expects_compile_error: bool,
        execution_mode: str = "js-runtime",
        backend: str = "selfhost",
        target: str = "js",
        compile_options_json: str = "",
        entry_path: str | None = None,
        expected_diagnostic_code: str | None = None,
        expected_runtime_json: str | None = None,
        expected_snapshot: str | None = None,
        skip_reason: str | None = None,
    ) -> int:
        cur = self.conn.execute(
            """
            INSERT INTO test_cases(
                category_id,
                source_code,
                exit_code,
                expects_compile_error,
                execution_mode,
                backend,
                target,
                compile_options_json,
                entry_path,
                expected_diagnostic_code,
                expected_runtime_json,
                expected_snapshot,
                skip_reason
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """,
            (
                category_id,
                source_code,
                exit_code,
                1 if expects_compile_error else 0,
                execution_mode,
                backend,
                target,
                _ensure_json_string(compile_options_json),
                entry_path,
                expected_diagnostic_code,
                _ensure_json_string(expected_runtime_json),
                expected_snapshot,
                skip_reason,
            ),
        )
        self.conn.commit()
        return int(cur.lastrowid)

    def update_case(
        self,
        case_id: int,
        category_id: int,
        source_code: str,
        exit_code: int,
        expects_compile_error: bool,
        execution_mode: str = "js-runtime",
        backend: str = "selfhost",
        target: str = "js",
        compile_options_json: str = "",
        entry_path: str | None = None,
        expected_diagnostic_code: str | None = None,
        expected_runtime_json: str | None = None,
        expected_snapshot: str | None = None,
        skip_reason: str | None = None,
    ) -> None:
        self.conn.execute(
            """
            UPDATE test_cases
            SET category_id = ?,
                source_code = ?,
                exit_code = ?,
                expects_compile_error = ?,
                execution_mode = ?,
                backend = ?,
                target = ?,
                compile_options_json = ?,
                entry_path = ?,
                expected_diagnostic_code = ?,
                expected_runtime_json = ?,
                expected_snapshot = ?,
                skip_reason = ?
            WHERE id = ?;
            """,
            (
                category_id,
                source_code,
                exit_code,
                1 if expects_compile_error else 0,
                execution_mode,
                backend,
                target,
                _ensure_json_string(compile_options_json),
                entry_path,
                expected_diagnostic_code,
                _ensure_json_string(expected_runtime_json),
                expected_snapshot,
                skip_reason,
                case_id,
            ),
        )
        self.conn.commit()

    def list_case_files(self, case_id: int) -> list[sqlite3.Row]:
        cur = self.conn.execute(
            """
            SELECT id, case_id, file_path, source_code, role, sort_order
            FROM test_case_files
            WHERE case_id = ?
            ORDER BY sort_order ASC, id ASC;
            """,
            (case_id,),
        )
        return list(cur.fetchall())

    def replace_case_files(
        self, case_id: int, files: list[tuple[str, str, str, int]]
    ) -> None:
        self.conn.execute("DELETE FROM test_case_files WHERE case_id = ?", (case_id,))
        for file_path, source_code, role, sort_order in files:
            self.conn.execute(
                """
                INSERT INTO test_case_files(case_id, file_path, source_code, role, sort_order)
                VALUES (?, ?, ?, ?, ?)
                """,
                (case_id, file_path, source_code, role, sort_order),
            )
        self.conn.commit()

    def delete_case(self, case_id: int) -> None:
        self.conn.execute("DELETE FROM test_cases WHERE id = ?", (case_id,))
        self.conn.commit()


class TestCaseManagerApp:
    def __init__(self, root: tk.Tk, repo: TestCaseRepository):
        self.root = root
        self.repo = repo
        self.selected_case_id: int | None = None
        self.pending_category_id: int | None = None
        self.file_tabs: dict[ttk.Frame, dict[str, object]] = {}

        root.title("Tuff Compiler Test Case Manager")
        root.geometry("1200x700")
        root.minsize(900, 560)

        self._build_ui()
        self._bind_events()
        self.refresh_all()

    def _build_ui(self) -> None:
        paned = ttk.Panedwindow(self.root, orient=tk.HORIZONTAL)
        paned.pack(fill=tk.BOTH, expand=True)

        left = ttk.Frame(paned, padding=8)
        right = ttk.Frame(paned, padding=10)
        paned.add(left, weight=1)
        paned.add(right, weight=2)

        ttk.Label(left, text="Test Explorer", font=("Segoe UI", 11, "bold")).pack(
            anchor="w"
        )

        self.tree = ttk.Treeview(left, show="tree", selectmode="browse")
        yscroll = ttk.Scrollbar(left, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=yscroll.set)
        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, pady=(8, 0))
        yscroll.pack(side=tk.RIGHT, fill=tk.Y, pady=(8, 0))

        form = ttk.Frame(right)
        form.pack(fill=tk.BOTH, expand=True)

        ttk.Label(form, text="Category", font=("Segoe UI", 10, "bold")).grid(
            row=0, column=0, sticky="w"
        )
        self.category_var = tk.StringVar()
        self.category_combo = ttk.Combobox(
            form, textvariable=self.category_var, state="readonly"
        )
        self.category_combo.grid(row=1, column=0, sticky="ew", pady=(2, 10))

        ttk.Label(form, text="Exit code", font=("Segoe UI", 10, "bold")).grid(
            row=0, column=1, sticky="w", padx=(12, 0)
        )
        self.exit_code_var = tk.StringVar(value="0")
        self.exit_code_entry = ttk.Entry(
            form, textvariable=self.exit_code_var, width=16
        )
        self.exit_code_entry.grid(
            row=1, column=1, sticky="w", padx=(12, 0), pady=(2, 10)
        )

        self.expects_compile_error_var = tk.BooleanVar(value=False)
        self.compile_error_check = ttk.Checkbutton(
            form,
            text="Expected: compilation error (no exit code)",
            variable=self.expects_compile_error_var,
            command=self.on_expected_compile_error_toggle,
        )
        self.compile_error_check.grid(row=2, column=1, sticky="w", padx=(12, 0))

        ttk.Label(form, text="Execution mode", font=("Segoe UI", 10, "bold")).grid(
            row=2, column=0, sticky="w"
        )
        self.execution_mode_var = tk.StringVar(value="js-runtime")
        self.execution_mode_combo = ttk.Combobox(
            form,
            textvariable=self.execution_mode_var,
            state="readonly",
            values=["js-runtime", "compile-only"],
            width=24,
        )
        self.execution_mode_combo.grid(row=3, column=0, sticky="w", pady=(2, 10))

        ttk.Label(
            form, text="Entry path (multi-file)", font=("Segoe UI", 10, "bold")
        ).grid(row=3, column=1, sticky="w", padx=(12, 0))
        self.entry_path_var = tk.StringVar(value="")
        self.entry_path_entry = ttk.Entry(
            form, textvariable=self.entry_path_var, width=36
        )
        self.entry_path_entry.grid(
            row=4, column=1, sticky="w", padx=(12, 0), pady=(2, 10)
        )

        ttk.Label(
            form,
            text="Source files (tab per file)",
            font=("Segoe UI", 10, "bold"),
        ).grid(row=5, column=0, columnspan=2, sticky="w")

        files_actions = ttk.Frame(form)
        files_actions.grid(row=5, column=1, sticky="e")
        self.add_file_btn = ttk.Button(
            files_actions, text="+ Add file", command=self.add_file_tab
        )
        self.remove_file_btn = ttk.Button(
            files_actions,
            text="- Remove selected",
            command=self.remove_selected_file_tab,
        )
        self.use_entry_btn = ttk.Button(
            files_actions,
            text="Use selected as entry",
            command=self.use_selected_tab_as_entry,
        )
        self.add_file_btn.pack(side=tk.LEFT)
        self.remove_file_btn.pack(side=tk.LEFT, padx=(8, 0))
        self.use_entry_btn.pack(side=tk.LEFT, padx=(8, 0))

        files_frame = ttk.Frame(form)
        files_frame.grid(row=6, column=0, columnspan=2, sticky="nsew", pady=(4, 10))

        self.files_notebook = ttk.Notebook(files_frame)
        self.files_notebook.grid(row=0, column=0, sticky="nsew")

        files_frame.rowconfigure(0, weight=1)
        files_frame.columnconfigure(0, weight=1)

        actions = ttk.Frame(form)
        actions.grid(row=7, column=0, columnspan=2, sticky="ew")

        self.new_btn = ttk.Button(actions, text="New", command=self.clear_form)
        self.create_btn = ttk.Button(actions, text="Create", command=self.create_case)
        self.update_btn = ttk.Button(actions, text="Update", command=self.update_case)
        self.delete_btn = ttk.Button(actions, text="Delete", command=self.delete_case)

        self.new_btn.pack(side=tk.LEFT)
        self.create_btn.pack(side=tk.LEFT, padx=(8, 0))
        self.update_btn.pack(side=tk.LEFT, padx=(8, 0))
        self.delete_btn.pack(side=tk.LEFT, padx=(8, 0))

        self.status_var = tk.StringVar(value="Ready")
        ttk.Label(form, textvariable=self.status_var, foreground="#2d6a4f").grid(
            row=8, column=0, columnspan=2, sticky="w", pady=(10, 0)
        )

        form.columnconfigure(0, weight=1)
        form.columnconfigure(1, weight=0)
        form.rowconfigure(6, weight=1)

        self.blank_menu = tk.Menu(self.root, tearoff=False)
        self.blank_menu.add_command(
            label="Create Category", command=self.prompt_create_category
        )
        self.blank_menu.add_command(label="New Test Case", command=self.clear_form)

        self.category_menu = tk.Menu(self.root, tearoff=False)
        self.category_menu.add_command(
            label="Create Test Case in Category",
            command=self.new_case_under_selected_category,
        )
        self.category_menu.add_command(
            label="Create Category", command=self.prompt_create_category
        )
        self.category_menu.add_separator()
        self.category_menu.add_command(
            label="Delete Category (and all test cases)",
            command=self.delete_selected_category,
        )

        self.case_menu = tk.Menu(self.root, tearoff=False)
        self.case_menu.add_command(
            label="Delete Test Case", command=self.delete_selected_case_from_tree
        )

    def _bind_events(self) -> None:
        self.tree.bind("<<TreeviewSelect>>", self.on_tree_select)
        self.tree.bind("<Button-3>", self.on_tree_right_click)
        self.root.protocol("WM_DELETE_WINDOW", self.on_close)

    def refresh_all(self) -> None:
        categories = self.repo.list_categories()
        cat_names = [c["name"] for c in categories]
        self.category_combo["values"] = cat_names

        if not cat_names:
            self.category_var.set("")
        elif self.category_var.get() not in cat_names:
            self.category_var.set(cat_names[0])

        self.tree.delete(*self.tree.get_children())

        for category in categories:
            cat_id = int(category["id"])
            cat_node = self.tree.insert(
                "", tk.END, iid=f"cat:{cat_id}", text=category["name"], open=True
            )
            for case in self.repo.list_cases_for_category(cat_id):
                case_id = int(case["id"])
                preview = self._source_preview(case["source_code"])
                self.tree.insert(cat_node, tk.END, iid=f"case:{case_id}", text=preview)

        self._set_action_button_states()

    @staticmethod
    def _source_preview(source_code: str) -> str:
        line = " ".join(source_code.splitlines()).strip()
        if not line:
            return "(empty source)"
        if len(line) > CASE_PREVIEW_LENGTH:
            return f"{line[:CASE_PREVIEW_LENGTH - 1]}…"
        return line

    def _set_action_button_states(self) -> None:
        if self.selected_case_id is None:
            self.update_btn.state(["disabled"])
            self.delete_btn.state(["disabled"])
        else:
            self.update_btn.state(["!disabled"])
            self.delete_btn.state(["!disabled"])

    def _sync_file_tab_title(self, frame: ttk.Frame) -> None:
        meta = self.file_tabs.get(frame)
        if meta is None:
            return
        path_value = str(meta["path_var"].get()).strip().replace("\\", "/")
        self.files_notebook.tab(frame, text=path_value if path_value else "(new file)")

    def _add_file_tab_internal(
        self,
        file_path: str = "",
        source_code: str = "",
        role: str = "module",
    ) -> ttk.Frame:
        tab = ttk.Frame(self.files_notebook)
        self.files_notebook.add(tab, text=file_path if file_path else "(new file)")

        path_var = tk.StringVar(value=file_path)
        role_var = tk.StringVar(value=role if role in ("entry", "module") else "module")

        top = ttk.Frame(tab)
        top.pack(fill=tk.X, padx=6, pady=(6, 4))
        ttk.Label(top, text="File path").pack(side=tk.LEFT)
        path_entry = ttk.Entry(top, textvariable=path_var, width=50)
        path_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(8, 8))
        ttk.Label(top, text="Role").pack(side=tk.LEFT)
        role_combo = ttk.Combobox(
            top,
            textvariable=role_var,
            state="readonly",
            values=["entry", "module"],
            width=10,
        )
        role_combo.pack(side=tk.LEFT)

        editor_frame = ttk.Frame(tab)
        editor_frame.pack(fill=tk.BOTH, expand=True, padx=6, pady=(0, 6))
        text = tk.Text(editor_frame, wrap="none", undo=True, font=("Consolas", 10))
        yscroll = ttk.Scrollbar(editor_frame, orient="vertical", command=text.yview)
        xscroll = ttk.Scrollbar(editor_frame, orient="horizontal", command=text.xview)
        text.configure(yscrollcommand=yscroll.set, xscrollcommand=xscroll.set)
        text.grid(row=0, column=0, sticky="nsew")
        yscroll.grid(row=0, column=1, sticky="ns")
        xscroll.grid(row=1, column=0, sticky="ew")
        editor_frame.rowconfigure(0, weight=1)
        editor_frame.columnconfigure(0, weight=1)

        if source_code:
            text.insert("1.0", source_code)
        text.bind("<Control-Return>", self.on_source_ctrl_enter_create)

        self.file_tabs[tab] = {
            "path_var": path_var,
            "role_var": role_var,
            "text": text,
        }
        path_var.trace_add("write", lambda *_: self._sync_file_tab_title(tab))
        self._sync_file_tab_title(tab)
        self.files_notebook.select(tab)
        return tab

    def _clear_file_tabs(self) -> None:
        for tab_id in list(self.files_notebook.tabs()):
            self.files_notebook.forget(tab_id)
        self.file_tabs.clear()

    def add_file_tab(self) -> None:
        self._add_file_tab_internal(file_path="main.tuff")

    def remove_selected_file_tab(self) -> None:
        selected = self.files_notebook.select()
        if not selected:
            return
        tab = self.root.nametowidget(selected)
        if not isinstance(tab, ttk.Frame):
            return
        self.files_notebook.forget(tab)
        self.file_tabs.pop(tab, None)

    def use_selected_tab_as_entry(self) -> None:
        selected = self.files_notebook.select()
        if not selected:
            return
        tab = self.root.nametowidget(selected)
        meta = self.file_tabs.get(tab)
        if meta is None:
            return
        path_value = str(meta["path_var"].get()).strip().replace("\\", "/")
        if path_value:
            self.entry_path_var.set(path_value)

    def _collect_files_from_tabs(self) -> list[tuple[str, str, str, int]] | None:
        files: list[tuple[str, str, str, int]] = []
        seen: set[str] = set()
        for idx, tab_id in enumerate(self.files_notebook.tabs()):
            tab = self.root.nametowidget(tab_id)
            meta = self.file_tabs.get(tab)
            if meta is None:
                continue
            path_value = str(meta["path_var"].get()).strip().replace("\\", "/")
            if path_value == "":
                messagebox.showwarning(
                    "Invalid embedded files",
                    f"File tab #{idx + 1} is missing a file path.",
                )
                return None
            if path_value in seen:
                messagebox.showwarning(
                    "Invalid embedded files",
                    f"Duplicate embedded file path: {path_value}",
                )
                return None
            seen.add(path_value)

            source_code = str(meta["text"].get("1.0", tk.END).rstrip("\n"))
            role_value = str(meta["role_var"].get() or "module")
            files.append((path_value, source_code, role_value, idx))

        return files

    @staticmethod
    def _derive_primary_source_from_files(
        files: list[tuple[str, str, str, int]],
        entry_path: str | None,
    ) -> str:
        if len(files) == 0:
            return ""
        if entry_path is not None:
            for file_path, source_code, _role, _sort in files:
                if file_path == entry_path:
                    return source_code
        return files[0][1]

    def _load_file_tabs_from_case(self, case_id: int) -> None:
        self._clear_file_tabs()
        case_files = self.repo.list_case_files(case_id)
        for row in case_files:
            self._add_file_tab_internal(
                file_path=str(row["file_path"]),
                source_code=str(row["source_code"]),
                role=str(row["role"]),
            )
        if len(case_files) == 0:
            case = self.repo.get_case(case_id)
            fallback_path = "main.tuff"
            if case is not None and case["entry_path"]:
                fallback_path = str(case["entry_path"])
            fallback_source = str(case["source_code"] if case is not None else "")
            self._add_file_tab_internal(
                file_path=fallback_path,
                source_code=fallback_source,
                role="entry",
            )

    def _get_form_data(
        self,
    ) -> tuple[int, str, int, bool, str, str | None, list[tuple[str, str, str, int]]] | None:
        category_name = self.category_var.get().strip()
        exit_code_raw = self.exit_code_var.get().strip()
        expects_compile_error = self.expects_compile_error_var.get()
        execution_mode = self.execution_mode_var.get().strip() or "js-runtime"
        entry_path_raw = self.entry_path_var.get().strip().replace("\\", "/")

        files = self._collect_files_from_tabs()
        if files is None:
            return None

        if not category_name:
            messagebox.showwarning(
                "Missing category", "Pick a category from the dropdown."
            )
            return None

        category_id = self.repo.get_category_id_by_name(category_name)
        if category_id is None:
            messagebox.showerror(
                "Unknown category", "Selected category does not exist."
            )
            return None

        if len(files) == 0:
            messagebox.showwarning(
                "Missing files",
                "Add at least one source file tab for the test case.",
            )
            return None

        if len(files) > 0 and entry_path_raw == "":
            entry_path_raw = files[0][0]

        if len(files) > 0 and not any(f[0] == entry_path_raw for f in files):
            messagebox.showwarning(
                "Invalid entry path",
                "Entry path must match one of the embedded file paths.",
            )
            return None

        if expects_compile_error:
            # Stored but ignored by runner logic when compile-error mode is expected.
            exit_code = 0
        else:
            try:
                exit_code = int(exit_code_raw)
            except ValueError:
                messagebox.showwarning(
                    "Invalid exit code", "Exit code must be an integer."
                )
                return None

        entry_path = entry_path_raw if entry_path_raw != "" else None
        source_code = self._derive_primary_source_from_files(files, entry_path)

        return (
            category_id,
            source_code,
            exit_code,
            expects_compile_error,
            execution_mode,
            entry_path,
            files,
        )

    def on_expected_compile_error_toggle(self) -> None:
        if self.expects_compile_error_var.get():
            self.exit_code_entry.state(["disabled"])
        else:
            self.exit_code_entry.state(["!disabled"])

    def on_source_ctrl_enter_create(self, _event: tk.Event) -> str:
        self.create_case()
        return "break"

    def clear_form(self) -> None:
        self.selected_case_id = None
        self._clear_file_tabs()
        self._add_file_tab_internal(file_path="main.tuff", role="entry")
        self.exit_code_var.set("0")
        self.expects_compile_error_var.set(False)
        self.execution_mode_var.set("js-runtime")
        self.entry_path_var.set("")
        self.on_expected_compile_error_toggle()

        if self.pending_category_id is not None:
            categories = self.repo.list_categories()
            for category in categories:
                if int(category["id"]) == self.pending_category_id:
                    self.category_var.set(category["name"])
                    break
            self.pending_category_id = None

        self.status_var.set("Ready for a new test case")
        self._set_action_button_states()

    def on_tree_select(self, _event: tk.Event) -> None:
        selected = self.tree.selection()
        if not selected:
            return

        iid = selected[0]
        if iid.startswith("case:"):
            case_id = int(iid.split(":", 1)[1])
            self.load_case(case_id)
        else:
            self.selected_case_id = None
            self._set_action_button_states()

    def load_case(self, case_id: int) -> None:
        case = self.repo.get_case(case_id)
        if case is None:
            self.status_var.set("Could not load test case; it may have been deleted")
            return

        self.selected_case_id = int(case["id"])
        self.category_var.set(case["category_name"])
        self.exit_code_var.set(str(case["exit_code"]))
        self.expects_compile_error_var.set(bool(case["expects_compile_error"]))
        self.execution_mode_var.set(case["execution_mode"])
        self.entry_path_var.set(case["entry_path"] or "")
        self.on_expected_compile_error_toggle()
        self._load_file_tabs_from_case(case_id)
        self.status_var.set(f"Loaded test case #{self.selected_case_id}")
        self._set_action_button_states()

    def create_case(self) -> None:
        form_data = self._get_form_data()
        if form_data is None:
            return

        (
            category_id,
            source_code,
            exit_code,
            expects_compile_error,
            execution_mode,
            entry_path,
            files,
        ) = form_data
        new_id = self.repo.create_case(
            category_id,
            source_code,
            exit_code,
            expects_compile_error,
            execution_mode=execution_mode,
            entry_path=entry_path,
        )
        self.repo.replace_case_files(new_id, files)
        self.refresh_all()
        self._select_tree_item(f"case:{new_id}")
        self.status_var.set(f"Created test case #{new_id}")

    def update_case(self) -> None:
        if self.selected_case_id is None:
            messagebox.showinfo("No selection", "Select a test case first.")
            return

        form_data = self._get_form_data()
        if form_data is None:
            return

        (
            category_id,
            source_code,
            exit_code,
            expects_compile_error,
            execution_mode,
            entry_path,
            files,
        ) = form_data
        self.repo.update_case(
            self.selected_case_id,
            category_id,
            source_code,
            exit_code,
            expects_compile_error,
            execution_mode=execution_mode,
            entry_path=entry_path,
        )
        self.repo.replace_case_files(self.selected_case_id, files)
        updated_id = self.selected_case_id
        self.refresh_all()
        self._select_tree_item(f"case:{updated_id}")
        self.status_var.set(f"Updated test case #{updated_id}")

    def delete_case(self) -> None:
        if self.selected_case_id is None:
            messagebox.showinfo("No selection", "Select a test case first.")
            return

        if not messagebox.askyesno(
            "Delete test case", f"Delete test case #{self.selected_case_id}?"
        ):
            return

        deleted_id = self.selected_case_id
        self.repo.delete_case(deleted_id)
        self.selected_case_id = None
        self.refresh_all()
        self.clear_form()
        self.status_var.set(f"Deleted test case #{deleted_id}")

    def _select_tree_item(self, iid: str) -> None:
        if not self.tree.exists(iid):
            return

        parent = self.tree.parent(iid)
        while parent:
            self.tree.item(parent, open=True)
            parent = self.tree.parent(parent)

        self.tree.selection_set(iid)
        self.tree.focus(iid)
        self.tree.see(iid)

    def on_tree_right_click(self, event: tk.Event) -> None:
        row_id = self.tree.identify_row(event.y)
        if row_id:
            self.tree.selection_set(row_id)
            self.tree.focus(row_id)

            if row_id.startswith("case:"):
                self.case_menu.tk_popup(event.x_root, event.y_root)
            elif row_id.startswith("cat:"):
                self.category_menu.tk_popup(event.x_root, event.y_root)
            else:
                self.blank_menu.tk_popup(event.x_root, event.y_root)
        else:
            self.blank_menu.tk_popup(event.x_root, event.y_root)

    def prompt_create_category(self) -> None:
        name = simpledialog.askstring(
            "Create Category", "Category name:", parent=self.root
        )
        if name is None:
            return

        clean_name = name.strip()
        if not clean_name:
            messagebox.showwarning("Invalid name", "Category name cannot be empty.")
            return

        try:
            self.repo.create_category(clean_name)
        except sqlite3.IntegrityError:
            messagebox.showwarning(
                "Duplicate category", f"Category '{clean_name}' already exists."
            )
            return

        self.refresh_all()
        self.category_var.set(clean_name)
        cat_id = self.repo.get_category_id_by_name(clean_name)
        if cat_id is not None:
            self._select_tree_item(f"cat:{cat_id}")
        self.status_var.set(f"Created category '{clean_name}'")

    def _selected_category_id(self) -> int | None:
        selected = self.tree.selection()
        if not selected:
            return None
        iid = selected[0]
        if iid.startswith("cat:"):
            return int(iid.split(":", 1)[1])
        if iid.startswith("case:"):
            case = self.repo.get_case(int(iid.split(":", 1)[1]))
            return int(case["category_id"]) if case else None
        return None

    def new_case_under_selected_category(self) -> None:
        category_id = self._selected_category_id()
        if category_id is None:
            messagebox.showinfo("No category", "Select a category first.")
            return

        self.pending_category_id = category_id
        self.clear_form()
        selected = self.files_notebook.select()
        if selected:
            tab = self.root.nametowidget(selected)
            meta = self.file_tabs.get(tab)
            if meta is not None:
                meta["text"].focus_set()
        self.status_var.set("Ready to create a new test case in selected category")

    def delete_selected_case_from_tree(self) -> None:
        selected = self.tree.selection()
        if not selected:
            return
        iid = selected[0]
        if not iid.startswith("case:"):
            return

        case_id = int(iid.split(":", 1)[1])
        if not messagebox.askyesno("Delete test case", f"Delete test case #{case_id}?"):
            return

        self.repo.delete_case(case_id)
        if self.selected_case_id == case_id:
            self.clear_form()
        self.refresh_all()
        self.status_var.set(f"Deleted test case #{case_id}")

    def delete_selected_category(self) -> None:
        category_id = self._selected_category_id()
        if category_id is None:
            messagebox.showinfo("No category", "Select a category first.")
            return

        category_name = None
        for c in self.repo.list_categories():
            if int(c["id"]) == category_id:
                category_name = c["name"]
                break

        if category_name is None:
            return

        confirm = messagebox.askyesno(
            "Delete category",
            f"Delete category '{category_name}' and all of its test cases?",
        )
        if not confirm:
            return

        self.repo.delete_category(category_id)
        self.refresh_all()

        current_category_name = self.category_var.get().strip()
        if current_category_name == category_name:
            self.clear_form()

        self.status_var.set(f"Deleted category '{category_name}'")

    def on_close(self) -> None:
        self.repo.close()
        self.root.destroy()


def main() -> None:
    script_dir = Path(__file__).resolve().parent
    db_path = script_dir / DB_FILENAME

    root = tk.Tk()
    repo = TestCaseRepository(db_path)

    app = TestCaseManagerApp(root, repo)
    # Keep a reference so static analyzers don't complain about app being unused.
    _ = app

    root.mainloop()


if __name__ == "__main__":
    main()
