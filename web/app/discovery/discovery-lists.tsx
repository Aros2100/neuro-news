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

function NewsValueBadge({ value }: { value: number }) {
  if (!value) return null;
  let color = "from-slate-400 to-slate-500";
  if (value >= 8) color = "from-rose-500 to-pink-600";
  else if (value >= 6) color = "from-amber-500 to-orange-500";
  else if (value >= 4) color = "from-sky-500 to-blue-500";

  return (
    <div
      className={`flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br ${color} text-[11px] font-bold text-white shadow-sm shrink-0`}
      title={`News value: ${value}/10`}
    >
      {value}
    </div>
  );
}

function ArticleRow({ article, rank }: { article: Article; rank: number }) {
  const subStyle =
    SUBSPECIALTY_STYLES[article.subspecialty] ??
    "bg-slate-500/10 text-slate-600 ring-slate-500/20";
  const relStyle = RELEVANCE_STYLES[article.clinical_relevance] ?? "";

  return (
    <li className="group rounded-xl border border-slate-200/80 bg-white px-4 py-3.5 shadow-sm transition hover:shadow-md hover:border-slate-300 dark:border-slate-700/80 dark:bg-slate-800/40 dark:hover:border-slate-600">
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold text-slate-300 dark:text-slate-600 w-5 text-center shrink-0">
          {rank}
        </span>
        <NewsValueBadge value={article.news_value} />
        <div className="min-w-0 flex-1">
          <Link
            href={`/article/${article.id}`}
            className="block text-sm font-semibold leading-snug text-slate-900 group-hover:text-indigo-600 dark:text-slate-100 dark:group-hover:text-indigo-400 transition line-clamp-1"
          >
            {article.title}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {article.subspecialty && (
              <span className={`inline-flex rounded-md px-1.5 py-px text-[10px] font-semibold ring-1 ring-inset ${subStyle}`}>
                {article.subspecialty}
              </span>
            )}
            {article.clinical_relevance && (
              <span className={`inline-flex rounded-full px-2 py-px text-[10px] font-bold ${relStyle}`}>
                {article.clinical_relevance}
              </span>
            )}
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              {article.journal}
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              &middot; {article.pub_date}
            </span>
          </div>
        </div>
        {Number(article.is_open_access) === 1 && (
          <span className="hidden sm:inline-flex rounded-md px-1.5 py-px text-[10px] font-semibold bg-green-500/10 text-green-600 ring-1 ring-inset ring-green-500/20 dark:text-green-400 shrink-0">
            OA
          </span>
        )}
      </div>
    </li>
  );
}

interface Tab {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  articles: Article[];
  emptyText: string;
}

export default function DiscoveryLists({ articles }: { articles: Article[] }) {
  const now = Date.now();
  const sevenDaysMs = 7 * 86400000;

  const mustReads = useMemo(() => {
    return articles
      .filter((a) => {
        if (a.news_value < 8) return false;
        const d = parsePubDate(a.pub_date);
        return d ? now - d.getTime() <= sevenDaysMs : false;
      })
      .sort((a, b) => b.news_value - a.news_value)
      .slice(0, 10);
  }, [articles, now]);

  const practiceChanging = useMemo(() => {
    return articles
      .filter(
        (a) =>
          a.clinical_relevance === "Practice-changing" &&
          (a.article_type === "Clinical trial" || a.article_type === "Outcomes study")
      )
      .sort((a, b) => {
        const da = parsePubDate(a.pub_date)?.getTime() ?? 0;
        const db = parsePubDate(b.pub_date)?.getTime() ?? 0;
        return db - da;
      })
      .slice(0, 10);
  }, [articles]);

  const improveTechnique = useMemo(() => {
    return articles
      .filter((a) => a.article_type === "Technical note" && a.news_value >= 6)
      .sort((a, b) => (b.citation_count || 0) - (a.citation_count || 0))
      .slice(0, 10);
  }, [articles]);

  const tabs: Tab[] = [
    {
      id: "must-reads",
      label: "Must-Reads",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 0 0 .495-7.468 5.99 5.99 0 0 0-1.925 3.547 5.975 5.975 0 0 1-2.133-1.001A3.75 3.75 0 0 0 12 18Z" />
        </svg>
      ),
      description: "High-impact articles from the last 7 days (news value 8+)",
      articles: mustReads,
      emptyText: "No high-impact articles this week yet.",
    },
    {
      id: "practice-changing",
      label: "Practice-Changing",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
        </svg>
      ),
      description: "Clinical trials and outcomes studies that could change practice",
      articles: practiceChanging,
      emptyText: "No practice-changing articles found.",
    },
    {
      id: "technique",
      label: "Technique",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.049.58.025 1.193-.14 1.743" />
        </svg>
      ),
      description: "Notable technical notes for the practicing neurosurgeon",
      articles: improveTechnique,
      emptyText: "No notable technical notes found.",
    },
  ];

  const [activeTab, setActiveTab] = useState(tabs[0].id);
  const current = tabs.find((t) => t.id === activeTab)!;

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/60">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              activeTab === tab.id
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.articles.length > 0 && (
              <span
                className={`rounded-full px-1.5 py-px text-[10px] font-bold ${
                  activeTab === tab.id
                    ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400"
                    : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                }`}
              >
                {tab.articles.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Description */}
      <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
        {current.description}
      </p>

      {/* Article list */}
      {current.articles.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-800/20 dark:text-slate-500">
          {current.emptyText}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {current.articles.map((article, i) => (
            <ArticleRow key={article.id} article={article} rank={i + 1} />
          ))}
        </ul>
      )}
    </div>
  );
}
