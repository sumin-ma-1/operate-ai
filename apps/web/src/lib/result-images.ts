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

export function downloadImage(
  raw: string,
  filename = "generated-image.png"
): void {
  const url = toImageDataUrl(raw);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function copyImageToClipboard(raw: string): Promise<void> {
  const url = toImageDataUrl(raw);
  const response = await fetch(url);
  const blob = await response.blob();
  const type = blob.type || "image/png";

  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    await navigator.clipboard.write([new ClipboardItem({ [type]: blob })]);
    return;
  }

  throw new Error("Clipboard image copy is not supported in this browser");
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
