"use client";

import { useRef, useState } from "react";

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

const emptyHint =
  "Attach text files here if needed";

function AddAttachmentZone({
  label,
  compact = false,
  onClick,
}: {
  label: string;
  compact?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`group relative flex w-full items-center justify-center rounded-md border border-dashed border-border transition hover:border-sky-400/40 hover:bg-sky-500/5 ${
        compact ? "px-3 py-2.5" : "px-3 py-4"
      }`}
    >
      <p
        className={`text-center text-muted transition-opacity duration-150 group-hover:opacity-0 ${
          compact ? "text-[11px]" : "text-xs"
        }`}
      >
        {label}
      </p>
      <span className="material-icons absolute text-[18px] leading-none text-muted opacity-0 transition-opacity duration-150 group-hover:text-sky-300 group-hover:opacity-100">
        add
      </span>
    </button>
  );
}

export function InputAttachments({
  attachments,
  onChange,
}: InputAttachmentsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const openFilePicker = () => {
    inputRef.current?.click();
  };

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
      <label className="mb-1 block text-xs text-muted">Attachments</label>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ATTACHMENT_ACCEPT}
        className="hidden"
        onChange={(event) => handleFiles(event.target.files)}
      />

      {attachments.length > 0 ? (
        <>
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
          <div className="mt-2">
            <AddAttachmentZone
              compact
              label="Add another file"
              onClick={openFilePicker}
            />
          </div>
        </>
      ) : (
        <AddAttachmentZone label={emptyHint} onClick={openFilePicker} />
      )}

      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  );
}
