"""Backfill ISSNs for existing articles that don't have one yet."""

import os
import ssl
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

import certifi
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())
DATABASE_URL = os.environ["DATABASE_URL"]

PUBMED_FETCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"


def fetch_issns(pmids: list[str]) -> dict[str, str]:
    """Fetch ISSNs from PubMed efetch for a batch of PMIDs."""
    if not pmids:
        return {}

    params = urllib.parse.urlencode({
        "db": "pubmed",
        "id": ",".join(pmids),
        "retmode": "xml",
    })

    url = f"{PUBMED_FETCH_URL}?{params}"
    with urllib.request.urlopen(url, context=SSL_CONTEXT) as response:
        root = ET.parse(response).getroot()

    results: dict[str, str] = {}
    for art in root.findall("PubmedArticle"):
        pmid = art.findtext("MedlineCitation/PMID", "")
        if not pmid:
            continue

        article_el = art.find("MedlineCitation/Article")
        if article_el is None:
            continue

        journal_el = article_el.find("Journal")
        if journal_el is None:
            continue

        issn = ""
        for issn_type in ("Electronic", "Print"):
            for issn_el in journal_el.findall("ISSN"):
                if issn_el.get("IssnType") == issn_type and issn_el.text:
                    issn = issn_el.text
                    break
            if issn:
                break

        if issn:
            results[pmid] = issn

    return results


def main():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    # Find articles without ISSN
    cur.execute(
        "SELECT pmid FROM articles WHERE (issn IS NULL OR issn = '') AND pmid != ''"
    )
    pmids = [r[0] for r in cur.fetchall()]

    if not pmids:
        print("All articles already have ISSNs.")
        cur.close()
        conn.close()
        return

    print(f"Found {len(pmids)} articles without ISSN. Fetching from PubMed...")

    # Process in batches of 100
    total_updated = 0
    for i in range(0, len(pmids), 100):
        batch = pmids[i : i + 100]
        print(f"  Batch {i // 100 + 1}: fetching {len(batch)} articles...")

        try:
            issn_map = fetch_issns(batch)
            for pmid, issn in issn_map.items():
                cur.execute(
                    "UPDATE articles SET issn = %s WHERE pmid = %s",
                    (issn, pmid),
                )
            conn.commit()
            total_updated += len(issn_map)
            print(f"    Updated {len(issn_map)} ISSNs.")
        except Exception as e:
            print(f"    Error: {e}")

    print(f"\nTotal: updated ISSN for {total_updated} of {len(pmids)} articles.")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
