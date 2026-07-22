"use client";

import { useEffect, useState } from "react";

import { InputAttachments } from "@/components/editor/InputAttachments";
import { OutputActions } from "@/components/editor/OutputActions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { NODE_TYPE_LABELS } from "@/lib/node-labels";
import { fetchModels } from "@/lib/workflow-api";
import { useWorkflowStore } from "@/stores/workflowStore";

export function PropertyPanel() {
  const selectedNodeId = useWorkflowStore((state) => state.selectedNodeId);
  const selectedEdgeId = useWorkflowStore((state) => state.selectedEdgeId);
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const removeNode = useWorkflowStore((state) => state.removeNode);
  const unwrapLoop = useWorkflowStore((state) => state.unwrapLoop);
  const removeEdge = useWorkflowStore((state) => state.removeEdge);
  const setEdgeDisabled = useWorkflowStore((state) => state.setEdgeDisabled);
  const [models, setModels] = useState<string[]>(["gemma4:e4b"]);

  const selectedNode = nodes.find((node) => node.id === selectedNodeId);
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId);

  useEffect(() => {
    fetchModels()
      .then((data) => {
        if (data.length > 0) {
          setModels(data.map((model) => model.name));
        }
      })
      .catch(() => {
        setModels(["gemma4:e4b"]);
      });
  }, []);

  if (selectedEdge) {
    const disabled = Boolean(selectedEdge.data?.disabled);
    const sourceLabel =
      nodes.find((node) => node.id === selectedEdge.source)?.data.label ||
      selectedEdge.source;
    const targetLabel =
      nodes.find((node) => node.id === selectedEdge.target)?.data.label ||
      selectedEdge.target;

    return (
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Properties</h2>
            <p className="mt-1 text-xs uppercase text-muted">Connection</p>
          </div>
          <Button
            variant="ghost"
            className="shrink-0 text-red-300 hover:bg-red-500/10 hover:text-red-200"
            onClick={() => removeEdge(selectedEdge.id)}
          >
            Delete
          </Button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <p className="text-xs text-muted">From</p>
            <p className="mt-1 text-sm">{sourceLabel}</p>
          </div>
          <div>
            <p className="text-xs text-muted">To</p>
            <p className="mt-1 text-sm">{targetLabel}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!disabled}
            aria-label="Toggle connection enabled"
            onClick={() => setEdgeDisabled(selectedEdge.id, !disabled)}
            className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <span>{disabled ? "Disabled" : "Enabled"}</span>
            <span
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                disabled ? "bg-slate-600" : "bg-primary"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  disabled ? "translate-x-0" : "translate-x-5"
                }`}
              />
            </span>
          </button>
          <p className="text-xs text-muted">
            Disabled connections are shown as dashed lines and skipped during
            execution.
          </p>
        </div>
      </div>
    );
  }

  if (!selectedNode) {
    return null;
  }

  const { id, type, data } = selectedNode;

  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Properties</h2>
          <p className="mt-1 text-xs uppercase text-muted">
            {type === "loop" ? NODE_TYPE_LABELS.loop : type}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {type === "loop" && (
            <Button
              variant="ghost"
              className="text-white/70 hover:bg-white/10 hover:text-white"
              onClick={() => unwrapLoop(id)}
            >
              Remove loop box
            </Button>
          )}
          <Button
            variant="ghost"
            className="shrink-0 text-red-300 hover:bg-red-500/10 hover:text-red-200"
            onClick={() => removeNode(id)}
          >
            {type === "loop" ? "Delete all" : "Delete"}
          </Button>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <label className="mb-1 block text-xs text-muted">Label</label>
          <Input
            value={data.label}
            onChange={(event) => updateNodeData(id, { label: event.target.value })}
          />
        </div>

        {type === "input" && (
          <>
            <div>
              <label className="mb-1 block text-xs text-muted">Input Text</label>
              <Textarea
                rows={5}
                value={data.value || ""}
                onChange={(event) =>
                  updateNodeData(id, { value: event.target.value })
                }
              />
            </div>
            <InputAttachments
              attachments={data.attachments || []}
              onChange={(attachments) => updateNodeData(id, { attachments })}
            />
          </>
        )}

        {type === "llm" && (
          <>
            <div>
              <label className="mb-1 block text-xs text-muted">Model</label>
              <Select
                value={data.model || "gemma4:e4b"}
                onChange={(event) => updateNodeData(id, { model: event.target.value })}
              >
                {models.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">System Prompt</label>
              <Textarea
                rows={3}
                value={data.systemPrompt || ""}
                onChange={(event) =>
                  updateNodeData(id, { systemPrompt: event.target.value })
                }
              />
            </div>
          </>
        )}

        {type === "loop" && (
          <>
            <div>
              <label className="mb-1 block text-xs text-muted">Goal</label>
              <Textarea
                rows={4}
                value={data.goalPrompt || ""}
                placeholder="When should this loop stop?"
                onChange={(event) =>
                  updateNodeData(id, { goalPrompt: event.target.value })
                }
              />
              <p className="mt-1 text-xs text-muted">
                Describe the condition that means the agent is done.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Max iterations</label>
              <Input
                type="number"
                min={1}
                max={20}
                value={data.maxIterations ?? 5}
                onChange={(event) => {
                  const parsed = Number(event.target.value);
                  updateNodeData(id, {
                    maxIterations: Number.isNaN(parsed)
                      ? 5
                      : Math.min(20, Math.max(1, parsed)),
                  });
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Checker model</label>
              <Select
                value={data.checkerModel || data.model || "gemma4:e4b"}
                onChange={(event) =>
                  updateNodeData(id, { checkerModel: event.target.value })
                }
              >
                {models.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </Select>
            </div>
          </>
        )}

        {type === "output" && (
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label className="block text-xs text-muted">Result</label>
              <OutputActions
                content={data.result || ""}
                filename={data.label || "output"}
              />
            </div>
            <Textarea
              rows={16}
              readOnly
              className="scrollbar-none"
              value={data.result || ""}
            />
          </div>
        )}
      </div>
    </div>
  );
}
