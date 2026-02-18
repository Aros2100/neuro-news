"""Enrich articles with AI-generated summaries using Claude API."""

import os
import json
from pathlib import Path

import psycopg2
from dotenv import load_dotenv
import anthropic

load_dotenv(Path(__file__).parent / ".env")

DATABASE_URL = os.environ["DATABASE_URL"]
MODEL = "claude-haiku-4-5-20251001"

SYSTEM_PROMPT = """\
You are analyzing a scientific article. You must ONLY use information that is explicitly stated \
in the title and abstract provided.

CRITICAL RULES:
- If information is not explicitly mentioned, respond with 'Unknown'
- Do NOT infer, assume, or extrapolate beyond what is written
- Do NOT use your general medical knowledge to fill in gaps
- Do NOT make educated guesses
- For categories, if unclear choose the most conservative option
- For each field, if you cannot determine the answer with 100% confidence from the text provided, \
mark it as 'Unknown' or 'Not specified'

Always respond with valid JSON and nothing else."""

USER_PROMPT_TEMPLATE = """\
Analyze ONLY the title and abstract below. Do not use any outside knowledge.

Title: {title}
Journal: {journal}
Abstract: {abstract}

Based STRICTLY on the text above, generate the following in English:

1. "summary": A short summary (2-3 sentences) using ONLY facts stated in the abstract. \
Do not add context or background not present in the text.
2. "importance": Why is this important based on what the authors explicitly state? \
(1-2 sentences). If the abstract does not state importance, write "Not specified in abstract".
3. "news_value": A score from 1-10 (integer). ONLY score highly (7+) if the abstract \
explicitly reports significant/novel results. If the abstract is vague or results are unclear, \
score conservatively (1-4). 10 = abstract explicitly describes paradigm-shifting results; \
1 = routine/incremental or unclear findings.
4. "subspecialty": Choose exactly one from: "Oncology", "Vascular", "Spine", "Functional", \
"Trauma", "Pediatric", "Skull base", "General". Choose "General" if the subspecialty is not \
clearly identifiable from the title and abstract.
5. "article_type": Choose exactly one from: "Clinical trial", "Case report", "Review", \
"Technical note", "Outcomes study", "Basic research". Choose based on what the abstract \
explicitly describes (e.g. "randomized trial", "case series", "systematic review"). \
If unclear, choose "Outcomes study" as default.
6. "clinical_relevance": Choose exactly one from: "Practice-changing", "Important update", \
"Background knowledge", "Research only". Use "Practice-changing" ONLY if the abstract \
explicitly states results that would change clinical practice. Default to "Background knowledge" \
if uncertain.

Respond ONLY with JSON in this exact format:
{{"summary": "...", "importance": "...", "news_value": N, "subspecialty": "...", "article_type": "...", "clinical_relevance": "..."}}"""


def get_unenriched_articles(conn) -> list[dict]:
    """Get articles that haven't been enriched yet."""
    cur = conn.cursor()
    cur.execute(
        "SELECT id, title, journal, abstract FROM articles "
        "WHERE summary = '' AND abstract != '' "
        "ORDER BY id"
    )
    rows = cur.fetchall()
    cur.close()
    return [
        {"id": r[0], "title": r[1], "journal": r[2], "abstract": r[3]}
        for r in rows
    ]


def enrich_article(client: anthropic.Anthropic, article: dict) -> dict:
    """Call Claude to generate enrichment data."""
    message = client.messages.create(
        model=MODEL,
        max_tokens=512,
        messages=[{
            "role": "user",
            "content": USER_PROMPT_TEMPLATE.format(
                title=article["title"],
                journal=article["journal"],
                abstract=article["abstract"],
            ),
        }],
        system=SYSTEM_PROMPT,
    )

    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1]
        raw = raw.rsplit("```", 1)[0]
        raw = raw.strip()
    return json.loads(raw)


def save_enrichment(conn, article_id: int, data: dict):
    """Save enrichment data to the database."""
    cur = conn.cursor()
    cur.execute(
        "UPDATE articles SET summary=%s, importance=%s, news_value=%s, "
        "subspecialty=%s, article_type=%s, clinical_relevance=%s WHERE id=%s",
        (
            data["summary"],
            data["importance"],
            int(data["news_value"]),
            data["subspecialty"],
            data["article_type"],
            data["clinical_relevance"],
            article_id,
        ),
    )
    conn.commit()
    cur.close()


def main():
    client = anthropic.Anthropic()
    conn = psycopg2.connect(DATABASE_URL)

    # Reset all to force re-enrichment
    cur = conn.cursor()
    cur.execute(
        "UPDATE articles SET summary='', importance='', news_value=0, "
        "subspecialty='', article_type='', clinical_relevance=''"
    )
    conn.commit()
    cur.close()

    articles = get_unenriched_articles(conn)
    print(f"Found {len(articles)} articles to enrich.")

    if not articles:
        print("Nothing to do.")
        conn.close()
        return

    for i, article in enumerate(articles, 1):
        print(f"[{i}/{len(articles)}] {article['title'][:70]}...")
        try:
            data = enrich_article(client, article)
            save_enrichment(conn, article["id"], data)
            print(f"  -> {data['subspecialty']} | {data['article_type']} | {data['clinical_relevance']} | NV:{data['news_value']}")
        except (json.JSONDecodeError, KeyError) as e:
            print(f"  -> ERROR: {e}")
        except anthropic.APIError as e:
            print(f"  -> API ERROR: {e}")

    conn.close()
    print("\nDone!")


if __name__ == "__main__":
    main()
