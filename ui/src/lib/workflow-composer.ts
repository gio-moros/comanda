import { parseWorkflowSource } from "@/lib/workflow-parser";
import type { ServerWorkflowFile } from "@/lib/server-client";
import type { ParsedWorkflow } from "@/lib/workflow-types";

type WorkflowModuleSource = "root" | "sample" | "server";

interface WorkflowEntry {
  path: string;
  source: Exclude<WorkflowModuleSource, "root">;
}

interface ModuleVisit {
  yaml: string;
  path: string | null;
  source: WorkflowModuleSource;
  label: string;
  depth: number;
  parentModuleId: string | null;
  parentNodeId: string | null;
  viaWorkflowFile: string | null;
}

export interface WorkflowModule {
  id: string;
  label: string;
  path: string | null;
  source: WorkflowModuleSource;
  depth: number;
  parentModuleId: string | null;
  parentNodeId: string | null;
  viaWorkflowFile: string | null;
  workflow: ParsedWorkflow;
}

export interface WorkflowReference {
  id: string;
  parentModuleId: string;
  parentNodeId: string;
  rawPath: string;
  resolved: boolean;
  resolvedPath: string | null;
  resolvedSource: Exclude<WorkflowModuleSource, "root"> | null;
  targetModuleId: string | null;
}

export interface WorkflowComposition {
  rootModuleId: string;
  modules: WorkflowModule[];
  references: WorkflowReference[];
  warnings: string[];
}

interface ComposeWorkflowOptions {
  rootYaml: string;
  rootPath?: string | null;
  rootSource: WorkflowModuleSource;
  rootLabel: string;
  sampleLibrary: Record<string, string>;
  serverWorkflows: ServerWorkflowFile[];
  loadServerWorkflow: (workflowPath: string) => Promise<string>;
}

function normalizeWorkflowPath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+/g, "/").replace(/^\.\//, "");
}

function dirnameWorkflowPath(value: string): string {
  const normalized = normalizeWorkflowPath(value);
  const index = normalized.lastIndexOf("/");
  return index === -1 ? "" : normalized.slice(0, index);
}

function joinWorkflowPath(left: string, right: string): string {
  const base = normalizeWorkflowPath(left);
  const relative = normalizeWorkflowPath(right);
  if (!base) {
    return relative;
  }
  if (!relative) {
    return base;
  }
  return normalizeWorkflowPath(`${base}/${relative}`);
}

function workflowLabel(path: string | null, fallback: string): string {
  if (!path) {
    return fallback;
  }

  const normalized = normalizeWorkflowPath(path);
  const parts = normalized.split("/");
  const fileName = parts[parts.length - 1] ?? normalized;
  return fileName.replace(/\.(ya?ml)$/i, "");
}

function buildCandidatePaths(reference: string, currentPath: string | null): string[] {
  const normalized = normalizeWorkflowPath(reference);
  if (!normalized) {
    return [];
  }

  const candidates = new Set<string>([normalized]);
  const parts = normalized.split("/").filter(Boolean);
  const currentDir = currentPath ? dirnameWorkflowPath(currentPath) : "";

  if (currentDir) {
    candidates.add(joinWorkflowPath(currentDir, normalized));
  }

  for (let index = 1; index < parts.length; index += 1) {
    const suffix = parts.slice(index).join("/");
    candidates.add(suffix);
    if (currentDir) {
      candidates.add(joinWorkflowPath(currentDir, suffix));
    }
  }

  return Array.from(candidates).filter(Boolean);
}

function exactPreferredMatch(
  entries: WorkflowEntry[],
  path: string,
  preferredSources: WorkflowModuleSource[],
): WorkflowEntry | null {
  for (const preferredSource of preferredSources) {
    if (preferredSource === "root") {
      continue;
    }
    const match = entries.find((entry) => entry.source === preferredSource && entry.path === path);
    if (match) {
      return match;
    }
  }

  return null;
}

function exactAnyMatch(entries: WorkflowEntry[], path: string): WorkflowEntry | null {
  return entries.find((entry) => entry.path === path) ?? null;
}

function suffixPreferredMatch(
  entries: WorkflowEntry[],
  path: string,
  preferredSources: WorkflowModuleSource[],
): WorkflowEntry | null {
  const matches = entries.filter(
    (entry) => entry.path.endsWith(`/${path}`) || path.endsWith(`/${entry.path}`),
  );

  for (const preferredSource of preferredSources) {
    if (preferredSource === "root") {
      continue;
    }
    const preferredMatch = matches.find((entry) => entry.source === preferredSource);
    if (preferredMatch) {
      return preferredMatch;
    }
  }

  return null;
}

function suffixAnyMatch(entries: WorkflowEntry[], path: string): WorkflowEntry | null {
  const matches = entries.filter(
    (entry) => entry.path.endsWith(`/${path}`) || path.endsWith(`/${entry.path}`),
  );
  return matches[0] ?? null;
}

function resolveWorkflowEntry(
  reference: string,
  currentPath: string | null,
  rootPath: string | null,
  entries: WorkflowEntry[],
  preferredSources: WorkflowModuleSource[],
): { type: "root" } | { type: "entry"; entry: WorkflowEntry } | null {
  const candidates = buildCandidatePaths(reference, currentPath);
  const normalizedRootPath = rootPath ? normalizeWorkflowPath(rootPath) : null;

  if (normalizedRootPath && candidates.includes(normalizedRootPath)) {
    return { type: "root" };
  }

  for (const candidate of candidates) {
    const match = exactPreferredMatch(entries, candidate, preferredSources);
    if (match) {
      return { type: "entry", entry: match };
    }
  }

  for (const candidate of candidates) {
    const match = suffixPreferredMatch(entries, candidate, preferredSources);
    if (match) {
      return { type: "entry", entry: match };
    }
  }

  for (const candidate of candidates) {
    const match = exactAnyMatch(entries, candidate);
    if (match) {
      return { type: "entry", entry: match };
    }
  }

  for (const candidate of candidates) {
    const match = suffixAnyMatch(entries, candidate);
    if (match) {
      return { type: "entry", entry: match };
    }
  }

  return null;
}

