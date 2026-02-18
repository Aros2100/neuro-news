"""Fetch recent neurosurgery articles from PubMed."""

import os
import urllib.request
import urllib.parse
import json
import ssl
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from pathlib import Path

import certifi
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())
DATABASE_URL = os.environ["DATABASE_URL"]

PUBMED_SEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
PUBMED_FETCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"


def search_pubmed(query: str, days: int = 7, max_results: int = 20) -> list[str]:
    """Search PubMed and return a list of article IDs."""
    min_date = (datetime.now() - timedelta(days=days)).strftime("%Y/%m/%d")
    max_date = datetime.now().strftime("%Y/%m/%d")

    params = urllib.parse.urlencode({
        "db": "pubmed",
        "term": query,
        "retmax": max_results,
        "datetype": "edat",
        "mindate": min_date,
        "maxdate": max_date,
        "retmode": "json",
    })

    url = f"{PUBMED_SEARCH_URL}?{params}"
    with urllib.request.urlopen(url, context=SSL_CONTEXT) as response:
        data = json.loads(response.read())

    return data.get("esearchresult", {}).get("idlist", [])


def fetch_articles(article_ids: list[str]) -> list[dict]:
    """Fetch full article details from PubMed via efetch XML."""
    if not article_ids:
        return []

    params = urllib.parse.urlencode({
        "db": "pubmed",
        "id": ",".join(article_ids),
        "retmode": "xml",
    })

    url = f"{PUBMED_FETCH_URL}?{params}"
    with urllib.request.urlopen(url, context=SSL_CONTEXT) as response:
        root = ET.parse(response).getroot()

    articles = []
    for art in root.findall("PubmedArticle"):
        citation = art.find("MedlineCitation")
        article_el = citation.find("Article")

        # PMID
        pmid = citation.findtext("PMID", "")

        # Title
        title = article_el.findtext("ArticleTitle", "N/A")

        # Authors - short display (3 + et al.)
        author_list_el = article_el.find("AuthorList")
        authors_short = ""
        authors_full = ""
        first_affiliation = ""
        if author_list_el is not None:
            names = []
            for author in author_list_el.findall("Author"):
                last = author.findtext("LastName", "")
                fore = author.findtext("ForeName", "")
                initials = author.findtext("Initials", "")
                if last:
                    names.append(f"{last} {initials}".strip())
                    # First author affiliation
                    if not first_affiliation:
                        aff_el = author.find("AffiliationInfo/Affiliation")
                        if aff_el is not None and aff_el.text:
                            first_affiliation = aff_el.text

            authors_full = ", ".join(names)
            if len(names) > 3:
                authors_short = ", ".join(names[:3]) + " et al."
            else:
                authors_short = ", ".join(names)

        # Journal
        journal = article_el.findtext("Journal/Title", "N/A")

        # ISSN (prefer Electronic, fallback Print)
        issn = ""
        journal_el = article_el.find("Journal")
        if journal_el is not None:
            for issn_type in ("Electronic", "Print"):
                for issn_el in journal_el.findall("ISSN"):
                    if issn_el.get("IssnType") == issn_type and issn_el.text:
                        issn = issn_el.text
                        break
                if issn:
                    break

        # Publication date
        pub_date_el = article_el.find("Journal/JournalIssue/PubDate")
        if pub_date_el is not None:
            year = pub_date_el.findtext("Year", "")
            month = pub_date_el.findtext("Month", "")
            day = pub_date_el.findtext("Day", "")
            pub_date = " ".join(part for part in [year, month, day] if part)
            if not pub_date:
                pub_date = pub_date_el.findtext("MedlineDate", "N/A")
        else:
            pub_date = "N/A"

        # DOI
        doi = ""
        for eid in article_el.findall("ELocationID"):
            if eid.get("EIdType") == "doi" and eid.text:
                doi = eid.text
                break
        # Fallback: check ArticleIdList in PubmedData
        if not doi:
            pubmed_data = art.find("PubmedData")
            if pubmed_data is not None:
                for aid in pubmed_data.findall("ArticleIdList/ArticleId"):
                    if aid.get("IdType") == "doi" and aid.text:
                        doi = aid.text
                        break

        # Publication types
        pub_types = []
        pub_type_list = article_el.find("PublicationTypeList")
        if pub_type_list is not None:
            for pt in pub_type_list.findall("PublicationType"):
                if pt.text and pt.text != "Journal Article":
                    pub_types.append(pt.text)
        pub_types_str = ", ".join(pub_types)

        # MeSH terms (up to 10)
        mesh_list = citation.find("MeshHeadingList")
        mesh_terms = []
        if mesh_list is not None:
            for heading in mesh_list.findall("MeshHeading"):
                descriptor = heading.find("DescriptorName")
                if descriptor is not None and descriptor.text:
                    major = descriptor.get("MajorTopicYN", "N")
                    mesh_terms.append(("*" + descriptor.text) if major == "Y" else descriptor.text)
        # Put major topics first, then limit to 10
        mesh_terms.sort(key=lambda x: (not x.startswith("*"), x))
        mesh_terms_str = ", ".join(mesh_terms[:10])

        # Grant information
        grant_list_el = citation.find(".//GrantList")
        grants = []
        if grant_list_el is not None:
            for grant in grant_list_el.findall("Grant"):
                agency = grant.findtext("Agency", "")
                grant_id = grant.findtext("GrantID", "")
                if agency and agency not in grants:
                    grants.append(agency)
        grants_str = ", ".join(grants) if grants else "Unknown"

        # Conflict of interest statement
        coi_statement = citation.findtext("CoiStatement", "") or "Unknown"

        # Open access: check for PMC ID (indicates freely available via PubMed Central)
        pmc_id = ""
        pubmed_data = art.find("PubmedData")
        if pubmed_data is not None:
            for aid in pubmed_data.findall("ArticleIdList/ArticleId"):
                if aid.get("IdType") == "pmc" and aid.text:
                    pmc_id = aid.text
                    break
        is_open_access = 1 if pmc_id else 0

        # Abstract
        abstract_el = article_el.find("Abstract")
        abstract = ""
        if abstract_el is not None:
            parts = []
            for text_el in abstract_el.findall("AbstractText"):
                label = text_el.get("Label", "")
                text = "".join(text_el.itertext())
                if label:
                    parts.append(f"{label}: {text}")
                else:
                    parts.append(text)
            abstract = "\n\n".join(parts)

        articles.append({
            "pmid": pmid,
            "title": title,
            "authors": authors_short,
            "authors_full": authors_full,
            "journal": journal,
            "pub_date": pub_date,
            "abstract": abstract,
            "doi": doi,
            "pub_types": pub_types_str,
            "mesh_terms": mesh_terms_str,
            "affiliation": first_affiliation,
            "grants": grants_str,
            "coi_statement": coi_statement,
            "is_open_access": is_open_access,
            "pmc_id": pmc_id,
            "issn": issn,
            "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
        })

    return articles


