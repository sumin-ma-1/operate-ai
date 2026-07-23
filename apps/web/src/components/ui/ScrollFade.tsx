"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface ScrollFadeProps {
  children: ReactNode;
  className?: string;
}

const bottomFadeMask =
  "linear-gradient(to bottom, black calc(100% - 3.5rem), transparent)";

export function ScrollFade({ children, className = "" }: ScrollFadeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [fadeBottom, setFadeBottom] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) {
      setFadeBottom(false);
      return;
    }
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
    setFadeBottom(el.scrollHeight > el.clientHeight + 1 && remaining > 4);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    update();

    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(el);

    const mutationObserver = new MutationObserver(update);
    mutationObserver.observe(el, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [update, children]);

  return (
    <div
      ref={ref}
      onScroll={update}
      className={`scrollbar-none overflow-y-auto transition-[mask-image,-webkit-mask-image] duration-200 ${className}`}
      style={
        fadeBottom
          ? {
              WebkitMaskImage: bottomFadeMask,
              maskImage: bottomFadeMask,
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}
