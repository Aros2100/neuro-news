import { getArticles, getHighImpactCount, type Article } from "@/lib/db";
import HomeDashboard from "./home-dashboard";

export const dynamic = "force-dynamic";

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

export default async function Home() {
  const articles = await getArticles();
  const now = Date.now();
  const sevenDaysMs = 7 * 86400000;

  const newThisWeek = articles.filter((a) => {
    const d = parsePubDate(a.pub_date);
    return d ? now - d.getTime() <= sevenDaysMs : false;
  }).length;

  const practiceChanging = articles.filter(
    (a) => a.clinical_relevance === "Practice-changing"
  ).length;

  const highImpact = await getHighImpactCount(5);

  // Pre-sort by date on the server (newest first), with id as tiebreaker
  const latestArticles = [...articles]
    .sort((a, b) => {
      const da = parsePubDate(a.pub_date)?.getTime() ?? 0;
      const db = parsePubDate(b.pub_date)?.getTime() ?? 0;
      if (db !== da) return db - da;
      return b.id - a.id;
    })
    .slice(0, 10);

  return (
    <div className="min-h-screen font-sans">
      {/* Header */}
      <header className="relative overflow-hidden border-b border-slate-200/80 bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 dark:border-slate-700/80">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBvcGFjaXR5PSIwLjEiPjxjaXJjbGUgY3g9IjMwIiBjeT0iMzAiIHI9IjEuNSIgZmlsbD0id2hpdGUiLz48L2c+PC9zdmc+')] opacity-40" />
        <div className="relative mx-auto max-w-3xl px-6 py-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Neurosurgery News
              </h1>
              <p className="text-sm text-indigo-100">
                Latest neurosurgery research from PubMed
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-6 py-8">
        <HomeDashboard
          total={articles.length}
          newThisWeek={newThisWeek}
          practiceChanging={practiceChanging}
          highImpact={highImpact}
          latestArticles={latestArticles}
        />
      </main>
    </div>
  );
}
