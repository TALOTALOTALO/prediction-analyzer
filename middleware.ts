import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/analyze(.*)",
  "/history(.*)",
  "/picks(.*)",
  "/api/analyze",
  "/api/history",
  "/api/picks",
  "/api/checkout",
  "/api/portal",
  "/api/subscription",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) await auth.protect();
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next|studio).*)","/" ,"/(api|trpc)(.*)"],
};
