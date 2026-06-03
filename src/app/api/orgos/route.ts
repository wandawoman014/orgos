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

type CurrentRole = {
  title: string;
  department: string;
};

type FutureRole = {
  title: string;
  description: string;
  fit: "High Fit" | "Medium Fit";
  learningPath?: LearningPath;
};

type RoleConnection = {
  current: CurrentRole;
  future: FutureRole;
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

type CompanyContext = {
  companyId: string;
  companyName: string;
};

type OrgOSApiResponse = {
  answer: string;
  companyId: string;
  companyName: string;
  reportUrl?: string;
  roleMap?: RoleMap;
  source: "live" | "mock";
};

const companyDirectory: Array<CompanyContext & { aliases: string[] }> = [
  { companyName: "Figma", companyId: "ORG-FIGMA-001", aliases: ["figma"] },
  { companyName: "Accenture", companyId: "ORG-ACCENTURE-001", aliases: ["accenture"] },
  { companyName: "McKinsey", companyId: "ORG-MCKINSEY-001", aliases: ["mckinsey"] },
  { companyName: "Goldman Sachs", companyId: "ORG-GOLDMAN-001", aliases: ["goldman sachs", "goldman"] },
  { companyName: "Deloitte", companyId: "ORG-DELOITTE-001", aliases: ["deloitte"] },
  { companyName: "Infosys", companyId: "ORG-INFOSYS-001", aliases: ["infosys"] },
];

const fallbackConnections: RoleConnection[] = [
  {
    current: { title: "Product Designer", department: "Design" },
    future: {
      title: "AI Experience Designer",
      description: "Designs human-in-the-loop workflows and prompt-aware interfaces.",
      fit: "High Fit",
      learningPath: {
        skills: ["Prompt design", "Workflow prototyping", "Evaluation rubrics"],
        steps: [
          "Map one repeatable workflow that already depends on design review.",
          "Prototype a human-in-the-loop AI flow with clear override points.",
          "Create a scorecard for trust, speed, and output quality.",
        ],
        resources: [
          {
            title: "Human-Centered AI Design Patterns",
            source: "EvolutionOS Library",
            url: "https://careeros-supriya.vercel.app/",
          },
          {
            title: "Prompting for Product Teams",
            source: "EvolutionOS Library",
            url: "https://careeros-supriya.vercel.app/",
          },
        ],
      },
    },
  },
  {
    current: { title: "Growth Manager", department: "Growth" },
    future: {
      title: "Growth Systems Strategist",
      description: "Orchestrates experimentation systems with AI-generated insights.",
      fit: "Medium Fit",
      learningPath: {
        skills: ["Experiment design", "Signal triage", "Automation governance"],
        steps: [
          "Document the decisions that still require human judgment in the funnel.",
          "Introduce an AI-generated insight digest with one weekly review ritual.",
          "Define thresholds for when automation can launch, pause, or escalate.",
        ],
        resources: [
          {
            title: "AI Experimentation Playbook",
            source: "EvolutionOS Library",
            url: "https://careeros-supriya.vercel.app/",
          },
        ],
      },
    },
  },
  {
    current: { title: "Research Lead", department: "Research" },
    future: {
      title: "AI Insight Translator",
      description: "Converts qualitative signals into decision-ready operating guidance.",
      fit: "High Fit",
      learningPath: {
        skills: ["Synthesis systems", "Insight framing", "Decision storytelling"],
        steps: [
          "Standardize how research signals are tagged for operational impact.",
          "Build one reusable synthesis template for leadership reviews.",
          "Pair AI-assisted clustering with analyst-led recommendation writing.",
        ],
        resources: [
          {
            title: "Decision Storytelling for AI Teams",
            source: "EvolutionOS Library",
            url: "https://careeros-supriya.vercel.app/",
          },
        ],
      },
    },
  },
];

const fallbackAnswer = (company: string, query: string) => {
  const companyLabel = company.trim() || "your organization";
  const queryLabel = query.trim() || "role redesign priorities";

  return [
    "Intent: Org redesign overview",
    "",
    `${companyLabel} is showing early signals that its operating model needs to shift for the AI era. This sample OrgOS response uses your prompt, \"${queryLabel}\", to outline where roles are changing first and how leadership can respond.`,
    "",
    "CURRENT ROLES:",
    "1. Product Designer (Design)",
    "2. Growth Manager (Growth)",
    "3. Research Lead (Research)",
    "",
    "KEY SHIFTS:",
    "- Routine production work is compressing into smaller AI-assisted loops.",
    "- Decision quality is becoming more important than raw output volume.",
    "- Managers need clearer ownership lines between humans, copilots, and agents.",
    "",
    "ROLE TRANSITIONS:",
    "Product Designer (Design) -> AI Experience Designer | High Fit | Designs human-in-the-loop workflows and prompt-aware interfaces.",
    "Growth Manager (Growth) -> Growth Systems Strategist | Medium Fit | Orchestrates experimentation systems with AI-generated insights.",
    "Research Lead (Research) -> AI Insight Translator | High Fit | Converts qualitative signals into decision-ready operating guidance.",
    "",
    "LEADERSHIP ACTIONS:",
    "1. Audit the roles spending the most time on repetitive synthesis.",
    "2. Redefine decision rights before introducing more automation.",
    "3. Pilot one future-role transition per function with measurable outcomes.",
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

const asStringArray = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
};

const normalizeLookup = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const findCompanyById = (companyId: string) =>
  companyDirectory.find((company) => normalizeLookup(company.companyId) === normalizeLookup(companyId));

const resolveCompanyContext = (...candidates: string[]): CompanyContext | null => {
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeLookup(candidate);
    if (!normalizedCandidate) {
      continue;
    }

    const directMatch = companyDirectory.find((company) =>
      company.aliases.some((alias) => normalizedCandidate === normalizeLookup(alias) || normalizedCandidate.includes(normalizeLookup(alias))),
    );

    if (directMatch) {
      return { companyId: directMatch.companyId, companyName: directMatch.companyName };
    }
  }

  return null;
};

const normalizeResources = (value: unknown): ResourceItem[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (typeof item === "string" && item.trim()) {
      return [{ title: item.trim(), source: "OrgOS resource", url: "https://careeros-supriya.vercel.app/" }];
    }

    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return [];
    }

    const record = item as Record<string, unknown>;
    const title = asString(record.title) || asString(record.name);
    if (!title) {
      return [];
    }

    return [
      {
        title,
        source: asString(record.source) || asString(record.provider) || "OrgOS resource",
        url: asString(record.url) || asString(record.link) || "https://careeros-supriya.vercel.app/",
      },
    ];
  });
};

