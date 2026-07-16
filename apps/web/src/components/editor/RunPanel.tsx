"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { executeWorkflow } from "@/lib/workflow-api";
import { useWorkflowStore } from "@/stores/workflowStore";

export function RunPanel() {
  const isRunning = useWorkflowStore((state) => state.isRunning);
  const lastResult = useWorkflowStore((state) => state.lastResult);
  const nodes = useWorkflowStore((state) => state.nodes);
  const toWorkflowDefinition = useWorkflowStore((state) => state.toWorkflowDefinition);
  const setRunning = useWorkflowStore((state) => state.setRunning);
  const applyExecutionResults = useWorkflowStore((state) => state.applyExecutionResults);
  const [error, setError] = useState<string | null>(null);

  const inputNode = nodes.find((node) => node.type === "input");
  const inputValue = inputNode?.data.value || "";

  const handleRun = async () => {
    setError(null);
    setRunning(true);

    try {
      const workflow = toWorkflowDefinition();
      const result = await executeWorkflow({ workflow, input: inputValue });
      applyExecutionResults(result);

      if (!result.success && result.error) {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Execution failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="border-t border-border bg-card p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold">Execution</h3>
          <p className="text-xs text-muted">
            Run the connected workflow against Ollama.
          </p>
        </div>
        <Button onClick={handleRun} disabled={isRunning || nodes.length === 0}>
          {isRunning ? "Running..." : "Run"}
        </Button>
      </div>

      {error && (
        <p className="mt-3 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {lastResult && (
        <div className="mt-4 space-y-3">
          <div>
            <h4 className="text-xs font-semibold uppercase text-muted">Final Output</h4>
            <pre className="mt-2 max-h-40 overflow-auto rounded-md border border-border bg-background p-3 text-sm whitespace-pre-wrap">
              {lastResult.finalOutput || "(empty)"}
            </pre>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase text-muted">Node Logs</h4>
            <div className="mt-2 max-h-32 space-y-2 overflow-auto">
              {lastResult.nodeResults.map((result) => (
                <div
                  key={result.nodeId}
                  className="rounded-md border border-border bg-background p-2 text-xs"
                >
                  <span className="font-medium">{result.nodeType}</span>
                  <span className="text-muted"> ({result.nodeId})</span>
                  <p className="mt-1 line-clamp-2 text-muted">{result.output}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
