import { getArticles } from "@/lib/db";
import Link from "next/link";
import ArticleList from "../article-list";

export const dynamic = "force-dynamic";

export default async function BrowsePage() {
  const articles = await getArticles();

  return (
    <div className="min-h-screen font-sans">
      {/* Header */}
      <header className="relative overflow-hidden border-b border-slate-200/80 bg-red-600 dark:border-slate-700/80">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBvcGFjaXR5PSIwLjEiPjxjaXJjbGUgY3g9IjMwIiBjeT0iMzAiIHI9IjEuNSIgZmlsbD0id2hpdGUiLz48L2c+PC9zdmc+')] opacity-40" />
        <div className="relative mx-auto max-w-3xl px-6 py-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  Browse Articles
                </h1>
                <p className="text-sm text-indigo-100">
                  Search, filter, and sort all articles
                </p>
              </div>
            </div>
            <Link
              href="/"
              className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/25"
            >
              &larr; Home
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-6 py-8 space-y-5">
        <ArticleList articles={articles} />
      </main>
    </div>
  );
}