def fetch_citation_counts(pmids: list[str]) -> dict[str, int]:
    """Fetch citation counts from Europe PMC for a list of PMIDs."""
    counts: dict[str, int] = {}
    # Europe PMC search API supports querying multiple PMIDs
    # Process in batches of 50
    for i in range(0, len(pmids), 50):
        batch = pmids[i : i + 50]
        query = " OR ".join(f"EXT_ID:{pmid}" for pmid in batch)
        params = urllib.parse.urlencode({
            "query": query,
            "format": "json",
            "resultType": "core",
            "pageSize": len(batch),
        })
        url = f"https://www.ebi.ac.uk/europepmc/webservices/rest/search?{params}"
        try:
            with urllib.request.urlopen(url, context=SSL_CONTEXT) as response:
                data = json.loads(response.read())
            for result in data.get("resultList", {}).get("result", []):
                pmid = result.get("pmid", "")
                cited = result.get("citedByCount", 0)
                if pmid:
                    counts[pmid] = cited
        except Exception as e:
            print(f"  Warning: Europe PMC batch failed: {e}")
    return counts


def save_articles(conn, articles: list[dict]) -> int:
    """Insert articles into the database, skipping duplicates."""
    cur = conn.cursor()
    new_count = 0
    for a in articles:
        cur.execute(
            "INSERT INTO articles "
            "(pmid, title, authors, authors_full, journal, pub_date, abstract, doi, pub_types, mesh_terms, affiliation, citation_count, grants, coi_statement, is_open_access, pmc_id, issn, url) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) "
            "ON CONFLICT (url) DO NOTHING",
            (
                a["pmid"], a["title"], a["authors"], a["authors_full"], a["journal"],
                a["pub_date"], a["abstract"], a["doi"], a["pub_types"],
                a["mesh_terms"], a["affiliation"], a.get("citation_count", 0),
                a.get("grants", ""), a.get("coi_statement", ""),
                a.get("is_open_access", 0), a.get("pmc_id", ""),
                a.get("issn", ""), a["url"],
            ),
        )
        new_count += cur.rowcount
    conn.commit()
    cur.close()
    return new_count


QUERY = '"Neurosurgery"[MeSH] OR "Neurosurgical Procedures"[MeSH]'


def main():
    print("Fetching neurosurgery articles from the last 30 days...")

    article_ids = search_pubmed(QUERY, days=30, max_results=200)
    print(f"Found {len(article_ids)} articles on PubMed.")

    if not article_ids:
        print("No articles found.")
        return

    articles = fetch_articles(article_ids)

    # Fetch citation counts from Europe PMC
    pmids = [a["pmid"] for a in articles if a["pmid"]]
    print(f"Fetching citation counts for {len(pmids)} articles...")
    citation_counts = fetch_citation_counts(pmids)
    for a in articles:
        a["citation_count"] = citation_counts.get(a["pmid"], 0)
    cited = sum(1 for a in articles if a["citation_count"] > 0)
    print(f"Found citations for {cited} articles.")

    conn = psycopg2.connect(DATABASE_URL)
    new_count = save_articles(conn, articles)

    # Sync cached IFs from journals table to new articles
    cur = conn.cursor()
    cur.execute("""
        UPDATE articles SET impact_factor = (
            SELECT j.impact_factor FROM journals j
            WHERE j.journal_name = articles.journal AND j.impact_factor IS NOT NULL
        )
        WHERE impact_factor IS NULL
          AND journal IN (SELECT journal_name FROM journals WHERE impact_factor IS NOT NULL)
    """)
    conn.commit()

    cur.execute("SELECT COUNT(*) FROM articles")
    total = cur.fetchone()[0]
    cur.close()
    conn.close()

    print(f"Saved {new_count} new articles ({len(articles) - new_count} duplicates skipped).")
    print(f"Total articles in database: {total}")


if __name__ == "__main__":
    main()
