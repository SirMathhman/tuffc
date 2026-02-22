import sqlite3

con = sqlite3.connect("test_cases.db")
cur = con.cursor()

tables = cur.execute(
    "select name from sqlite_master where type='table' order by name"
).fetchall()
print("TABLES", tables)
for (t,) in tables:
    print(f"\n{t}")
    print("COLS", cur.execute(f"pragma table_info({t})").fetchall())
    rows = cur.execute(f"select * from {t}").fetchall()
    print("ROWS", rows[:50])
