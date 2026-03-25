import { ArrowRight, GitBranch, RotateCcw } from "lucide-react";
import type { WorkflowModule, WorkflowReference } from "@/lib/workflow-composer";
import type { ParsedWorkflow, WorkflowNode, WorkflowStage } from "@/lib/workflow-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface WorkflowCanvasProps {
  workflow: ParsedWorkflow;
  activeModuleId: string;
  activeModuleLabel: string;
  modules: WorkflowModule[];
  references: WorkflowReference[];
  onSelectModule: (moduleId: string) => void;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}

function stageIcon(stage: WorkflowStage) {
  if (stage.type === "parallel") {
    return <GitBranch className="h-4 w-4" />;
  }

  if (stage.type === "loop") {
    return <RotateCcw className="h-4 w-4" />;
  }

  return null;
}

function stageTone(stage: WorkflowStage) {
  switch (stage.type) {
    case "parallel":
      return "border-[#2d919a]/24 bg-[linear-gradient(180deg,rgba(226,244,243,0.96),rgba(245,250,249,0.95))]";
    case "loop":
      return "border-[#88a045]/24 bg-[linear-gradient(180deg,rgba(244,248,232,0.98),rgba(251,252,246,0.96))]";
    case "deferred":
      return "border-[#d58652]/24 bg-[linear-gradient(180deg,rgba(255,242,233,0.98),rgba(253,248,241,0.96))]";
    default:
      return "border-[rgba(111,92,72,0.18)] bg-[linear-gradient(180deg,rgba(255,252,247,0.98),rgba(246,238,224,0.92))]";
  }
}

function nodeTone(node: WorkflowNode) {
  switch (node.type) {
    case "process":
      return "border-[#b6d7da] bg-[rgba(238,248,249,0.88)]";
    case "generate":
      return "border-[#e4c7a5] bg-[rgba(255,247,235,0.88)]";
    case "loop":
      return "border-[#d1e0af] bg-[rgba(245,250,236,0.88)]";
    case "deferred":
      return "border-[#efc5a7] bg-[rgba(255,241,232,0.88)]";
    case "openai-responses":
      return "border-[#d6cee8] bg-[rgba(244,239,255,0.88)]";
    default:
      return "border-[rgba(110,92,72,0.12)] bg-[rgba(255,252,247,0.84)]";
  }
}

function renderNode(node: WorkflowNode, selectedNodeId: string | null, onSelectNode: (nodeId: string) => void) {
  return (
    <button
      className={cn(
        "w-full rounded-[1.6rem] border p-4 text-left transition duration-200 hover:-translate-y-1 hover:shadow-[0_16px_30px_rgba(52,39,20,0.12)]",
        nodeTone(node),
        selectedNodeId === node.id && "ring-2 ring-primary ring-offset-2 ring-offset-[rgba(250,245,237,1)]",
      )}
      key={node.id}
      onClick={() => onSelectNode(node.id)}
      type="button"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="section-kicker">{node.model}</div>
          <div className="mt-2 text-base font-semibold text-foreground">{node.name}</div>
        </div>
        <Badge variant="outline">{node.type}</Badge>
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-700">{node.action}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {node.dependsOn.length > 0 ? (
          node.dependsOn.map((dep) => (
            <Badge className="bg-white/70" key={dep} variant="secondary">
              depends on {dep}
            </Badge>
          ))
        ) : (
          <Badge className="bg-white/70" variant="secondary">
            entry node
          </Badge>
        )}
      </div>
    </button>
  );
}

export function WorkflowCanvas({
  workflow,
  activeModuleId,
  activeModuleLabel,
  modules,
  references,
  onSelectModule,
  selectedNodeId,
  onSelectNode,
}: WorkflowCanvasProps) {
  const activeReferences = references.filter((reference) => reference.parentModuleId === activeModuleId);

  return (
    <Card className="signal-panel min-h-[780px]">
      <CardHeader className="pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="section-kicker">Flow Atlas</div>
            <CardTitle className="mt-3 font-display text-[2.5rem] leading-none tracking-[-0.045em]">
              Read the route before you run it.
            </CardTitle>
            <CardDescription className="mt-3 max-w-2xl leading-6">
              Sequential stages stretch across the desk, parallel groups split into lanes, and linked sub-workflows
              stay attached to the same orchestration map.
            </CardDescription>
          </div>

          <div className="flex max-w-md flex-wrap justify-end gap-2">
            {workflow.entryInputs.map((input) => (
              <Badge key={input} variant="secondary">
                entry {input}
              </Badge>
            ))}
            {workflow.finalOutputs.map((output) => (
              <Badge key={output} variant="outline">
                output {output}
              </Badge>
            ))}
          </div>
        </div>

        <div className="inner-plate rounded-[1.8rem] p-4">
          <div className="section-kicker">Linked Workflow Dock</div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline">active {activeModuleLabel}</Badge>
            {modules.map((module) => (
              <Button
                className={module.id === activeModuleId ? "" : "bg-[rgba(255,251,243,0.68)]"}
                key={module.id}
                onClick={() => onSelectModule(module.id)}
                size="sm"
                variant={module.id === activeModuleId ? "default" : "outline"}
              >
                {module.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {activeReferences.length > 0 ? (
          <div className="mb-5 grid gap-3 md:grid-cols-2">
            {activeReferences.map((reference) => {
              const targetModuleId = reference.targetModuleId;

              return (
                <div className="inner-plate rounded-[1.75rem] p-4" key={reference.id}>
                  <div className="section-kicker">Linked workflow</div>
                  <div className="mt-2 text-base font-semibold text-foreground">{reference.parentNodeId}</div>
                  <div className="mt-1 font-mono text-[11px] text-muted-foreground">{reference.rawPath}</div>
                  <div className="mt-4">
                    {reference.resolved && targetModuleId ? (
                      <Button onClick={() => onSelectModule(targetModuleId)} size="sm" variant="outline">
                        Open linked workflow
                      </Button>
                    ) : (
                      <Badge variant="outline">unresolved</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        <ScrollArea className="w-full">
          <div className="flex min-w-max items-stretch gap-5 pb-2">
            {workflow.stages.map((stage, index) => (
              <div className="flex items-center gap-5" key={stage.id}>
                <div
                  className={cn(
                    "w-[330px] rounded-[2rem] border p-5 shadow-[0_18px_38px_rgba(53,39,21,0.08)] transition animate-stage-in",
                    stageTone(stage),
                  )}
                >
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <div>
                      <div className="section-kicker">
                        {String(index + 1).padStart(2, "0")} / {stage.type}
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-base font-semibold text-foreground">
                        {stageIcon(stage)}
                        {stage.title}
                      </div>
                      <div className="mt-2 text-sm leading-6 text-muted-foreground">{stage.description}</div>
                    </div>
                    <Badge variant="accent">{stage.nodes.length} nodes</Badge>
                  </div>

                  <div className="grid gap-3">
                    {stage.nodes.map((node) => renderNode(node, selectedNodeId, onSelectNode))}
                  </div>
                </div>

                {index < workflow.stages.length - 1 ? (
                  <div className="hidden h-full items-center lg:flex">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <div className="h-16 w-px bg-gradient-to-b from-transparent via-border to-transparent" />
                      <ArrowRight className="h-4 w-4" />
                      <div className="h-16 w-px bg-gradient-to-b from-transparent via-border to-transparent" />
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
