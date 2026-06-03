import { NextRequest, NextResponse } from "next/server";

type ResourceItem = {
  title: string;
  source: string;
  url: string;
};

type LearningPath = {
  skills: string[];
  steps: string[];
  resources: ResourceItem[];
};

type CurrentRoleNode = {
  id: string;
  label: string;
  type: "current";
  department: string;
};

type FutureRoleNode = {
  id: string;
  label: string;
  type: "future";
  description: string;
  fit: "High Fit" | "Medium Fit";
  learningPath?: LearningPath;
};

type RoleMapNode = CurrentRoleNode | FutureRoleNode;

type RoleMapEdge = {
  from: string;
  to: string;
};

type RoleMap = {
  nodes: RoleMapNode[];
  edges: RoleMapEdge[];
};

type OrgOSApiResponse = {
  answer: string;
  reportUrl?: string;
  roleMap?: RoleMap;
  source: "live" | "mock";
  needsFollowUp?: boolean;
  followUpQuestion?: string;
  companyId?: string;
  companyName?: string;
};

type OrgContext = {
  company?: string;
  team?: string;
  intent?: string;
};

const knownCompanyIds: Record<string, string> = {
  figma: "ORG-FIGMA-001",
  accenture: "ORG-ACCENTURE-001",
  mckinsey: "ORG-MCKINSEY-001",
  "goldman sachs": "ORG-GOLDMAN-001",
  deloitte: "ORG-DELOITTE-001",
  infosys: "ORG-INFOSYS-001",
};

const fallbackRoleMap: RoleMap = {
  nodes: [
    { id: "current-1", label: "Product Designer", type: "current", department: "Design" },
    { id: "current-2", label: "Growth Manager", type: "current", department: "Growth" },
    { id: "current-3", label: "Research Lead", type: "current", department: "Research" },
    {
      id: "future-1",
      label: "AI Experience Designer",
      type: "future",
      description: "Designs human-in-the-loop workflows and prompt-aware interfaces.",
      fit: "High Fit",
    },
    {
      id: "future-2",
      label: "Growth Systems Strategist",
      type: "future",
      description: "Orchestrates experimentation systems with AI-generated insights.",
      fit: "Medium Fit",
    },
    {
      id: "future-3",
      label: "AI Insight Translator",
      type: "future",
      description: "Converts qualitative signals into decision-ready operating guidance.",
      fit: "High Fit",
    },
  ],
  edges: [
    { from: "current-1", to: "future-1" },
    { from: "current-2", to: "future-2" },
    { from: "current-3", to: "future-3" },
  ],
};

const fallbackAnswer = (company: string, intent: string) => {
  const companyLabel = company.trim() || "this organization";
  const intentLabel = intent.trim() || "role redesign priorities";

  return [
    "Intent: Org redesign overview",
    "",
    `${companyLabel} is showing early signals that its operating model needs to shift for the AI era. Here is a sample OrgOS response focused on ${intentLabel}.`,
    "",
    "CURRENT ROLES:",
    "1. Product Designer (Design)",
    "2. Growth Manager (Growth)",
    "3. Research Lead (Research)",
    "",
    "KEY SHIFTS:",
    "- Routine production work is compressing into smaller AI-assisted loops.",
    "- Decision quality is becoming more important than raw output volume.",
    "- Leaders need clearer ownership lines between humans, copilots, and agents.",
    "",
    "ROLE TRANSITIONS:",
    "Product Designer (Design) -> AI Experience Designer | High Fit | Designs human-in-the-loop workflows and prompt-aware interfaces.",
    "Growth Manager (Growth) -> Growth Systems Strategist | Medium Fit | Orchestrates experimentation systems with AI-generated insights.",
    "Research Lead (Research) -> AI Insight Translator | High Fit | Converts qualitative signals into decision-ready operating guidance.",
  ].join("\n");
};

const safeParseJson = (value: string): unknown | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
};

const asString = (value: unknown) => (typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined);

const normalizeLookup = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const inferCompanyId = (company: string) => knownCompanyIds[normalizeLookup(company)];

const normalizeRoleMapNode = (value: unknown): RoleMapNode | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const type = asString(record.type)?.toLowerCase();
  const id = asString(record.id);
  const label = asString(record.label) || asString(record.title) || asString(record.name);

  if (!type || !id || !label || (type !== "current" && type !== "future")) {
    return null;
  }

  if (type === "current") {
    return {
      id,
      label,
      type,
      department: asString(record.department) || asString(record.team) || "Default",
    };
  }

  return {
    id,
    label,
    type,
    description: asString(record.description) || asString(record.summary) || "Future role",
    fit: /high/i.test(asString(record.fit) || "") ? "High Fit" : "Medium Fit",
  };
};

