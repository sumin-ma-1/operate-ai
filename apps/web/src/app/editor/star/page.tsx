"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SpinnerIcon } from "@/components/ui/SpinnerIcon";
import { fetchCommunityPost } from "@/lib/workflow-api";
import { starWorkflow } from "@/lib/workflow-stars";

function EditorStarInner() {
  const params = useSearchParams();
  const postId = params.get("postId") ?? "";

  const [loading, setLoading] = useState(Boolean(postId));
  const [error, setError] = useState<string | null>(
    postId ? null : "Missing postId in URL"
  );
  const [title, setTitle] = useState<string | null>(null);

  useEffect(() => {
    if (!postId) return;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const post = await fetchCommunityPost(postId);
        starWorkflow({
          id: post.id,
          title: post.title,
          workflow: post.workflow,
          sourcePostId: post.id,
          authorName: post.authorName,
        });
        setTitle(post.title);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Star failed");
      } finally {
        setLoading(false);
      }
    })();
  }, [postId]);

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 p-8">
      <Card className="w-full max-w-xl border-white/10 bg-slate-900/55 p-6 backdrop-blur-sm">
        <h1 className="text-xl font-semibold">Star from Open Space</h1>
        <p className="mt-2 text-sm text-muted">
          Saves a copy in this local editor so you can paste it from Add (+) →
          Starred.
        </p>

        {loading ? (
          <div className="mt-6 flex items-center gap-3 text-sm text-muted">
            <SpinnerIcon size={18} />
            Starring…
          </div>
        ) : error ? (
          <div className="mt-6 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-emerald-200">
              Starred{title ? `: ${title}` : ""}. Open a workflow and use Add (+)
              → Starred to paste it onto the canvas.
            </p>
            <Link href="/">
              <Button variant="secondary" className="!rounded-full">
                Back to workflows
              </Button>
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function EditorStarPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center text-sm text-muted">
          <SpinnerIcon size={18} />
        </div>
      }
    >
      <EditorStarInner />
    </Suspense>
  );
}
