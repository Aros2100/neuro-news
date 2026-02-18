"""Test the updated enrichment prompts on 10 articles without saving to DB."""

import sqlite3
import json
from pathlib import Path

from dotenv import load_dotenv
import anthropic

load_dotenv(Path(__file__).parent / ".env")

DB_PATH = Path(__file__).parent / "articles.db"

# Import prompts from the real script
from enrich_articles import SYSTEM_PROMPT, USER_PROMPT_TEMPLATE, MODEL


def main():
    client = anthropic.Anthropic()
    conn = sqlite3.connect(DB_PATH)

    # Pick 10 articles with abstracts, spread across different types
    rows = conn.execute(
        "SELECT id, title, journal, abstract FROM articles "
        "WHERE abstract != '' ORDER BY RANDOM() LIMIT 10"
    ).fetchall()
    conn.close()

    print(f"Testing enrichment on {len(rows)} articles...\n")
    print("=" * 80)

    for i, (aid, title, journal, abstract) in enumerate(rows, 1):
        print(f"\n[{i}/10] ID={aid}")
        print(f"TITLE: {title[:100]}")
        print(f"JOURNAL: {journal}")
        print(f"ABSTRACT: {abstract[:200]}...")
        print()

        message = client.messages.create(
            model=MODEL,
            max_tokens=512,
            messages=[{
                "role": "user",
                "content": USER_PROMPT_TEMPLATE.format(
                    title=title, journal=journal, abstract=abstract,
                ),
            }],
            system=SYSTEM_PROMPT,
        )

        raw = message.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1]
            raw = raw.rsplit("```", 1)[0].strip()

        try:
            data = json.loads(raw)
            print(f"  summary:            {data['summary']}")
            print(f"  importance:         {data['importance']}")
            print(f"  news_value:         {data['news_value']}")
            print(f"  subspecialty:       {data['subspecialty']}")
            print(f"  article_type:       {data['article_type']}")
            print(f"  clinical_relevance: {data['clinical_relevance']}")
        except (json.JSONDecodeError, KeyError) as e:
            print(f"  ERROR: {e}")
            print(f"  RAW: {raw[:300]}")

        print("-" * 80)

    print("\nDone! Review the results above before running full enrichment.")


if __name__ == "__main__":
    main()
