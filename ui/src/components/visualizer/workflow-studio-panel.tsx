import { Play, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

interface WorkflowStudioPanelProps {
  tab: string;
  onTabChange: (value: string) => void;
  authRequired: boolean;
  generatePrompt: string;
  onGeneratePromptChange: (value: string) => void;
  generateModel: string;
  onGenerateModelChange: (value: string) => void;
  generating: boolean;
  generateError: string | null;
  generateMessage: string | null;
  onGenerate: () => void;
  activeWorkflowLabel: string;
  savedWorkflowPath: string | null;
  runMode: "draft" | "saved";
  onRunModeChange: (value: "draft" | "saved") => void;
  runInput: string;
  onRunInputChange: (value: string) => void;
  running: boolean;
  runError: string | null;
  runMessage: string | null;
  runOutput: string;
  onRun: () => void;
}

export function WorkflowStudioPanel({
  tab,
  onTabChange,
  authRequired,
  generatePrompt,
  onGeneratePromptChange,
  generateModel,
  onGenerateModelChange,
  generating,
  generateError,
  generateMessage,
  onGenerate,
  activeWorkflowLabel,
  savedWorkflowPath,
  runMode,
  onRunModeChange,
  runInput,
  onRunInputChange,
  running,
  runError,
  runMessage,
  runOutput,
  onRun,
}: WorkflowStudioPanelProps) {
  return (
    <Card className="signal-panel-dark">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="section-kicker section-kicker-inverse">Studio Controls</div>
            <CardTitle className="mt-3 font-display text-[2rem] leading-none tracking-[-0.04em] text-[#f7eedf]">
              Generate and launch from one desk.
            </CardTitle>
            <CardDescription className="studio-copy mt-3 max-w-sm leading-6">
              Use the server generator for rough composition, then switch straight into execution without leaving the
              visualizer.
            </CardDescription>
          </div>
          <Badge className="studio-chip" variant="outline">
            {authRequired ? "secured" : "local"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs onValueChange={onTabChange} value={tab}>
          <TabsList className="studio-tablist grid w-full grid-cols-2 shadow-none">
            <TabsTrigger className="studio-tab" value="generate">
              Generate
            </TabsTrigger>
            <TabsTrigger className="studio-tab" value="run">
              Run
            </TabsTrigger>
          </TabsList>

          <TabsContent className="space-y-4 pt-1" value="generate">
            <div className="inner-plate-dark rounded-[1.8rem] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="studio-chip" variant="outline">
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  server-backed generation
                </Badge>
                {authRequired ? (
                  <Badge className="studio-chip" variant="outline">
                    token required
                  </Badge>
                ) : null}
              </div>

              <Input
                className="studio-field mt-4"
                onChange={(event) => onGenerateModelChange(event.target.value)}
                placeholder="Generation model, or leave blank for server default"
                value={generateModel}
              />

              <Textarea
                className="studio-field mt-4 min-h-[170px]"
                onChange={(event) => onGeneratePromptChange(event.target.value)}
                placeholder="Describe the workflow you want to generate."
                value={generatePrompt}
              />

              {generateError ? <div className="warning-block mt-4 rounded-[1.4rem] p-3 text-xs text-slate-700">{generateError}</div> : null}

              {generateMessage ? <div className="success-block mt-4 rounded-[1.4rem] p-3 text-xs text-slate-700">{generateMessage}</div> : null}

              <Button className="mt-4" disabled={generating || !generatePrompt.trim()} onClick={onGenerate}>
                {generating ? "Generating..." : "Generate workflow"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent className="space-y-4 pt-1" value="run">
            <div className="inner-plate-dark rounded-[1.8rem] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="studio-chip" variant="outline">
                  viewing {activeWorkflowLabel}
                </Badge>
                {savedWorkflowPath ? (
                  <Badge className="studio-chip" variant="outline">
                    saved workflow
                  </Badge>
                ) : (
                  <Badge className="studio-chip" variant="outline">
                    draft only
                  </Badge>
                )}
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <Button
                  className={
                    runMode === "saved"
                      ? ""
                      : "border-white/15 bg-white/12 text-[#f7eedf] hover:bg-white/18 hover:text-[#f7eedf]"
                  }
                  disabled={!savedWorkflowPath}
                  onClick={() => onRunModeChange("saved")}
                  variant={runMode === "saved" ? "default" : "outline"}
                >
                  Run saved workflow
                </Button>
                <Button
                  className={
                    runMode === "draft"
                      ? ""
                      : "border-white/15 bg-white/12 text-[#f7eedf] hover:bg-white/18 hover:text-[#f7eedf]"
                  }
                  onClick={() => onRunModeChange("draft")}
                  variant={runMode === "draft" ? "default" : "outline"}
                >
                  Run editor draft
                </Button>
              </div>

              <Textarea
                className="studio-field mt-4 min-h-[120px]"
                onChange={(event) => onRunInputChange(event.target.value)}
                placeholder="Optional STDIN to pass into the workflow."
                value={runInput}
              />

              {runError ? <div className="warning-block mt-4 rounded-[1.4rem] p-3 text-xs text-slate-700">{runError}</div> : null}

              {runMessage ? <div className="success-block mt-4 rounded-[1.4rem] p-3 text-xs text-slate-700">{runMessage}</div> : null}

              <Button className="mt-4" disabled={running || (runMode === "saved" && !savedWorkflowPath)} onClick={onRun}>
                <Play className="h-3.5 w-3.5" />
                {running ? "Running..." : "Start workflow"}
              </Button>
            </div>

            <div className="signal-screen rounded-[1.9rem] p-4">
              <div className="section-kicker section-kicker-inverse">Output Stream</div>
              <pre className="mt-3 max-h-[240px] overflow-auto rounded-[1.35rem] bg-[rgba(9,19,24,0.42)] p-4 text-xs leading-6 text-[#dfeeee]">
                {runOutput || "No workflow output yet."}
              </pre>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
