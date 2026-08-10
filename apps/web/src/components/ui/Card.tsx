import type { HTMLAttributes } from "react";

/** Frosted glass surface (no hover) — detail pages, static panels. */
export const glassCardSurfaceClassName =
  "flex h-full flex-col gap-3 !rounded-[1.75rem] !border-white/20 !bg-white/[0.08] !p-5 !shadow-[0_8px_32px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-xl";

/** Frosted glass surface with hover — home saved workflows and Open Space gallery. */
export const glassCardClassName = `${glassCardSurfaceClassName} group transition duration-300 hover:!border-white/35 hover:!bg-white/[0.12] hover:!shadow-[0_12px_40px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.22)]`;

export const glassCardButtonClassName =
  "!rounded-full !border-white/20 !bg-white/10 px-4 !text-white/90 backdrop-blur-md transition duration-300 hover:!-translate-y-0.5 hover:!border-white/35 hover:!bg-white/20";

export function Card({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-lg border border-border bg-card p-4 shadow ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
