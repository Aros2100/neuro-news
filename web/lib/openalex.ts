/**
 * OpenAlex utility functions — ported from fetch_impact_factors.py
 */

const OPENALEX_BASE = "https://api.openalex.org";
const UA = "neuro-news/1.0 (mailto:noreply@example.com)";

async function openalexGet(url: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch (e) {
    console.warn("OpenAlex request failed:", e);
    return null;
  }
}

export async function lookupByIssn(
  issn: string
): Promise<Record<string, unknown> | null> {
  return openalexGet(`${OPENALEX_BASE}/sources/issn:${issn}`);
}

export async function searchByName(
  name: string
): Promise<Record<string, unknown> | null> {
  const params = new URLSearchParams({ search: name });
  const data = await openalexGet(`${OPENALEX_BASE}/sources?${params}`);
  const results = data?.results as unknown[] | undefined;
  if (results && results.length > 0) {
    return results[0] as Record<string, unknown>;
  }
  return null;
}

export function extractIF(
  source: Record<string, unknown>
): number | null {
  const stats = source.summary_stats as Record<string, unknown> | undefined;
  const value = stats?.["2yr_mean_citedness"] as number | undefined;
  if (value != null && value > 0) {
    return Math.round(value * 100) / 100;
  }
  return null;
}
