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
import { ScrollFade } from "@/components/ui/ScrollFade";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { getNodeDisplayLabel, getNodeTypeLabel } from "@/lib/node-labels";
import {
  fetchForgeModels,
  fetchModelCatalog,
  fetchNodeProviderKeys,
  testProviderConnection,
  updateNodeProviderKey,
} from "@/lib/workflow-api";
import type { ForgeCheckpoint } from "@/lib/workflow-api";
import type {
  LLMProvider,
  ModelCatalogProvider,
  WorkflowNodeType,
} from "@operate-ai/workflow-schema";
import { useWorkflowStore } from "@/stores/workflowStore";

const PANEL_WIDTH = 288;
const PANEL_HEIGHT = 420;
const PANEL_GAP = 28;

type CloudProviderId = "openai" | "anthropic" | "gemini";

function isCloudProvider(provider: string): provider is CloudProviderId {
  return (
    provider === "openai" ||
    provider === "anthropic" ||
    provider === "gemini"
  );
}

function NodeApiKeyOverride({
  nodeId,
  provider,
  onKeysChange,
}: {
  nodeId: string;
  provider: CloudProviderId;
  onKeysChange?: () => void;
}) {
  const [usingGlobal, setUsingGlobal] = useState(true);
  const [masked, setMasked] = useState("");
  const [draftKey, setDraftKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDraftKey("");
    setStatus(null);
    setError(null);
    fetchNodeProviderKeys(nodeId)
      .then((providers) => {
        if (cancelled) return;
        const entry = providers[provider];
        setUsingGlobal(entry?.usingGlobal !== false);
        setMasked(entry?.apiKeyMasked || "");
      })
      .catch(() => {
        if (cancelled) return;
        setUsingGlobal(true);
        setMasked("");
      });
    return () => {
      cancelled = true;
    };
  }, [nodeId, provider]);

  const handleSave = async () => {
    const value = draftKey.trim();
    if (!value) {
      setError("Enter a key to override the global one");
      return;
    }
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const providers = await updateNodeProviderKey({
        nodeId,
        provider,
        apiKey: value,
      });
      const entry = providers[provider];
      setUsingGlobal(entry?.usingGlobal !== false);
      setMasked(entry?.apiKeyMasked || "");
      setDraftKey("");
      setStatus("Node override saved");
      onKeysChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const handleClear = async () => {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const providers = await updateNodeProviderKey({
        nodeId,
        provider,
        apiKey: "",
      });
      const entry = providers[provider];
      setUsingGlobal(entry?.usingGlobal !== false);
      setMasked(entry?.apiKeyMasked || "");
      setDraftKey("");
      setStatus("Using global key");
      onKeysChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clear failed");
    } finally {
      setBusy(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setError(null);
    setStatus(null);
    try {
      await testProviderConnection({
        provider,
        apiKey: draftKey.trim() || undefined,
        nodeId,
      });
      setStatus("Connection OK");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test failed");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs text-white/70">API key</label>
        <span className="text-[10px] uppercase tracking-wide text-white/40">
          {usingGlobal ? "Global" : "Node override"}
        </span>
      </div>
      {!usingGlobal && masked ? (
        <p className="text-[11px] text-white/45">Saved: {masked}</p>
      ) : (
        <p className="text-[11px] text-white/45">
          Uses the key from home → Keys unless you override here.
        </p>
      )}
      <Input
        type="password"
        autoComplete="off"
        className={fieldClass}
        placeholder={usingGlobal ? "Override key…" : "Replace override…"}
        value={draftKey}
        onChange={(event) => setDraftKey(event.target.value)}
      />
      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          variant="secondary"
          className="!rounded-full !px-2.5 !py-1 !text-[11px]"
          disabled={busy || !draftKey.trim()}
          onClick={() => void handleSave()}
        >
          Save
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="!rounded-full !px-2.5 !py-1 !text-[11px]"
          disabled={busy || testing}
          onClick={() => void handleTest()}
        >
          {testing ? "Testing…" : "Test"}
        </Button>
        {!usingGlobal ? (
          <Button
            type="button"
            variant="ghost"
            className="!rounded-full !px-2.5 !py-1 !text-[11px] text-white/50"
            disabled={busy}
            onClick={() => void handleClear()}
          >
            Use global
          </Button>
        ) : null}
      </div>
      {status ? (
        <p className="text-[11px] text-emerald-300/80">{status}</p>
      ) : null}
      {error ? (
        <p className="text-[11px] text-amber-200/80">{error}</p>
      ) : null}
    </div>
  );
}

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
    case "loop":
      return {
        panel: "border-amber-400/35 shadow-[0_0_32px_rgba(251,191,36,0.2)]",
        port: "bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.85)]",
      };
    case "approval":
      return {
        panel: "border-rose-400/35 shadow-[0_0_32px_rgba(251,113,133,0.2)]",
        port: "bg-rose-400 shadow-[0_0_12px_rgba(251,113,133,0.85)]",
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
            className="inline-flex shrink-0 items-center justify-center !rounded-full !px-2 !py-1 !font-normal text-red-300/40 hover:!bg-red-500/10 hover:text-red-300/85"
            onClick={() => removeEdge(edge.id)}
            title="Delete connection"
            aria-label="Delete connection"
          >
            <span className="material-icons text-[16px] leading-none">
              delete
            </span>
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
  const unwrapLoop = useWorkflowStore((state) => state.unwrapLoop);
  const [catalog, setCatalog] = useState<ModelCatalogProvider[]>([]);
  const [forgeCheckpoints, setForgeCheckpoints] = useState<ForgeCheckpoint[]>(
    []
  );
  const [nodeKeyConfigured, setNodeKeyConfigured] = useState<
    Record<string, boolean>
  >({});
  const internalNode = useInternalNode(nodeId);
  const { flowToScreenPosition } = useReactFlow();
  const viewport = useViewport();
  const paneDomNode = useStore((state) => state.domNode);

  const selectedNode = nodes.find((node) => node.id === nodeId);

  const refreshNodeKeys = () => {
    fetchNodeProviderKeys(nodeId)
      .then((providers) => {
        const next: Record<string, boolean> = {};
        for (const [name, entry] of Object.entries(providers)) {
          next[name] = Boolean(entry.configured);
        }
        setNodeKeyConfigured(next);
      })
      .catch(() => setNodeKeyConfigured({}));
  };

  useEffect(() => {
    fetchModelCatalog()
      .then((data) => setCatalog(data))
      .catch(() => {
        setCatalog([
          {
            provider: "ollama",
            label: "Ollama",
            configured: true,
            supportsTools: true,
            models: [],
          },
        ]);
      });
    fetchForgeModels()
      .then((data) => setForgeCheckpoints(data.checkpoints))
      .catch(() => setForgeCheckpoints([]));
  }, []);

  useEffect(() => {
    refreshNodeKeys();
  }, [nodeId]);

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
  const nodeLabel =
    type != null
      ? getNodeDisplayLabel(data.label, type as WorkflowNodeType)
      : { text: data.label || "Node", isPlaceholder: false };

  const providerHasKey = (provider: LLMProvider) => {
    if (provider === "ollama") return true;
    const globalConfigured = Boolean(
      catalog.find((item) => item.provider === provider)?.configured
    );
    return globalConfigured || Boolean(nodeKeyConfigured[provider]);
  };

  const modelsForProvider = (provider: LLMProvider) => {
    if (!providerHasKey(provider)) return [] as string[];
    const entry = catalog.find((item) => item.provider === provider);
    return entry?.models?.length ? entry.models : [];
  };

  const llmProvider = (data.provider || "ollama") as LLMProvider;
  const llmModels = modelsForProvider(llmProvider);

  const checkerProvider = (data.checkerProvider ||
    "ollama") as LLMProvider;
  const checkerModels = modelsForProvider(checkerProvider);

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
            <h2
              className={`text-sm ${
                nodeLabel.isPlaceholder
                  ? "font-normal uppercase tracking-wider text-white/35"
                  : "font-semibold text-white"
              }`}
            >
              {nodeLabel.text}
            </h2>
            <p className="mt-0.5 text-[11px] uppercase tracking-wide text-white/40">
              {type ? getNodeTypeLabel(type as WorkflowNodeType) : "Node"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {type === "loop" && (
              <Button
                variant="ghost"
                className="inline-flex items-center justify-center !rounded-full !px-2 !py-1 !font-normal text-white/45 hover:!bg-white/10 hover:text-white/80"
                onClick={() => unwrapLoop(id)}
                title="Remove loop box and keep inner LLMs"
                aria-label="Remove loop box"
              >
                <span className="material-icons text-[16px] leading-none">
                  crop_free
                </span>
              </Button>
            )}
            <Button
              variant="ghost"
              className="inline-flex shrink-0 items-center justify-center !rounded-full !px-2 !py-1 !font-normal text-red-300/40 hover:!bg-red-500/10 hover:text-red-300/85"
              onClick={() => removeNode(id)}
              title={
                type === "loop"
                  ? "Delete loop and all inner LLMs"
                  : "Delete node"
              }
              aria-label="Delete node"
            >
              <span className="material-icons text-[16px] leading-none">
                delete
              </span>
            </Button>
          </div>
        </div>

        <ScrollFade className="mt-4 max-h-[min(60vh,420px)] space-y-4 pr-0.5">
          <div>
            <label className="mb-1.5 block text-xs text-white/70">Label</label>
            <Input
              className={fieldClass}
              placeholder="Label"
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
                  Workflow Input
                </label>
                <Textarea
                  rows={4}
                  className={`${fieldClass} scrollbar-none`}
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
                  Provider
                </label>
                <Select
                  className={fieldClass}
                  value={llmProvider}
                  onChange={(event) => {
                    const provider = event.target.value as LLMProvider;
                    const entry = catalog.find(
                      (item) => item.provider === provider
                    );
                    const nextModel =
                      entry?.models[0] ||
                      (provider === "ollama" ? "gemma4:e4b" : "");
                    updateNodeData(id, {
                      provider,
                      model: nextModel || data.model,
                    });
                  }}
                >
                  {(catalog.length
                    ? catalog
                    : [
                        {
                          provider: "ollama" as const,
                          label: "Ollama",
                          configured: true,
                          supportsTools: true,
                          models: [] as string[],
                        },
                      ]
                  ).map((item) => (
                    <option key={item.provider} value={item.provider}>
                      {item.label}
                      {!item.configured && item.provider !== "ollama"
                        ? " (needs key)"
                        : ""}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-white/70">
                  Model
                </label>
                {llmModels.length > 0 ? (
                  <Select
                    className={fieldClass}
                    value={
                      llmModels.includes(data.model || "")
                        ? data.model
                        : llmModels[0]
                    }
                    onChange={(event) =>
                      updateNodeData(id, { model: event.target.value })
                    }
                  >
                    {llmModels.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <p className="rounded-xl border border-white/10 bg-black/50 px-3 py-2.5 text-[11px] text-white/45">
                    Add a key in home → Keys (or override below) to choose a
                    model
                  </p>
                )}
              </div>
              {isCloudProvider(llmProvider) ? (
                <NodeApiKeyOverride
                  nodeId={id}
                  provider={llmProvider}
                  onKeysChange={refreshNodeKeys}
                />
              ) : null}
              <div>
                <label className="mb-1.5 block text-xs text-white/70">
                  System Prompt
                </label>
                <Textarea
                  rows={3}
                  className={`${fieldClass} scrollbar-none`}
                  value={data.systemPrompt || ""}
                  onChange={(event) =>
                    updateNodeData(id, { systemPrompt: event.target.value })
                  }
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-white/70">Tools</label>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      ["web_search", "travel_explore", "Web search"],
                      ["generate_image", "image", "Generate image"],
                      ["run_python", "terminal", "Run Python"],
                    ] as const
                  ).map(([toolId, icon, label]) => {
                    const enabled = (data.enabledTools || []).includes(toolId);
                    return (
                      <button
                        key={toolId}
                        type="button"
                        onClick={() => {
                          const current = data.enabledTools || [];
                          const next = current.includes(toolId)
                            ? current.filter((tool) => tool !== toolId)
                            : [...current, toolId];
                          updateNodeData(id, { enabledTools: next });
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition ${
                          enabled
                            ? "border-sky-400/60 bg-sky-500/30 text-sky-100"
                            : "border-white/15 bg-white/5 text-white/45 hover:border-white/25 hover:text-white/70"
                        }`}
                      >
                        <span className="material-icons text-[14px] leading-none">
                          {icon}
                        </span>
                        {label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[11px] text-white/35">
                  Tools work with Ollama and OpenAI. Image gen needs local Forge
                  (--api).
                </p>
              </div>
              {(data.enabledTools || []).includes("generate_image") ? (
                <div>
                  <label className="mb-1.5 block text-xs text-white/70">
                    Forge checkpoint
                  </label>
                  <Select
                    className={fieldClass}
                    value={
                      typeof data.forgeCheckpoint === "string"
                        ? data.forgeCheckpoint
                        : ""
                    }
                    onChange={(event) =>
                      updateNodeData(id, {
                        forgeCheckpoint: event.target.value || undefined,
                      })
                    }
                  >
                    <option value="">Use global default</option>
                    {forgeCheckpoints.map((item) => (
                      <option key={item.title} value={item.title}>
                        {item.title}
                      </option>
                    ))}
                  </Select>
                  <p className="mt-1.5 text-[11px] text-white/35">
                    Override the default from home → Keys → Forge for this
                    node only.
                  </p>
                </div>
              ) : null}
              {(data.enabledTools || []).length > 0 && (
                <div>
                  <label className="mb-1.5 block text-xs text-white/70">
                    Max tool rounds
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    className={fieldClass}
                    value={data.maxToolRounds ?? 5}
                    onChange={(event) => {
                      const parsed = Number(event.target.value);
                      updateNodeData(id, {
                        maxToolRounds: Number.isNaN(parsed)
                          ? 5
                          : Math.min(10, Math.max(1, parsed)),
                      });
                    }}
                  />
                </div>
              )}
            </>
          )}

          {type === "loop" && (
            <>
              <div>
                <label className="mb-1.5 block text-xs text-white/70">Goal</label>
                <Textarea
                  rows={3}
                  className={`${fieldClass} scrollbar-none`}
                  placeholder="When should this loop stop?"
                  value={data.goalPrompt || ""}
                  onChange={(event) =>
                    updateNodeData(id, { goalPrompt: event.target.value })
                  }
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-white/70">
                  Max iterations
                </label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  className={fieldClass}
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
                <label className="mb-1.5 block text-xs text-white/70">
                  Checker provider
                </label>
                <Select
                  className={fieldClass}
                  value={checkerProvider}
                  onChange={(event) => {
                    const provider = event.target.value as LLMProvider;
                    const entry = catalog.find(
                      (item) => item.provider === provider
                    );
                    updateNodeData(id, {
                      checkerProvider: provider,
                      checkerModel:
                        entry?.models[0] || data.checkerModel || "gemma4:e4b",
                    });
                  }}
                >
                  {(catalog.length
                    ? catalog
                    : [
                        {
                          provider: "ollama" as const,
                          label: "Ollama",
                          configured: true,
                          supportsTools: true,
                          models: [] as string[],
                        },
                      ]
                  ).map((item) => (
                    <option key={item.provider} value={item.provider}>
                      {item.label}
                      {!item.configured && item.provider !== "ollama"
                        ? " (needs key)"
                        : ""}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-white/70">
                  Checker model
                </label>
                {checkerModels.length > 0 ? (
                  <Select
                    className={fieldClass}
                    value={
                      checkerModels.includes(
                        data.checkerModel || data.model || ""
                      )
                        ? data.checkerModel || data.model
                        : checkerModels[0]
                    }
                    onChange={(event) =>
                      updateNodeData(id, { checkerModel: event.target.value })
                    }
                  >
                    {checkerModels.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <p className="rounded-xl border border-white/10 bg-black/50 px-3 py-2.5 text-[11px] text-white/45">
                    Add a key in home → Keys (or override below) to choose a
                    model
                  </p>
                )}
                <p className="mt-1.5 text-[11px] text-white/35">
                  LLM used to decide when the goal is met
                </p>
              </div>
              {isCloudProvider(checkerProvider) ? (
                <NodeApiKeyOverride
                  nodeId={id}
                  provider={checkerProvider}
                  onKeysChange={refreshNodeKeys}
                />
              ) : null}
            </>
          )}

          {type === "approval" && (
            <div>
              <label className="mb-1.5 block text-xs text-white/70">
                Instructions
              </label>
              <Textarea
                rows={3}
                className={`${fieldClass} scrollbar-none`}
                placeholder="Optional guidance for the reviewer"
                value={data.approvalPrompt || ""}
                onChange={(event) =>
                  updateNodeData(id, { approvalPrompt: event.target.value })
                }
              />
            </div>
          )}

          {type === "output" && (
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label className="block text-xs text-white/70">Final Output</label>
                <OutputActions
                  content={data.result || ""}
                  filename={data.label || "output"}
                />
              </div>
              <Textarea
                rows={8}
                readOnly
                className={`${fieldClass} scrollbar-none`}
                value={data.result || ""}
              />
            </div>
          )}
        </ScrollFade>
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
