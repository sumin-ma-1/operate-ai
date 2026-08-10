"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { GoogleSignInTrigger } from "@/components/auth/GoogleSignInTrigger";
import { OpenSpaceShell } from "@/components/open-space/OpenSpaceShell";
import { Button } from "@/components/ui/Button";
import {
  Card,
  glassCardButtonClassName,
  glassCardSurfaceClassName,
} from "@/components/ui/Card";
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
  const googleSignInRef = useRef<(() => void) | null>(null);
  const googleIdToken = useAuthStore((s) => s.googleIdToken);
  const setGoogleIdToken = useAuthStore((s) => s.setGoogleIdToken);
  const clearGoogleIdToken = useAuthStore((s) => s.clearGoogleIdToken);
  const [toast, setToast] = useState<{
    message: string;
    variant: "success" | "error";
    durationMs?: number;
    actions?: Array<{ label: string; onClick: () => void; danger?: boolean }>;
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

  const galleryHref = usePublicShell ? "/open-space" : "/community";

  const performDelete = useCallback(async () => {
    if (!googleIdToken) return;
    setToast(null);
    setDeleting(true);
    setError(null);
    try {
      await deleteCommunityPost(postId, {
        deleteToken: deleteToken ?? undefined,
        authToken: googleIdToken,
      });
      removeCommunityDeleteToken(postId);
      setToast({
        message: "Post deleted",
        variant: "success",
        durationMs: 1600,
      });
      window.setTimeout(() => {
        router.push(galleryHref);
      }, 900);
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Delete failed";
      const denied =
        /not authorized|forbidden|invalid delete token|403/i.test(raw);
      setToast({
        message: denied
          ? "Delete denied - you are not allowed to remove this post"
          : raw,
        variant: "error",
        durationMs: 3200,
      });
      setDeleting(false);
    }
  }, [deleteToken, galleryHref, googleIdToken, postId, router]);

  const handleDelete = () => {
    if (!googleIdToken || deleting) return;
    setToast({
      message: "Delete this post?",
      variant: "error",
      durationMs: 0,
      actions: [
        {
          label: "Cancel",
          onClick: () => setToast(null),
        },
        {
          label: "Delete",
          danger: true,
          onClick: () => {
            void performDelete();
          },
        },
      ],
    });
  };

  const handleSignOut = () => {
    setToast({
      message: "Sign out of Google?",
      variant: "error",
      durationMs: 0,
      actions: [
        {
          label: "Cancel",
          onClick: () => setToast(null),
        },
        {
          label: "Sign out",
          danger: true,
          onClick: () => {
            clearGoogleIdToken();
            setToast({
              message: "Signed out",
              variant: "success",
              durationMs: 1800,
            });
          },
        },
      ],
    });
  };

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
    // Do not probe localhost with fetch from public HTTPS — browsers block
    // private-network requests, so a live editor looks "down". Top-level
    // navigation to the local editor still works when it is running.
    const localEditorBase = getLocalEditorBaseUrl();
    const target = `${localEditorBase}/editor/import?postId=${encodeURIComponent(
      postId
    )}`;
    window.location.assign(target);
  };

  const handleToggleStar = async () => {
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
        <Card className={`mt-6 ${glassCardSurfaceClassName}`}>
          <h1 className="text-2xl font-bold text-white/95">{post.title}</h1>
          <p className="mt-1 text-sm text-white/45">
            by {post.authorName} · {post.forkCount} forks ·{" "}
            {new Date(post.createdAt).toLocaleString()}
          </p>

          {post.description ? (
            <p className="mt-4 whitespace-pre-wrap text-sm text-white/70">
              {post.description}
            </p>
          ) : null}

          {post.tags.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-0.5 text-xs text-white/60"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-6 rounded-2xl border border-white/15 bg-white/[0.05] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-md">
            <h2 className="text-sm font-medium text-white/90">
              Workflow summary
            </h2>
            <p className="mt-1 text-xs text-white/45">
              {post.nodeCount} nodes · {post.workflow.edges.length} edges
            </p>
            <ul className="mt-3 space-y-1 text-sm text-white/55">
              {nodeCounts.map(([type, count]) => (
                <li key={type}>
                  {getNodeTypeLabel(type as WorkflowNodeType)}: {count}
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-4 text-xs text-white/45">
            <strong className="font-medium text-white/75">Open as new</strong>{" "}
            creates a private workflow in your local editor.{" "}
            <strong className="font-medium text-white/75">Star</strong>{" "}
            {usePublicShell
              ? "opens the local editor and saves a copy for Add (+) → Starred."
              : "keeps a copy for Add (+) → Starred so you can paste it onto an open canvas."}{" "}
            Prompts in this post are public.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button
              onClick={handleOpenAsNew}
              disabled={forking}
              className="inline-flex items-center gap-1.5 !rounded-full !border-0 !bg-gradient-to-r !from-sky-600 !via-indigo-600 !to-indigo-700 px-5 shadow-[0_8px_24px_rgba(56,189,248,0.25)] transition duration-300 hover:!-translate-y-0.5"
            >
              {forking ? (
                <SpinnerIcon size={18} />
              ) : (
                <span className="material-icons text-[18px] leading-none">
                  draw
                </span>
              )}
              {forking ? "Opening…" : "Open as new"}
            </Button>
            <Button
              variant="secondary"
              onClick={handleToggleStar}
              className={`inline-flex items-center gap-1.5 ${glassCardButtonClassName}`}
            >
              <span className="material-icons text-[18px] leading-none">
                {usePublicShell || !starred ? "star_border" : "star"}
              </span>
              {usePublicShell ? "Star in editor" : starred ? "Unstar" : "Star"}
            </Button>
          </div>
        </Card>
      )}

      {post ? (
        <div className="mt-4">
          {googleIdToken ? (
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-200">
                <span className="material-icons text-[14px] leading-none text-emerald-300/90">
                  check_circle
                </span>
                <span>Signed in with Google</span>
                <button
                  type="button"
                  className="ml-0.5 text-emerald-200/70 underline-offset-2 transition hover:text-emerald-100 hover:underline"
                  onClick={handleSignOut}
                >
                  sign out
                </button>
              </div>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className="inline-flex w-fit items-center gap-1.5 rounded-full border border-red-400/25 bg-red-500/10 px-3 py-1.5 text-xs text-red-200 transition hover:border-red-400/40 hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="material-icons text-[14px] leading-none text-red-300/90">
                  delete
                </span>
                <span>{deleting ? "Deleting…" : "Delete post"}</span>
              </button>
            </div>
          ) : (
            <p className="text-xs text-muted">
              Posted this?{" "}
              <button
                type="button"
                className="text-sky-300/90 underline underline-offset-2 transition hover:text-sky-200"
                onClick={() => googleSignInRef.current?.()}
              >
                Sign in with Google to delete it.
              </button>{" "}
              Open as new and Star do not require sign-in.
            </p>
          )}
        </div>
      ) : null}

      {!googleIdToken ? (
        <GoogleSignInTrigger
          triggerRef={googleSignInRef}
          onCredential={(token) => setGoogleIdToken(token)}
          onError={() => setError("Google sign-in failed")}
        />
      ) : null}
    </main>
  );

  const toastNode = toast ? (
    <Toast
      message={toast.message}
      variant={toast.variant}
      placement="center"
      durationMs={toast.durationMs}
      actions={toast.actions}
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
