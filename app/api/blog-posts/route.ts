import { NextResponse } from "next/server";
import { sanityClient } from "@/lib/sanity";

export const revalidate = 60;

export async function GET() {
  try {
    const posts = await sanityClient.fetch(
      `*[_type == "post"] | order(publishedAt desc) {
        _id, title, slug, excerpt, publishedAt, category, readTime, section, mainImage
      }`,
      {},
      { next: { revalidate: 60 } }
    );
    return NextResponse.json({ posts: posts ?? [] });
  } catch {
    return NextResponse.json({ posts: [] });
  }
}