const normalizeRoleMapEdge = (value: unknown): RoleMapEdge | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const from = asString(record.from) || asString(record.source);
  const to = asString(record.to) || asString(record.target);
  if (!from || !to) {
    return null;
  }

  return { from, to };
};

const normalizeRoleMap = (value: unknown): RoleMap | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const nodes = (Array.isArray(record.nodes) ? record.nodes : []).map(normalizeRoleMapNode).filter((item): item is RoleMapNode => item !== null);
  const edges = (Array.isArray(record.edges) ? record.edges : []).map(normalizeRoleMapEdge).filter((item): item is RoleMapEdge => item !== null);

  if (nodes.length === 0 || edges.length === 0) {
    return undefined;
  }

  return { nodes, edges };
};

const normalizeWebhookPayload = (payload: unknown) => {
  if (typeof payload === "string") {
    return { answer: payload };
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { answer: "Webhook response was empty." };
  }

  const record = payload as Record<string, unknown>;
  return {
    answer:
      asString(record.answer) ||
      asString(record.text) ||
      asString(record.message) ||
      asString(record.output) ||
      asString(record.response) ||
      "Webhook returned JSON without answer text.",
    reportUrl: asString(record.report_url) || asString(record.reportUrl) || asString(record.url),
    roleMap:
      normalizeRoleMap(record.role_map) ||
      normalizeRoleMap(record.roleMap) ||
      normalizeRoleMap({ nodes: record.nodes, edges: record.edges }),
    needsFollowUp: Boolean(record.needs_follow_up) || Boolean(record.needsFollowUp),
    followUpQuestion: asString(record.follow_up_question) || asString(record.followUpQuestion),
    companyId: asString(record.company_id) || asString(record.companyId) || asString(record.organization_id),
    companyName: asString(record.company) || asString(record.company_name) || asString(record.organization),
  };
};

export async function POST(req: NextRequest) {
  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const contextValue = payload.context && typeof payload.context === "object" && !Array.isArray(payload.context) ? (payload.context as OrgContext) : {};
  const message = asString(payload.message) || asString(payload.query) || asString(payload.question) || "";
  const company = asString(contextValue.company) || asString(payload.company) || "";
  const team = asString(contextValue.team) || asString(payload.team) || "";
  const intent = asString(contextValue.intent) || asString(payload.intent) || "";
  const companyId = asString(payload.company_id) || inferCompanyId(company) || undefined;

  if (!message) {
    return NextResponse.json({ error: "Message cannot be blank." }, { status: 400 });
  }

  if (!company) {
    return NextResponse.json({
      answer: "",
      source: "mock",
      needsFollowUp: true,
      followUpQuestion: "Which company should I analyze?",
    } satisfies OrgOSApiResponse);
  }

  const webhookUrl = (process.env.WEBHOOK_URL || process.env.MAKE_WEBHOOK_URL || "").trim();
  if (!webhookUrl) {
    return NextResponse.json({
      answer: fallbackAnswer(company, intent),
      roleMap: fallbackRoleMap,
      source: "mock",
      companyId,
      companyName: company,
    } satisfies OrgOSApiResponse);
  }

  try {
    const webhookResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        query: message,
        company,
        ...(companyId ? { company_id: companyId } : {}),
        ...(team ? { team } : {}),
        ...(intent ? { intent } : {}),
        mode: "org",
        context: {
          company,
          ...(team ? { team } : {}),
          ...(intent ? { intent } : {}),
        },
      }),
      signal: AbortSignal.timeout(30000),
    });

    const responseText = await webhookResponse.text();
    const parsed = safeParseJson(responseText);
    const normalized: ReturnType<typeof normalizeWebhookPayload> =
      parsed === null ? { answer: responseText.trim() || "Webhook response was empty." } : normalizeWebhookPayload(parsed);

    if (companyId && normalized.companyId && normalized.companyId !== companyId) {
      return NextResponse.json({ error: "Data mismatch - please retry" }, { status: 409 });
    }

    return NextResponse.json(
      {
        answer: normalized.answer || fallbackAnswer(company, intent),
        ...(normalized.reportUrl ? { reportUrl: normalized.reportUrl } : {}),
        ...(normalized.roleMap ? { roleMap: normalized.roleMap } : {}),
        ...(normalized.needsFollowUp ? { needsFollowUp: true } : {}),
        ...(normalized.followUpQuestion ? { followUpQuestion: normalized.followUpQuestion } : {}),
        ...(normalized.companyId || companyId ? { companyId: normalized.companyId || companyId } : {}),
        ...(normalized.companyName || company ? { companyName: normalized.companyName || company } : {}),
        source: webhookResponse.ok ? "live" : "mock",
      } satisfies OrgOSApiResponse,
      { status: webhookResponse.ok ? 200 : 502 },
    );
  } catch {
    return NextResponse.json(
      {
        error: `Unable to retrieve role intelligence for ${company}.`,
      },
      { status: 502 },
    );
  }
}
