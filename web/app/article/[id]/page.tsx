import { getArticle } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

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

function NewsValueBar({ value }: { value: number }) {
  if (!value) return null;
  let color = "from-slate-400 to-slate-500";
  let label = "Low";
  if (value >= 8) { color = "from-rose-500 to-pink-600"; label = "High"; }
  else if (value >= 6) { color = "from-amber-500 to-orange-500"; label = "Medium"; }
  else if (value >= 4) { color = "from-sky-500 to-blue-500"; label = "Moderate"; }

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${color} transition-all`}
          style={{ width: `${value * 10}%` }}
        />
      </div>
      <span className={`text-sm font-bold bg-gradient-to-r ${color} bg-clip-text text-transparent`}>
        {value}/10
      </span>
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
    </div>
  );
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const article = await getArticle(Number(id));

  if (!article) notFound();

  const subStyle = SUBSPECIALTY_STYLES[article.subspecialty] ?? "bg-slate-100 text-slate-600 ring-slate-200";
  const relStyle = RELEVANCE_STYLES[article.clinical_relevance] ?? "bg-slate-400 text-white";

  return (
    <div className="min-h-screen font-sans">
      <header className="border-b border-slate-200/80 bg-red-600 dark:border-slate-700/80">
        <div className="mx-auto max-w-3xl px-6 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-indigo-100 hover:text-white transition"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            Back
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        <article className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-800/40">
          {/* Title */}
          <div className="p-6 pb-5">
            <h1 className="text-xl font-bold leading-tight text-slate-900 dark:text-slate-100">
              {article.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {article.subspecialty && (
                <span className={`inline-flex rounded-md px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${subStyle}`}>
                  {article.subspecialty}
                </span>
              )}
              {article.article_type && (
                <span className="inline-flex rounded-md px-2.5 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-600">
                  {article.article_type}
                </span>
              )}
              {article.clinical_relevance && (
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${relStyle}`}>
                  {article.clinical_relevance}
                </span>
              )}
              {article.pub_types && (
                <span className="inline-flex rounded-md px-2.5 py-0.5 text-[11px] font-semibold bg-cyan-500/10 text-cyan-600 ring-1 ring-inset ring-cyan-500/20 dark:text-cyan-400">
                  {article.pub_types}
                </span>
              )}
              {Number(article.is_open_access) === 1 ? (
                <span className="inline-flex rounded-md px-2.5 py-0.5 text-[11px] font-semibold bg-green-500/10 text-green-600 ring-1 ring-inset ring-green-500/20 dark:text-green-400">
                  Open Access
                </span>
              ) : (
                <span className="inline-flex rounded-md px-2.5 py-0.5 text-[11px] font-semibold bg-slate-500/10 text-slate-500 ring-1 ring-inset ring-slate-500/20 dark:text-slate-400">
                  Paywalled
                </span>
              )}
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-600 ring-1 ring-inset ring-indigo-500/20 hover:bg-indigo-100 transition dark:bg-indigo-500/10 dark:text-indigo-400 dark:hover:bg-indigo-500/20"
              >
                PubMed
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </a>
              {article.doi && (
                <a
                  href={`https://doi.org/${article.doi}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 ring-1 ring-inset ring-emerald-500/20 hover:bg-emerald-100 transition dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
                >
                  Full Article (DOI)
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </a>
              )}
              {article.pmc_id && (
                <a
                  href={`https://www.ncbi.nlm.nih.gov/pmc/articles/${article.pmc_id}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md bg-green-50 px-2.5 py-0.5 text-[11px] font-semibold text-green-600 ring-1 ring-inset ring-green-500/20 hover:bg-green-100 transition dark:bg-green-500/10 dark:text-green-400 dark:hover:bg-green-500/20"
                >
                  Free Full Text (PMC)
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </a>
              )}
            </div>
          </div>

          {/* News Value */}
          {article.news_value > 0 && (
            <div className="px-6 pb-4">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                News Value
              </h2>
              <NewsValueBar value={article.news_value} />
            </div>
          )}

          {/* Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px border-y border-slate-100 bg-slate-100 dark:border-slate-700/60 dark:bg-slate-700/60">
            <Field label="Journal" value={article.impact_factor != null ? `${article.journal} · IF ${article.impact_factor.toFixed(1)}` : article.journal} />
            <Field label="Published" value={article.pub_date} />
            <Field label="Citations" value={String(article.citation_count || 0)} />
            <Field label="Authors" value={article.authors_full || article.authors} full />
            {article.affiliation && (
              <Field label="Affiliation" value={article.affiliation} full />
            )}
            {article.mesh_terms && (
              <Field label="MeSH Terms" value={article.mesh_terms} full />
            )}
            {article.grants && (
              <Field label="Funding" value={article.grants} full />
            )}
            {article.coi_statement && (
              <Field label="Conflicts of Interest" value={article.coi_statement} full />
            )}
          </div>

          {/* AI summary */}
          {article.summary && (
            <div className="p-6 space-y-5">
              <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 p-5 dark:from-indigo-500/5 dark:to-violet-500/5">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Summary
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                  {article.summary}
                </p>
              </div>
              {article.importance && (
                <div className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 p-5 dark:from-amber-500/5 dark:to-orange-500/5">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    Why It Matters
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                    {article.importance}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Abstract */}
          {article.abstract && (
            <div className="border-t border-slate-100 dark:border-slate-700/60 p-6">
              <details>
                <summary className="cursor-pointer text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 transition">
                  Original Abstract
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400 whitespace-pre-line">
                  {article.abstract}
                </p>
              </details>
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-slate-100 dark:border-slate-700/60 px-6 py-3">
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              Fetched {article.fetched_at}
            </span>
          </div>
        </article>
      </main>
    </div>
  );
}

function Field({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={`bg-white dark:bg-slate-800/40 px-6 py-4 ${full ? "sm:col-span-2" : ""}`}>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">{value}</dd>
    </div>
  );
}
