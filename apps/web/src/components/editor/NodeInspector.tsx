"use client";

import { useEffect, useMemo, useState } from "react";
import {
  EdgeToolbar,
  NodeToolbar,
  Position,
  useInternalNode,
  useReactFlow,
  useStore,
  useViewport,
} from "@xyflow/react";

import { InputAttachments } from "@/components/editor/InputAttachments";
import { OutputActions } from "@/components/editor/OutputActions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { fetchModels } from "@/lib/workflow-api";
import { useWorkflowStore } from "@/stores/workflowStore";

const PANEL_WIDTH = 288;
const PANEL_HEIGHT = 340;
const PANEL_GAP = 28;

const fieldClass =
  "w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2.5 text-sm text-white placeholder:text-white/35 outline-none focus:ring-1 focus:ring-violet-400/50";

function accentForType(type: string | undefined) {
  switch (type) {
    case "input":
      return {
        panel: "border-sky-400/35 shadow-[0_0_32px_rgba(56,189,248,0.2)]",
        port: "bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.85)]",
      };
    case "llm":
      return {
        panel: "border-violet-400/40 shadow-[0_0_32px_rgba(167,139,250,0.25)]",
        port: "bg-violet-400 shadow-[0_0_12px_rgba(167,139,250,0.9)]",
      };
    case "output":
      return {
        panel: "border-emerald-400/35 shadow-[0_0_32px_rgba(52,211,153,0.2)]",
        port: "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.85)]",
      };
    default:
      return {
        panel: "border-white/10 shadow-[0_0_24px_rgba(148,163,184,0.12)]",
        port: "bg-slate-400 shadow-[0_0_10px_rgba(148,163,184,0.6)]",
      };
  }
}

function portClass(side: Position) {
  switch (side) {
    case Position.Left:
      return "absolute top-1/2 -right-1.5 -translate-y-1/2";
    case Position.Top:
      return "absolute -bottom-1.5 left-1/2 -translate-x-1/2";
    case Position.Bottom:
      return "absolute -top-1.5 left-1/2 -translate-x-1/2";
    case Position.Right:
    default:
      return "absolute top-1/2 -left-1.5 -translate-y-1/2";
  }
}

function pickNodeToolbarSide(args: {
  nodeLeft: number;
  nodeTop: number;
  nodeRight: number;
  nodeBottom: number;
  paneLeft: number;
  paneTop: number;
  paneRight: number;
  paneBottom: number;
}): Position {
  const space = {
    [Position.Right]: args.paneRight - args.nodeRight,
    [Position.Left]: args.nodeLeft - args.paneLeft,
    [Position.Bottom]: args.paneBottom - args.nodeBottom,
    [Position.Top]: args.nodeTop - args.paneTop,
  };

  const required = {
    [Position.Right]: PANEL_WIDTH + PANEL_GAP,
    [Position.Left]: PANEL_WIDTH + PANEL_GAP,
    [Position.Bottom]: PANEL_HEIGHT + PANEL_GAP,
    [Position.Top]: PANEL_HEIGHT + PANEL_GAP,
  };

  const preference = [
    Position.Right,
    Position.Left,
    Position.Bottom,
    Position.Top,
  ];

  for (const side of preference) {
    if (space[side] >= required[side]) {
      return side;
    }
  }

  return preference.reduce((best, side) =>
    space[side] > space[best] ? side : best
  );
}

function ConnectionPanel({
  edgeId,
}: {
  edgeId: string;
}) {
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const removeEdge = useWorkflowStore((state) => state.removeEdge);
  const setEdgeDisabled = useWorkflowStore((state) => state.setEdgeDisabled);

  const edge = edges.find((item) => item.id === edgeId);
  const sourceNode = useInternalNode(edge?.source || "");
  const targetNode = useInternalNode(edge?.target || "");
  const viewport = useViewport();

  const center = useMemo(() => {
    if (!sourceNode || !targetNode) {
      return null;
    }

    const sourceWidth = sourceNode.measured.width ?? 220;
    const sourceHeight = sourceNode.measured.height ?? 80;
    const targetHeight = targetNode.measured.height ?? 80;

    const sourceX = sourceNode.internals.positionAbsolute.x + sourceWidth;
    const sourceY =
      sourceNode.internals.positionAbsolute.y + sourceHeight / 2;
    const targetX = targetNode.internals.positionAbsolute.x;
    const targetY =
      targetNode.internals.positionAbsolute.y + targetHeight / 2;

    return {
      x: (sourceX + targetX) / 2,
      y: (sourceY + targetY) / 2,
    };
  }, [sourceNode, targetNode, viewport.x, viewport.y, viewport.zoom]);

  if (!edge || !center) {
    return null;
  }

  const disabled = Boolean(edge.data?.disabled);
  const sourceLabel =
    nodes.find((node) => node.id === edge.source)?.data.label || edge.source;
  const targetLabel =
    nodes.find((node) => node.id === edge.target)?.data.label || edge.target;

  return (
    <EdgeToolbar
      edgeId={edge.id}
      x={center.x}
      y={center.y}
      isVisible
      alignX="center"
      alignY="center"
      className="!border-0 !bg-transparent !p-0 !shadow-none"
    >
      <div
        className="nodrag nowheel nopan relative w-72 rounded-2xl border border-white/10 bg-black/92 p-4 shadow-[0_0_28px_rgba(148,163,184,0.18)] backdrop-blur-md"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <span
          className="absolute top-1/2 -left-1.5 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-black bg-blue-400 shadow-[0_0_12px_rgba(96,165,250,0.9)]"
          aria-hidden
        />

        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-white">Connection</h2>
            <p className="mt-1 text-xs text-white/45">Edge properties</p>
          </div>
          <Button
            variant="ghost"
            className="shrink-0 !px-2 !py-1 text-red-300 hover:bg-red-500/10 hover:text-red-200"
            onClick={() => removeEdge(edge.id)}
          >
            Delete
          </Button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <p className="text-xs text-white/45">From</p>
            <p className="mt-1 text-sm text-white">{sourceLabel}</p>
          </div>
          <div>
            <p className="text-xs text-white/45">To</p>
            <p className="mt-1 text-sm text-white">{targetLabel}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!disabled}
            aria-label="Toggle connection enabled"
            onClick={() => setEdgeDisabled(edge.id, !disabled)}
            className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white"
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
        </div>
      </div>
    </EdgeToolbar>
  );
}

