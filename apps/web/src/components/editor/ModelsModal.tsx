"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SpinnerIcon } from "@/components/ui/SpinnerIcon";
import {
  deleteOllamaModel,
  fetchForgeModels,
  fetchForgeSettings,
  fetchModelCatalog,
  fetchProviderSettings,
  pullOllamaModel,
  testProviderConnection,
  updateForgeSettings,
  updateProviderSettings,
} from "@/lib/workflow-api";
import type { ForgeCheckpoint } from "@/lib/workflow-api";
import type {
  ModelCatalogProvider,
  ProviderSecretStatus,
} from "@operate-ai/workflow-schema";

type TabId = "providers" | "ollama" | "forge";

type ModelsModalProps = {
  open: boolean;
  onClose: () => void;
};

const CLOUD_PROVIDERS = [
  { id: "openai" as const, label: "OpenAI", placeholder: "sk-..." },
  { id: "anthropic" as const, label: "Anthropic", placeholder: "sk-ant-..." },
  { id: "gemini" as const, label: "Gemini", placeholder: "AIza..." },
];

export function ModelsModal({ open, onClose }: ModelsModalProps) {
  const [tab, setTab] = useState<TabId>("providers");
  const [catalog, setCatalog] = useState<ModelCatalogProvider[]>([]);
  const [secrets, setSecrets] = useState<Record<string, ProviderSecretStatus>>(
    {}
  );
  const [draftKeys, setDraftKeys] = useState<Record<string, string>>({
    openai: "",
    anthropic: "",
    gemini: "",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [pullName, setPullName] = useState("");
  const [pullStatus, setPullStatus] = useState("");
  const [pulling, setPulling] = useState(false);
  const [forgeCheckpoints, setForgeCheckpoints] = useState<ForgeCheckpoint[]>(
    []
  );
  const [forgeActive, setForgeActive] = useState("");
  const [forgeDefault, setForgeDefault] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextCatalog, nextSecrets, forgeData, forgeSettings] =
        await Promise.all([
          fetchModelCatalog(),
          fetchProviderSettings(),
          fetchForgeModels().catch(() => null),
          fetchForgeSettings().catch(() => null),
        ]);
      setCatalog(nextCatalog);
      setSecrets(nextSecrets);
      if (forgeData) {
        setForgeCheckpoints(forgeData.checkpoints);
        setForgeActive(forgeData.activeCheckpoint);
        setForgeDefault(
          forgeSettings?.defaultCheckpoint || forgeData.defaultCheckpoint || ""
        );
      } else if (forgeSettings) {
        setForgeDefault(forgeSettings.defaultCheckpoint);
        setForgeActive(forgeSettings.activeCheckpoint);
        setForgeCheckpoints([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load models");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open, refresh]);

  if (!open) return null;

  const ollamaEntry = catalog.find((item) => item.provider === "ollama");

  const handleSaveKeys = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const payload: Record<string, string> = {};
      for (const provider of CLOUD_PROVIDERS) {
        const value = draftKeys[provider.id]?.trim();
        if (value) {
          payload[provider.id] = value;
        }
      }
      if (Object.keys(payload).length === 0) {
        setMessage("Enter a new API key to save (leave blank to keep existing).");
        return;
      }
      const next = await updateProviderSettings(payload);
      setSecrets(next);
      setDraftKeys({ openai: "", anthropic: "", gemini: "" });
      setMessage("API keys saved locally on this machine");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleClearKey = async (provider: "openai" | "anthropic" | "gemini") => {
    setSaving(true);
    setError(null);
    try {
      const next = await updateProviderSettings({ [provider]: "" });
      setSecrets(next);
      setMessage(`${provider} key cleared`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clear failed");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (
    provider: "openai" | "anthropic" | "gemini"
  ) => {
    setTesting(provider);
    setError(null);
    setMessage(null);
    try {
      await testProviderConnection({
        provider,
        apiKey: draftKeys[provider]?.trim() || undefined,
      });
      setMessage(`${provider} connection OK`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test failed");
    } finally {
      setTesting(null);
    }
  };

  const handlePull = async (event: FormEvent) => {
    event.preventDefault();
    const name = pullName.trim();
    if (!name) return;
    setPulling(true);
    setPullStatus("Starting…");
    setError(null);
    try {
      await pullOllamaModel(name, (status) => {
        if (typeof status.status === "string") {
          setPullStatus(status.status);
        } else if (status.error) {
          setPullStatus(String(status.error));
        }
      });
      setMessage(`Pulled ${name}`);
      setPullName("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pull failed");
    } finally {
      setPulling(false);
      setPullStatus("");
    }
  };

  const handleSaveForgeDefault = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const next = await updateForgeSettings({
        defaultCheckpoint: forgeDefault || "",
      });
      setForgeDefault(next.defaultCheckpoint);
      setForgeActive(next.activeCheckpoint);
      setMessage("Forge default checkpoint saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOllama = async (name: string) => {
    if (!confirm(`Delete Ollama model "${name}"?`)) return;
    setError(null);
    try {
      await deleteOllamaModel(name);
      setMessage(`Deleted ${name}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="models-modal-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(85vh,640px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 id="models-modal-title" className="text-lg font-semibold">
            Keys
          </h2>
          <button
            type="button"
            className="rounded-md p-1 text-muted hover:bg-background hover:text-foreground"
            onClick={onClose}
            aria-label="Close"
          >
            <span className="material-icons text-[20px] leading-none">close</span>
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          <nav
            className="flex w-36 shrink-0 flex-col gap-1 border-r border-border p-3"
            aria-label="Keys sections"
          >
            {(
              [
                ["providers", "Providers"] as const,
                ["ollama", "Ollama"] as const,
                ["forge", "Forge"] as const,
              ]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                  tab === id
                    ? "bg-white/10 text-foreground"
                    : "text-muted hover:bg-white/5 hover:text-foreground"
                }`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="min-w-0 flex-1 overflow-y-auto px-5 py-4 scrollbar-none">
            {loading && (
              <p className="text-sm text-muted">Loading…</p>
            )}
            {error && (
              <p className="mb-3 rounded-md border border-red-500/40 bg-red-500/10 p-2 text-sm text-red-300">
                {error}
              </p>
            )}
            {message && (
              <p className="mb-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2 text-sm text-emerald-200">
                {message}
              </p>
            )}

            {tab === "providers" && (
              <form className="space-y-4" onSubmit={handleSaveKeys}>
                <p className="text-xs text-muted">
                  Keys are saved once for this machine (all workflows). They are
                  never written into workflow JSON or Open Space. A single LLM
                  node can override a key in its inspector.
                </p>
                {CLOUD_PROVIDERS.map((provider) => {
                  const status = secrets[provider.id];
                  return (
                    <div
                      key={provider.id}
                      className="rounded-lg border border-border/70 bg-background/40 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium">{provider.label}</div>
                        <span className="text-[11px] text-muted">
                          {status?.configured
                            ? `Saved · ${status.apiKeyMasked}`
                            : "Not configured"}
                        </span>
                      </div>
                      <Input
                        className="mt-2"
                        type="password"
                        autoComplete="off"
                        placeholder={
                          status?.configured
                            ? "Enter new key to replace"
                            : provider.placeholder
                        }
                        value={draftKeys[provider.id] || ""}
                        onChange={(event) =>
                          setDraftKeys((current) => ({
                            ...current,
                            [provider.id]: event.target.value,
                          }))
                        }
                      />
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          className="!rounded-full px-3 text-xs"
                          disabled={testing === provider.id}
                          onClick={() => handleTest(provider.id)}
                        >
                          {testing === provider.id ? "Testing…" : "Test"}
                        </Button>
                        {status?.configured ? (
                          <Button
                            type="button"
                            variant="ghost"
                            className="!rounded-full px-3 text-xs text-red-300/80"
                            onClick={() => handleClearKey(provider.id)}
                          >
                            Clear
                          </Button>
                        ) : null}
                      </div>
                      {status?.configured
                        ? catalog
                            .find((item) => item.provider === provider.id)
                            ?.models.slice(0, 6)
                            .map((model) => (
                              <span
                                key={model}
                                className="mr-1 mt-2 inline-block rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-muted"
                              >
                                {model}
                              </span>
                            ))
                        : null}
                    </div>
                  );
                })}
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 !rounded-full"
                  >
                    {saving ? <SpinnerIcon size={16} /> : null}
                    Save keys
                  </Button>
                </div>
              </form>
            )}

            {tab === "ollama" && (
              <div className="space-y-4">
                <form className="flex gap-2" onSubmit={handlePull}>
                  <Input
                    value={pullName}
                    onChange={(event) => setPullName(event.target.value)}
                    placeholder="Model name (e.g. gemma3:4b)"
                    disabled={pulling}
                  />
                  <Button
                    type="submit"
                    disabled={pulling || !pullName.trim()}
                    className="shrink-0 !rounded-full px-4"
                  >
                    {pulling ? "Pulling…" : "Pull"}
                  </Button>
                </form>
                {pullStatus ? (
                  <p className="text-xs text-muted">{pullStatus}</p>
                ) : null}

                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                    Installed
                  </p>
                  {(ollamaEntry?.models.length ?? 0) === 0 ? (
                    <p className="text-sm text-muted">
                      No Ollama models found. Is Ollama running?
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {ollamaEntry?.models.map((name) => (
                        <li
                          key={name}
                          className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2 text-sm"
                        >
                          <span className="truncate">{name}</span>
                          <button
                            type="button"
                            className="shrink-0 text-xs text-red-300/70 hover:text-red-300"
                            onClick={() => handleDeleteOllama(name)}
                          >
                            Delete
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {tab === "forge" && (
              <div className="space-y-4">
                <p className="text-xs text-muted">
                  Default checkpoint for <strong>generate_image</strong> on all
                  workflows. Per-node overrides are in the LLM inspector. Empty
                  uses whatever is active in Forge UI. Env{" "}
                  <code className="text-[11px]">FORGE_DEFAULT_CHECKPOINT</code>{" "}
                  is a fallback when no default is saved here.
                </p>
                {forgeActive ? (
                  <p className="text-xs text-muted">
                    Active in Forge UI:{" "}
                    <span className="text-foreground">{forgeActive}</span>
                  </p>
                ) : null}
                {forgeCheckpoints.length === 0 ? (
                  <p className="text-sm text-muted">
                    No checkpoints from Forge. Is it running with{" "}
                    <code className="text-[11px]">--api</code>?
                  </p>
                ) : (
                  <div>
                    <label className="mb-1.5 block text-xs text-muted">
                      Default checkpoint
                    </label>
                    <select
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                      value={forgeDefault}
                      onChange={(event) => setForgeDefault(event.target.value)}
                    >
                      <option value="">Use Forge UI active model</option>
                      {forgeCheckpoints.map((item) => (
                        <option key={item.title} value={item.title}>
                          {item.title}
                        </option>
                      ))}
                    </select>
                    <div className="mt-3 flex justify-end">
                      <Button
                        type="button"
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 !rounded-full"
                        onClick={() => void handleSaveForgeDefault()}
                      >
                        {saving ? <SpinnerIcon size={16} /> : null}
                        Save default
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
