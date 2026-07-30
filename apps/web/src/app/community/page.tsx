"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { OpenSpaceShell } from "@/components/open-space/OpenSpaceShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import {
  getPublicOpenSpaceHref,
  isLocalEditorHost,
  isPublicOpenSpaceSite,
} from "@/lib/open-space-url";
import { fetchCommunityPosts } from "@/lib/workflow-api";
import type { CommunityPostSummary } from "@operate-ai/workflow-schema";

type SortMode = "newest" | "forks";

export default function CommunityPage() {
  const [posts, setPosts] = useState<CommunityPostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("newest");
  const publicHref = getPublicOpenSpaceHref("/");
  const bounceToPublic = Boolean(publicHref && isLocalEditorHost());
  const usePublicShell = isPublicOpenSpaceSite();

  useEffect(() => {
    if (bounceToPublic && publicHref) {
      window.location.replace(publicHref);
    }
  }, [bounceToPublic, publicHref]);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCommunityPosts({
        q: query.trim() || undefined,
        sort,
      });
      setPosts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load community");
    } finally {
      setLoading(false);
    }
  }, [query, sort]);

  useEffect(() => {
    if (bounceToPublic) return;
    const handle = window.setTimeout(() => {
      void loadPosts();
    }, 200);
    return () => window.clearTimeout(handle);
  }, [loadPosts, bounceToPublic]);

  if (bounceToPublic) {
    return (
      <p className="p-8 text-center text-sm text-muted">
        Opening public Open Space…
      </p>
    );
  }

  const sortChip = (active: boolean) =>
    `!h-8 !rounded-full !px-3.5 !py-0 text-xs font-medium leading-none transition ${
      active
        ? "!border !border-sky-400/50 !bg-sky-500/15 !text-sky-100 hover:!opacity-100"
        : "!border !border-white/10 !bg-transparent !text-muted hover:!border-white/20 hover:!bg-white/5 hover:!text-foreground"
    }`;

  const gallery = (
    <main className="relative z-10 mx-auto max-w-7xl px-6 pb-12 pt-8 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          {!usePublicShell && isLocalEditorHost() ? (
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-sm text-muted transition hover:text-foreground"
            >
              <span className="material-icons text-[18px] leading-none">
                arrow_back
              </span>
              Workflows
            </Link>
          ) : null}
          <h1
            className={`text-3xl font-bold ${
              !usePublicShell && isLocalEditorHost() ? "mt-3" : ""
            }`}
          >
            Gallery
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Browse community workflows. Open as new for a private copy in your
            local editor, or Star to paste into an editor you already have open.
            Publishing shares prompts publicly.
          </p>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-md">
          <span
            className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted"
            aria-hidden="true"
          >
            <span className="material-icons block translate-y-px text-[18px] leading-none">
              search
            </span>
          </span>
          <Input
            className="!rounded-full border-white/10 bg-slate-900/40 !py-2 pl-10 pr-4"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, author, tags…"
            aria-label="Search community posts"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            className={sortChip(sort === "newest")}
            onClick={() => setSort("newest")}
          >
            Newest
          </Button>
          <Button
            variant="ghost"
            className={sortChip(sort === "forks")}
            onClick={() => setSort("forks")}
          >
            Most forked
          </Button>
        </div>
      </div>

      <section className="mt-8">
        {loading && (
          <p className="text-center text-muted">Loading community…</p>
        )}
        {error && (
          <p className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </p>
        )}
        {!loading && !error && posts.length === 0 && (
          <p className="rounded-lg border border-dashed border-white/15 bg-slate-900/40 px-6 py-12 text-center text-muted">
            No posts yet. Open a workflow in the editor and publish it to Open
            Space.
          </p>
        )}
        {!loading && !error && posts.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Card
                key={post.id}
                className="flex h-full flex-col gap-3 border-white/10 bg-slate-900/50 backdrop-blur-sm transition duration-300 hover:border-sky-400/40 hover:bg-slate-800/70"
              >
                <div className="flex-1">
                  <h2 className="text-lg font-semibold">{post.title}</h2>
                  <p className="mt-1 text-xs text-muted">
                    by {post.authorName}
                  </p>
                  {post.description ? (
                    <p className="mt-2 line-clamp-3 text-sm text-muted">
                      {post.description}
                    </p>
                  ) : null}
                  {post.tags.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {post.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-muted"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-muted">
                  <span>
                    {post.nodeCount} nodes · {post.forkCount} forks
                  </span>
                  <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                </div>
                <Link href={`/community/${post.id}`}>
                  <Button
                    variant="secondary"
                    className="inline-flex w-full items-center justify-center gap-1.5 !rounded-full"
                  >
                    <span className="material-icons text-[18px] leading-none">
                      visibility
                    </span>
                    View
                  </Button>
                </Link>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  );

  if (usePublicShell) {
    return <OpenSpaceShell active="gallery">{gallery}</OpenSpaceShell>;
  }

  return <div className="space-backdrop min-h-screen">{gallery}</div>;
}
