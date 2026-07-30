/** Public Open Space site (hosted). Empty = use in-app /community routes. */
export function getPublicOpenSpaceBaseUrl(): string | null {
  const raw = (process.env.NEXT_PUBLIC_OPEN_SPACE_URL || "").trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

export function getPublicOpenSpaceHref(path = "/open-space"): string | null {
  const base = getPublicOpenSpaceBaseUrl();
  if (!base) return null;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}

/** Built as the public Open Space host (Docker), not the local editor. */
export function isPublicOpenSpaceSite(): boolean {
  return process.env.NEXT_PUBLIC_SITE_MODE === "open-space";
}

/** True when this is the local editor (not the public Open Space host). */
export function isLocalEditorHost(): boolean {
  if (isPublicOpenSpaceSite()) return false;
  if (typeof window === "undefined") return true;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}