export async function composeWorkflow({
  rootYaml,
  rootPath,
  rootSource,
  rootLabel,
  sampleLibrary,
  serverWorkflows,
  loadServerWorkflow,
}: ComposeWorkflowOptions): Promise<WorkflowComposition> {
  const modules: WorkflowModule[] = [];
  const references: WorkflowReference[] = [];
  const warnings: string[] = [];
  const moduleByKey = new Map<string, WorkflowModule>();
  const samplePaths = Object.keys(sampleLibrary).map(normalizeWorkflowPath);
  const serverEntries: WorkflowEntry[] = serverWorkflows.map((workflow) => ({
    path: normalizeWorkflowPath(workflow.path),
    source: "server",
  }));
  const sampleEntries: WorkflowEntry[] = samplePaths.map((path) => ({
    path,
    source: "sample",
  }));
  const allEntries = [...serverEntries, ...sampleEntries];
  const serverCache = new Map<string, string>();

  const loadEntryYaml = async (entry: WorkflowEntry) => {
    if (entry.source === "sample") {
      return sampleLibrary[entry.path];
    }

    if (!serverCache.has(entry.path)) {
      serverCache.set(entry.path, await loadServerWorkflow(entry.path));
    }

    return serverCache.get(entry.path) ?? "";
  };

  const preferredSources: WorkflowModuleSource[] =
    rootSource === "sample" ? ["sample", "server"] : ["server", "sample"];
  const normalizedRootPath = rootPath ? normalizeWorkflowPath(rootPath) : null;
  const rootModuleKey =
    normalizedRootPath == null ? "root:__draft__" : `root:${normalizeWorkflowPath(normalizedRootPath)}`;

  async function visitModule(visit: ModuleVisit): Promise<WorkflowModule> {
    const moduleKey =
      visit.source === "root" ? rootModuleKey : `${visit.source}:${normalizeWorkflowPath(visit.path ?? visit.label)}`;

    const existingModule = moduleByKey.get(moduleKey);
    if (existingModule) {
      return existingModule;
    }

    const workflow = parseWorkflowSource(visit.yaml);
    const module: WorkflowModule = {
      id: moduleKey,
      label: visit.label,
      path: visit.path ? normalizeWorkflowPath(visit.path) : null,
      source: visit.source,
      depth: visit.depth,
      parentModuleId: visit.parentModuleId,
      parentNodeId: visit.parentNodeId,
      viaWorkflowFile: visit.viaWorkflowFile,
      workflow,
    };

    moduleByKey.set(moduleKey, module);
    modules.push(module);
    warnings.push(...workflow.warnings.map((warning) => `${module.label}: ${warning}`));

    for (const node of workflow.nodes) {
      if (node.type !== "process") {
        continue;
      }

      const rawPath = node.metadata.workflowFile;
      if (!rawPath) {
        continue;
      }

      const resolved = resolveWorkflowEntry(rawPath, module.path, rootPath ?? null, allEntries, preferredSources);
      const referenceId = `${module.id}:${node.id}:${rawPath}`;

      if (!resolved) {
        references.push({
          id: referenceId,
          parentModuleId: module.id,
          parentNodeId: node.id,
          rawPath,
          resolved: false,
          resolvedPath: null,
          resolvedSource: null,
          targetModuleId: null,
        });
        warnings.push(`${module.label}: could not resolve sub-workflow "${rawPath}".`);
        continue;
      }

      if (resolved.type === "root") {
        references.push({
          id: referenceId,
          parentModuleId: module.id,
          parentNodeId: node.id,
          rawPath,
          resolved: true,
          resolvedPath: normalizedRootPath,
          resolvedSource: rootSource === "root" ? null : rootSource,
          targetModuleId: rootModuleKey,
        });
        continue;
      }

      const targetYaml = await loadEntryYaml(resolved.entry);
      const childModule = await visitModule({
        yaml: targetYaml,
        path: resolved.entry.path,
        source: resolved.entry.source,
        label: workflowLabel(resolved.entry.path, rawPath),
        depth: module.depth + 1,
        parentModuleId: module.id,
        parentNodeId: node.id,
        viaWorkflowFile: rawPath,
      });

      references.push({
        id: referenceId,
        parentModuleId: module.id,
        parentNodeId: node.id,
        rawPath,
        resolved: true,
        resolvedPath: resolved.entry.path,
        resolvedSource: resolved.entry.source,
        targetModuleId: childModule.id,
      });
    }

    return module;
  }

  const rootLabelValue = workflowLabel(normalizedRootPath, rootLabel);

  await visitModule({
    yaml: rootYaml,
    path: normalizedRootPath,
    source: "root",
    label: rootLabelValue,
    depth: 0,
    parentModuleId: null,
    parentNodeId: null,
    viaWorkflowFile: null,
  });

  return {
    rootModuleId: rootModuleKey,
    modules: modules.sort((left, right) => left.depth - right.depth || left.label.localeCompare(right.label)),
    references,
    warnings,
  };
}
