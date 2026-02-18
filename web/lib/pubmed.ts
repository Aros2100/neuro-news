/**
 * PubMed utility functions — ported from fetch_articles.py
 */

import { XMLParser } from "fast-xml-parser";

const PUBMED_SEARCH_URL =
  "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
const PUBMED_FETCH_URL =
  "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi";

export interface PubMedArticle {
  pmid: string;
  title: string;
  authors: string;
  authors_full: string;
  journal: string;
  pub_date: string;
  abstract: string;
  doi: string;
  pub_types: string;
  mesh_terms: string;
  affiliation: string;
  grants: string;
  coi_statement: string;
  is_open_access: number;
  pmc_id: string;
  issn: string;
  url: string;
  citation_count: number;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export async function searchPubMed(
  query: string,
  days: number = 7,
  maxResults: number = 200
): Promise<string[]> {
  const now = new Date();
  const minDate = new Date(now.getTime() - days * 86_400_000);
  const fmt = (d: Date) =>
    `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;

  const params = new URLSearchParams({
    db: "pubmed",
    term: query,
    retmax: String(maxResults),
    datetype: "edat",
    mindate: fmt(minDate),
    maxdate: fmt(now),
    retmode: "json",
  });

  const res = await fetch(`${PUBMED_SEARCH_URL}?${params}`);
  const data = await res.json();
  return data?.esearchresult?.idlist ?? [];
}

// ---------------------------------------------------------------------------
// Fetch & parse XML
// ---------------------------------------------------------------------------

/** Helper: always returns an array regardless of XML cardinality. */
function asArray<T>(val: T | T[] | undefined | null): T[] {
  if (val == null) return [];
  return Array.isArray(val) ? val : [val];
}

/** Recursively collect all text from a node that fast-xml-parser produced. */
function collectText(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(collectText).join("");
  if (typeof node === "object") {
    return Object.values(node as Record<string, unknown>)
      .map(collectText)
      .join("");
  }
  return "";
}

export async function fetchArticles(pmids: string[]): Promise<PubMedArticle[]> {
  if (pmids.length === 0) return [];

  const params = new URLSearchParams({
    db: "pubmed",
    id: pmids.join(","),
    retmode: "xml",
  });

  const res = await fetch(`${PUBMED_FETCH_URL}?${params}`);
  const xml = await res.text();

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    isArray: (name) =>
      [
        "PubmedArticle",
        "Author",
        "ISSN",
        "ELocationID",
        "PublicationType",
        "MeshHeading",
        "Grant",
        "ArticleId",
        "AbstractText",
        "AffiliationInfo",
      ].includes(name),
  });
  const root = parser.parse(xml);
  const pubmedArticles = asArray(root?.PubmedArticleSet?.PubmedArticle);

  const articles: PubMedArticle[] = [];

  for (const art of pubmedArticles) {
    const citation = art.MedlineCitation;
    const articleEl = citation?.Article;

    // PMID
    const pmid = String(citation?.PMID?.["#text"] ?? citation?.PMID ?? "");

    // Title
    const title = collectText(articleEl?.ArticleTitle) || "N/A";

    // Authors
    const authorList = asArray(articleEl?.AuthorList?.Author);
    let authorsShort = "";
    let authorsFull = "";
    let firstAffiliation = "";
    const names: string[] = [];
    for (const author of authorList) {
      const last = author.LastName ?? "";
      const initials = author.Initials ?? "";
      if (last) {
        names.push(`${last} ${initials}`.trim());
        if (!firstAffiliation) {
          const affInfos = asArray(author.AffiliationInfo);
          const affText = affInfos[0]?.Affiliation;
          if (affText) firstAffiliation = String(affText);
        }
      }
    }
    authorsFull = names.join(", ");
    authorsShort =
      names.length > 3
        ? names.slice(0, 3).join(", ") + " et al."
        : names.join(", ");

    // Journal
    const journal = String(articleEl?.Journal?.Title ?? "N/A");

    // ISSN (prefer Electronic, fallback Print)
    let issn = "";
    const issnList = asArray(articleEl?.Journal?.ISSN);
    for (const type of ["Electronic", "Print"]) {
      for (const el of issnList) {
        if (el?.["@_IssnType"] === type && el?.["#text"]) {
          issn = String(el["#text"]);
          break;
        }
      }
      if (issn) break;
    }

    // Publication date
    const pubDateEl = articleEl?.Journal?.JournalIssue?.PubDate;
    let pubDate = "N/A";
    if (pubDateEl) {
      const parts = [pubDateEl.Year, pubDateEl.Month, pubDateEl.Day]
        .filter(Boolean)
        .map(String);
      pubDate = parts.length > 0 ? parts.join(" ") : (pubDateEl.MedlineDate ?? "N/A");
    }

    // DOI
    let doi = "";
    for (const eid of asArray(articleEl?.ELocationID)) {
      if (eid?.["@_EIdType"] === "doi" && eid?.["#text"]) {
        doi = String(eid["#text"]);
        break;
      }
    }
    if (!doi) {
      for (const aid of asArray(art?.PubmedData?.ArticleIdList?.ArticleId)) {
        if (aid?.["@_IdType"] === "doi" && aid?.["#text"]) {
          doi = String(aid["#text"]);
          break;
        }
      }
    }

    // Publication types
    const pubTypes = asArray(articleEl?.PublicationTypeList?.PublicationType)
      .map((pt) => collectText(pt?.["#text"] ?? pt))
      .filter((t) => t && t !== "Journal Article");
    const pubTypesStr = pubTypes.join(", ");

    // MeSH terms (up to 10, major topics first)
    const meshHeadings = asArray(citation?.MeshHeadingList?.MeshHeading);
    const meshTerms: string[] = [];
    for (const heading of meshHeadings) {
      const desc = heading.DescriptorName;
      const text = desc?.["#text"] ?? (typeof desc === "string" ? desc : "");
      if (text) {
        const major = desc?.["@_MajorTopicYN"] === "Y";
        meshTerms.push(major ? `*${text}` : String(text));
      }
    }
    meshTerms.sort((a, b) => {
      const aM = a.startsWith("*") ? 0 : 1;
      const bM = b.startsWith("*") ? 0 : 1;
      return aM - bM || a.localeCompare(b);
    });
    const meshTermsStr = meshTerms.slice(0, 10).join(", ");

    // Grants
    const grantList = asArray(citation?.Article?.GrantList?.Grant ?? citation?.GrantList?.Grant);
    const grantAgencies: string[] = [];
    for (const g of grantList) {
      const agency = g?.Agency;
      if (agency && !grantAgencies.includes(String(agency))) {
        grantAgencies.push(String(agency));
      }
    }
    const grantsStr = grantAgencies.length > 0 ? grantAgencies.join(", ") : "Unknown";

    // COI statement
    const coiStatement = String(citation?.CoiStatement ?? "") || "Unknown";

    // PMC ID → open access
    let pmcId = "";
    for (const aid of asArray(art?.PubmedData?.ArticleIdList?.ArticleId)) {
      if (aid?.["@_IdType"] === "pmc" && aid?.["#text"]) {
        pmcId = String(aid["#text"]);
        break;
      }
    }
    const isOpenAccess = pmcId ? 1 : 0;

    // Abstract
    const abstractTexts = asArray(articleEl?.Abstract?.AbstractText);
    const abstractParts: string[] = [];
    for (const at of abstractTexts) {
      const label = at?.["@_Label"] ?? "";
      const text = collectText(at?.["#text"] ?? at);
      if (label) {
        abstractParts.push(`${label}: ${text}`);
      } else {
        abstractParts.push(text);
      }
    }
    const abstract = abstractParts.join("\n\n");

    articles.push({
      pmid,
      title,
      authors: authorsShort,
      authors_full: authorsFull,
      journal,
      pub_date: pubDate,
      abstract,
      doi,
      pub_types: pubTypesStr,
      mesh_terms: meshTermsStr,
      affiliation: firstAffiliation,
      grants: grantsStr,
      coi_statement: coiStatement,
      is_open_access: isOpenAccess,
      pmc_id: pmcId,
      issn,
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      citation_count: 0,
    });
  }

  return articles;
}

// ---------------------------------------------------------------------------
// Citation counts (Europe PMC)
// ---------------------------------------------------------------------------

export async function fetchCitationCounts(
  pmids: string[]
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};

  for (let i = 0; i < pmids.length; i += 50) {
    const batch = pmids.slice(i, i + 50);
    const query = batch.map((id) => `EXT_ID:${id}`).join(" OR ");
    const params = new URLSearchParams({
      query,
      format: "json",
      resultType: "core",
      pageSize: String(batch.length),
    });

    try {
      const res = await fetch(
        `https://www.ebi.ac.uk/europepmc/webservices/rest/search?${params}`
      );
      const data = await res.json();
      for (const result of data?.resultList?.result ?? []) {
        if (result.pmid) {
          counts[String(result.pmid)] = result.citedByCount ?? 0;
        }
      }
    } catch (e) {
      console.warn("Europe PMC batch failed:", e);
    }
  }

  return counts;
}
