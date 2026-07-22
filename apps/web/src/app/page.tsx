"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { RotatingTagline } from "@/components/home/RotatingTagline";
import { deleteWorkflow, fetchWorkflows } from "@/lib/workflow-api";
import type { WorkflowSummary } from "@operate-ai/workflow-schema";

export default function HomePage() {
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starFlashKey, setStarFlashKey] = useState(0);

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
    loadWorkflows();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this workflow?")) return;
    await deleteWorkflow(id);
    await loadWorkflows();
  };

  const isEmpty = !loading && !error && workflows.length === 0;

  return (
    <div className="space-backdrop min-h-screen">
      {starFlashKey > 0 && (
        <span
          key={starFlashKey}
          className="star-flash is-active"
          aria-hidden="true"
        />
      )}
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
          <div className="mt-6">
            <Link
              href="/editor/new"
              onMouseEnter={triggerStarFlash}
              onFocus={triggerStarFlash}
            >
              <Button className="!rounded-full border-0 bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500 px-6 py-2.5 shadow-[0_0_28px_rgba(59,130,246,0.55),0_0_48px_rgba(99,102,241,0.25)] transition duration-300 hover:shadow-[0_0_36px_rgba(59,130,246,0.75),0_0_64px_rgba(99,102,241,0.4)] hover:!opacity-100">
                New Workflow
              </Button>
            </Link>
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

            {/*
              Columns by screen size (Tailwind breakpoints):
              - default: 1
              - sm (640px+): 2
              - lg (1024px+): 3
              - xl (1280px+): 4
              Change grid-cols-* below to adjust.
            */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {workflows.map((workflow) => (
                <Card
                  key={workflow.id}
                  className="group flex h-full flex-col gap-3 border-white/10 bg-slate-900/50 backdrop-blur-sm transition duration-300 hover:border-sky-400/40 hover:bg-slate-800/70 hover:shadow-[0_0_20px_rgba(56,189,248,0.12)]"
                >
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold">{workflow.name}</h2>
                    {workflow.updatedAt &&
                      workflow.updatedAt !== workflow.createdAt && (
                        <p className="mt-1 text-xs text-muted">
                          Updated at {" "}
                          {new Date(workflow.updatedAt).toLocaleString()}
                        </p>
                      )}
                    {workflow.createdAt && (
                      <p
                        className={`text-xs text-muted ${
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
                      className="!rounded-full px-4 transition duration-300 group-hover:!bg-slate-700 group-hover:shadow-[0_0_14px_rgba(56,189,248,0.28)] hover:-translate-y-0.5 hover:!bg-slate-700"
                    >
                        Open
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      className="!rounded-full px-4 !font-normal text-red-300/35 hover:!bg-red-500/15 hover:text-red-300/90"
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
    </div>
  );
}
