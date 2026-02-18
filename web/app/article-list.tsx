"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Article } from "@/lib/db";

const SUBSPECIALTY_STYLES: Record<string, string> = {
  Oncology: "bg-rose-500/10 text-rose-600 ring-rose-500/20 dark:text-rose-400",
  Vascular: "bg-red-500/10 text-red-600 ring-red-500/20 dark:text-red-400",
  Spine: "bg-sky-500/10 text-sky-600 ring-sky-500/20 dark:text-sky-400",
  Functional: "bg-violet-500/10 text-violet-600 ring-violet-500/20 dark:text-violet-400",
  Trauma: "bg-orange-500/10 text-orange-600 ring-orange-500/20 dark:text-orange-400",
  Pediatric: "bg-teal-500/10 text-teal-600 ring-teal-500/20 dark:text-teal-400",
  "Skull base": "bg-indigo-500/10 text-indigo-600 ring-indigo-500/20 dark:text-indigo-400",
  General: "bg-slate-500/10 text-slate-600 ring-slate-500/20 dark:text-slate-400",
};

const RELEVANCE_STYLES: Record<string, string> = {
  "Practice-changing": "bg-rose-600 text-white",
  "Important update": "bg-amber-500 text-white",
  "Background knowledge": "bg-sky-500 text-white",
  "Research only": "bg-slate-400 text-white",
};

const DATE_PRESETS = [
  { label: "All dates", days: 0 },
  { label: "Last week", days: 7 },
  { label: "Last month", days: 30 },
  { label: "Last 3 months", days: 90 },
  { label: "Last year", days: 365 },
];

const inputClass =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/20 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20";

/** Try to parse a PubMed date like "2026 Feb 14" into a Date. */
function parsePubDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;
  // Try "YYYY Mon" format
  const parts = dateStr.split(" ");
  if (parts.length >= 2) {
    const d2 = new Date(`${parts[1]} 1, ${parts[0]}`);
    if (!isNaN(d2.getTime())) return d2;
  }
  return null;
}

function NewsValueBadge({ value }: { value: number }) {
  if (!value) return null;
  let color = "from-slate-400 to-slate-500";
  if (value >= 8) color = "from-rose-500 to-pink-600";
  else if (value >= 6) color = "from-amber-500 to-orange-500";
  else if (value >= 4) color = "from-sky-500 to-blue-500";

  return (
    <div
      className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${color} text-xs font-bold text-white shadow-sm shrink-0`}
      title={`News value: ${value}/10`}
    >
      {value}
    </div>
  );
}

function Badge({ label, style }: { label: string; style: string }) {
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${style}`}>
      {label}
    </span>
  );
}

