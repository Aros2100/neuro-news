"use client";

import { useMemo } from "react";
import type { Article } from "@/lib/db";

const SUBSPECIALTY_COLORS: Record<string, string> = {
  Oncology: "bg-rose-500",
  Vascular: "bg-red-500",
  Spine: "bg-sky-500",
  Functional: "bg-violet-500",
  Trauma: "bg-orange-500",
  Pediatric: "bg-teal-500",
  "Skull base": "bg-indigo-500",
  General: "bg-slate-500",
};

const RELEVANCE_COLORS: Record<string, string> = {
  "Practice-changing": "bg-rose-600",
  "Important update": "bg-amber-500",
  "Background knowledge": "bg-sky-500",
  "Research only": "bg-slate-400",
};

const cardClass =
  "rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-700/80 dark:bg-slate-800/40";

interface BarItem {
  label: string;
  count: number;
  color: string;
}

function countBy(articles: Article[], key: keyof Article): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const a of articles) {
    const val = a[key];
    if (val != null && val !== "") {
      const k = String(val);
      counts[k] = (counts[k] || 0) + 1;
    }
  }
  return counts;
}

function StatCard({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
}) {
  return (
    <div className={cardClass}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
        {value}
      </p>
      {subtitle && (
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {subtitle}
        </p>
      )}
    </div>
  );
}

function BarChart({ title, items }: { title: string; items: BarItem[] }) {
  const max = Math.max(...items.map((i) => i.count), 1);

  return (
    <div className={cardClass}>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
        {title}
      </h3>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            <span className="w-32 shrink-0 truncate text-xs text-slate-600 dark:text-slate-400 text-right">
              {item.label}
            </span>
            <div className="flex-1 h-5 rounded-full bg-slate-100 dark:bg-slate-700/50 overflow-hidden">
              <div
                className={`h-full rounded-full ${item.color} transition-all duration-500`}
                style={{ width: `${(item.count / max) * 100}%` }}
              />
            </div>
            <span className="w-8 shrink-0 text-xs font-semibold text-slate-700 dark:text-slate-300 text-right">
              {item.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SplitBar({
  title,
  leftLabel,
  rightLabel,
  leftCount,
  rightCount,
  leftColor,
  rightColor,
}: {
  title: string;
  leftLabel: string;
  rightLabel: string;
  leftCount: number;
  rightCount: number;
  leftColor: string;
  rightColor: string;
}) {
  const total = leftCount + rightCount;
  const leftPct = total > 0 ? (leftCount / total) * 100 : 50;

  return (
    <div className={cardClass}>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
        {title}
      </h3>
      <div className="flex h-8 rounded-full overflow-hidden">
        <div
          className={`${leftColor} flex items-center justify-center text-xs font-bold text-white transition-all duration-500`}
          style={{ width: `${leftPct}%` }}
        >
          {leftCount}
        </div>
        <div
          className={`${rightColor} flex items-center justify-center text-xs font-bold text-white transition-all duration-500`}
          style={{ width: `${100 - leftPct}%` }}
        >
          {rightCount}
        </div>
      </div>
      <div className="mt-2 flex justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>{leftLabel} ({leftPct.toFixed(0)}%)</span>
        <span>{rightLabel} ({(100 - leftPct).toFixed(0)}%)</span>
      </div>
    </div>
  );
}

export default function Dashboard({ articles }: { articles: Article[] }) {
  const stats = useMemo(() => {
    const total = articles.length;
    const openAccess = articles.filter((a) => Number(a.is_open_access) === 1).length;
    const avgNewsValue =
      total > 0
        ? (articles.reduce((sum, a) => sum + (a.news_value || 0), 0) / total).toFixed(1)
        : "0";
    const practiceChanging = articles.filter(
      (a) => a.clinical_relevance === "Practice-changing"
    ).length;
    const withGrants = articles.filter((a) => a.grants && a.grants.trim()).length;
    const withCOI = articles.filter((a) => a.coi_statement && a.coi_statement.trim()).length;

    // Subspecialty distribution
    const subCounts = countBy(articles, "subspecialty");
    const subspecialties: BarItem[] = Object.entries(subCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({
        label,
        count,
        color: SUBSPECIALTY_COLORS[label] || "bg-slate-500",
      }));

    // Article type distribution
    const typeCounts = countBy(articles, "article_type");
    const articleTypes: BarItem[] = Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({
        label,
        count,
        color: "bg-indigo-500",
      }));

    // Clinical relevance distribution
    const relCounts = countBy(articles, "clinical_relevance");
    const relevanceOrder = ["Practice-changing", "Important update", "Background knowledge", "Research only"];
    const relevances: BarItem[] = relevanceOrder
      .filter((r) => relCounts[r])
      .map((label) => ({
        label,
        count: relCounts[label],
        color: RELEVANCE_COLORS[label] || "bg-slate-400",
      }));

    // News value distribution (grouped)
    const newsGroups = [
      { label: "8–10 (High)", min: 8, max: 10, color: "bg-rose-500" },
      { label: "6–7", min: 6, max: 7, color: "bg-amber-500" },
      { label: "4–5", min: 4, max: 5, color: "bg-sky-500" },
      { label: "1–3 (Low)", min: 1, max: 3, color: "bg-slate-400" },
    ];
    const newsValues: BarItem[] = newsGroups.map((g) => ({
      label: g.label,
      count: articles.filter((a) => a.news_value >= g.min && a.news_value <= g.max).length,
      color: g.color,
    }));

    // Top 10 journals
    const journalCounts = countBy(articles, "journal");
    const topJournals: BarItem[] = Object.entries(journalCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([label, count]) => ({
        label,
        count,
        color: "bg-violet-500",
      }));

    return {
      total,
      openAccess,
      avgNewsValue,
      practiceChanging,
      withGrants,
      withCOI,
      subspecialties,
      articleTypes,
      relevances,
      newsValues,
      topJournals,
    };
  }, [articles]);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Articles" value={stats.total} />
        <StatCard
          label="Open Access"
          value={stats.openAccess}
          subtitle={`${((stats.openAccess / stats.total) * 100).toFixed(0)}% of total`}
        />
        <StatCard label="Avg News Value" value={stats.avgNewsValue} subtitle="out of 10" />
        <StatCard
          label="Practice-Changing"
          value={stats.practiceChanging}
          subtitle="highest relevance"
        />
      </div>

      {/* Subspecialty distribution */}
      <BarChart title="Subspecialty Distribution" items={stats.subspecialties} />

      {/* Article type distribution */}
      <BarChart title="Article Type Distribution" items={stats.articleTypes} />

      {/* Clinical relevance distribution */}
      <BarChart title="Clinical Relevance" items={stats.relevances} />

      {/* News value distribution */}
      <BarChart title="News Value Distribution" items={stats.newsValues} />

      {/* Top journals */}
      <BarChart title="Top 10 Journals" items={stats.topJournals} />

      {/* Open Access vs Paywalled */}
      <SplitBar
        title="Access Type"
        leftLabel="Open Access"
        rightLabel="Paywalled"
        leftCount={stats.openAccess}
        rightCount={stats.total - stats.openAccess}
        leftColor="bg-emerald-500"
        rightColor="bg-slate-400"
      />

      {/* Grants & COI */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label="With Grants"
          value={stats.withGrants}
          subtitle={`${((stats.withGrants / stats.total) * 100).toFixed(0)}% of articles`}
        />
        <StatCard
          label="COI Statements"
          value={stats.withCOI}
          subtitle={`${((stats.withCOI / stats.total) * 100).toFixed(0)}% of articles`}
        />
      </div>
    </div>
  );
}
