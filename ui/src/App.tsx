import { useEffect, useRef, useState } from "react";
import { Bot, Network, PanelRightOpen, WandSparkles } from "lucide-react";
import { WorkflowCanvas } from "@/components/visualizer/workflow-canvas";
import { WorkflowInspector } from "@/components/visualizer/workflow-inspector";
import { WorkflowMetrics } from "@/components/visualizer/workflow-metrics";
import { WorkflowSourcePanel } from "@/components/visualizer/workflow-source-panel";
import { WorkflowStudioPanel } from "@/components/visualizer/workflow-studio-panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { composeWorkflow, type WorkflowModule } from "@/lib/workflow-composer";
import { workflowSampleLibrary, workflowSamples } from "@/lib/samples";
import {
  fetchUIConfig,
  fetchWorkflowContent,
  generateWorkflow,
  getDefaultServerBaseUrl,
  listWorkflows,
  runDraftWorkflow,
  runSavedWorkflow,
  type ServerUIConfig,
  type ServerWorkflowFile,
} from "@/lib/server-client";
import { parseWorkflowSource } from "@/lib/workflow-parser";
import type { ParsedWorkflow } from "@/lib/workflow-types";

type WorkflowContextSource = "sample" | "server" | "draft";

function readUploadedFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

function normalizeWorkflowPath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+/g, "/");
}

function findServerWorkflowPath(candidatePath: string | null, serverWorkflows: ServerWorkflowFile[]): string | null {
  if (!candidatePath) {
    return null;
  }

  const normalizedCandidate = normalizeWorkflowPath(candidatePath);
  const match = serverWorkflows.find((workflow) => {
    const normalizedWorkflowPath = normalizeWorkflowPath(workflow.path);
    return (
      normalizedWorkflowPath === normalizedCandidate ||
      normalizedWorkflowPath.endsWith(`/${normalizedCandidate}`) ||
      normalizedCandidate.endsWith(`/${normalizedWorkflowPath}`)
    );
  });

  return match?.path ?? null;
}

function fallbackWorkflow(workflow: ParsedWorkflow | null, label: string, path: string | null): WorkflowModule | null {
  if (!workflow) {
    return null;
  }

  return {
    id: "root:fallback",
    label,
    path,
    source: "root",
    depth: 0,
    parentModuleId: null,
    parentNodeId: null,
    viaWorkflowFile: null,
    workflow,
  };
}

