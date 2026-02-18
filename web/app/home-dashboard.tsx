"use client";

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

const cardClass =
  "rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-700/80 dark:bg-slate-800/40";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={cardClass}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}

function ArticleRow({ article }: { article: Article }) {
  const subStyle =
    SUBSPECIALTY_STYLES[article.subspecialty] ??
    "bg-slate-500/10 text-slate-600 ring-slate-500/20";

  return (
    <li className="group flex items-center gap-3 rounded-lg border border-slate-200/80 bg-white px-4 py-3 transition hover:shadow-sm hover:border-slate-300 dark:border-slate-700/80 dark:bg-slate-800/40 dark:hover:border-slate-600">
      {article.subspecialty && (
        <span
          className={`hidden sm:inline-flex shrink-0 rounded-md px-1.5 py-px text-[10px] font-semibold ring-1 ring-inset ${subStyle}`}
        >
          {article.subspecialty}
        </span>
      )}
      <Link
        href={`/article/${article.id}`}
        className="min-w-0 flex-1 text-sm font-medium leading-snug text-slate-900 group-hover:text-indigo-600 dark:text-slate-100 dark:group-hover:text-indigo-400 transition line-clamp-1"
      >
        {article.title}
      </Link>
      <span className="shrink-0 text-[11px] text-slate-400 dark:text-slate-500 hidden sm:block">
        {article.pub_date}
      </span>
    </li>
  );
}

interface Props {
  total: number;
  newThisWeek: number;
  practiceChanging: number;
  highImpact: number;
  latestArticles: Article[];
}

export default function HomeDashboard({
  total,
  newThisWeek,
  practiceChanging,
  highImpact,
  latestArticles,
}: Props) {
  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Articles" value={total} />
        <StatCard label="New This Week" value={newThisWeek} />
        <StatCard label="Practice-Changing" value={practiceChanging} />
        <StatCard label="High-Impact (IF>5)" value={highImpact} />
      </div>

      {/* Navigation cards */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/browse"
          className="group rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:shadow-md hover:border-indigo-300 dark:border-slate-700/80 dark:bg-slate-800/40 dark:hover:border-indigo-500/50"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10">
              <svg className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
            <p className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 dark:text-slate-100 dark:group-hover:text-indigo-400 transition">
              Browse Articles &rarr;
            </p>
          </div>
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Search, filter by subspecialty, date, journal, and sort all {total} articles.
          </p>
        </Link>

        <Link
          href="/discovery"
          className="group rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:shadow-md hover:border-amber-300 dark:border-slate-700/80 dark:bg-slate-800/40 dark:hover:border-amber-500/50"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
              <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
              </svg>
            </div>
            <p className="text-sm font-bold text-slate-900 group-hover:text-amber-600 dark:text-slate-100 dark:group-hover:text-amber-400 transition">
              Discovery &rarr;
            </p>
          </div>
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Curated must-reads, practice-changing articles, and top techniques.
          </p>
        </Link>

        <Link
          href="/discovery/subspecialty"
          className="group rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:shadow-md hover:border-teal-300 dark:border-slate-700/80 dark:bg-slate-800/40 dark:hover:border-teal-500/50"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/10">
              <svg className="h-5 w-5 text-teal-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
              </svg>
            </div>
            <p className="text-sm font-bold text-slate-900 group-hover:text-teal-600 dark:text-slate-100 dark:group-hover:text-teal-400 transition">
              By Subspecialty &rarr;
            </p>
          </div>
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Spine, Vascular, Oncology, Functional, Trauma, Pediatric, and Skull base.
          </p>
        </Link>

        <Link
          href="/dashboard"
          className="group rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:shadow-md hover:border-violet-300 dark:border-slate-700/80 dark:bg-slate-800/40 dark:hover:border-violet-500/50"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10">
              <svg className="h-5 w-5 text-violet-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
              </svg>
            </div>
            <p className="text-sm font-bold text-slate-900 group-hover:text-violet-600 dark:text-slate-100 dark:group-hover:text-violet-400 transition">
              Dashboard &rarr;
            </p>
          </div>
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Full statistics, distributions, charts, and aggregate data overview.
          </p>
        </Link>
      </div>

      {/* Latest articles */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Latest Articles
          </h2>
          <Link
            href="/browse"
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition"
          >
            View all {total} &rarr;
          </Link>
        </div>
        <ul className="space-y-1.5">
          {latestArticles.map((article) => (
            <ArticleRow key={article.id} article={article} />
          ))}
        </ul>
      </div>
    </div>
  );
}
