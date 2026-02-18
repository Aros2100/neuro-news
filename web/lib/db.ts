import { createClient } from "@supabase/supabase-js";

export interface Article {
  id: number;
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
  summary: string;
  importance: string;
  category: string;
  news_value: number;
  subspecialty: string;
  article_type: string;
  clinical_relevance: string;
  pmid: string;
  citation_count: number;
  grants: string;
  coi_statement: string;
  is_open_access: number;
  pmc_id: string;
  issn: string;
  impact_factor: number | null;
  url: string;
  fetched_at: string;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getArticles(): Promise<Article[]> {
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .order("news_value", { ascending: false })
    .order("id", { ascending: false });

  if (error) throw error;
  return data as Article[];
}

export async function getHighImpactCount(minIF: number): Promise<number> {
  const { count, error } = await supabase
    .from("articles")
    .select("*", { count: "exact", head: true })
    .gte("impact_factor", minIF);

  if (error) return 0;
  return count ?? 0;
}

export async function getArticle(id: number): Promise<Article | undefined> {
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return undefined;
  return data as Article;
}
