"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { deleteWorkflow, fetchWorkflows } from "@/lib/workflow-api";
import type { WorkflowSummary } from "@operate-ai/workflow-schema";

export default function HomePage() {
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWorkflows = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWorkflows();
      setWorkflows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workflows");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkflows();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this workflow?")) return;
    await deleteWorkflow(id);
    await loadWorkflows();
  };

  return (
    <main className="mx-auto min-h-screen max-w-5xl p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Operate-AI</h1>
          <p className="mt-2 text-muted">
            Visual editor for AI agents and LLM workflows
          </p>
        </div>
        <Link href="/editor/new">
          <Button>New Workflow</Button>
        </Link>
      </div>

      {loading && <p className="text-muted">Loading workflows...</p>}
      {error && (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {!loading && !error && workflows.length === 0 && (
        <Card>
          <p className="text-sm text-muted">No workflows yet. Create your first one.</p>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {workflows.map((workflow) => (
          <Card key={workflow.id} className="flex flex-col gap-3">
            <div>
              <h2 className="text-lg font-semibold">{workflow.name}</h2>
              <p className="text-xs text-muted">ID: {workflow.id}</p>
              {workflow.updatedAt && (
                <p className="mt-1 text-xs text-muted">
                  Updated: {new Date(workflow.updatedAt).toLocaleString()}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Link href={`/editor/${workflow.id}`}>
                <Button variant="secondary">Open</Button>
              </Link>
              <Button variant="ghost" onClick={() => handleDelete(workflow.id)}>
                Delete
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </main>
  );
}
