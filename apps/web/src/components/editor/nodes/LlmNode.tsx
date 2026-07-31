"use client";

import { Handle, type Node, type NodeProps } from "@xyflow/react";

import { Position } from "@/lib/flow";

import { NodeCardLabel } from "@/components/editor/nodes/NodeCardLabel";
import { ResultImageGrid } from "@/components/editor/ResultImageGrid";
import { useWorkflowStore } from "@/stores/workflowStore";

import type { WorkflowNodeData } from "@operate-ai/workflow-schema";

type LlmNodeType = Node<WorkflowNodeData, "llm">;

const TOOL_META: Record<string, { label: string; icon: string }> = {
  web_search: { label: "Web search", icon: "travel_explore" },
  generate_image: { label: "Generate image", icon: "image" },
  run_python: { label: "Run Python", icon: "terminal" },
};

const chipClass =
  "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide";

export function LlmNode({ id, data }: NodeProps<LlmNodeType>) {
  const model = data.model || "gemma4:e4b";
  const tools = data.enabledTools || [];
  const images = useWorkflowStore(
    (state) =>
      state.lastResult?.nodeResults.find((result) => result.nodeId === id)
        ?.images
  );

  return (
    <div className="box-border w-full max-w-full overflow-hidden p-3 text-left">
      <Handle type="target" position={Position.Left} />
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-violet-400">
        LLM
      </div>
      <NodeCardLabel label={data.label} type="llm" />
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span
          className={`${chipClass} border-violet-400/40 bg-gradient-to-r from-violet-500/30 via-fuchsia-500/20 to-indigo-500/25 text-violet-100`}
          title={`Model: ${model}`}
        >
          <span className="material-icons text-[12px] leading-none opacity-80">
            auto_awesome
          </span>
          <span className="truncate">{model}</span>
        </span>
        {tools.map((tool) => {
          const meta = TOOL_META[tool] ?? {
            label: tool.replaceAll("_", " "),
            icon: "build",
          };
          return (
            <span
              key={tool}
              className={`${chipClass} border-sky-400/40 bg-sky-500/20 text-sky-100`}
              title={`Tool: ${meta.label}`}
            >
              <span className="material-icons text-[12px] leading-none">
                {meta.icon}
              </span>
              <span className="truncate">{meta.label}</span>
            </span>
          );
        })}
      </div>
      {images?.length ? (
        <ResultImageGrid images={images} size="sm" className="mt-2" />
      ) : null}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