function PillBadge({ label, style }: { label: string; style: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${style}`}>
      {label}
    </span>
  );
}

const selectClass =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/20 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20";

type FilterKey = "subspecialty" | "article_type" | "clinical_relevance" | "open_access";

const IF_FILTER_OPTIONS = [
  { label: "Any IF", value: 0 },
  { label: "IF > 3", value: 3 },
  { label: "IF > 5", value: 5 },
  { label: "IF > 10", value: 10 },
];

type SortKey = "news_value" | "citations" | "date" | "impact_factor";

const SORT_OPTIONS: { label: string; value: SortKey }[] = [
  { label: "News value", value: "news_value" },
  { label: "Citations", value: "citations" },
  { label: "Impact Factor", value: "impact_factor" },
  { label: "Date", value: "date" },
];

export default function ArticleList({ articles }: { articles: Article[] }) {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("news_value");
  const [datePreset, setDatePreset] = useState(0);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [journal, setJournal] = useState("");
  const [minIF, setMinIF] = useState(0);
  const [filters, setFilters] = useState<Record<FilterKey, string | null>>({
    subspecialty: null,
    article_type: null,
    clinical_relevance: null,
    open_access: null,
  });

  // Build sorted journal list with counts
  const journalOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of articles) {
      if (a.journal) counts[a.journal] = (counts[a.journal] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [articles]);

  const now = Date.now();
  const fromTime = dateFrom ? new Date(dateFrom).getTime() : 0;
  const toTime = dateTo ? new Date(dateTo + "T23:59:59").getTime() : 0;

  const filtered = articles.filter((a) => {
    // Text search
    const q = query.toLowerCase();
    const matchesQuery =
      !q ||
      a.title.toLowerCase().includes(q) ||
      a.authors.toLowerCase().includes(q) ||
      a.journal.toLowerCase().includes(q) ||
      a.summary?.toLowerCase().includes(q) ||
      a.abstract?.toLowerCase().includes(q);

    // Date filter: custom range takes priority, then preset
    let matchesDate = true;
    if (fromTime || toTime) {
      const pubDate = parsePubDate(a.pub_date);
      if (pubDate) {
        const t = pubDate.getTime();
        if (fromTime && t < fromTime) matchesDate = false;
        if (toTime && t > toTime) matchesDate = false;
      }
    } else if (datePreset > 0) {
      const pubDate = parsePubDate(a.pub_date);
      if (pubDate) {
        matchesDate = now - pubDate.getTime() <= datePreset * 86400000;
      }
    }

    // Journal filter
    const matchesJournal = !journal || a.journal === journal;

    // Tag filters
    const matchesSub = !filters.subspecialty || a.subspecialty === filters.subspecialty;
    const matchesType = !filters.article_type || a.article_type === filters.article_type;
    const matchesRel = !filters.clinical_relevance || a.clinical_relevance === filters.clinical_relevance;
    const matchesOA = !filters.open_access || (filters.open_access === "Open Access" ? Number(a.is_open_access) === 1 : Number(a.is_open_access) === 0);
    const matchesIF = !minIF || (a.impact_factor != null && a.impact_factor > minIF);

    return matchesQuery && matchesDate && matchesJournal && matchesSub && matchesType && matchesRel && matchesOA && matchesIF;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "citations") return (b.citation_count || 0) - (a.citation_count || 0);
    if (sortBy === "impact_factor") return (b.impact_factor ?? 0) - (a.impact_factor ?? 0);
    if (sortBy === "date") {
      const da = parsePubDate(a.pub_date)?.getTime() ?? 0;
      const db_ = parsePubDate(b.pub_date)?.getTime() ?? 0;
      return db_ - da;
    }
    return (b.news_value || 0) - (a.news_value || 0);
  });

  function toggle(key: FilterKey, value: string) {
    setFilters((f) => ({ ...f, [key]: f[key] === value ? null : value }));
  }

  function uniqueValues(key: FilterKey) {
    if (key === "open_access") {
      return ["Open Access", "Paywalled"];
    }
    return [...new Set(articles.map((a) => a[key]).filter(Boolean))];
  }

  const hasActiveFilters =
    query || datePreset > 0 || dateFrom || dateTo || journal || minIF > 0 || filters.subspecialty || filters.article_type || filters.clinical_relevance || filters.open_access;

  const filterGroups: { key: FilterKey; label: string }[] = [
    { key: "subspecialty", label: "Subspecialty" },
    { key: "article_type", label: "Article Type" },
    { key: "clinical_relevance", label: "Clinical Relevance" },
    { key: "open_access", label: "Access" },
  ];

  return (
    <>
      {/* Search + dropdowns row */}
      <div className="space-y-3">
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search title, authors, abstract..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-12 pr-4 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/20 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20"
          />
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Date
            </label>
            <select
              value={datePreset}
              onChange={(e) => {
                setDatePreset(Number(e.target.value));
                setDateFrom("");
                setDateTo("");
              }}
              className={selectClass}
            >
              {DATE_PRESETS.map((opt) => (
                <option key={opt.days} value={opt.days}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setDatePreset(0); }}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setDatePreset(0); }}
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Journal
            </label>
            <select
              value={journal}
              onChange={(e) => setJournal(e.target.value)}
              className={`${selectClass} max-w-xs truncate`}
            >
              <option value="">All journals</option>
              {journalOptions.map(({ name, count }) => (
                <option key={name} value={name}>
                  {name} ({count})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Impact Factor
            </label>
            <select
              value={minIF}
              onChange={(e) => setMinIF(Number(e.target.value))}
              className={selectClass}
            >
              {IF_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Sort by
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className={selectClass}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {hasActiveFilters && (
            <button
              onClick={() => {
                setQuery("");
                setDatePreset(0);
                setDateFrom("");
                setDateTo("");
                setJournal("");
                setMinIF(0);
                setFilters({ subspecialty: null, article_type: null, clinical_relevance: null, open_access: null });
              }}
              className="rounded-lg px-3 py-2 text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 transition dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Tag filter groups */}
      <div className="space-y-3">
        {filterGroups.map(({ key, label }) => {
          const values = uniqueValues(key);
          if (values.length === 0) return null;
          return (
            <div key={key}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                {label}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {values.map((val) => (
                  <button
                    key={val}
                    onClick={() => toggle(key, val)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                      filters[key] === val
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Results count */}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {sorted.length} of {articles.length} articles
      </p>

      {/* Article cards */}
      <ul className="space-y-3">
        {sorted.map((article) => {
          const subStyle = SUBSPECIALTY_STYLES[article.subspecialty] ?? "bg-slate-500/10 text-slate-600 ring-slate-500/20";
          const relStyle = RELEVANCE_STYLES[article.clinical_relevance] ?? "";

          return (
            <li
              key={article.id}
              className="group rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:shadow-md hover:border-slate-300 dark:border-slate-700/80 dark:bg-slate-800/40 dark:hover:border-slate-600"
            >
              <div className="flex items-start gap-3">
                <NewsValueBadge value={article.news_value} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/article/${article.id}`}
                    className="block text-[15px] font-semibold leading-snug text-slate-900 group-hover:text-indigo-600 dark:text-slate-100 dark:group-hover:text-indigo-400 transition"
                  >
                    {article.title}
                  </Link>

                  {/* Badges row */}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {article.subspecialty && <Badge label={article.subspecialty} style={subStyle} />}
                    {article.article_type && (
                      <Badge label={article.article_type} style="bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-600" />
                    )}
                    {article.pub_types && (
                      <Badge label={article.pub_types} style="bg-cyan-500/10 text-cyan-600 ring-cyan-500/20 dark:text-cyan-400" />
                    )}
                    {article.clinical_relevance && <PillBadge label={article.clinical_relevance} style={relStyle} />}
                    {Number(article.is_open_access) === 1 ? (
                      <Badge label="Open Access" style="bg-green-500/10 text-green-600 ring-green-500/20 dark:text-green-400" />
                    ) : (
                      <Badge label="Paywalled" style="bg-slate-500/10 text-slate-500 ring-slate-500/20 dark:text-slate-400" />
                    )}
                    {article.doi && (
                      <a
                        href={`https://doi.org/${article.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 ring-1 ring-inset ring-emerald-500/20 hover:bg-emerald-100 transition dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
                        onClick={(e) => e.stopPropagation()}
                      >
                        DOI
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                      </a>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-medium">
                      {article.journal}
                      {article.impact_factor != null && (
                        <span className={`ml-1 font-semibold ${
                          article.impact_factor >= 10 ? "text-rose-600 dark:text-rose-400" :
                          article.impact_factor >= 5 ? "text-amber-600 dark:text-amber-400" :
                          "text-slate-500 dark:text-slate-400"
                        }`}>
                          &middot; IF {article.impact_factor.toFixed(1)}
                        </span>
                      )}
                    </span>
                    <span>&middot;</span>
                    <span>{article.pub_date}</span>
                    <span>&middot;</span>
                    <span>{article.authors}</span>
                    <span>&middot;</span>
                    <span className={`inline-flex items-center gap-1 font-semibold ${article.citation_count > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-400 dark:text-slate-500"}`}>
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                      </svg>
                      {article.citation_count || 0} citations
                    </span>
                  </div>
                  {article.summary && (
                    <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                      {article.summary}
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {filtered.length === 0 && (
        <p className="py-12 text-center text-sm text-slate-400 dark:text-slate-500">
          No articles match your filters.
        </p>
      )}
    </>
  );
}
