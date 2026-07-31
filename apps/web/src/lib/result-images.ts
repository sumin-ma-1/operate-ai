/** Build a browser-usable data URL from raw base64 (or pass through if already data:). */
export function toImageDataUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("data:")) {
    const comma = trimmed.indexOf(",");
    if (comma === -1) {
      return trimmed;
    }
    const meta = trimmed.slice(0, comma + 1);
    const payload = trimmed.slice(comma + 1).replace(/\s+/g, "");
    return `${meta}${payload}`;
  }
  return `data:image/png;base64,${trimmed.replace(/\s+/g, "")}`;
}

export function openImageInNewTab(raw: string): void {
  const url = toImageDataUrl(raw);
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) {
    const link = document.createElement("a");
    link.href = url;
    link.download = "generated-image.png";
    link.rel = "noopener";
    link.click();
  }
}

/** Prefer Output node images, else the last node result that has any. */
export function getFinalOutputImages(
  nodeResults: { nodeType: string; images?: string[] }[]
): string[] {
  const reversed = [...nodeResults].reverse();
  const fromOutput = reversed.find(
    (result) => result.nodeType === "output" && result.images?.length
  );
  if (fromOutput?.images?.length) {
    return fromOutput.images;
  }
  const any = reversed.find((result) => result.images?.length);
  return any?.images ?? [];
}
