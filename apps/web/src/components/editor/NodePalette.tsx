"use client";

import type { WorkflowNodeType } from "@operate-ai/workflow-schema";

import { Button } from "@/components/ui/Button";
import { useWorkflowStore } from "@/stores/workflowStore";

const paletteItems: { type: WorkflowNodeType; label: string; description: string }[] = [
  { type: "input", label: "Input", description: "Workflow entry text" },
  { type: "llm", label: "LLM", description: "Ollama model call" },
  { type: "output", label: "Output", description: "Display final result" },
];

export function NodePalette() {
  const addNode = useWorkflowStore((state) => state.addNode);

  return (
    <aside className="flex w-56 flex-col gap-3 border-r border-border bg-card p-4">
      <h2 className="text-sm font-semibold">Nodes</h2>
      <div className="flex flex-col gap-2">
        {paletteItems.map((item) => (
          <Button
            key={item.type}
            variant="secondary"
            className="flex flex-col items-start gap-1 text-left"
            onClick={() => addNode(item.type)}
          >
            <span>{item.label}</span>
            <span className="text-xs font-normal text-muted">{item.description}</span>
          </Button>
        ))}
      </div>
    </aside>
  );
}
