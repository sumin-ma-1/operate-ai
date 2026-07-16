"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { EditorHeader } from "@/components/editor/EditorHeader";
import { WorkflowEditor } from "@/components/editor/WorkflowEditor";
import { fetchWorkflow } from "@/lib/workflow-api";
import { useWorkflowStore } from "@/stores/workflowStore";

export default function EditorPage() {
  const params = useParams<{ id: string }>();
  const loadWorkflow = useWorkflowStore((state) => state.loadWorkflow);
  const reset = useWorkflowStore((state) => state.reset);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      reset();
      setLoading(true);
      setError(null);
      try {
        const workflow = await fetchWorkflow(params.id);
        loadWorkflow(workflow);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load workflow");
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      load();
    }
  }, [params.id, loadWorkflow, reset]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-muted">
        Loading workflow...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="rounded-md border border-red-500/40 bg-red-500/10 p-4 text-red-300">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <EditorHeader />
      <div className="min-h-0 flex-1">
        <WorkflowEditor />
      </div>
    </div>
  );
}
