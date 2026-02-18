"""One-time migration: copy data from local SQLite to Supabase PostgreSQL."""

import os
import sqlite3
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

DB_PATH = Path(__file__).parent / "articles.db"
DATABASE_URL = os.environ["DATABASE_URL"]


def migrate_articles(sqlite_conn, pg_conn):
    """Migrate all articles from SQLite to PostgreSQL."""
    cursor = sqlite_conn.execute("SELECT * FROM articles")
    columns = [desc[0] for desc in cursor.description]
    rows = cursor.fetchall()

    if not rows:
        print("No articles to migrate.")
        return

    # Build INSERT statement, excluding 'id' (let Postgres assign SERIAL)
    cols_no_id = [c for c in columns if c != "id"]
    placeholders = ", ".join(["%s"] * len(cols_no_id))
    col_names = ", ".join(cols_no_id)
    insert_sql = (
        f"INSERT INTO articles ({col_names}) VALUES ({placeholders}) "
        f"ON CONFLICT (url) DO NOTHING"
    )

    id_idx = columns.index("id")
    pg_cur = pg_conn.cursor()
    inserted = 0
    for row in rows:
        values = [row[columns.index(c)] for c in cols_no_id]
        pg_cur.execute(insert_sql, values)
        inserted += pg_cur.rowcount
    pg_conn.commit()
    pg_cur.close()

    print(f"Articles: {inserted} inserted out of {len(rows)} total ({len(rows) - inserted} skipped as duplicates).")


def migrate_journals(sqlite_conn, pg_conn):
    """Migrate all journals from SQLite to PostgreSQL."""
    try:
        cursor = sqlite_conn.execute("SELECT * FROM journals")
    except sqlite3.OperationalError:
        print("No journals table in SQLite. Skipping.")
        return

    columns = [desc[0] for desc in cursor.description]
    rows = cursor.fetchall()

    if not rows:
        print("No journals to migrate.")
        return

    cols_no_id = [c for c in columns if c != "id"]
    placeholders = ", ".join(["%s"] * len(cols_no_id))
    col_names = ", ".join(cols_no_id)
    insert_sql = (
        f"INSERT INTO journals ({col_names}) VALUES ({placeholders}) "
        f"ON CONFLICT (journal_name) DO NOTHING"
    )

    pg_cur = pg_conn.cursor()
    inserted = 0
    for row in rows:
        values = [row[columns.index(c)] for c in cols_no_id]
        pg_cur.execute(insert_sql, values)
        inserted += pg_cur.rowcount
    pg_conn.commit()
    pg_cur.close()

    print(f"Journals: {inserted} inserted out of {len(rows)} total.")


def verify(sqlite_conn, pg_conn):
    """Verify row counts match."""
    sqlite_articles = sqlite_conn.execute("SELECT COUNT(*) FROM articles").fetchone()[0]
    pg_cur = pg_conn.cursor()
    pg_cur.execute("SELECT COUNT(*) FROM articles")
    pg_articles = pg_cur.fetchone()[0]

    try:
        sqlite_journals = sqlite_conn.execute("SELECT COUNT(*) FROM journals").fetchone()[0]
    except sqlite3.OperationalError:
        sqlite_journals = 0
    pg_cur.execute("SELECT COUNT(*) FROM journals")
    pg_journals = pg_cur.fetchone()[0]
    pg_cur.close()

    print(f"\nVerification:")
    print(f"  Articles - SQLite: {sqlite_articles}, PostgreSQL: {pg_articles}")
    print(f"  Journals - SQLite: {sqlite_journals}, PostgreSQL: {pg_journals}")

    if sqlite_articles == pg_articles and sqlite_journals == pg_journals:
        print("  All counts match!")
    else:
        print("  WARNING: counts don't match (duplicates may have been skipped).")


def main():
    if not DB_PATH.exists():
        print(f"SQLite database not found at {DB_PATH}")
        return

    print(f"Connecting to SQLite: {DB_PATH}")
    sqlite_conn = sqlite3.connect(DB_PATH)

    print(f"Connecting to PostgreSQL...")
    pg_conn = psycopg2.connect(DATABASE_URL)

    migrate_articles(sqlite_conn, pg_conn)
    migrate_journals(sqlite_conn, pg_conn)
    verify(sqlite_conn, pg_conn)

    sqlite_conn.close()
    pg_conn.close()
    print("\nMigration complete!")


if __name__ == "__main__":
    main()
