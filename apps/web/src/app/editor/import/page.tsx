"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { SpinnerIcon } from "@/components/ui/SpinnerIcon";
import { Card } from "@/components/ui/Card";
import { forkCommunityPost, saveWorkflow } from "@/lib/workflow-api";
import type { WorkflowDefinition } from "@operate-ai/workflow-schema";

function EditorImportInner() {
  const router = useRouter();
  const params = useSearchParams();
  const postId = params.get("postId") ?? "";

  const localEditorInfo = useMemo(() => {
    const local = process.env.NEXT_PUBLIC_LOCAL_EDITOR_URL;
    return local || "local editor";
  }, []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!postId) return;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const remoteWorkflow = (await forkCommunityPost(
          postId
        )) as WorkflowDefinition;
        const saved = await saveWorkflow(remoteWorkflow);
        router.replace(`/editor/${saved.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Import failed");
      } finally {
        setLoading(false);
      }
    })();
  }, [postId, router]);

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 p-8">
      <Card className="w-full max-w-xl border-white/10 bg-slate-900/55 backdrop-blur-sm p-6">
        <h1 className="text-xl font-semibold">Import from Open Space</h1>
        <p className="mt-2 text-sm text-muted">
          {postId ? `postId: ${postId}` : "Missing postId in URL"}
        </p>

        {loading ? (
          <div className="mt-6 flex items-center gap-3 text-sm text-muted">
            <SpinnerIcon size={18} />
            Importing to {localEditorInfo}…
          </div>
        ) : error ? (
          <div className="mt-6 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        ) : (
          <div className="mt-6">
            <Button
              variant="secondary"
              className="!rounded-full"
              onClick={() => router.push("/editor/new")}
            >
              Go to editor
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function EditorImportPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center text-sm text-muted">
          <SpinnerIcon size={18} />
        </div>
      }
    >
      <EditorImportInner />
    </Suspense>
  );
}
