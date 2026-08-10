"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { SpinnerIcon } from "@/components/ui/SpinnerIcon";
import {
  getLocalEditorBaseUrl,
  getPublicOpenSpaceBaseUrl,
  isRunningInsideTauri,
} from "@/lib/open-space-url";
import { fetchCommunityPost } from "@/lib/workflow-api";
import { starWorkflow } from "@/lib/workflow-stars";

function isAllowedReturnTo(url: string): boolean {
  try {
    const target = new URL(url);
    if (target.protocol !== "http:" && target.protocol !== "https:") {
      return false;
    }
    if (target.hostname === "localhost" || target.hostname === "127.0.0.1") {
      return true;
    }
    const allowed = new Set<string>();
    const publicBase = getPublicOpenSpaceBaseUrl();
    if (publicBase) allowed.add(new URL(publicBase).origin);
    allowed.add(new URL(getLocalEditorBaseUrl()).origin);
    if (typeof window !== "undefined") allowed.add(window.location.origin);
    return allowed.has(target.origin);
  } catch {
    return false;
  }
}

function EditorStarInner() {
  const params = useSearchParams();
  const postId = params.get("postId") ?? "";
  const returnTo = params.get("returnTo") ?? "";

  const [error, setError] = useState<string | null>(
    postId ? null : "Missing postId in URL"
  );

  useEffect(() => {
    if (!postId) return;

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

        // Browser handoff from public Open Space: bounce back for the toast.
        // Inside the desktop app, stay local (webview cannot leave for public).
        if (
          returnTo &&
          !isRunningInsideTauri() &&
          isAllowedReturnTo(returnTo)
        ) {
          const target = new URL(returnTo);
          if (target.origin !== window.location.origin) {
            target.searchParams.set("starred", post.title || "1");
            window.location.replace(target.toString());
            return;
          }
        }

        const home = new URL("/", window.location.origin);
        home.searchParams.set("starred", post.title || "1");
        window.location.replace(home.toString());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Star failed");
      }
    })();
  }, [postId, returnTo]);

  if (error) {
    return (
      <div className="space-backdrop flex min-h-screen flex-col items-center justify-center gap-3 p-8">
        <p className="relative z-10 max-w-md rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </p>
        <a
          href="/"
          className="relative z-10 text-sm text-sky-300/90 underline underline-offset-2"
        >
          Back to workflows
        </a>
      </div>
    );
  }

  return (
    <div className="space-backdrop flex min-h-screen items-center justify-center gap-3 text-sm text-white/70">
      <SpinnerIcon size={18} className="relative z-10 text-white/70" />
      <span className="relative z-10">Saving to Starred…</span>
    </div>
  );
}

export default function EditorStarPage() {
  return (
    <Suspense
      fallback={
        <div className="space-backdrop flex min-h-screen items-center justify-center text-sm text-white/70">
          <SpinnerIcon size={18} className="relative z-10" />
        </div>
      }
    >
      <EditorStarInner />
    </Suspense>
  );
}
