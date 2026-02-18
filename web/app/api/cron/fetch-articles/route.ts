import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  searchPubMed,
  fetchArticles,
  fetchCitationCounts,
  type PubMedArticle,
} from "@/lib/pubmed";
import { lookupByIssn, searchByName, extractIF } from "@/lib/openalex";

export const maxDuration = 60;

const QUERY = '"Neurosurgery"[MeSH] OR "Neurosurgical Procedures"[MeSH]';

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

  const log: string[] = [];

  try {
    // 1. Search PubMed
    const pmids = await searchPubMed(QUERY, 7, 200);
    log.push(`Found ${pmids.length} articles on PubMed`);
    if (pmids.length === 0) {
      return NextResponse.json({ ok: true, log });
    }

    // 2. Fetch full article XML
    const articles = await fetchArticles(pmids);
    log.push(`Parsed ${articles.length} articles`);

    // 3. Citation counts
    const articlePmids = articles.map((a) => a.pmid).filter(Boolean);
    const citations = await fetchCitationCounts(articlePmids);
    for (const a of articles) {
      a.citation_count = citations[a.pmid] ?? 0;
    }
    const cited = articles.filter((a) => a.citation_count > 0).length;
    log.push(`Citations found for ${cited} articles`);

    // 4. Upsert articles to Supabase
    // Supabase upsert with onConflict on `url`
    const rows = articles.map((a: PubMedArticle) => ({
      pmid: a.pmid,
      title: a.title,
      authors: a.authors,
      authors_full: a.authors_full,
      journal: a.journal,
      pub_date: a.pub_date,
      abstract: a.abstract,
      doi: a.doi,
      pub_types: a.pub_types,
      mesh_terms: a.mesh_terms,
      affiliation: a.affiliation,
      citation_count: a.citation_count,
      grants: a.grants,
      coi_statement: a.coi_statement,
      is_open_access: a.is_open_access,
      pmc_id: a.pmc_id,
      issn: a.issn,
      url: a.url,
    }));

    const { error: upsertError } = await supabase
      .from("articles")
      .upsert(rows, { onConflict: "url", ignoreDuplicates: true });

    if (upsertError) {
      log.push(`Upsert error: ${upsertError.message}`);
      return NextResponse.json({ ok: false, log }, { status: 500 });
    }
    log.push(`Upserted ${rows.length} articles`);

    // 5. Sync journals table
    // Get distinct (journal, issn) from articles
    const { data: journalPairs } = await supabase
      .from("articles")
      .select("journal, issn")
      .neq("journal", "");

    const uniqueJournals = new Map<string, string>();
    for (const row of journalPairs ?? []) {
      if (!uniqueJournals.has(row.journal) || (row.issn && !uniqueJournals.get(row.journal))) {
        uniqueJournals.set(row.journal, row.issn ?? "");
      }
    }

    for (const [journalName, issn] of uniqueJournals) {
      await supabase
        .from("journals")
        .upsert(
          { journal_name: journalName, issn: issn || undefined },
          { onConflict: "journal_name", ignoreDuplicates: false }
        );
    }
    log.push(`Synced ${uniqueJournals.size} journals`);

    // Update ISSN where journals table is missing it
    const { data: missingIssn } = await supabase
      .from("journals")
      .select("id, journal_name")
      .or("issn.is.null,issn.eq.");

    for (const j of missingIssn ?? []) {
      const { data: artWithIssn } = await supabase
        .from("articles")
        .select("issn")
        .eq("journal", j.journal_name)
        .neq("issn", "")
        .limit(1)
        .single();

      if (artWithIssn?.issn) {
        await supabase
          .from("journals")
          .update({ issn: artWithIssn.issn })
          .eq("id", j.id);
      }
    }

    // 6. Fetch impact factors from OpenAlex for journals without one
    const { data: journalsNoIF } = await supabase
      .from("journals")
      .select("id, journal_name, issn, openalex_id")
      .is("impact_factor", null);

    let ifUpdated = 0;
    for (const j of journalsNoIF ?? []) {
      let source: Record<string, unknown> | null = null;

      if (j.issn) {
        source = await lookupByIssn(j.issn);
      }
      if (!source) {
        source = await searchByName(j.journal_name);
      }

      if (source) {
        const impactFactor = extractIF(source);
        const oaId = (source.id as string) ?? "";
        await supabase
          .from("journals")
          .update({
            impact_factor: impactFactor,
            openalex_id: oaId,
            if_updated_at: new Date().toISOString(),
          })
          .eq("id", j.id);
        if (impactFactor != null) ifUpdated++;
      }
    }
    log.push(`Updated IF for ${ifUpdated} journals`);

    // 7. Denormalize IFs to articles table
    const { data: journalsWithIF } = await supabase
      .from("journals")
      .select("journal_name, impact_factor")
      .not("impact_factor", "is", null);

    let ifDenorm = 0;
    for (const j of journalsWithIF ?? []) {
      const { data: updated } = await supabase
        .from("articles")
        .update({ impact_factor: j.impact_factor })
        .eq("journal", j.journal_name)
        .is("impact_factor", null)
        .select("id");
      ifDenorm += updated?.length ?? 0;
    }
    log.push(`Denormalized IF to ${ifDenorm} articles`);

    return NextResponse.json({ ok: true, log });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.push(`Error: ${msg}`);
    return NextResponse.json({ ok: false, log }, { status: 500 });
  }
}
