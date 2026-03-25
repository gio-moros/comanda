import YAML from "yaml";
import type {
  ParsedWorkflow,
  WorkflowNode,
  WorkflowNodeType,
  WorkflowStage,
  WorkflowStats,
} from "@/lib/workflow-types";

type AnyRecord = Record<string, unknown>;

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeList(value: unknown): string[] {
  if (value == null) {
    return [];
  }

  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeList(item));
  }

  if (isRecord(value)) {
    if (typeof value.url === "string") {
      return [`url:${value.url}`];
    }

    if (isRecord(value.database)) {
      return ["database"];
    }

    return ["structured"];
  }

  return [String(value)];
}

function normalizeModel(value: unknown): string {
  const list = normalizeList(value);
  return list[0] ?? "NA";
}

function summarizeAction(value: unknown): string {
  const raw = normalizeList(value).join(" ").replace(/\s+/g, " ").trim();
  if (!raw) {
    return "No action";
  }

  if (raw.length <= 140) {
    return raw;
  }

  return `${raw.slice(0, 137)}...`;
}

function inferNodeType(stepConfig: AnyRecord): WorkflowNodeType {
  if (isRecord(stepConfig.generate)) {
    return "generate";
  }

  if (isRecord(stepConfig.process)) {
    return "process";
  }

  if (stepConfig.type === "openai-responses") {
    return "openai-responses";
  }

  return "standard";
}

function buildStepNode(name: string, stepConfig: AnyRecord, forcedType?: WorkflowNodeType): WorkflowNode {
  const type = forcedType ?? inferNodeType(stepConfig);
  const generateConfig = isRecord(stepConfig.generate) ? stepConfig.generate : null;
  const processConfig = isRecord(stepConfig.process) ? stepConfig.process : null;

  const model =
    type === "generate"
      ? normalizeModel(generateConfig?.model)
      : type === "process"
        ? "NA"
        : normalizeModel(stepConfig.model);

  const action =
    type === "generate"
      ? summarizeAction(generateConfig?.action)
      : type === "process"
        ? `Process ${String(processConfig?.workflow_file ?? "sub-workflow")}`
        : stepConfig.type === "openai-responses"
          ? summarizeAction(stepConfig.instructions)
          : summarizeAction(stepConfig.action);

  const inputs = normalizeList(stepConfig.input);
  const outputs =
    type === "generate"
      ? normalizeList(generateConfig?.output)
      : normalizeList(stepConfig.output);

  const metadata: Record<string, string> = {};
  if (type === "process" && typeof processConfig?.workflow_file === "string") {
    metadata.workflowFile = processConfig.workflow_file;
  }
  if (type === "openai-responses" && typeof stepConfig.instructions === "string") {
    metadata.instructions = stepConfig.instructions;
  }

  return {
    id: name,
    name,
    type,
    model,
    action,
    inputs,
    outputs,
    dependsOn: [],
    metadata,
    raw: stepConfig,
  };
}

function buildLoopNode(loopName: string, loopConfig: AnyRecord, workflowNode?: AnyRecord): WorkflowNode {
  const actionBits = [
    `max ${String(loopConfig.max_iterations ?? 10)} iterations`,
    loopConfig.exit_condition ? `exit: ${String(loopConfig.exit_condition)}` : "exit: llm_decides",
  ];

  if (loopConfig.stateful === true) {
    actionBits.push("stateful");
  }

  if (typeof workflowNode?.role === "string") {
    actionBits.push(`role: ${workflowNode.role}`);
  }

  const metadata: Record<string, string> = {};
  if (typeof loopConfig.input_state === "string") {
    metadata.inputState = loopConfig.input_state;
  }
  if (typeof loopConfig.output_state === "string") {
    metadata.outputState = loopConfig.output_state;
  }
  if (typeof workflowNode?.validates === "string") {
    metadata.validates = workflowNode.validates;
  }
  if (typeof workflowNode?.on_fail === "string") {
    metadata.onFail = workflowNode.on_fail;
  }

  return {
    id: loopName,
    name: loopName,
    type: "loop",
    model: "claude-code",
    action: actionBits.join(" | "),
    inputs: normalizeList(loopConfig.input_state ?? "NA"),
    outputs: normalizeList(loopConfig.output_state ?? "STDOUT"),
    dependsOn: normalizeList(loopConfig.depends_on),
    metadata,
    raw: loopConfig,
  };
}

