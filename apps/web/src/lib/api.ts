const API_URL = process.env.NEXT_PUBLIC_API_URL || "/backend";
// Routes under `/community*` should be sent to a separate (public) Open Space API.
// We use a Next.js rewrite path by default (`/community-backend`) to avoid CORS issues.
const COMMUNITY_API_URL =
  process.env.NEXT_PUBLIC_COMMUNITY_API_URL || "/community-backend";

export function getApiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const isCommunity =
    normalizedPath === "/community" ||
    normalizedPath.startsWith("/community/");

  const base = isCommunity ? COMMUNITY_API_URL : API_URL;
  return `${base.replace(/\/$/, "")}${normalizedPath}`;
}
