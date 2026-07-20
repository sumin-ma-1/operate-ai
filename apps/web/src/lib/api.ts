const API_URL = process.env.NEXT_PUBLIC_API_URL || "/backend";

export function getApiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_URL.replace(/\/$/, "")}${normalizedPath}`;
}
