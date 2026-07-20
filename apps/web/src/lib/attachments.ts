import type { WorkflowAttachment } from "@operate-ai/workflow-schema";

const TEXT_EXTENSIONS = new Set(["txt", "md", "json", "csv"]);
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif"]);
const DOCUMENT_EXTENSIONS = new Set([
  "docx",
  "xlsx",
  "pptx",
  "pdf",
  "hwp",
]);

const MAX_TEXT_BYTES = 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

const SUPPORTED_EXTENSIONS = new Set([
  ...TEXT_EXTENSIONS,
  ...IMAGE_EXTENSIONS,
  ...DOCUMENT_EXTENSIONS,
]);

export const ATTACHMENT_ACCEPT = [
  ".txt",
  ".md",
  ".json",
  ".csv",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".docx",
  ".xlsx",
  ".pptx",
  ".pdf",
  ".hwp",
].join(",");

function getExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.at(-1)!.toLowerCase() : "";
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error(`Failed to read ${file.name}`));
        return;
      }
      const base64 = result.split(",")[1];
      if (!base64) {
        reject(new Error(`Failed to encode ${file.name}`));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export function isSupportedAttachmentFile(file: File): boolean {
  const extension = getExtension(file.name);
  return SUPPORTED_EXTENSIONS.has(extension);
}

function attachmentKindLabel(kind: WorkflowAttachment["kind"]): string {
  switch (kind) {
    case "text":
      return "Text file";
    case "image":
      return "Image";
    case "document":
      return "Document";
  }
}

export async function fileToAttachment(file: File): Promise<WorkflowAttachment> {
  const extension = getExtension(file.name);

  if (TEXT_EXTENSIONS.has(extension)) {
    if (file.size > MAX_TEXT_BYTES) {
      throw new Error(`${file.name} is too large (max 1 MB for text files).`);
    }

    const content = await file.text();
    return {
      id: crypto.randomUUID(),
      name: file.name,
      mimeType: file.type || "text/plain",
      kind: "text",
      content,
    };
  }

  if (IMAGE_EXTENSIONS.has(extension)) {
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error(`${file.name} is too large (max 5 MB for images).`);
    }

    const content = await readFileAsBase64(file);
    return {
      id: crypto.randomUUID(),
      name: file.name,
      mimeType: file.type || `image/${extension === "jpg" ? "jpeg" : extension}`,
      kind: "image",
      content,
    };
  }

  if (DOCUMENT_EXTENSIONS.has(extension)) {
    if (file.size > MAX_DOCUMENT_BYTES) {
      throw new Error(`${file.name} is too large (max 10 MB for documents).`);
    }

    const content = await readFileAsBase64(file);
    return {
      id: crypto.randomUUID(),
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      kind: "document",
      content,
    };
  }

  throw new Error(
    `Unsupported file type: ${file.name}. Supported: ${ATTACHMENT_ACCEPT}.`
  );
}

export function formatAttachmentSummary(
  attachments: WorkflowAttachment[] | undefined
): string {
  if (!attachments?.length) {
    return "";
  }

  const textCount = attachments.filter((item) => item.kind === "text").length;
  const imageCount = attachments.filter((item) => item.kind === "image").length;
  const documentCount = attachments.filter((item) => item.kind === "document").length;
  const parts: string[] = [];

  if (textCount > 0) {
    parts.push(`${textCount} text`);
  }
  if (documentCount > 0) {
    parts.push(`${documentCount} doc${documentCount > 1 ? "s" : ""}`);
  }
  if (imageCount > 0) {
    parts.push(`${imageCount} image${imageCount > 1 ? "s" : ""}`);
  }

  return parts.join(", ");
}

export { attachmentKindLabel };
