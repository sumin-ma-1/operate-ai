"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { GitHubIcon } from "@/components/icons/GitHubIcon";
import { OpenSpaceShell } from "@/components/open-space/OpenSpaceShell";
import { getEditorRepoUrl } from "@/lib/open-space-url";

export function OpenSpaceLanding() {
  const editorRepoUrl = getEditorRepoUrl();
  const [starFlashKey, setStarFlashKey] = useState(0);

  const triggerStarFlash = () => {
    setStarFlashKey((key) => key + 1);
  };

  return (
    <OpenSpaceShell active="home">
      <section className="relative mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-6xl flex-col justify-center px-6 pb-16 pt-10 sm:px-8">
        {starFlashKey > 0 && (
          <span
            key={starFlashKey}
            className="star-flash is-active"
            aria-hidden="true"
          />
        )}
        <div className="grid w-full items-center gap-10 md:grid-cols-[minmax(0,1fr)_11rem] lg:grid-cols-[minmax(0,1fr)_14rem] xl:grid-cols-[minmax(0,40rem)_1fr]">
          <div className="os-landing-fade max-w-2xl md:pr-4 lg:pr-8">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-sky-300/80">
              Operate AI
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Open Space
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              Community workflows for Operate AI.
              <br />
              Browse shared graphs, open a private copy in your local editor, or
              star pieces to paste into work you already have open.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/open-space"
                onMouseEnter={triggerStarFlash}
                onFocus={triggerStarFlash}
              >
                <Button className="inline-flex items-center gap-2 !rounded-full !border-0 !bg-gradient-to-r !from-slate-500 !via-teal-600 !to-cyan-700 px-6 py-2.5 shadow-[0_0_28px_rgba(45,212,191,0.4),0_0_48px_rgba(8,145,178,0.28)] transition duration-300 hover:shadow-[0_0_36px_rgba(45,212,191,0.55),0_0_64px_rgba(8,145,178,0.38)] hover:!opacity-100">
                  <span className="material-icons text-[20px] leading-none">
                    public
                  </span>
                  Browse gallery
                </Button>
              </Link>
              <a href={editorRepoUrl} target="_blank" rel="noopener noreferrer">
                <Button
                  variant="secondary"
                  className="inline-flex items-center gap-2 !rounded-full border-white/15 bg-slate-900/50 px-6 py-2.5 backdrop-blur-sm transition duration-300 hover:border-sky-400/40 hover:!bg-slate-800/70"
                >
                  <GitHubIcon className="text-[18px]" />
                  Get the editor
                </Button>
              </a>
            </div>
          </div>

          <div
            className="pointer-events-none hidden justify-self-end opacity-90 md:block xl:translate-x-6"
            aria-hidden="true"
          >
            <img
              src="/retro_spaceship_thruster.gif"
              alt=""
              width={160}
              height={160}
              className="os-landing-ship drop-shadow-[0_0_40px_rgba(56,189,248,0.25)]"
            />
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-slate-950/20">
        <div className="mx-auto max-w-6xl px-6 py-14 sm:px-8">
          <h2 className="text-xl font-semibold text-foreground">
            How it works
          </h2>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Local editing stays on your machine. Open Space is only for sharing.
          </p>
          <ol className="mt-8 grid gap-8 sm:grid-cols-3">
            <li className="os-landing-step" style={{ animationDelay: "0.05s" }}>
              <span className="text-xs font-medium uppercase tracking-wider text-sky-300/70">
                01
              </span>
              <h3 className="mt-2 text-sm font-semibold">Browse</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                Search community posts by title, author, or tags.
              </p>
            </li>
            <li className="os-landing-step" style={{ animationDelay: "0.15s" }}>
              <span className="text-xs font-medium uppercase tracking-wider text-sky-300/70">
                02
              </span>
              <h3 className="mt-2 text-sm font-semibold">Open or star</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                Open as new for a private workflow, or Star to paste into an
                open canvas.
              </p>
            </li>
            <li className="os-landing-step" style={{ animationDelay: "0.25s" }}>
              <span className="text-xs font-medium uppercase tracking-wider text-sky-300/70">
                03
              </span>
              <h3 className="mt-2 text-sm font-semibold">Publish</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                From the local editor, publish a workflow so others can reuse
                it. Prompts are public.
              </p>
            </li>
          </ol>
        </div>
      </section>
    </OpenSpaceShell>
  );
}
