import type { WorkflowDefinition } from "@operate-ai/workflow-schema";

export type StarredWorkflow = {
  id: string;
  title: string;
  sourcePostId?: string;
  authorName?: string;
  workflow: WorkflowDefinition;
  starredAt: string;
};

const STORAGE_KEY = "operate-ai:workflow-stars";
const MAX_STARRED = 30;

function readAll(): StarredWorkflow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StarredWorkflow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(items: StarredWorkflow[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function listStarred(): StarredWorkflow[] {
  return readAll().sort((a, b) => b.starredAt.localeCompare(a.starredAt));
}

export function isStarred(id: string): boolean {
  return readAll().some((item) => item.id === id);
}

export function starWorkflow(args: {
  id: string;
  title: string;
  workflow: WorkflowDefinition;
  sourcePostId?: string;
  authorName?: string;
}): StarredWorkflow {
  const items = readAll().filter((item) => item.id !== args.id);
  const next: StarredWorkflow = {
    id: args.id,
    title: args.title.trim() || "Untitled",
    sourcePostId: args.sourcePostId,
    authorName: args.authorName,
    workflow: args.workflow,
    starredAt: new Date().toISOString(),
  };
  items.unshift(next);
  writeAll(items.slice(0, MAX_STARRED));
  return next;
}

export function unstarWorkflow(id: string): boolean {
  const items = readAll();
  const next = items.filter((item) => item.id !== id);
  if (next.length === items.length) return false;
  writeAll(next);
  return true;
}
