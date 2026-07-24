const STORAGE_KEY = "operate-ai:community-delete-tokens";

function readMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(map: Record<string, string>) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function saveCommunityDeleteToken(postId: string, token: string) {
  const map = readMap();
  map[postId] = token;
  writeMap(map);
}

export function getCommunityDeleteToken(postId: string): string | null {
  return readMap()[postId] ?? null;
}

export function removeCommunityDeleteToken(postId: string) {
  const map = readMap();
  if (!(postId in map)) return;
  delete map[postId];
  writeMap(map);
}

const AUTHOR_KEY = "operate-ai:community-author-name";

export function getSavedAuthorName(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(AUTHOR_KEY) ?? "";
}

export function saveAuthorName(name: string) {
  window.localStorage.setItem(AUTHOR_KEY, name.trim());
}
