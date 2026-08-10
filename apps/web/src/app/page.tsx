"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ModelsModal } from "@/components/editor/ModelsModal";
import { OpenSpaceLanding } from "@/components/open-space/OpenSpaceLanding";
import { Button } from "@/components/ui/Button";
import {
  Card,
  glassCardButtonClassName,
  glassCardClassName,
} from "@/components/ui/Card";
import { RotatingTagline } from "@/components/home/RotatingTagline";
import {
  getPublicOpenSpaceHref,
  isLocalEditorHost,
  isPublicOpenSpaceSite,
  openExternalUrl,
} from "@/lib/open-space-url";
import { deleteWorkflow, fetchWorkflows } from "@/lib/workflow-api";
import type { WorkflowSummary } from "@operate-ai/workflow-schema";

export default function HomePage() {
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starFlashKey, setStarFlashKey] = useState(0);
  const [modelsOpen, setModelsOpen] = useState(false);

  const isPublic = isPublicOpenSpaceSite();

  useEffect(() => {
    // Non-local hosts that are not the public build still go to the gallery alias.
    if (!isPublic && !isLocalEditorHost()) {
      window.location.replace("/open-space");
    }
  }, [isPublic]);

  const triggerStarFlash = () => {
    setStarFlashKey((key) => key + 1);
  };

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
    if (isPublic) return;
    void loadWorkflows();
  }, [isPublic]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this workflow?")) return;
    await deleteWorkflow(id);
    await loadWorkflows();
  };

  if (isPublic) {
    return <OpenSpaceLanding />;
  }

  const isEmpty = !loading && !error && workflows.length === 0;
  const publicOpenSpaceHref = getPublicOpenSpaceHref("/");
  const openSpaceHref = publicOpenSpaceHref || "/community";

  const handleOpenSpace = () => {
    if (publicOpenSpaceHref) {
      void openExternalUrl(publicOpenSpaceHref);
      return;
    }
    window.location.assign(openSpaceHref);
  };

  return (
    <div className="space-backdrop min-h-screen">
      {starFlashKey > 0 && (
        <span
          key={starFlashKey}
          className="star-flash is-active"
          aria-hidden="true"
        />
      )}
      <Button
        onClick={() => setModelsOpen(true)}
        title="Keys"
        aria-label="Keys"
        className="group fixed top-5 left-5 z-20 inline-flex !h-11 !w-11 items-center justify-center !rounded-full border-0 !bg-transparent !p-0 shadow-none hover:!bg-transparent hover:!opacity-100"
      >
        <span className="material-symbols-outlined text-[22px] leading-none text-white/55 transition duration-300 group-hover:text-white group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.45)]">
          orbit
        </span>
      </Button>
      <main
        className={`relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-8 ${
          isEmpty ? "justify-center pb-8" : "pb-10 pt-8"
        }`}
      >
        <div
          className={`flex flex-col items-center text-center ${
            isEmpty ? "" : "pt-[12vh]"
          }`}
        >
          <img
            src="/retro_spaceship_thruster.gif"
            alt="Operate AI"
            width={48}
            height={48}
            className="mb-3"
          />
          <h1 className="text-3xl font-bold">Operate AI</h1>
          <RotatingTagline />
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/editor/new"
              onMouseEnter={triggerStarFlash}
              onFocus={triggerStarFlash}
            >
              <Button className="inline-flex items-center gap-2 !rounded-full border-0 bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500 px-6 py-2.5 shadow-[0_0_28px_rgba(59,130,246,0.55),0_0_48px_rgba(99,102,241,0.25)] transition duration-300 hover:shadow-[0_0_36px_rgba(59,130,246,0.75),0_0_64px_rgba(99,102,241,0.4)] hover:!opacity-100">
                <span className="material-icons text-[20px] leading-none">
                  draw
                </span>
                New Workflow
              </Button>
            </Link>
            <Button
              type="button"
              onClick={handleOpenSpace}
              className="inline-flex items-center gap-2 !rounded-full border-0 bg-gradient-to-r from-slate-500 via-teal-600 to-cyan-700 px-6 py-2.5 shadow-[0_0_24px_rgba(45,212,191,0.28),0_0_40px_rgba(8,145,178,0.18)] transition duration-300 hover:shadow-[0_0_32px_rgba(45,212,191,0.4),0_0_52px_rgba(8,145,178,0.28)] hover:!opacity-100"
            >
              <span className="material-icons text-[20px] leading-none">
                public
              </span>
              Open Space
            </Button>
          </div>
        </div>

        {!isEmpty && (
          <section className="mt-10">
            {loading && (
              <p className="text-center text-muted">Loading workflows...</p>
            )}
            {error && (
              <p className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
                {error}
              </p>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {workflows.map((workflow) => (
                <Card key={workflow.id} className={glassCardClassName}>
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold text-white/95">
                      {workflow.name}
                    </h2>
                    {workflow.updatedAt &&
                      workflow.updatedAt !== workflow.createdAt && (
                        <p className="mt-1 text-xs text-white/45">
                          Updated at{" "}
                          {new Date(workflow.updatedAt).toLocaleString()}
                        </p>
                      )}
                    {workflow.createdAt && (
                      <p
                        className={`text-xs text-white/45 ${
                          workflow.updatedAt &&
                          workflow.updatedAt !== workflow.createdAt
                            ? "mt-0.5"
                            : "mt-1"
                        }`}
                      >
                        Created at {new Date(workflow.createdAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="mt-auto flex gap-2">
                    <Link href={`/editor/${workflow.id}`}>
                      <Button
                        variant="secondary"
                        className={glassCardButtonClassName}
                      >
                        Open
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      className="!rounded-full px-4 !font-normal text-red-300/40 hover:!bg-white/10 hover:text-red-200/90"
                      onClick={() => handleDelete(workflow.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}
      </main>

      <ModelsModal open={modelsOpen} onClose={() => setModelsOpen(false)} />
    </div>
  );
}
