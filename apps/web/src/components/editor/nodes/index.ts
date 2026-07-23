"use client";

import { ApprovalNode } from "./ApprovalNode";
import { InputNode } from "./InputNode";
import { LlmNode } from "./LlmNode";
import { LoopNode } from "./LoopNode";
import { OutputNode } from "./OutputNode";

export const nodeTypes = {
  input: InputNode,
  llm: LlmNode,
  output: OutputNode,
  loop: LoopNode,
  approval: ApprovalNode,
};
