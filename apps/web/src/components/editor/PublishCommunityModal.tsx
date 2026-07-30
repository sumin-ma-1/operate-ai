"use client";

import { useEffect, useState, type FormEvent } from "react";
import { GoogleLogin } from "@react-oauth/google";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SpinnerIcon } from "@/components/ui/SpinnerIcon";
import { Textarea } from "@/components/ui/Textarea";
import { useAuthStore } from "@/stores/authStore";
import {
  getSavedAuthorName,
  saveAuthorName,
  saveCommunityDeleteToken,
} from "@/lib/community-local";
import { publishCommunityPost } from "@/lib/workflow-api";
import type { WorkflowDefinition } from "@operate-ai/workflow-schema";

type PublishCommunityModalProps = {
  open: boolean;
  workflow: WorkflowDefinition;
  onClose: () => void;
  onPublished: (postId: string) => void;
  onError: (message: string) => void;
};

function displayNameFromGoogleIdToken(token: string): string {
  try {
    const payload = JSON.parse(atob(token.split(".")[1] ?? "")) as {
      name?: string;
      given_name?: string;
      email?: string;
    };
    return (
      payload.name?.trim() ||
      payload.given_name?.trim() ||
      payload.email?.split("@")[0]?.trim() ||
      ""
    );
  } catch {
    return "";
  }
}

export function PublishCommunityModal({
  open,
  workflow,
  onClose,
  onPublished,
  onError,
}: PublishCommunityModalProps) {
  const [authorName, setAuthorName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [publishing, setPublishing] = useState(false);
  const googleIdToken = useAuthStore((s) => s.googleIdToken);
  const setGoogleIdToken = useAuthStore((s) => s.setGoogleIdToken);
  const clearGoogleIdToken = useAuthStore((s) => s.clearGoogleIdToken);

  useEffect(() => {
    if (!open) return;
    setTitle(workflow.name || "Untitled Workflow");
    setDescription("");
    setTagsInput("");
  }, [open, workflow.name]);

  useEffect(() => {
    if (!open || !googleIdToken) return;
    const saved = getSavedAuthorName();
    const fromGoogle = displayNameFromGoogleIdToken(googleIdToken);
    setAuthorName(saved || fromGoogle);
  }, [open, googleIdToken]);

  if (!open) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedAuthor = authorName.trim();
    const trimmedTitle = title.trim();
    if (!trimmedAuthor || !trimmedTitle) {
      onError("Author name and title are required");
      return;
    }
    if (!googleIdToken) {
      onError("Please sign in with Google to publish.");
      return;
    }

    const tags = tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 8);

    setPublishing(true);
    try {
      saveAuthorName(trimmedAuthor);
      const post = await publishCommunityPost(
        {
          authorName: trimmedAuthor,
          title: trimmedTitle,
          description: description.trim() || undefined,
          tags: tags.length ? tags : undefined,
          workflow,
        },
        googleIdToken
      );
      if (post.deleteToken) {
        saveCommunityDeleteToken(post.id, post.deleteToken);
      }
      onPublished(post.id);
      onClose();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="publish-community-title"
      onClick={onClose}
    >
      <form
        className="relative w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={publishing}
          aria-label="Close"
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-muted/50 transition hover:bg-white/5 hover:text-muted disabled:opacity-40"
        >
          <span className="material-icons text-[20px] leading-none">close</span>
        </button>

        <h2
          id="publish-community-title"
          className="pr-10 text-lg font-semibold"
        >
          Publish to Open Space
        </h2>
        <p className="mt-1 text-xs text-muted">
          A snapshot of this workflow will be public, including system prompts.
          Large file attachments are stripped.
        </p>

        <div className="mt-4 flex flex-col gap-2">
          {googleIdToken ? (
            <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-200">
              <span className="material-icons text-[14px] leading-none text-emerald-300/90">
                check_circle
              </span>
              <span>Signed in with Google</span>
              <button
                type="button"
                className="ml-0.5 text-emerald-200/70 underline-offset-2 transition hover:text-emerald-100 hover:underline"
                onClick={() => clearGoogleIdToken()}
              >
                sign out
              </button>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted">
                Sign in with Google to continue. Then you can set author name,
                title, and description.
              </p>
              <div className="mt-3">
                <GoogleLogin
                  onSuccess={(credentialResponse) => {
                    if (credentialResponse.credential) {
                      setGoogleIdToken(credentialResponse.credential);
                    }
                  }}
                  onError={() => onError("Google sign-in failed")}
                  useOneTap={false}
                  theme="filled_blue"
                  shape="pill"
                  size="large"
                  text="signin_with"
                />
              </div>
            </>
          )}
        </div>

        {googleIdToken ? (
          <>
            <label className="mt-4 block text-xs font-medium text-muted">
              Author name
              <Input
                className="mt-1"
                value={authorName}
                onChange={(event) => setAuthorName(event.target.value)}
                maxLength={64}
                required
                placeholder="Nickname"
              />
            </label>

            <label className="mt-3 block text-xs font-medium text-muted">
              Title
              <Input
                className="mt-1"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={120}
                required
              />
            </label>

            <label className="mt-3 block text-xs font-medium text-muted">
              Description
              <Textarea
                className="mt-1 min-h-[88px]"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={2000}
                placeholder="What does this workflow do?"
              />
            </label>

            <label className="mt-3 block text-xs font-medium text-muted">
              Tags (comma-separated)
              <Input
                className="mt-1"
                value={tagsInput}
                onChange={(event) => setTagsInput(event.target.value)}
                placeholder="research, writing, tools"
              />
            </label>

            <div className="mt-5 flex justify-end">
              <Button
                type="submit"
                disabled={publishing}
                className="inline-flex items-center gap-1.5 !rounded-full"
              >
                {publishing ? (
                  <SpinnerIcon size={16} />
                ) : (
                  <span className="material-icons text-[18px] leading-none">
                    public
                  </span>
                )}
                {publishing ? "Publishing…" : "Publish"}
              </Button>
            </div>
          </>
        ) : null}
      </form>
    </div>
  );
}