const normalizeLearningPath = (value: unknown): LearningPath | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const skills = asStringArray(record.skills).length > 0 ? asStringArray(record.skills) : asStringArray(record.skillGaps);
  const steps = asStringArray(record.steps).length > 0 ? asStringArray(record.steps) : asStringArray(record.actions);
  const resources = normalizeResources(record.resources).length > 0 ? normalizeResources(record.resources) : normalizeResources(record.learn_now);

  if (skills.length === 0 && steps.length === 0 && resources.length === 0) {
    return undefined;
  }

  return {
    skills,
    steps,
    resources,
  };
};

const normalizeRoleMapNode = (value: unknown): RoleMapNode | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const type = asString(record.type)?.toLowerCase();
  const label = asString(record.label) || asString(record.title) || asString(record.name);
  const id = asString(record.id);

  if (!label || !id || (type !== "current" && type !== "future")) {
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

  const fitSource = asString(record.fit) || asString(record.match) || "Medium Fit";
  return {
    id,
    label,
    type,
    description: asString(record.description) || asString(record.summary) || "Full learning path available in your CareerOS report.",
    fit: /high/i.test(fitSource) ? "High Fit" : "Medium Fit",
    learningPath:
      normalizeLearningPath(record.learningPath) ||
      normalizeLearningPath(record.learning_path) ||
      normalizeLearningPath(record.pathway) ||
      normalizeLearningPath(record.learning),
  };
};

