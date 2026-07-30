import Link from "next/link";
import type { ReactNode } from "react";

import { GitHubIcon } from "@/components/icons/GitHubIcon";
import { getEditorRepoUrl } from "@/lib/open-space-url";

interface OpenSpaceShellProps {
  children: ReactNode;
  /** Highlight Gallery in the nav when on gallery/detail. */
  active?: "home" | "gallery";
}

export function OpenSpaceShell({
  children,
  active = "home",
}: OpenSpaceShellProps) {
  const editorRepoUrl = getEditorRepoUrl();

  return (
    <div className="space-backdrop flex min-h-screen flex-col">
      <header className="relative z-20 border-b border-white/10 bg-slate-950/40 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-6 sm:px-8">
          <Link
            href="/"
            className="flex items-center gap-2 text-foreground transition hover:opacity-90"
          >
            <img
              src="/retro_spaceship_thruster.gif"
              alt=""
              width={28}
              height={28}
              className="shrink-0"
            />
            <span className="text-sm font-semibold tracking-wide">
              Open Space
            </span>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/open-space"
              className={`rounded-full px-3 py-1.5 text-sm transition ${
                active === "gallery"
                  ? "bg-white/10 text-foreground"
                  : "text-muted hover:bg-white/5 hover:text-foreground"
              }`}
            >
              Gallery
            </Link>
            <a
              href={editorRepoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 inline-flex items-center gap-1.5 rounded-full border-0 bg-gradient-to-r from-sky-600 via-indigo-600 to-indigo-700 px-3.5 py-1.5 text-sm font-medium text-white shadow-[0_0_18px_rgba(99,102,241,0.25)] transition duration-300 hover:shadow-[0_0_24px_rgba(99,102,241,0.4)] hover:opacity-95"
            >
              <GitHubIcon className="text-[15px]" />
              Get the editor
            </a>
          </nav>
        </div>
      </header>

      <div className="relative z-10 flex flex-1 flex-col">{children}</div>

      <footer className="relative z-20 border-t border-white/10 bg-slate-950/30">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div>
            <p className="text-sm font-medium text-foreground/90">
              Open Space · Operate AI
            </p>
            <p className="mt-1 max-w-md text-xs text-muted">
              Edit workflows privately in the local Operate AI editor. Share
              prompts and graphs here for others to open or star.
            </p>
          </div>
          <a
            href={editorRepoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted underline-offset-2 transition hover:text-foreground hover:underline"
          >
            <GitHubIcon className="text-[13px]" />
            Get Operate AI on GitHub
            <span className="material-icons text-[14px] leading-none">
              arrow_forward
            </span>
          </a>
        </div>
      </footer>
    </div>
  );
}