function SelectedNodePanel({ nodeId }: { nodeId: string }) {
  const nodes = useWorkflowStore((state) => state.nodes);
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const removeNode = useWorkflowStore((state) => state.removeNode);
  const [models, setModels] = useState<string[]>(["gemma4:e4b"]);
  const internalNode = useInternalNode(nodeId);
  const { flowToScreenPosition } = useReactFlow();
  const viewport = useViewport();
  const paneDomNode = useStore((state) => state.domNode);

  const selectedNode = nodes.find((node) => node.id === nodeId);

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

  const toolbarSide = useMemo(() => {
    if (!internalNode || !paneDomNode) {
      return Position.Right;
    }

    const width = internalNode.measured.width ?? 220;
    const height = internalNode.measured.height ?? 80;
    const abs = internalNode.internals.positionAbsolute;
    const topLeft = flowToScreenPosition(abs);
    const bottomRight = flowToScreenPosition({
      x: abs.x + width,
      y: abs.y + height,
    });
    const paneRect = paneDomNode.getBoundingClientRect();

    return pickNodeToolbarSide({
      nodeLeft: topLeft.x,
      nodeTop: topLeft.y,
      nodeRight: bottomRight.x,
      nodeBottom: bottomRight.y,
      paneLeft: paneRect.left,
      paneTop: paneRect.top,
      paneRight: paneRect.right,
      paneBottom: paneRect.bottom,
    });
  }, [
    internalNode,
    paneDomNode,
    flowToScreenPosition,
    viewport.x,
    viewport.y,
    viewport.zoom,
  ]);

  if (!selectedNode) {
    return null;
  }

  const { id, type, data } = selectedNode;
  const accent = accentForType(type);

  return (
    <NodeToolbar
      nodeId={id}
      isVisible
      position={toolbarSide}
      offset={22}
      align="center"
      className="!border-0 !bg-transparent !p-0 !shadow-none"
    >
      <div
        className={`nodrag nowheel nopan relative w-72 rounded-2xl border bg-black/92 p-4 backdrop-blur-md ${accent.panel}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <span
          className={`h-3 w-3 rounded-full border-2 border-black ${portClass(toolbarSide)} ${accent.port}`}
          aria-hidden
        />

        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-white">
              {data.label || "Node"}
            </h2>
            <p className="mt-0.5 text-[11px] uppercase tracking-wide text-white/40">
              {type}
            </p>
          </div>
          <Button
            variant="ghost"
            className="shrink-0 !px-2 !py-1 text-red-300 hover:bg-red-500/10 hover:text-red-200"
            onClick={() => removeNode(id)}
          >
            Delete
          </Button>
        </div>

        <div className="mt-4 max-h-[min(60vh,420px)] space-y-4 overflow-y-auto pr-0.5 scrollbar-soft">
          <div>
            <label className="mb-1.5 block text-xs text-white/70">Label</label>
            <Input
              className={fieldClass}
              value={data.label}
              onChange={(event) =>
                updateNodeData(id, { label: event.target.value })
              }
            />
          </div>

          {type === "input" && (
            <>
              <div>
                <label className="mb-1.5 block text-xs text-white/70">
                  Input
                </label>
                <Textarea
                  rows={4}
                  className={`${fieldClass} scrollbar-soft`}
                  placeholder="Type something..."
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
                <label className="mb-1.5 block text-xs text-white/70">
                  Model
                </label>
                <Select
                  className={fieldClass}
                  value={data.model || "gemma4:e4b"}
                  onChange={(event) =>
                    updateNodeData(id, { model: event.target.value })
                  }
                >
                  {models.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-white/70">
                  System Prompt
                </label>
                <Textarea
                  rows={3}
                  className={`${fieldClass} scrollbar-soft`}
                  value={data.systemPrompt || ""}
                  onChange={(event) =>
                    updateNodeData(id, { systemPrompt: event.target.value })
                  }
                />
              </div>
            </>
          )}

          {type === "output" && (
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label className="block text-xs text-white/70">Result</label>
                <OutputActions
                  content={data.result || ""}
                  filename={data.label || "output"}
                />
              </div>
              <Textarea
                rows={8}
                readOnly
                className={`${fieldClass} scrollbar-soft`}
                value={data.result || ""}
              />
            </div>
          )}
        </div>
      </div>
    </NodeToolbar>
  );
}

export function NodeInspector() {
  const selectedNodeId = useWorkflowStore((state) => state.selectedNodeId);
  const selectedEdgeId = useWorkflowStore((state) => state.selectedEdgeId);

  if (selectedEdgeId) {
    return <ConnectionPanel edgeId={selectedEdgeId} />;
  }

  if (selectedNodeId) {
    return <SelectedNodePanel nodeId={selectedNodeId} />;
  }

  return null;
}
