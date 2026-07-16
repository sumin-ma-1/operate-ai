"use client";

import { useEffect } from "react";

import { EditorHeader } from "@/components/editor/EditorHeader";
import { WorkflowEditor } from "@/components/editor/WorkflowEditor";
import { useWorkflowStore } from "@/stores/workflowStore";

function createId() {
  return `wf-${Date.now().toString(36)}`;
}

export default function NewEditorPage() {
  const initDefaultWorkflow = useWorkflowStore((state) => state.initDefaultWorkflow);

  useEffect(() => {
    initDefaultWorkflow(createId(), "Untitled Workflow");
  }, [initDefaultWorkflow]);

  return (
    <div className="flex h-screen flex-col">
      <EditorHeader />
      <div className="min-h-0 flex-1">
        <WorkflowEditor />
      </div>
    </div>
  );
}
