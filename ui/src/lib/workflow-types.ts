export type WorkflowNodeType =
  | "standard"
  | "generate"
  | "process"
  | "openai-responses"
  | "loop"
  | "deferred";

export type WorkflowStageType = "single" | "parallel" | "loop" | "deferred";

export interface WorkflowNode {
  id: string;
  name: string;
  type: WorkflowNodeType;
  model: string;
  action: string;
  inputs: string[];
  outputs: string[];
  dependsOn: string[];
  metadata: Record<string, string>;
  raw: unknown;
}

export interface WorkflowStage {
  id: string;
  title: string;
  type: WorkflowStageType;
  description: string;
  nodes: WorkflowNode[];
}

export interface WorkflowStats {
  totalNodes: number;
  totalStages: number;
  parallelStages: number;
  loopStages: number;
  uniqueModels: string[];
}

export interface ParsedWorkflow {
  title: string;
  entryInputs: string[];
  finalOutputs: string[];
  stages: WorkflowStage[];
  nodes: WorkflowNode[];
  warnings: string[];
  stats: WorkflowStats;
}
