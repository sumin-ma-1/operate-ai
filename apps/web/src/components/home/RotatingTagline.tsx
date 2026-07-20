"use client";

import { useEffect, useState } from "react";

const TAGLINES = [
  "Visual editor for AI agents and LLM workflows",
  "Design, connect, and run intelligent pipelines",
  "Turn ideas into agent workflows you can operate anytime",
  "Build LLM systems node by node, visually",
  "From prompt to production-ready agent flows",
];

const INTERVAL_MS = 11000;

export function RotatingTagline() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setVisible(false);
      window.setTimeout(() => {
        setIndex((current) => (current + 1) % TAGLINES.length);
        setVisible(true);
      }, 600);
    }, INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <p
      className={`mt-2 min-h-[1.5rem] text-muted transition-opacity duration-700 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      {TAGLINES[index]}
    </p>
  );
}
