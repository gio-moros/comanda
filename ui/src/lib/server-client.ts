export interface ServerWorkflowFile {
  name: string;
  path: string;
  size: number;
  isDir: boolean;
  createdAt: string;
  modifiedAt: string;
  methods?: string;
}

export interface ServerUIConfig {
  success: boolean;
  authEnabled: boolean;
  workflowsEndpoint: string;
  contentEndpoint: string;
  generateEndpoint: string;
  processEndpoint: string;
  yamlProcessEndpoint: string;
  error?: string;
}

export interface WorkflowGenerateResponse {
  success: boolean;
  yaml?: string;
  error?: string;
  model?: string;
}

export interface WorkflowRunResponse {
  success: boolean;
  message?: string;
  error?: string;
  output?: string;
}

interface WorkflowListResponse {
  success: boolean;
  workflows: ServerWorkflowFile[];
  error?: string;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

function buildURL(baseUrl: string, pathname: string): string {
  const normalizedBase = normalizeBaseUrl(baseUrl);
  if (!normalizedBase) {
    return pathname;
  }

  return `${normalizedBase}${pathname}`;
}

async function readErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const data = (await response.json()) as { error?: string; message?: string };
    return data.error ?? data.message ?? `Request failed with status ${response.status}`;
  }

  const text = await response.text();
  return text || `Request failed with status ${response.status}`;
}

function buildHeaders(token: string): HeadersInit {
  return token.trim()
    ? {
        Authorization: `Bearer ${token.trim()}`,
      }
    : {};
}

async function parseJSONResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as T;
}

export async function fetchUIConfig(baseUrl: string): Promise<ServerUIConfig> {
  return parseJSONResponse<ServerUIConfig>(await fetch(buildURL(baseUrl, "/ui/config")));
}

export async function listWorkflows(
  baseUrl: string,
  token: string,
  uiConfig?: ServerUIConfig | null,
): Promise<ServerWorkflowFile[]> {
  const response = await fetch(buildURL(baseUrl, uiConfig?.workflowsEndpoint ?? "/workflows"), {
    headers: buildHeaders(token),
  });

  const data = await parseJSONResponse<WorkflowListResponse>(response);
  if (!data.success) {
    throw new Error(data.error ?? "Failed to list workflows");
  }

  return data.workflows.sort((left, right) => left.path.localeCompare(right.path));
}

export async function fetchWorkflowContent(
  baseUrl: string,
  token: string,
  workflowPath: string,
  uiConfig?: ServerUIConfig | null,
): Promise<string> {
  const response = await fetch(
    buildURL(baseUrl, `${uiConfig?.contentEndpoint ?? "/files/content"}?path=${encodeURIComponent(workflowPath)}`),
    {
      headers: buildHeaders(token),
    },
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return response.text();
}

export async function generateWorkflow(
  baseUrl: string,
  token: string,
  prompt: string,
  model: string,
  uiConfig?: ServerUIConfig | null,
): Promise<WorkflowGenerateResponse> {
  const response = await fetch(buildURL(baseUrl, uiConfig?.generateEndpoint ?? "/generate"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildHeaders(token),
    },
    body: JSON.stringify({
      prompt,
      model: model.trim() || undefined,
    }),
  });

  const data = await parseJSONResponse<WorkflowGenerateResponse>(response);
  if (!data.success) {
    throw new Error(data.error ?? "Workflow generation failed");
  }

  return data;
}

export async function runSavedWorkflow(
  baseUrl: string,
  token: string,
  workflowPath: string,
  input: string,
  uiConfig?: ServerUIConfig | null,
): Promise<WorkflowRunResponse> {
  const response = await fetch(
    buildURL(baseUrl, `${uiConfig?.processEndpoint ?? "/process"}?filename=${encodeURIComponent(workflowPath)}`),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildHeaders(token),
      },
      body: JSON.stringify({
        input,
        streaming: false,
      }),
    },
  );

  const data = await parseJSONResponse<WorkflowRunResponse>(response);
  if (!data.success) {
    throw new Error(data.error ?? "Workflow run failed");
  }

  return data;
}

export async function runDraftWorkflow(
  baseUrl: string,
  token: string,
  content: string,
  input: string,
  uiConfig?: ServerUIConfig | null,
): Promise<WorkflowRunResponse> {
  const response = await fetch(buildURL(baseUrl, uiConfig?.yamlProcessEndpoint ?? "/yaml/process"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildHeaders(token),
    },
    body: JSON.stringify({
      content,
      input,
      streaming: false,
    }),
  });

  const data = await parseJSONResponse<WorkflowRunResponse>(response);
  if (!data.success) {
    throw new Error(data.error ?? "Workflow run failed");
  }

  return data;
}

export function getDefaultServerBaseUrl(): string {
  return "";
}
