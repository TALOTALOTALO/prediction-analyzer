import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedPage = createRouteMatcher([
  "/history(.*)",
  "/coach(.*)",
  "/portfolio(.*)",
]);

const isProtectedApi = createRouteMatcher([
  "/api/analyze",
  "/api/analyze-url",
  "/api/analyze-parlay",
  "/api/build-parlay",
  "/api/history(.*)",
  "/api/coach",
  "/api/checkout",
  "/api/portal",
  "/api/sync-subscription",
  "/api/paper-trades(.*)",
  "/api/manual-trades(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();
  if (!userId) {
    if (isProtectedApi(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (isProtectedPage(req)) {
      const signInUrl = new URL("/sign-in", req.url);
      signInUrl.searchParams.set("redirect_url", req.nextUrl.pathname);
      return NextResponse.redirect(signInUrl);
    }
  }
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next|studio).*)","/" ,"/(api|trpc)(.*)"],
};
