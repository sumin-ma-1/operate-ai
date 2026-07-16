"use client";

import { useEffect, useState } from "react";

import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { fetchModels } from "@/lib/workflow-api";
import { useWorkflowStore } from "@/stores/workflowStore";

export function PropertyPanel() {
  const selectedNodeId = useWorkflowStore((state) => state.selectedNodeId);
  const nodes = useWorkflowStore((state) => state.nodes);
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const [models, setModels] = useState<string[]>(["llama3"]);

  const selectedNode = nodes.find((node) => node.id === selectedNodeId);

  useEffect(() => {
    fetchModels()
      .then((data) => {
        if (data.length > 0) {
          setModels(data.map((model) => model.name));
        }
      })
      .catch(() => {
        setModels(["llama3"]);
      });
  }, []);

  if (!selectedNode) {
    return (
      <aside className="w-72 border-l border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Properties</h2>
        <p className="mt-4 text-sm text-muted">Select a node to edit its properties.</p>
      </aside>
    );
  }

  const { id, type, data } = selectedNode;

  return (
    <aside className="w-72 overflow-y-auto border-l border-border bg-card p-4">
      <h2 className="text-sm font-semibold">Properties</h2>
      <p className="mt-1 text-xs uppercase text-muted">{type}</p>

      <div className="mt-4 space-y-4">
        <div>
          <label className="mb-1 block text-xs text-muted">Label</label>
          <Input
            value={data.label}
            onChange={(event) => updateNodeData(id, { label: event.target.value })}
          />
        </div>

        {type === "input" && (
          <div>
            <label className="mb-1 block text-xs text-muted">Input Text</label>
            <Textarea
              rows={5}
              value={data.value || ""}
              onChange={(event) => updateNodeData(id, { value: event.target.value })}
            />
          </div>
        )}

        {type === "llm" && (
          <>
            <div>
              <label className="mb-1 block text-xs text-muted">Model</label>
              <Select
                value={data.model || "llama3"}
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
            <div>
              <label className="mb-1 block text-xs text-muted">User Prompt Template</label>
              <Textarea
                rows={4}
                value={data.userPromptTemplate || "{{input}}"}
                onChange={(event) =>
                  updateNodeData(id, { userPromptTemplate: event.target.value })
                }
              />
              <p className="mt-1 text-xs text-muted">Use {"{{input}}"} for upstream output.</p>
            </div>
          </>
        )}

        {type === "output" && (
          <div>
            <label className="mb-1 block text-xs text-muted">Result</label>
            <Textarea rows={8} readOnly value={data.result || ""} />
          </div>
        )}
      </div>
    </aside>
  );
}