const normalizeRoleMapEdge = (value: unknown): RoleMapEdge | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const from = asString(record.from) || asString(record.source) || asString(record.current_id);
  const to = asString(record.to) || asString(record.target) || asString(record.future_id);

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
  const nodesSource = Array.isArray(record.nodes) ? record.nodes : [];
  const edgesSource = Array.isArray(record.edges) ? record.edges : [];
  const nodes = nodesSource.map(normalizeRoleMapNode).filter((item): item is RoleMapNode => item !== null);
  const edges = edgesSource.map(normalizeRoleMapEdge).filter((item): item is RoleMapEdge => item !== null);

  if (nodes.length === 0 || edges.length === 0) {
    return undefined;
  }

  return { nodes, edges };
};

const buildRoleMap = (connections: RoleConnection[]): RoleMap => {
  const currentNodes: CurrentRoleNode[] = [];
  const futureNodes: FutureRoleNode[] = [];
  const edges: RoleMapEdge[] = [];
  const currentNodeIds = new Map<string, string>();
  const futureNodeIds = new Map<string, string>();

  connections.forEach((connection) => {
    const currentKey = `${connection.current.title}::${connection.current.department}`;
    let currentId = currentNodeIds.get(currentKey);
    if (!currentId) {
      currentId = `current-${currentNodeIds.size + 1}`;
      currentNodeIds.set(currentKey, currentId);
      currentNodes.push({
        id: currentId,
        label: connection.current.title,
        type: "current",
        department: connection.current.department,
      });
    }

    const futureKey = connection.future.title;
    let futureId = futureNodeIds.get(futureKey);
    if (!futureId) {
      futureId = `future-${futureNodeIds.size + 1}`;
      futureNodeIds.set(futureKey, futureId);
      futureNodes.push({
        id: futureId,
        label: connection.future.title,
        type: "future",
        description: connection.future.description,
        fit: connection.future.fit,
        learningPath: connection.future.learningPath,
      });
    }

    if (!edges.some((edge) => edge.from === currentId && edge.to === futureId)) {
      edges.push({ from: currentId, to: futureId });
    }
  });

  return { nodes: [...currentNodes, ...futureNodes], edges };
};

const normalizeWebhookPayload = (payload: unknown): Omit<OrgOSApiResponse, "source" | "companyId" | "companyName"> & {
  companyId?: string;
  companyName?: string;
} => {
  if (typeof payload === "string") {
    return { answer: payload };
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { answer: "Webhook response was empty." };
  }

  const record = payload as Record<string, unknown>;
  const answer =
    asString(record.answer) ||
    asString(record.text) ||
    asString(record.message) ||
    asString(record.output) ||
    asString(record.response) ||
    asString(record.summary) ||
    "Webhook returned JSON without answer text.";

  const directRoleMap =
    normalizeRoleMap(record.role_map) ||
    normalizeRoleMap(record.roleMap) ||
    normalizeRoleMap({ nodes: record.nodes, edges: record.edges });

  return {
    answer,
    ...(asString(record.report_url) || asString(record.reportUrl) || asString(record.url)
      ? { reportUrl: asString(record.report_url) || asString(record.reportUrl) || asString(record.url) }
      : {}),
    ...(directRoleMap ? { roleMap: directRoleMap } : {}),
    ...(asString(record.company_id) || asString(record.companyId) || asString(record.organization_id) || asString(record.org_id)
      ? { companyId: asString(record.company_id) || asString(record.companyId) || asString(record.organization_id) || asString(record.org_id) }
      : {}),
    ...(asString(record.company) || asString(record.company_name) || asString(record.organization)
      ? { companyName: asString(record.company) || asString(record.company_name) || asString(record.organization) }
      : {}),
  };
};

