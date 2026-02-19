import sqlite3
import tkinter as tk
from pathlib import Path
from tkinter import messagebox, simpledialog, ttk


DB_FILENAME = "test_cases.db"
CASE_PREVIEW_LENGTH = 80


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
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
            );

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
            SELECT id, source_code, exit_code, expects_compile_error
            FROM test_cases
            WHERE category_id = ?
            ORDER BY id DESC;
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
    ) -> int:
        cur = self.conn.execute(
            """
            INSERT INTO test_cases(category_id, source_code, exit_code, expects_compile_error)
            VALUES (?, ?, ?, ?);
            """,
            (category_id, source_code, exit_code, 1 if expects_compile_error else 0),
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
    ) -> None:
        self.conn.execute(
            """
            UPDATE test_cases
            SET category_id = ?, source_code = ?, exit_code = ?, expects_compile_error = ?
            WHERE id = ?;
            """,
            (
                category_id,
                source_code,
                exit_code,
                1 if expects_compile_error else 0,
                case_id,
            ),
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

        ttk.Label(form, text="Source code", font=("Segoe UI", 10, "bold")).grid(
            row=3, column=0, columnspan=2, sticky="w"
        )

        editor_frame = ttk.Frame(form)
        editor_frame.grid(row=4, column=0, columnspan=2, sticky="nsew", pady=(4, 10))

        self.source_text = tk.Text(
            editor_frame, wrap="none", undo=True, font=("Consolas", 10)
        )
        src_yscroll = ttk.Scrollbar(
            editor_frame, orient="vertical", command=self.source_text.yview
        )
        src_xscroll = ttk.Scrollbar(
            editor_frame, orient="horizontal", command=self.source_text.xview
        )
        self.source_text.configure(
            yscrollcommand=src_yscroll.set, xscrollcommand=src_xscroll.set
        )

        self.source_text.grid(row=0, column=0, sticky="nsew")
        src_yscroll.grid(row=0, column=1, sticky="ns")
        src_xscroll.grid(row=1, column=0, sticky="ew")

        editor_frame.rowconfigure(0, weight=1)
        editor_frame.columnconfigure(0, weight=1)

        actions = ttk.Frame(form)
        actions.grid(row=5, column=0, columnspan=2, sticky="ew")

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
            row=6, column=0, columnspan=2, sticky="w", pady=(10, 0)
        )

        form.columnconfigure(0, weight=1)
        form.columnconfigure(1, weight=0)
        form.rowconfigure(4, weight=1)

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
        self.source_text.bind("<Control-Return>", self.on_source_ctrl_enter_create)
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

    def _get_form_data(self) -> tuple[int, str, int, bool] | None:
        category_name = self.category_var.get().strip()
        source_code = self.source_text.get("1.0", tk.END).rstrip("\n")
        exit_code_raw = self.exit_code_var.get().strip()
        expects_compile_error = self.expects_compile_error_var.get()

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

        if source_code == "":
            messagebox.showwarning(
                "Missing source", "Please provide source code for the test case."
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

        return category_id, source_code, exit_code, expects_compile_error

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
        self.source_text.delete("1.0", tk.END)
        self.exit_code_var.set("0")
        self.expects_compile_error_var.set(False)
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
        self.on_expected_compile_error_toggle()
        self.source_text.delete("1.0", tk.END)
        self.source_text.insert("1.0", case["source_code"])
        self.status_var.set(f"Loaded test case #{self.selected_case_id}")
        self._set_action_button_states()

    def create_case(self) -> None:
        form_data = self._get_form_data()
        if form_data is None:
            return

        category_id, source_code, exit_code, expects_compile_error = form_data
        new_id = self.repo.create_case(
            category_id, source_code, exit_code, expects_compile_error
        )
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

        category_id, source_code, exit_code, expects_compile_error = form_data
        self.repo.update_case(
            self.selected_case_id,
            category_id,
            source_code,
            exit_code,
            expects_compile_error,
        )
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
        self.source_text.focus_set()
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