function buildDependencies(nodes: WorkflowNode[]) {
  const outputProducers = new Map<string, string>();

  for (const node of nodes) {
    for (const output of node.outputs) {
      if (!output || output === "STDOUT" || output === "MEMORY" || output === "NA") {
        continue;
      }
      outputProducers.set(output, node.name);
    }
  }

  for (const node of nodes) {
    const deps = new Set(node.dependsOn);
    for (const input of node.inputs) {
      const producer = outputProducers.get(input);
      if (producer && producer !== node.name) {
        deps.add(producer);
      }
    }
    node.dependsOn = Array.from(deps);
  }
}

function findEntryInputs(nodes: WorkflowNode[]): string[] {
  const outputs = new Set<string>();
  const entryInputs = new Set<string>();

  for (const node of nodes) {
    for (const output of node.outputs) {
      if (output) {
        outputs.add(output);
      }
    }
  }

  for (const node of nodes) {
    for (const input of node.inputs) {
      if (!input || input === "STDIN" || input === "NA") {
        continue;
      }
      if (!outputs.has(input)) {
        entryInputs.add(input);
      }
    }
  }

  return Array.from(entryInputs);
}

function findFinalOutputs(nodes: WorkflowNode[]): string[] {
  const inputs = new Set<string>();
  const finals = new Set<string>();

  for (const node of nodes) {
    for (const input of node.inputs) {
      if (input) {
        inputs.add(input);
      }
    }
  }

  for (const node of nodes) {
    for (const output of node.outputs) {
      if (!output) {
        continue;
      }
      if (output === "STDOUT" || !inputs.has(output)) {
        finals.add(output);
      }
    }
  }

  return Array.from(finals);
}

function buildStats(stages: WorkflowStage[], nodes: WorkflowNode[]): WorkflowStats {
  const uniqueModels = Array.from(
    new Set(nodes.map((node) => node.model).filter((model) => model && model !== "NA")),
  ).sort();

  return {
    totalNodes: nodes.length,
    totalStages: stages.length,
    parallelStages: stages.filter((stage) => stage.type === "parallel").length,
    loopStages: stages.filter((stage) => stage.type === "loop").length,
    uniqueModels,
  };
}

function topologicalOrder(loopConfigs: Record<string, AnyRecord>): string[] {
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const order: string[] = [];

  function visit(loopName: string) {
    if (visited.has(loopName)) {
      return;
    }

    if (visiting.has(loopName)) {
      return;
    }

    visiting.add(loopName);
    for (const dep of normalizeList(loopConfigs[loopName]?.depends_on)) {
      if (loopConfigs[dep]) {
        visit(dep);
      }
    }
    visiting.delete(loopName);
    visited.add(loopName);
    order.push(loopName);
  }

  for (const loopName of Object.keys(loopConfigs)) {
    visit(loopName);
  }

  return order;
}

