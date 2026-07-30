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

/** True when this browser tab is the local editor, not the public Open Space host. */
export function isLocalEditorHost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}
