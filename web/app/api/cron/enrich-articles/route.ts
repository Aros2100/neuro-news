import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `You are analyzing a scientific article. You must ONLY use information that is explicitly stated \
in the title and abstract provided.

CRITICAL RULES:
- If information is not explicitly mentioned, respond with 'Unknown'
- Do NOT infer, assume, or extrapolate beyond what is written
- Do NOT use your general medical knowledge to fill in gaps
- Do NOT make educated guesses
- For categories, if unclear choose the most conservative option
- For each field, if you cannot determine the answer with 100% confidence from the text provided, \
mark it as 'Unknown' or 'Not specified'

Always respond with valid JSON and nothing else.`;

function userPrompt(title: string, journal: string, abstract: string): string {
  return `Analyze ONLY the title and abstract below. Do not use any outside knowledge.

Title: ${title}
Journal: ${journal}
Abstract: ${abstract}

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
{"summary": "...", "importance": "...", "news_value": N, "subspecialty": "...", "article_type": "...", "clinical_relevance": "..."}`;
}

interface EnrichmentData {
  summary: string;
  importance: string;
  news_value: number;
  subspecialty: string;
  article_type: string;
  clinical_relevance: string;
}

function authorize(request: Request): boolean {
  const header = request.headers.get("authorization");
  return header === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
  });

  const log: string[] = [];

  try {
    // Fetch up to 10 unenriched articles
    const { data: articles, error: queryError } = await supabase
      .from("articles")
      .select("id, title, journal, abstract")
      .eq("summary", "")
      .neq("abstract", "")
      .order("id", { ascending: true })
      .limit(10);

    if (queryError) {
      return NextResponse.json(
        { ok: false, error: queryError.message },
        { status: 500 }
      );
    }

    if (!articles || articles.length === 0) {
      return NextResponse.json({ ok: true, enriched: 0, log: ["No articles to enrich"] });
    }

    log.push(`Found ${articles.length} articles to enrich`);

    let enriched = 0;
    for (const article of articles) {
      try {
        const message = await anthropic.messages.create({
          model: MODEL,
          max_tokens: 512,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: userPrompt(article.title, article.journal, article.abstract),
            },
          ],
        });

        let raw =
          message.content[0].type === "text" ? message.content[0].text.trim() : "";

        // Strip markdown code fences if present
        if (raw.startsWith("```")) {
          raw = raw.split("\n").slice(1).join("\n");
          raw = raw.replace(/```\s*$/, "").trim();
        }

        const data: EnrichmentData = JSON.parse(raw);

        const { error: updateError } = await supabase
          .from("articles")
          .update({
            summary: data.summary,
            importance: data.importance,
            news_value: Math.round(data.news_value),
            subspecialty: data.subspecialty,
            article_type: data.article_type,
            clinical_relevance: data.clinical_relevance,
          })
          .eq("id", article.id);

        if (updateError) {
          log.push(`Update error for article ${article.id}: ${updateError.message}`);
        } else {
          enriched++;
          log.push(
            `[${enriched}] ${article.title.slice(0, 60)}... -> ${data.subspecialty} | NV:${data.news_value}`
          );
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        log.push(`Error enriching article ${article.id}: ${msg}`);
      }
    }

    return NextResponse.json({ ok: true, enriched, log });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
