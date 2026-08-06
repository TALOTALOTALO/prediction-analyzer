import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/analyze(.*)",
  "/history(.*)",
  "/coach(.*)",
  "/portfolio(.*)",
  "/api/analyze",
  "/api/history(.*)",
  "/api/coach",
  "/api/checkout",
  "/api/portal",
  "/api/subscription",
  "/api/sync-subscription",
  "/api/paper-trades(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) await auth.protect();
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next|studio).*)","/" ,"/(api|trpc)(.*)"],
};