function parseLoopWorkflow(root: AnyRecord): ParsedWorkflow {
  const loopConfigs = isRecord(root.loops) ? (root.loops as Record<string, AnyRecord>) : {};
  const workflowNodes = isRecord(root.workflow) ? (root.workflow as Record<string, AnyRecord>) : {};
  let executionOrder = normalizeList(root.execute_loops);

  if (executionOrder.length === 0 && Object.keys(workflowNodes).length > 0) {
    executionOrder = Object.values(workflowNodes)
      .flatMap((item) => (isRecord(item) && typeof item.loop === "string" ? [item.loop] : []));
  }

  if (executionOrder.length === 0) {
    executionOrder = topologicalOrder(loopConfigs);
  }

  const stages: WorkflowStage[] = [];
  const nodes: WorkflowNode[] = [];
  const warnings: string[] = [];

  for (const loopName of executionOrder) {
    const config = loopConfigs[loopName];
    if (!isRecord(config)) {
      warnings.push(`Loop "${loopName}" is referenced but not defined.`);
      continue;
    }

    const workflowNode = Object.values(workflowNodes).find(
      (node) => isRecord(node) && node.loop === loopName,
    );

    const builtNode = buildLoopNode(loopName, config, isRecord(workflowNode) ? workflowNode : undefined);
    nodes.push(builtNode);
    stages.push({
      id: `stage-${loopName}`,
      title: loopName,
      type: "loop",
      description: "Named loop orchestrator",
      nodes: [builtNode],
    });
  }

  buildDependencies(nodes);

  return {
    title: "Named loop orchestration",
    entryInputs: findEntryInputs(nodes),
    finalOutputs: findFinalOutputs(nodes),
    stages,
    nodes,
    warnings,
    stats: buildStats(stages, nodes),
  };
}

export function parseWorkflowSource(source: string): ParsedWorkflow {
  const parsed = YAML.parse(source);

  if (!isRecord(parsed)) {
    throw new Error("Workflow YAML must decode to a mapping at the top level.");
  }

  if (isRecord(parsed.loops)) {
    return parseLoopWorkflow(parsed);
  }

  const warnings: string[] = [];
  const stages: WorkflowStage[] = [];
  const nodes: WorkflowNode[] = [];
  let deferredNodes: WorkflowNode[] = [];

  for (const [key, value] of Object.entries(parsed)) {
    if (key === "parallel-process") {
      if (!isRecord(value)) {
        warnings.push("parallel-process must be a mapping.");
        continue;
      }

      const stageNodes = Object.entries(value)
        .filter((entry): entry is [string, AnyRecord] => isRecord(entry[1]))
        .map(([name, stepConfig]) => buildStepNode(name, stepConfig));

      nodes.push(...stageNodes);
      stages.push({
        id: "parallel-process",
        title: "parallel-process",
        type: "parallel",
        description: "Fan-out stage across multiple agents.",
        nodes: stageNodes,
      });
      continue;
    }

    if (key === "defer") {
      if (!isRecord(value)) {
        warnings.push("defer must be a mapping.");
        continue;
      }

      deferredNodes = Object.entries(value)
        .filter((entry): entry is [string, AnyRecord] => isRecord(entry[1]))
        .map(([name, stepConfig]) => buildStepNode(name, stepConfig, "deferred"));
      nodes.push(...deferredNodes);
      continue;
    }

    if (key === "agentic-loop") {
      if (!isRecord(value)) {
        warnings.push("agentic-loop must be a mapping.");
        continue;
      }

      const loopNode = buildLoopNode(String(value.name ?? "agentic-loop"), value);
      nodes.push(loopNode);
      stages.push({
        id: "agentic-loop",
        title: String(value.name ?? "agentic-loop"),
        type: "loop",
        description: "Standalone agentic loop",
        nodes: [loopNode],
      });
      continue;
    }

    if (["worktrees", "workflow", "execute_loops", "loops"].includes(key)) {
      continue;
    }

    if (!isRecord(value)) {
      warnings.push(`Top-level key "${key}" is not a valid workflow step block.`);
      continue;
    }

    const stepNode = buildStepNode(key, value);
    nodes.push(stepNode);
    stages.push({
      id: `stage-${key}`,
      title: key,
      type: "single",
      description: stepNode.type === "process" ? "Sub-workflow execution" : "Sequential step",
      nodes: [stepNode],
    });
  }

  if (deferredNodes.length > 0) {
    stages.push({
      id: "deferred",
      title: "defer",
      type: "deferred",
      description: "Conditionally dispatched follow-up steps",
      nodes: deferredNodes,
    });
  }

  buildDependencies(nodes);

  return {
    title: "Comanda workflow",
    entryInputs: findEntryInputs(nodes),
    finalOutputs: findFinalOutputs(nodes),
    stages,
    nodes,
    warnings,
    stats: buildStats(stages, nodes),
  };
}
