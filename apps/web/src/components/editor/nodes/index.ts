"use client";

import { InputNode } from "./InputNode";
import { LlmNode } from "./LlmNode";
import { OutputNode } from "./OutputNode";

export const nodeTypes = {
  input: InputNode,
  llm: LlmNode,
  output: OutputNode,
};
