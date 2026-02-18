"""Fetch journal Impact Factors from OpenAlex and denormalize to articles."""

import json
import os
import ssl
import time
import urllib.parse
import urllib.request
from pathlib import Path

import certifi
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())
DATABASE_URL = os.environ["DATABASE_URL"]

OPENALEX_BASE = "https://api.openalex.org"


def openalex_get(url: str) -> dict | None:
    """Make a GET request to OpenAlex with polite rate limiting."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "neuro-news/1.0 (mailto:noreply@example.com)"})
        with urllib.request.urlopen(req, context=SSL_CONTEXT) as response:
            return json.loads(response.read())
    except Exception as e:
        print(f"  Warning: OpenAlex request failed: {e}")
        return None


def lookup_by_issn(issn: str) -> dict | None:
    """Look up a journal in OpenAlex by ISSN."""
    url = f"{OPENALEX_BASE}/sources/issn:{issn}"
    return openalex_get(url)


def search_by_name(name: str) -> dict | None:
    """Search for a journal in OpenAlex by name."""
    params = urllib.parse.urlencode({"search": name})
    url = f"{OPENALEX_BASE}/sources?{params}"
    data = openalex_get(url)
    if data and data.get("results"):
        return data["results"][0]
    return None


def extract_if(source: dict) -> float | None:
    """Extract 2yr_mean_citedness from OpenAlex source data."""
    stats = source.get("summary_stats", {})
    value = stats.get("2yr_mean_citedness")
    if value is not None and value > 0:
        return round(value, 2)
    return None


def main():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    # Step 1: Upsert unique (journal, issn) pairs from articles into journals table
    cur.execute("""
        INSERT INTO journals (journal_name, issn)
        SELECT DISTINCT journal, issn FROM articles WHERE journal != ''
        ON CONFLICT (journal_name) DO NOTHING
    """)
    # Update ISSN in journals table if articles have it but journals don't
    cur.execute("""
        UPDATE journals SET issn = (
            SELECT a.issn FROM articles a
            WHERE a.journal = journals.journal_name AND a.issn != ''
            LIMIT 1
        )
        WHERE issn = '' AND journal_name IN (
            SELECT journal FROM articles WHERE issn != ''
        )
    """)
    conn.commit()

    # Step 2: Fetch IFs for journals without one
    cur.execute(
        "SELECT id, journal_name, issn, openalex_id FROM journals WHERE impact_factor IS NULL"
    )
    journals = cur.fetchall()

    print(f"Found {len(journals)} journals without Impact Factor.")

    updated = 0
    for jid, name, issn, openalex_id in journals:
        source = None

        # Try ISSN lookup first
        if issn:
            source = lookup_by_issn(issn)
            time.sleep(0.1)

        # Fallback to name search
        if not source:
            source = search_by_name(name)
            time.sleep(0.1)

        if source:
            impact_factor = extract_if(source)
            oa_id = source.get("id", "")
            cur.execute(
                "UPDATE journals SET impact_factor = %s, openalex_id = %s, if_updated_at = NOW() WHERE id = %s",
                (impact_factor, oa_id, jid),
            )
            conn.commit()
            if impact_factor is not None:
                updated += 1
                print(f"  {name}: IF = {impact_factor}")
            else:
                print(f"  {name}: no IF data in OpenAlex")
        else:
            print(f"  {name}: not found in OpenAlex")

    print(f"\nUpdated IF for {updated} of {len(journals)} journals.")

    # Step 3: Denormalize IFs to articles table
    cur.execute("""
        UPDATE articles SET impact_factor = (
            SELECT j.impact_factor FROM journals j
            WHERE j.journal_name = articles.journal AND j.impact_factor IS NOT NULL
        )
        WHERE journal IN (SELECT journal_name FROM journals WHERE impact_factor IS NOT NULL)
    """)
    affected = cur.rowcount
    conn.commit()
    print(f"Denormalized IF to {affected} articles.")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
