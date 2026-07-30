/** Public Open Space site (hosted). Empty = use in-app /community routes. */
export function getPublicOpenSpaceBaseUrl(): string | null {
  const raw = (process.env.NEXT_PUBLIC_OPEN_SPACE_URL || "").trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

/** Default bounce target is the public marketing home (`/`). */
export function getPublicOpenSpaceHref(path = "/"): string | null {
  const base = getPublicOpenSpaceBaseUrl();
  if (!base) return null;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}

/** Local Operate AI editor base URL (for Open as new / import). */
export function getLocalEditorBaseUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_LOCAL_EDITOR_URL || "").trim();
  if (raw) return raw.replace(/\/$/, "");
  return "http://localhost:3000";
}

/**
 * Probe whether the local editor responds. Uses `no-cors` so a public HTTPS
 * Open Space page can check `http://localhost` without CORS headers.
 * Connection refused / timeout → false.
 */
export async function isLocalEditorReachable(
  baseUrl = getLocalEditorBaseUrl(),
  timeoutMs = 2200
): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(`${baseUrl.replace(/\/$/, "")}/`, {
      method: "GET",
      mode: "no-cors",
      cache: "no-store",
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

/** Repo URL for “Get the editor” (clone / install instructions). */
export function getEditorRepoUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_EDITOR_REPO_URL || "").trim();
  if (raw) return raw.replace(/\/$/, "");
  return "https://github.com/sumin-ma-1/operate-ai";
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
