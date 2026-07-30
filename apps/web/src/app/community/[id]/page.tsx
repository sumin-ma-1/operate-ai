"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GoogleLogin } from "@react-oauth/google";

import { OpenSpaceShell } from "@/components/open-space/OpenSpaceShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SpinnerIcon } from "@/components/ui/SpinnerIcon";
import { Toast } from "@/components/ui/Toast";
import { useAuthStore } from "@/stores/authStore";
import {
  getCommunityDeleteToken,
  removeCommunityDeleteToken,
} from "@/lib/community-local";
import { getNodeTypeLabel } from "@/lib/node-labels";
import {
  getLocalEditorBaseUrl,
  getPublicOpenSpaceHref,
  isLocalEditorHost,
  isPublicOpenSpaceSite,
} from "@/lib/open-space-url";
import {
  deleteCommunityPost,
  fetchCommunityPost,
} from "@/lib/workflow-api";
import {
  isStarred,
  starWorkflow,
  unstarWorkflow,
} from "@/lib/workflow-stars";
import type { CommunityPost, WorkflowNodeType } from "@operate-ai/workflow-schema";

export default function CommunityDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const postId = params.id;
  const publicPostHref = getPublicOpenSpaceHref(`/community/${postId}`);
  const bounceToPublic = Boolean(publicPostHref && isLocalEditorHost());
  const usePublicShell = isPublicOpenSpaceSite();

  const [post, setPost] = useState<CommunityPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forking, setForking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteToken, setDeleteToken] = useState<string | null>(null);
  const [starred, setStarred] = useState(false);
  const googleIdToken = useAuthStore((s) => s.googleIdToken);
  const setGoogleIdToken = useAuthStore((s) => s.setGoogleIdToken);
  const clearGoogleIdToken = useAuthStore((s) => s.clearGoogleIdToken);
  const [toast, setToast] = useState<{
    message: string;
    variant: "success" | "error";
  } | null>(null);

  const clearToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (bounceToPublic && publicPostHref) {
      window.location.replace(publicPostHref);
    }
  }, [bounceToPublic, publicPostHref]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCommunityPost(postId);
      setPost(data);
      setDeleteToken(getCommunityDeleteToken(postId));
      setStarred(isStarred(postId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load post");
      setPost(null);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    if (bounceToPublic) return;
    void load();
  }, [load, bounceToPublic]);

  const nodeCounts = useMemo(() => {
    if (!post) return [];
    const counts = new Map<string, number>();
    for (const node of post.workflow.nodes) {
      counts.set(node.type, (counts.get(node.type) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [post]);

  if (bounceToPublic) {
    return (
      <p className="p-8 text-center text-sm text-muted">
        Opening public Open Space…
      </p>
    );
  }

  const handleOpenAsNew = async () => {
    setForking(true);
    setError(null);
    const localEditorBase = getLocalEditorBaseUrl();
    const target = `${localEditorBase}/editor/import?postId=${encodeURIComponent(
      postId
    )}`;
    window.location.assign(target);
  };

  const handleToggleStar = () => {
    if (!post) return;

    // Public Open Space → hand off to local editor (same idea as Open as new).
    if (usePublicShell) {
      const localEditorBase = getLocalEditorBaseUrl();
      window.location.assign(
        `${localEditorBase}/editor/star?postId=${encodeURIComponent(postId)}`
      );
      return;
    }

    if (starred) {
      unstarWorkflow(post.id);
      setStarred(false);
      setToast({ message: "Removed from Starred", variant: "success" });
      return;
    }
    starWorkflow({
      id: post.id,
      title: post.title,
      workflow: post.workflow,
      sourcePostId: post.id,
      authorName: post.authorName,
    });
    setStarred(true);
    setToast({
      message: "Starred ! Use Add (+) → Starred in the editor",
      variant: "success",
    });
  };

  const galleryHref = usePublicShell ? "/open-space" : "/community";

  const handleDelete = async () => {
    if (!googleIdToken) return;
    if (!confirm("Delete this community post?")) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteCommunityPost(postId, {
        deleteToken: deleteToken ?? undefined,
        authToken: googleIdToken,
      });
      removeCommunityDeleteToken(postId);
      router.push(galleryHref);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      setDeleting(false);
    }
  };

  const detail = (
    <main className="relative z-10 mx-auto max-w-3xl px-8 pb-12 pt-8">
      <Link
        href={galleryHref}
        className="inline-flex items-center gap-1 text-sm text-muted transition hover:text-foreground"
      >
        <span className="material-icons text-[18px] leading-none">
          arrow_back
        </span>
        Gallery
      </Link>

      {loading && <p className="mt-10 text-center text-muted">Loading…</p>}
      {error && (
        <p className="mt-6 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {post && (
        <Card className="mt-6 border-white/10 bg-slate-900/55 backdrop-blur-sm">
          <h1 className="text-2xl font-bold">{post.title}</h1>
          <p className="mt-1 text-sm text-muted">
            by {post.authorName} · {post.forkCount} forks ·{" "}
            {new Date(post.createdAt).toLocaleString()}
          </p>

          {post.description ? (
            <p className="mt-4 whitespace-pre-wrap text-sm text-foreground/90">
              {post.description}
            </p>
          ) : null}

          {post.tags.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/10 px-2.5 py-0.5 text-xs text-muted"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-6 rounded-lg border border-white/10 bg-background/40 p-4">
            <h2 className="text-sm font-medium">Workflow summary</h2>
            <p className="mt-1 text-xs text-muted">
              {post.nodeCount} nodes · {post.workflow.edges.length} edges
            </p>
            <ul className="mt-3 space-y-1 text-sm text-muted">
              {nodeCounts.map(([type, count]) => (
                <li key={type}>
                  {getNodeTypeLabel(type as WorkflowNodeType)}: {count}
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-4 text-xs text-muted">
            <strong className="font-medium text-foreground/80">Open as new</strong>{" "}
            creates a private workflow in your local editor.{" "}
            <strong className="font-medium text-foreground/80">Star</strong>{" "}
            {usePublicShell
              ? "opens the local editor and saves a copy for Add (+) → Starred."
              : "keeps a copy for Add (+) → Starred so you can paste it onto an open canvas."}{" "}
            Prompts in this post are public.
          </p>

          <div className="mt-4">
            {googleIdToken ? (
              <div className="text-xs text-emerald-200">
                Signed in with Google
                <button
                  type="button"
                  className="ml-2 underline"
                  onClick={() => clearGoogleIdToken()}
                >
                  (sign out)
                </button>
              </div>
            ) : (
              <GoogleLogin
                onSuccess={(credentialResponse: any) => {
                  if (credentialResponse.credential) {
                    setGoogleIdToken(credentialResponse.credential);
                  }
                }}
                onError={() => setError("Google sign-in failed")}
                useOneTap={false}
                theme="filled_blue"
                shape="pill"
                size="large"
                text="Sign in with Google"
              />
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button
              onClick={handleOpenAsNew}
              disabled={forking}
              className="inline-flex items-center gap-1.5 !rounded-full !border-0 !bg-gradient-to-r !from-sky-600 !via-indigo-600 !to-indigo-700 px-5"
            >
              {forking ? <SpinnerIcon size={18} /> : null}
              {forking ? "Opening…" : "Open as new"}
            </Button>
            <Button
              variant="secondary"
              onClick={handleToggleStar}
              className="inline-flex items-center gap-1.5 !rounded-full px-4"
            >
              <span className="material-icons text-[18px] leading-none">
                {usePublicShell || !starred ? "star_border" : "star"}
              </span>
              {usePublicShell ? "Star in editor" : starred ? "Unstar" : "Star"}
            </Button>
            {googleIdToken ? (
              <Button
                variant="ghost"
                disabled={deleting}
                className="!rounded-full text-red-300/70 hover:text-red-300"
                onClick={handleDelete}
              >
                {deleting ? "Deleting…" : "Delete post"}
              </Button>
            ) : null}
          </div>
        </Card>
      )}
    </main>
  );

  const toastNode = toast ? (
    <Toast
      message={toast.message}
      variant={toast.variant}
      onClose={clearToast}
    />
  ) : null;

  if (usePublicShell) {
    return (
      <OpenSpaceShell active="gallery">
        {detail}
        {toastNode}
      </OpenSpaceShell>
    );
  }

  return (
    <div className="space-backdrop min-h-screen">
      {detail}
      {toastNode}
    </div>
  );
}
