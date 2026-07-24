"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { PublishCommunityModal } from "@/components/editor/PublishCommunityModal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SpinnerIcon } from "@/components/ui/SpinnerIcon";
import { Toast } from "@/components/ui/Toast";
import { saveWorkflow } from "@/lib/workflow-api";
import { useWorkflowStore } from "@/stores/workflowStore";

export function EditorHeader() {
  const router = useRouter();
  const workflowId = useWorkflowStore((state) => state.workflowId);
  const workflowName = useWorkflowStore((state) => state.workflowName);
  const updatedAt = useWorkflowStore((state) => state.updatedAt);
  const setWorkflowMeta = useWorkflowStore((state) => state.setWorkflowMeta);
  const toWorkflowDefinition = useWorkflowStore((state) => state.toWorkflowDefinition);
  const [isSaving, setIsSaving] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    variant: "success" | "error";
  } | null>(null);

  const clearToast = useCallback(() => setToast(null), []);

  const handleSave = async () => {
    setIsSaving(true);
    setToast(null);

    try {
      const workflow = toWorkflowDefinition();
      const saved = await saveWorkflow(workflow);
      setWorkflowMeta(
        saved.id,
        saved.name,
        saved.updatedAt || saved.createdAt || new Date().toISOString()
      );
      setToast({ message: "Saved", variant: "success" });
      router.replace(`/editor/${saved.id}`);
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Save failed",
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-muted transition hover:bg-background hover:text-foreground"
            title="Back to workflows"
            aria-label="Back to workflows"
          >
            <span className="material-icons text-[20px] leading-none">
              arrow_back
            </span>
            <span>Workflows</span>
          </Link>
          <div className="flex items-center gap-2.5">
            <Input
              className="w-64"
              value={workflowName}
              onChange={(event) =>
                setWorkflowMeta(workflowId, event.target.value)
              }
              placeholder="Workflow name"
            />
            {updatedAt && (
              <span className="whitespace-nowrap text-xs text-muted/55">
                Updated at {new Date(updatedAt).toLocaleString()}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => setPublishOpen(true)}
            className="!rounded-full px-4"
          >
            Publish
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 !rounded-full !border-0 !bg-gradient-to-r !from-sky-600 !via-indigo-600 !to-indigo-700 px-4 py-1.0 shadow-[0_2px_12px_rgba(99,102,241,0.22)] hover:shadow-[0_2px_14px_rgba(99,102,241,0.32)] hover:!opacity-100"
          >
            {isSaving ? (
              <SpinnerIcon size={18} />
            ) : (
              <span className="material-icons text-[18px] leading-none">star</span>
            )}
            {isSaving ? "Saving" : "Save"}
          </Button>
        </div>
      </header>

      <PublishCommunityModal
        open={publishOpen}
        workflow={toWorkflowDefinition()}
        onClose={() => setPublishOpen(false)}
        onPublished={(postId) => {
          setToast({
            message: "Published to Open Space",
            variant: "success",
          });
          router.push(`/community/${postId}`);
        }}
        onError={(message) => setToast({ message, variant: "error" })}
      />

      {toast && (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onClose={clearToast}
        />
      )}
    </>
  );
}
