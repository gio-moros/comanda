import { DatabaseZap, Upload } from "lucide-react";
import type { WorkflowSample } from "@/lib/samples";
import type { ServerWorkflowFile } from "@/lib/server-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";

interface WorkflowSourcePanelProps {
  samples: WorkflowSample[];
  selectedSampleId: string;
  onSampleSelect: (sampleId: string) => void;
  yamlSource: string;
  onYamlChange: (value: string) => void;
  onFileUpload: (file: File) => void;
  serverBaseUrl: string;
  onServerBaseUrlChange: (value: string) => void;
  serverToken: string;
  onServerTokenChange: (value: string) => void;
  serverWorkflows: ServerWorkflowFile[];
  authRequired: boolean;
  serverError: string | null;
  serverLoading: boolean;
  onRefreshServer: () => void;
  onLoadServerWorkflow: (workflowPath: string) => void;
}

export function WorkflowSourcePanel({
  samples,
  selectedSampleId,
  onSampleSelect,
  yamlSource,
  onYamlChange,
  onFileUpload,
  serverBaseUrl,
  onServerBaseUrlChange,
  serverToken,
  onServerTokenChange,
  serverWorkflows,
  authRequired,
  serverError,
  serverLoading,
  onRefreshServer,
  onLoadServerWorkflow,
}: WorkflowSourcePanelProps) {
  return (
    <Card className="signal-panel">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="section-kicker">Source Deck</div>
            <CardTitle className="mt-3 font-display text-[2rem] leading-none tracking-[-0.04em]">
              Load, compare, and edit the flow.
            </CardTitle>
            <CardDescription className="mt-3 max-w-sm leading-6">
              Pull from curated workflow packs, browse the server registry, or paste fresh YAML straight into the
              editor surface.
            </CardDescription>
          </div>
          <Badge variant="outline">{samples.length} samples</Badge>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <div className="space-y-3">
          <div className="section-kicker">Curated Flows</div>
          <ScrollArea className="max-h-56 pr-2">
            <div className="grid gap-3">
              {samples.map((sample) => (
                <button
                  className={`inner-plate rounded-[1.75rem] px-4 py-4 text-left transition duration-200 hover:-translate-y-0.5 ${
                    sample.id === selectedSampleId
                      ? "border-[rgba(29,105,116,0.38)] bg-[rgba(231,245,244,0.9)] shadow-[0_16px_30px_rgba(24,81,90,0.12)]"
                      : "hover:border-[rgba(29,105,116,0.24)] hover:bg-[rgba(255,252,247,0.9)]"
                  }`}
                  key={sample.id}
                  onClick={() => onSampleSelect(sample.id)}
                  type="button"
                >
                  <div className="section-kicker">{sample.path ?? "sample workflow"}</div>
                  <div className="mt-2 text-base font-semibold text-foreground">{sample.name}</div>
                  <div className="mt-2 text-sm leading-6 text-muted-foreground">{sample.description}</div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        <div className="inner-plate rounded-[1.9rem] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="section-kicker">Server Registry</div>
              <div className="mt-2 text-sm leading-6 text-muted-foreground">
                Browse every workflow exposed by the Comanda server and load it directly into the studio.
              </div>
            </div>
            <Button onClick={onRefreshServer} size="sm" variant="outline">
              {serverLoading ? "Loading..." : "Refresh"}
            </Button>
          </div>

          <div className="mt-4 grid gap-3">
            <Input
              onChange={(event) => onServerBaseUrlChange(event.target.value)}
              placeholder="Leave blank for same origin or Vite proxy"
              value={serverBaseUrl}
            />

            <Input
              onChange={(event) => onServerTokenChange(event.target.value)}
              placeholder={authRequired ? "Bearer token required" : "Bearer token optional"}
              type="password"
              value={serverToken}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              <DatabaseZap className="mr-1.5 h-3.5 w-3.5" />
              {serverWorkflows.length} workflows
            </Badge>
            {authRequired ? <Badge variant="outline">auth enabled</Badge> : <Badge variant="outline">public access</Badge>}
          </div>

          {serverError ? <div className="warning-block mt-4 rounded-[1.4rem] p-3 text-xs text-slate-700">{serverError}</div> : null}

          <ScrollArea className="mt-4 max-h-44 pr-2">
            <div className="grid gap-2.5">
              {serverWorkflows.length > 0 ? (
                serverWorkflows.map((workflow) => (
                  <button
                    className="inner-plate rounded-[1.4rem] px-3 py-3 text-left transition duration-200 hover:-translate-y-0.5 hover:border-[rgba(29,105,116,0.24)] hover:bg-[rgba(255,252,247,0.9)]"
                    key={workflow.path}
                    onClick={() => onLoadServerWorkflow(workflow.path)}
                    type="button"
                  >
                    <div className="text-sm font-semibold text-foreground">{workflow.name}</div>
                    <div className="mt-1 font-mono text-[11px] text-muted-foreground">{workflow.path}</div>
                  </button>
                ))
              ) : (
                <div className="flow-note rounded-[1.4rem] p-3 text-xs text-muted-foreground">
                  No server workflows loaded yet.
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="flex items-center justify-between">
          <div className="section-kicker">YAML Workbench</div>
          <label>
            <input
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  onFileUpload(file);
                }
                event.currentTarget.value = "";
              }}
              type="file"
              accept=".yaml,.yml,.txt"
            />
            <Button size="sm" variant="outline">
              <Upload className="h-3.5 w-3.5" />
              Upload
            </Button>
          </label>
        </div>

        <Textarea
          className="editor-surface min-h-[360px] font-mono text-[12px] leading-6"
          onChange={(event) => onYamlChange(event.target.value)}
          spellCheck={false}
          value={yamlSource}
        />
      </CardContent>
    </Card>
  );
}