export default function App() {
  const initialSample = workflowSamples[0];
  const [selectedSampleId, setSelectedSampleId] = useState(initialSample.id);
  const [yamlSource, setYamlSource] = useState(initialSample.yaml);
  const [workflowContextPath, setWorkflowContextPath] = useState<string | null>(initialSample.path ?? null);
  const [workflowContextSource, setWorkflowContextSource] = useState<WorkflowContextSource>("sample");
  const [inspectorTab, setInspectorTab] = useState("node");
  const [studioTab, setStudioTab] = useState("run");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeModuleId, setActiveModuleId] = useState<string>("");
  const [serverBaseUrl, setServerBaseUrl] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }

    return window.localStorage.getItem("comanda.ui.serverBaseUrl") ?? getDefaultServerBaseUrl();
  });
  const [serverToken, setServerToken] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }

    return window.localStorage.getItem("comanda.ui.serverToken") ?? "";
  });
  const [serverConfig, setServerConfig] = useState<ServerUIConfig | null>(null);
  const [serverAuthRequired, setServerAuthRequired] = useState(false);
  const [serverWorkflows, setServerWorkflows] = useState<ServerWorkflowFile[]>([]);
  const [serverLoading, setServerLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [composition, setComposition] = useState<Awaited<ReturnType<typeof composeWorkflow>> | null>(null);
  const [compositionLoading, setCompositionLoading] = useState(false);
  const [compositionError, setCompositionError] = useState<string | null>(null);
  const [generatePrompt, setGeneratePrompt] = useState(
    "Create a workflow that gathers product requirements, runs parallel engineering and design reviews, then synthesizes a ship plan.",
  );
  const [generateModel, setGenerateModel] = useState("");
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateMessage, setGenerateMessage] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [runMode, setRunMode] = useState<"draft" | "saved">("draft");
  const [runInput, setRunInput] = useState("");
  const [runOutput, setRunOutput] = useState("");
  const [runError, setRunError] = useState<string | null>(null);
  const [runMessage, setRunMessage] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const serverWorkflowCache = useRef<Map<string, string>>(new Map());

  let workflow: ParsedWorkflow | null = null;
  let parseError: string | null = null;

  try {
    workflow = parseWorkflowSource(yamlSource);
  } catch (error) {
    parseError = error instanceof Error ? error.message : "Failed to parse workflow.";
  }

  const selectedSample = workflowSamples.find((sample) => sample.id === selectedSampleId) ?? null;
  const rootLabel = workflowContextPath ?? selectedSample?.name ?? "Current draft";
  const fallbackModuleValue = fallbackWorkflow(workflow, rootLabel, workflowContextPath);
  const modules = composition?.modules ?? (fallbackModuleValue ? [fallbackModuleValue] : []);
  const activeModule =
    modules.find((module) => module.id === activeModuleId) ??
    modules.find((module) => module.id === composition?.rootModuleId) ??
    fallbackModuleValue;
  const activeWorkflow = activeModule?.workflow ?? workflow;
  const activeWorkflowLabel = activeModule?.label ?? "Current draft";
  const activeWorkflowPath = activeModule?.source === "root" ? workflowContextPath : activeModule?.path ?? null;
  const activeReferences = composition?.references.filter((reference) => reference.parentModuleId === activeModule?.id) ?? [];
  const selectedNode = activeWorkflow?.nodes.find((node) => node.id === selectedNodeId) ?? activeWorkflow?.nodes[0] ?? null;
  const savedWorkflowPath = findServerWorkflowPath(activeWorkflowPath, serverWorkflows);
  const totalModuleCount = composition?.modules.length ?? modules.length;
  const linkedWorkflowCount = composition?.references.filter((reference) => reference.resolved).length ?? 0;
  const metrics = activeWorkflow?.stats ?? {
    totalNodes: 0,
    totalStages: 0,
    parallelStages: 0,
    loopStages: 0,
    uniqueModels: [],
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem("comanda.ui.serverBaseUrl", serverBaseUrl);
  }, [serverBaseUrl]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem("comanda.ui.serverToken", serverToken);
  }, [serverToken]);

  useEffect(() => {
    if (runMode === "saved" && !savedWorkflowPath) {
      setRunMode("draft");
    }
  }, [runMode, savedWorkflowPath]);

  useEffect(() => {
    if (!workflow) {
      setComposition(null);
      setCompositionError(null);
      return;
    }

    let cancelled = false;
    setCompositionLoading(true);
    setCompositionError(null);

    const rootSource = workflowContextSource === "draft" ? "root" : workflowContextSource;

    void composeWorkflow({
      rootYaml: yamlSource,
      rootPath: workflowContextPath,
      rootSource,
      rootLabel,
      sampleLibrary: workflowSampleLibrary,
      serverWorkflows,
      loadServerWorkflow: async (workflowPath) => {
        const normalizedPath = normalizeWorkflowPath(workflowPath);
        const cached = serverWorkflowCache.current.get(normalizedPath);
        if (cached) {
          return cached;
        }

        const content = await fetchWorkflowContent(serverBaseUrl, serverToken, normalizedPath, serverConfig);
        serverWorkflowCache.current.set(normalizedPath, content);
        return content;
      },
    })
      .then((nextComposition) => {
        if (cancelled) {
          return;
        }

        setComposition(nextComposition);
        setActiveModuleId((currentId) =>
          nextComposition.modules.some((module) => module.id === currentId) ? currentId : nextComposition.rootModuleId,
        );
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setComposition(null);
        setCompositionError(error instanceof Error ? error.message : "Failed to compose linked workflows.");
      })
      .finally(() => {
        if (!cancelled) {
          setCompositionLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [serverBaseUrl, serverConfig, serverToken, serverWorkflows, workflow, workflowContextPath, workflowContextSource, yamlSource, rootLabel]);

  async function refreshServerWorkflows() {
    setServerLoading(true);
    try {
      serverWorkflowCache.current.clear();
      const uiConfig = await fetchUIConfig(serverBaseUrl);
      setServerConfig(uiConfig);
      setServerAuthRequired(uiConfig.authEnabled);
      const workflows = await listWorkflows(serverBaseUrl, serverToken, uiConfig);
      setServerWorkflows(workflows);
      setServerError(null);
    } catch (error) {
      setServerWorkflows([]);
      setServerError(error instanceof Error ? error.message : "Failed to load server workflows.");
    } finally {
      setServerLoading(false);
    }
  }

  async function handleLoadServerWorkflow(workflowPath: string) {
    try {
      const content = await fetchWorkflowContent(serverBaseUrl, serverToken, workflowPath, serverConfig);
      serverWorkflowCache.current.set(normalizeWorkflowPath(workflowPath), content);
      setSelectedSampleId("");
      setYamlSource(content);
      setWorkflowContextPath(workflowPath);
      setWorkflowContextSource("server");
      setSelectedNodeId(null);
      setActiveModuleId("");
      setServerError(null);
      setRunMessage(null);
      setRunError(null);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : `Failed to load workflow ${workflowPath}.`);
    }
  }

  useEffect(() => {
    void refreshServerWorkflows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFileUpload(file: File) {
    const content = await readUploadedFile(file);
    setSelectedSampleId("");
    setYamlSource(content);
    setWorkflowContextPath(null);
    setWorkflowContextSource("draft");
    setSelectedNodeId(null);
    setActiveModuleId("");
  }

  function handleSampleSelect(sampleId: string) {
    const sample = workflowSamples.find((item) => item.id === sampleId);
    if (!sample) {
      return;
    }

    setSelectedSampleId(sample.id);
    setYamlSource(sample.yaml);
    setWorkflowContextPath(sample.path ?? null);
    setWorkflowContextSource("sample");
    setSelectedNodeId(null);
    setActiveModuleId("");
    setRunMessage(null);
    setRunError(null);
  }

  async function handleGenerateWorkflow() {
    setGenerating(true);
    try {
      const response = await generateWorkflow(serverBaseUrl, serverToken, generatePrompt, generateModel, serverConfig);
      setSelectedSampleId("");
      setYamlSource(response.yaml ?? "");
      setWorkflowContextPath(null);
      setWorkflowContextSource("draft");
      setSelectedNodeId(null);
      setActiveModuleId("");
      setRunMode("draft");
      setStudioTab("run");
      setGenerateError(null);
      setGenerateMessage(
        `Generated a workflow${response.model ? ` with ${response.model}` : ""} and loaded it into the editor.`,
      );
    } catch (error) {
      setGenerateError(error instanceof Error ? error.message : "Failed to generate workflow.");
      setGenerateMessage(null);
    } finally {
      setGenerating(false);
    }
  }

  async function handleRunWorkflow() {
    setRunning(true);
    try {
      const response =
        runMode === "saved" && savedWorkflowPath
          ? await runSavedWorkflow(serverBaseUrl, serverToken, savedWorkflowPath, runInput, serverConfig)
          : await runDraftWorkflow(serverBaseUrl, serverToken, yamlSource, runInput, serverConfig);

      setRunOutput(response.output ?? "");
      setRunMessage(
        response.message ??
          (runMode === "saved" && savedWorkflowPath
            ? `Started saved workflow ${savedWorkflowPath}.`
            : "Started the editor draft."),
      );
      setRunError(null);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Failed to start workflow.");
      setRunMessage(null);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden text-foreground">
      <div className="pointer-events-none absolute left-[-8rem] top-[-7rem] h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle,_rgba(221,136,82,0.42),_transparent_62%)] blur-3xl" />
      <div className="pointer-events-none absolute right-[-10rem] top-[10rem] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,_rgba(37,128,139,0.34),_transparent_66%)] blur-3xl" />

      <div className="relative mx-auto max-w-[1760px] px-4 py-6 md:px-8 xl:px-10">
        <section className="mb-8 grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_420px]">
          <Card className="hero-card">
            <CardHeader className="pb-5">
              <div className="section-kicker section-kicker-inverse">c-stack / orchestration atlas</div>
              <div className="mt-4 flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.6rem] bg-[linear-gradient(135deg,rgba(229,130,82,0.94),rgba(203,92,47,0.92))] text-white shadow-[0_18px_40px_rgba(26,11,4,0.24)]">
                  <Network className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="hero-display">See the whole system before the first tool call.</CardTitle>
                  <CardDescription className="hero-copy mt-5">
                    Linked workflows, generated drafts, and run controls now live on one editorial control surface,
                    built for reading agent orchestration like a route chart instead of a generic dashboard.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex flex-col gap-6 pt-0">
              <div className="flex flex-wrap gap-2">
                <Badge className="studio-chip" variant="outline">
                  <Bot className="mr-1.5 h-3.5 w-3.5" />
                  multi-agent aware
                </Badge>
                <Badge className="studio-chip" variant="outline">
                  <PanelRightOpen className="mr-1.5 h-3.5 w-3.5" />
                  linked sub-workflows
                </Badge>
                <Badge className="studio-chip" variant="outline">
                  <WandSparkles className="mr-1.5 h-3.5 w-3.5" />
                  generate and run in studio
                </Badge>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="hero-docket rounded-[1.6rem] p-4">
                  <div className="section-kicker section-kicker-inverse">Active workflow</div>
                  <div className="mt-3 font-display text-[2rem] leading-none tracking-[-0.04em]">{activeWorkflowLabel}</div>
                </div>
                <div className="hero-docket rounded-[1.6rem] p-4">
                  <div className="section-kicker section-kicker-inverse">Resolved links</div>
                  <div className="mt-3 font-display text-[2rem] leading-none tracking-[-0.04em]">{linkedWorkflowCount}</div>
                </div>
                <div className="hero-docket rounded-[1.6rem] p-4">
                  <div className="section-kicker section-kicker-inverse">Visible modules</div>
                  <div className="mt-3 font-display text-[2rem] leading-none tracking-[-0.04em]">{totalModuleCount}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <WorkflowMetrics stats={metrics} />
        </section>

        <section className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)_380px]">
          <div className="min-h-[780px] space-y-5">
            <WorkflowSourcePanel
              authRequired={serverAuthRequired}
              onFileUpload={(file) => {
                void handleFileUpload(file);
              }}
              onLoadServerWorkflow={(workflowPath) => {
                void handleLoadServerWorkflow(workflowPath);
              }}
              onRefreshServer={() => {
                void refreshServerWorkflows();
              }}
              onSampleSelect={handleSampleSelect}
              onServerBaseUrlChange={setServerBaseUrl}
              onServerTokenChange={setServerToken}
              onYamlChange={(value) => {
                setYamlSource(value);
                setSelectedSampleId("");
                setSelectedNodeId(null);
                setActiveModuleId("");
              }}
              samples={workflowSamples}
              selectedSampleId={selectedSampleId}
              serverBaseUrl={serverBaseUrl}
              serverError={serverError}
              serverLoading={serverLoading}
              serverToken={serverToken}
              serverWorkflows={serverWorkflows}
              yamlSource={yamlSource}
            />

            <WorkflowStudioPanel
              activeWorkflowLabel={activeWorkflowLabel}
              authRequired={serverAuthRequired}
              generateError={generateError}
              generateMessage={generateMessage}
              generateModel={generateModel}
              generatePrompt={generatePrompt}
              generating={generating}
              onGenerate={() => {
                void handleGenerateWorkflow();
              }}
              onGenerateModelChange={setGenerateModel}
              onGeneratePromptChange={setGeneratePrompt}
              onRun={() => {
                void handleRunWorkflow();
              }}
              onRunInputChange={setRunInput}
              onRunModeChange={setRunMode}
              onTabChange={setStudioTab}
              runError={runError}
              runInput={runInput}
              runMessage={runMessage}
              runMode={runMode}
              runOutput={runOutput}
              running={running}
              savedWorkflowPath={savedWorkflowPath}
              tab={studioTab}
            />
          </div>

          <div className="min-h-[780px]">
            {activeWorkflow ? (
              <WorkflowCanvas
                activeModuleId={activeModule?.id ?? ""}
                activeModuleLabel={activeWorkflowLabel}
                modules={modules}
                onSelectModule={(moduleId) => {
                  setActiveModuleId(moduleId);
                  setSelectedNodeId(null);
                  setInspectorTab("graph");
                }}
                onSelectNode={(nodeId) => {
                  setSelectedNodeId(nodeId);
                  setInspectorTab("node");
                }}
                references={activeReferences}
                selectedNodeId={selectedNode?.id ?? null}
                workflow={activeWorkflow}
              />
            ) : (
              <Card className="signal-panel h-full">
                <CardHeader>
                  <div className="section-kicker">Parsing error</div>
                  <CardTitle className="mt-3 font-display text-[2rem] leading-none tracking-[-0.04em]">
                    The current YAML broke the map.
                  </CardTitle>
                  <CardDescription className="mt-2 leading-6">
                    The visualizer could not understand the current workflow definition.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="signal-screen rounded-[1.8rem] p-4 text-sm text-red-100">{parseError}</pre>
                </CardContent>
              </Card>
            )}

            {compositionLoading ? (
              <div className="flow-note mt-4 rounded-[1.6rem] p-4 text-sm text-muted-foreground">
                Resolving linked sub-workflows...
              </div>
            ) : null}

            {compositionError ? (
              <div className="warning-block mt-4 rounded-[1.6rem] p-4 text-sm text-slate-700">
                {compositionError}
              </div>
            ) : null}
          </div>

          <div className="min-h-[780px]">
            <WorkflowInspector
              extraWarnings={composition?.warnings ?? []}
              node={selectedNode}
              onTabChange={setInspectorTab}
              references={activeReferences}
              tab={inspectorTab}
              workflow={
                activeWorkflow ?? {
                  title: "Empty workflow",
                  entryInputs: [],
                  finalOutputs: [],
                  stages: [],
                  nodes: [],
                  warnings: [],
                  stats: {
                    totalNodes: 0,
                    totalStages: 0,
                    parallelStages: 0,
                    loopStages: 0,
                    uniqueModels: [],
                  },
                }
              }
              workflowLabel={activeWorkflowLabel}
              workflowPath={activeWorkflowPath}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
