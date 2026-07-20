"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import {
  ATTACHMENT_ACCEPT,
  attachmentKindLabel,
  fileToAttachment,
  isSupportedAttachmentFile,
} from "@/lib/attachments";
import type { WorkflowAttachment } from "@operate-ai/workflow-schema";

interface InputAttachmentsProps {
  attachments: WorkflowAttachment[];
  onChange: (attachments: WorkflowAttachment[]) => void;
}

export function InputAttachments({
  attachments,
  onChange,
}: InputAttachmentsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;

    setError(null);
    const next = [...attachments];

    for (const file of Array.from(files)) {
      if (!isSupportedAttachmentFile(file)) {
        setError(`${file.name}: unsupported file type.`);
        continue;
      }

      try {
        next.push(await fileToAttachment(file));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to attach file.");
      }
    }

    onChange(next);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const removeAttachment = (id: string) => {
    onChange(attachments.filter((item) => item.id !== id));
  };

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label className="block text-xs text-muted">Attachments</label>
        <Button
          type="button"
          variant="secondary"
          className="px-2 py-1 text-xs"
          onClick={() => inputRef.current?.click()}
        >
          Add file
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ATTACHMENT_ACCEPT}
        className="hidden"
        onChange={(event) => handleFiles(event.target.files)}
      />

      {attachments.length > 0 ? (
        <ul className="space-y-2 rounded-md border border-border bg-background p-2">
          {attachments.map((attachment) => (
            <li
              key={attachment.id}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{attachment.name}</p>
                <p className="text-muted">{attachmentKindLabel(attachment.kind)}</p>
              </div>
              <button
                type="button"
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-card hover:text-red-300"
                onClick={() => removeAttachment(attachment.id)}
                title="Remove attachment"
                aria-label={`Remove ${attachment.name}`}
              >
                <span className="material-icons text-[16px] leading-none">
                  close
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-md border border-dashed border-border px-3 py-4 text-xs text-muted">
          Attach text files, Office documents (.docx, .xlsx, .pptx), PDF, HWP,
          or images. Documents are converted to text when the workflow runs.
        </p>
      )}

      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  );
}
