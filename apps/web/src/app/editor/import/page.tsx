"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { SpinnerIcon } from "@/components/ui/SpinnerIcon";
import { forkCommunityPost, saveWorkflow } from "@/lib/workflow-api";
import type { WorkflowDefinition } from "@operate-ai/workflow-schema";

function EditorImportInner() {
  const router = useRouter();
  const params = useSearchParams();
  const postId = params.get("postId") ?? "";

  const [error, setError] = useState<string | null>(
    postId ? null : "Missing postId in URL"
  );

  useEffect(() => {
    if (!postId) return;

    void (async () => {
      try {
        const remoteWorkflow = (await forkCommunityPost(
          postId
        )) as WorkflowDefinition;
        const saved = await saveWorkflow(remoteWorkflow);
        router.replace(`/editor/${saved.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Import failed");
      }
    })();
  }, [postId, router]);

  if (error) {
    return (
      <div className="space-backdrop flex min-h-screen flex-col items-center justify-center gap-3 p-8">
        <p className="relative z-10 max-w-md rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </p>
        <button
          type="button"
          className="relative z-10 text-sm text-sky-300/90 underline underline-offset-2"
          onClick={() => router.push("/")}
        >
          Back to workflows
        </button>
      </div>
    );
  }

  return (
    <div className="space-backdrop flex min-h-screen items-center justify-center gap-3 text-sm text-white/70">
      <SpinnerIcon size={18} className="relative z-10 text-white/70" />
      <span className="relative z-10">Opening workflow…</span>
    </div>
  );
}

export default function EditorImportPage() {
  return (
    <Suspense
      fallback={
        <div className="space-backdrop flex min-h-screen items-center justify-center text-sm text-white/70">
          <SpinnerIcon size={18} className="relative z-10" />
        </div>
      }
    >
      <EditorImportInner />
    </Suspense>
  );
}
