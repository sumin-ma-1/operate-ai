"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import {
  getPublicOpenSpaceHref,
  isLocalEditorHost,
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
  const publicHref = getPublicOpenSpaceHref("/open-space");
  const bounceToPublic = Boolean(publicHref && isLocalEditorHost());

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

  return (
    <div className="space-backdrop min-h-screen">
      <main className="relative z-10 mx-auto max-w-6xl px-8 pb-12 pt-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-sm text-muted transition hover:text-foreground"
            >
              <span className="material-icons text-[18px] leading-none">
                arrow_back
              </span>
              Workflows
            </Link>
            <h1 className="mt-3 text-3xl font-bold">Open Space</h1>
            <p className="mt-1 max-w-xl text-sm text-muted">
              Browse community workflows. Open as new for a private copy, or
              Star to paste into an editor you already have open. Publishing
              shares prompts publicly.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            className="sm:max-w-md"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, author, tags…"
            aria-label="Search community posts"
          />
          <div className="flex gap-2">
            <Button
              variant={sort === "newest" ? "primary" : "secondary"}
              className="!rounded-full px-4"
              onClick={() => setSort("newest")}
            >
              Newest
            </Button>
            <Button
              variant={sort === "forks" ? "primary" : "secondary"}
              className="!rounded-full px-4"
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
              No posts yet. Open a workflow in the editor and publish it to
              Open Space.
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
                      className="w-full !rounded-full"
                    >
                      View
                    </Button>
                  </Link>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
