"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Article } from "@/lib/db";

const SUBSPECIALTIES = [
  "Spine",
  "Vascular",
  "Oncology",
  "Functional",
  "Trauma",
  "Pediatric",
  "Skull base",
] as const;

const SUBSPECIALTY_COLORS: Record<string, { bg: string; text: string; ring: string; accent: string }> = {
  Spine:        { bg: "bg-sky-500/10",    text: "text-sky-600 dark:text-sky-400",       ring: "ring-sky-500/20",    accent: "bg-sky-500" },
  Vascular:     { bg: "bg-red-500/10",    text: "text-red-600 dark:text-red-400",       ring: "ring-red-500/20",    accent: "bg-red-500" },
  Oncology:     { bg: "bg-rose-500/10",   text: "text-rose-600 dark:text-rose-400",     ring: "ring-rose-500/20",   accent: "bg-rose-500" },
  Functional:   { bg: "bg-violet-500/10", text: "text-violet-600 dark:text-violet-400", ring: "ring-violet-500/20", accent: "bg-violet-500" },
  Trauma:       { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", ring: "ring-orange-500/20", accent: "bg-orange-500" },
  Pediatric:    { bg: "bg-teal-500/10",   text: "text-teal-600 dark:text-teal-400",     ring: "ring-teal-500/20",   accent: "bg-teal-500" },
  "Skull base": { bg: "bg-indigo-500/10", text: "text-indigo-600 dark:text-indigo-400", ring: "ring-indigo-500/20", accent: "bg-indigo-500" },
};

const RELEVANCE_STYLES: Record<string, string> = {
  "Practice-changing": "bg-rose-600 text-white",
  "Important update": "bg-amber-500 text-white",
  "Background knowledge": "bg-sky-500 text-white",
  "Research only": "bg-slate-400 text-white",
};

function parsePubDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;
  const parts = dateStr.split(" ");
  if (parts.length >= 2) {
    const d2 = new Date(`${parts[1]} 1, ${parts[0]}`);
    if (!isNaN(d2.getTime())) return d2;
  }
  return null;
}

