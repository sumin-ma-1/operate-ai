"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { saveWorkflow } from "@/lib/workflow-api";
import { useWorkflowStore } from "@/stores/workflowStore";

export function EditorHeader() {
  const router = useRouter();
  const workflowId = useWorkflowStore((state) => state.workflowId);
  const workflowName = useWorkflowStore((state) => state.workflowName);
  const setWorkflowMeta = useWorkflowStore((state) => state.setWorkflowMeta);
  const toWorkflowDefinition = useWorkflowStore((state) => state.toWorkflowDefinition);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const workflow = toWorkflowDefinition();
      const saved = await saveWorkflow(workflow);
      setWorkflowMeta(saved.id, saved.name);
      setMessage("Saved");
      router.replace(`/editor/${saved.id}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  return (
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
        <Input
          className="w-64"
          value={workflowName}
          onChange={(event) => setWorkflowMeta(workflowId, event.target.value)}
          placeholder="Workflow name"
        />
      </div>
      <div className="flex items-center gap-3">
        {message && <span className="text-xs text-muted">{message}</span>}
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex items-center gap-1.5 !rounded-full px-4 py-1.0"
        >
          <span
            className={`material-icons text-[18px] leading-none ${
              isSaving ? "animate-spin" : ""
            }`}
          >
            {isSaving ? "autorenew" : "save"}
          </span>
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>
    </header>
  );
}