const hasNoCompanyData = (payload: unknown, normalized: ReturnType<typeof normalizeWebhookPayload>) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  const record = payload as Record<string, unknown>;
  const status = asString(record.status)?.toLowerCase();
  const error = asString(record.error)?.toLowerCase();
  const answerMissing = !normalized.answer || /^webhook (response was empty|returned json without answer text\.)$/i.test(normalized.answer);
  const mapMissing = !normalized.roleMap || normalized.roleMap.nodes.length === 0 || normalized.roleMap.edges.length === 0;

  return (
    record.has_data === false ||
    record.hasData === false ||
    record.data_available === false ||
    record.dataAvailable === false ||
    record.found === false ||
    status === "no_data" ||
    status === "not_found" ||
    error === "no_data" ||
    error === "not_found" ||
    (answerMissing && mapMissing)
  );
};

const resolveResponseCompany = (
  normalized: ReturnType<typeof normalizeWebhookPayload>,
  requestedCompany: CompanyContext,
): CompanyContext => {
  const byId = normalized.companyId ? findCompanyById(normalized.companyId) : undefined;
  if (byId) {
    return { companyId: byId.companyId, companyName: byId.companyName };
  }

  const inferred = resolveCompanyContext(normalized.companyName || "", normalized.answer || "");
  return inferred || requestedCompany;
};

export async function POST(req: NextRequest) {
  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const query = asString(payload.query) || asString(payload.question) || "";
  const company = asString(payload.company) || asString(payload.company_name) || "";
  const requestedCompany =
    (asString(payload.company_id) ? findCompanyById(asString(payload.company_id) || "") : undefined) ||
    resolveCompanyContext(company, query);
  const requestedCompanyLabel = company || requestedCompany?.companyName || "this company";

  if (!query) {
    return NextResponse.json({ error: "Query cannot be blank." }, { status: 400 });
  }

  if (!requestedCompany) {
    return NextResponse.json(
      { error: `No role intelligence available for ${requestedCompanyLabel}. Run OrgOS analysis first.` },
      { status: 404 },
    );
  }

  const webhookUrl = (process.env.WEBHOOK_URL || process.env.MAKE_WEBHOOK_URL || "").trim();
  if (!webhookUrl) {
    const response: OrgOSApiResponse = {
      answer: fallbackAnswer(requestedCompany.companyName, query),
      companyId: requestedCompany.companyId,
      companyName: requestedCompany.companyName,
      roleMap: buildRoleMap(fallbackConnections),
      source: "mock",
    };

    return NextResponse.json(response);
  }

  try {
    const webhookResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        company: requestedCompany.companyName,
        company_id: requestedCompany.companyId,
        mode: "org",
      }),
      signal: AbortSignal.timeout(30000),
    });

    const responseText = await webhookResponse.text();
    const parsed = safeParseJson(responseText);
    const normalized = parsed === null ? { answer: responseText.trim() || "Webhook response was empty." } : normalizeWebhookPayload(parsed);

    if (hasNoCompanyData(parsed, normalized)) {
      return NextResponse.json(
        { error: `No role intelligence available for ${requestedCompany.companyName}. Run OrgOS analysis first.` },
        { status: 404 },
      );
    }

    const responseCompany = resolveResponseCompany(normalized, requestedCompany);
    if (responseCompany.companyId !== requestedCompany.companyId) {
      return NextResponse.json({ error: "Data mismatch - please retry" }, { status: 409 });
    }

    const response: OrgOSApiResponse = {
      answer: normalized.answer || fallbackAnswer(requestedCompany.companyName, query),
      companyId: requestedCompany.companyId,
      companyName: requestedCompany.companyName,
      ...(normalized.reportUrl ? { reportUrl: normalized.reportUrl } : {}),
      ...(normalized.roleMap ? { roleMap: normalized.roleMap } : {}),
      source: webhookResponse.ok ? "live" : "mock",
    };

    return NextResponse.json(response, { status: webhookResponse.ok ? 200 : 502 });
  } catch {
    return NextResponse.json(
      { error: `Unable to retrieve role intelligence for ${requestedCompany.companyName}.` },
      { status: 502 },
    );
  }
}
