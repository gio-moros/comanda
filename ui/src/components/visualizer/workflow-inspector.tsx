import { FileJson2, Info, Link2 } from "lucide-react";
import type { WorkflowReference } from "@/lib/workflow-composer";
import type { ParsedWorkflow, WorkflowNode } from "@/lib/workflow-types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface WorkflowInspectorProps {
  workflow: ParsedWorkflow;
  workflowLabel: string;
  workflowPath: string | null;
  references: WorkflowReference[];
  extraWarnings: string[];
  node: WorkflowNode | null;
  tab: string;
  onTabChange: (value: string) => void;
}

function metadataRows(node: WorkflowNode) {
  return Object.entries(node.metadata).map(([key, value]) => (
    <div className="flex items-start justify-between gap-3" key={key}>
      <div className="section-kicker">{key}</div>
      <div className="max-w-[18rem] text-right font-mono text-xs text-foreground">{value}</div>
    </div>
  ));
}

function listBlock(title: string, values: string[]) {
  return (
    <div>
      <div className="section-kicker">{title}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.length > 0 ? (
          values.map((value) => (
            <Badge key={`${title}-${value}`} variant="secondary">
              {value}
            </Badge>
          ))
        ) : (
          <Badge variant="outline">none</Badge>
        )}
      </div>
    </div>
  );
}

export function WorkflowInspector({
  workflow,
  workflowLabel,
  workflowPath,
  references,
  extraWarnings,
  node,
  tab,
  onTabChange,
}: WorkflowInspectorProps) {
  return (
    <Card className="signal-panel h-full">
      <CardHeader>
        <div className="section-kicker">Inspector</div>
        <CardTitle className="mt-3 font-display text-[2rem] leading-none tracking-[-0.04em]">
          Zoom into the active orchestration layer.
        </CardTitle>
        <CardDescription className="mt-2 leading-6">
          Read the selected node, inspect graph topology, and catch unresolved links or parser warnings before run
          time.
        </CardDescription>
      </CardHeader>

      <CardContent className="h-[calc(100%-6rem)]">
        <Tabs className="h-full" onValueChange={onTabChange} value={tab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="node">Node</TabsTrigger>
            <TabsTrigger value="graph">Graph</TabsTrigger>
            <TabsTrigger value="warnings">Warnings</TabsTrigger>
          </TabsList>

          <TabsContent className="h-[calc(100%-3.25rem)]" value="node">
            <ScrollArea className="h-full pr-1">
              {node ? (
                <div className="space-y-5">
                  <div className="inner-plate rounded-[1.8rem] p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="section-kicker">{node.model}</div>
                        <div className="mt-3 font-display text-[2rem] leading-none tracking-[-0.04em] text-foreground">
                          {node.name}
                        </div>
                      </div>
                      <Badge>{node.type}</Badge>
                    </div>
                    <p className="mt-4 text-sm leading-7 text-slate-700">{node.action}</p>
                  </div>

                  <div className="inner-plate rounded-[1.8rem] p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-primary" />
                      <div className="section-kicker">Data Flow</div>
                    </div>
                    <div className="space-y-4">
                      {listBlock("Inputs", node.inputs)}
                      {listBlock("Outputs", node.outputs)}
                      {listBlock("Dependencies", node.dependsOn)}
                    </div>
                  </div>

                  <div className="inner-plate rounded-[1.8rem] p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <Info className="h-4 w-4 text-primary" />
                      <div className="section-kicker">Metadata</div>
                    </div>
                    <div className="space-y-3">
                      {metadataRows(node).length > 0 ? metadataRows(node) : <Badge variant="outline">none</Badge>}
                    </div>
                  </div>

                  <div className="signal-screen rounded-[1.9rem] p-5">
                    <div className="mb-4 flex items-center gap-2 text-[#dfeeee]">
                      <FileJson2 className="h-4 w-4 text-[#80cad1]" />
                      <div className="section-kicker section-kicker-inverse">Raw node config</div>
                    </div>
                    <pre className="overflow-x-auto rounded-[1.35rem] bg-[rgba(9,19,24,0.42)] p-4 text-xs leading-6 text-slate-100">
                      {JSON.stringify(node.raw, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="flow-note rounded-[1.8rem] p-6 text-sm text-muted-foreground">
                  Select a node in the canvas to inspect its inputs, outputs, and orchestration role.
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="graph">
            <div className="inner-plate space-y-4 rounded-[1.8rem] p-5">
              <div>
                <div className="section-kicker">Workflow summary</div>
                <div className="mt-3 text-sm leading-6 text-muted-foreground">
                  {workflow.stats.totalStages} stages, {workflow.stats.totalNodes} nodes, {workflow.stats.parallelStages}{" "}
                  parallel groups, {workflow.stats.loopStages} loop orchestrators.
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="secondary">{workflowLabel}</Badge>
                  {workflowPath ? <Badge variant="outline">{workflowPath}</Badge> : <Badge variant="outline">draft</Badge>}
                </div>
              </div>

              <Separator />

              <div>
                <div className="section-kicker">Models</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {workflow.stats.uniqueModels.map((model) => (
                    <Badge key={model} variant="secondary">
                      {model}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <div className="section-kicker">Entry inputs</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {workflow.entryInputs.map((input) => (
                    <Badge key={input} variant="outline">
                      {input}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <div className="section-kicker">Final outputs</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {workflow.finalOutputs.map((output) => (
                    <Badge key={output} variant="outline">
                      {output}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <div className="section-kicker">Linked workflows</div>
                <div className="mt-3 space-y-2">
                  {references.length > 0 ? (
                    references.map((reference) => (
                      <div className="inner-plate rounded-[1.4rem] p-3 text-sm text-slate-700" key={reference.id}>
                        <div className="font-semibold text-foreground">{reference.parentNodeId}</div>
                        <div className="mt-1 font-mono text-xs text-muted-foreground">{reference.rawPath}</div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          {reference.resolved
                            ? `Resolved to ${reference.resolvedPath ?? "current draft"}`
                            : "Unresolved sub-workflow reference"}
                        </div>
                      </div>
                    ))
                  ) : (
                    <Badge variant="outline">none</Badge>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="warnings">
            <div className="space-y-3">
              {workflow.warnings.length + extraWarnings.length > 0 ? (
                [...workflow.warnings, ...extraWarnings].map((warning) => (
                  <div className="warning-block rounded-[1.4rem] p-3 text-sm text-slate-700" key={warning}>
                    {warning}
                  </div>
                ))
              ) : (
                <div className="success-block rounded-[1.4rem] p-3 text-sm text-slate-700">
                  No parser warnings for this workflow.
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