function ArticleRow({ article }: { article: Article }) {
  const relStyle = RELEVANCE_STYLES[article.clinical_relevance] ?? "";

  let nvColor = "from-slate-400 to-slate-500";
  if (article.news_value >= 8) nvColor = "from-rose-500 to-pink-600";
  else if (article.news_value >= 6) nvColor = "from-amber-500 to-orange-500";
  else if (article.news_value >= 4) nvColor = "from-sky-500 to-blue-500";

  return (
    <li className="group flex items-center gap-3 rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 transition hover:shadow-sm hover:border-slate-300 dark:border-slate-700/80 dark:bg-slate-800/40 dark:hover:border-slate-600">
      {article.news_value > 0 && (
        <div
          className={`flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br ${nvColor} text-[10px] font-bold text-white shrink-0`}
        >
          {article.news_value}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <Link
          href={`/article/${article.id}`}
          className="block text-[13px] font-semibold leading-snug text-slate-900 group-hover:text-indigo-600 dark:text-slate-100 dark:group-hover:text-indigo-400 transition line-clamp-1"
        >
          {article.title}
        </Link>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
          <span>{article.journal}</span>
          <span>&middot;</span>
          <span>{article.pub_date}</span>
          {(article.citation_count || 0) > 0 && (
            <>
              <span>&middot;</span>
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                {article.citation_count} cit.
              </span>
            </>
          )}
        </div>
      </div>
      {article.clinical_relevance && (
        <span className={`hidden sm:inline-flex shrink-0 rounded-full px-2 py-px text-[9px] font-bold ${relStyle}`}>
          {article.clinical_relevance}
        </span>
      )}
    </li>
  );
}

function MiniSection({
  label,
  articles,
  emptyText,
}: {
  label: string;
  articles: Article[];
  emptyText: string;
}) {
  if (articles.length === 0) {
    return (
      <div>
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
          {label}
        </h4>
        <p className="text-xs text-slate-300 italic dark:text-slate-600">{emptyText}</p>
      </div>
    );
  }

  return (
    <div>
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
        {label}
      </h4>
      <ul className="space-y-1.5">
        {articles.map((a) => (
          <ArticleRow key={a.id} article={a} />
        ))}
      </ul>
    </div>
  );
}

interface SubspecialtyData {
  name: string;
  total: number;
  practiceChanging: Article[];
  topTechniques: Article[];
  mostCited: Article[];
}

function SubspecialtySection({ data }: { data: SubspecialtyData }) {
  const [open, setOpen] = useState(false);
  const colors = SUBSPECIALTY_COLORS[data.name];
  const hasContent =
    data.practiceChanging.length > 0 ||
    data.topTechniques.length > 0 ||
    data.mostCited.length > 0;

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm overflow-hidden dark:border-slate-700/80 dark:bg-slate-800/40">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
      >
        <div className={`h-3 w-3 rounded-full ${colors.accent} shrink-0`} />
        <span className={`text-sm font-bold ${colors.text}`}>
          {data.name}
        </span>
        <span className="text-[11px] text-slate-400 dark:text-slate-500">
          {data.total} articles
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {data.practiceChanging.length > 0 && (
            <span className="rounded-full bg-rose-100 px-1.5 py-px text-[9px] font-bold text-rose-600 dark:bg-rose-500/15 dark:text-rose-400">
              {data.practiceChanging.length} practice-changing
            </span>
          )}
          <svg
            className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 dark:border-slate-700/60 px-4 py-4 space-y-4">
          {!hasContent ? (
            <p className="py-4 text-center text-xs text-slate-400 dark:text-slate-500">
              No highlighted articles for {data.name} yet.
            </p>
          ) : (
            <>
              <MiniSection
                label="Practice-Changing This Month"
                articles={data.practiceChanging}
                emptyText="None this month"
              />
              <MiniSection
                label="Top Techniques"
                articles={data.topTechniques}
                emptyText="No notable technical notes"
              />
              <MiniSection
                label="Most Cited Recently"
                articles={data.mostCited}
                emptyText="No cited articles"
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function SubspecialtyDiscovery({ articles }: { articles: Article[] }) {
  const now = Date.now();
  const thirtyDaysMs = 30 * 86400000;

  const data = useMemo(() => {
    return SUBSPECIALTIES.map((name): SubspecialtyData => {
      const subArticles = articles.filter((a) => a.subspecialty === name);

      const practiceChanging = subArticles
        .filter((a) => {
          if (a.clinical_relevance !== "Practice-changing") return false;
          const d = parsePubDate(a.pub_date);
          return d ? now - d.getTime() <= thirtyDaysMs : false;
        })
        .sort((a, b) => b.news_value - a.news_value)
        .slice(0, 5);

      const topTechniques = subArticles
        .filter((a) => a.article_type === "Technical note")
        .sort((a, b) => b.news_value - a.news_value)
        .slice(0, 5);

      const mostCited = subArticles
        .filter((a) => (a.citation_count || 0) > 0)
        .sort((a, b) => (b.citation_count || 0) - (a.citation_count || 0))
        .slice(0, 5);

      return { name, total: subArticles.length, practiceChanging, topTechniques, mostCited };
    });
  }, [articles, now]);

  // Sort by total articles descending so biggest subspecialties are first
  const sorted = [...data].sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-2">
      {/* Quick jump */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {sorted.map((d) => {
          const colors = SUBSPECIALTY_COLORS[d.name];
          return (
            <span
              key={d.name}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold ring-1 ring-inset ${colors.bg} ${colors.text} ${colors.ring}`}
            >
              {d.name}
              <span className="opacity-60">{d.total}</span>
            </span>
          );
        })}
      </div>

      {sorted.map((d) => (
        <SubspecialtySection key={d.name} data={d} />
      ))}
    </div>
  );
}
