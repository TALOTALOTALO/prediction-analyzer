import { MetadataRoute } from "next";
import { sanityClient } from "@/lib/sanity";
import { getSupabase } from "@/lib/supabase";

const BASE_URL = "https://www.fademe.ai";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "weekly", priority: 1.0 },
    { url: `${BASE_URL}/blog`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/analyze`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/picks`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE_URL}/record`, lastModified: new Date(), changeFrequency: "daily", priority: 0.85 },
    { url: `${BASE_URL}/archive`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE_URL}/terms`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/privacy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  ];

  let postPages: MetadataRoute.Sitemap = [];
  try {
    const posts: { slug: string; publishedAt: string }[] = await sanityClient.fetch(
      `*[_type == "post"]{ "slug": slug.current, publishedAt }`
    );
    postPages = posts.map((p) => ({
      url: `${BASE_URL}/blog/${p.slug}`,
      lastModified: new Date(p.publishedAt),
      changeFrequency: "monthly",
      priority: 0.7,
    }));
  } catch {
    // Sanity unavailable at build time — sitemap still includes static pages
  }

  let pickDatePages: MetadataRoute.Sitemap = [];
  try {
    const { data } = await getSupabase()
      .from("daily_picks")
      .select("pick_date")
      .order("pick_date", { ascending: false });

    const uniqueDates = [...new Set((data ?? []).map((r) => r.pick_date as string))];
    pickDatePages = uniqueDates.map((date) => ({
      url: `${BASE_URL}/picks/${date}`,
      lastModified: new Date(date + "T23:59:00"),
      changeFrequency: "weekly",
      priority: 0.75,
    }));
  } catch {
    // Supabase unavailable at build time
  }

  return [...staticPages, ...postPages, ...pickDatePages];
}
