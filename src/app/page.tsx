"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type ApiResponse = {
  answer?: string;
  companyId?: string;
  companyName?: string;
  reportUrl?: string;
  roleMap?: RoleMap;
  source?: "live" | "mock";
  error?: string;
  needsFollowUp?: boolean;
  followUpQuestion?: string;
};

type AnswerBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "ordered"; items: string[] }
  | { type: "unordered"; items: string[] };

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

type ChipValue = {
  value: string;
  tentative: boolean;
};

type OrgContext = {
  company?: ChipValue;
  team?: ChipValue;
  intent?: ChipValue;
};

type OrgContextKey = keyof OrgContext;

type EditableChipProps = {
  chipKey: OrgContextKey;
  label: string;
  chip: ChipValue;
  editingKey: OrgContextKey | null;
  editingValue: string;
  accentClass: string;
  onStartEdit: (key: OrgContextKey, value: string) => void;
  onChangeValue: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onRemove: (key: OrgContextKey) => void;
};

type OrgTemplateValues = {
  company: string;
  yearlyGoal: string;
  questionFocus: string;
};

type OrgTemplatePreset = {
  label: string;
  industry: string;
  company: string;
  yearlyGoal: string;
  questionFocus: string;
};

const GENERIC_ORG_REPORT_URL = "https://drive.google.com/drive/folders/1VSCUVd2pwafNyXxPFj02dVPv5wEv3Ba9?usp=sharing";

const knownCompanies = ["Figma", "Accenture", "McKinsey", "Goldman Sachs", "Deloitte", "Infosys", "Tata 1MG"];
const teamKeywords: Array<{ label: string; matcher: RegExp }> = [
  { label: "Leadership", matcher: /\bleadership\b|\bleaders\b|\bexecutive\b/i },
  { label: "Design", matcher: /\bdesign\b|\bdesigner\b/i },
  { label: "Engineering", matcher: /\bengineering\b|\bengineer\b/i },
  { label: "Product", matcher: /\bproduct\b|\bpm\b/i },
  { label: "Research", matcher: /\bresearch\b|\bresearcher\b/i },
  { label: "Growth", matcher: /\bgrowth\b/i },
  { label: "Marketing", matcher: /\bmarketing\b/i },
  { label: "Operations", matcher: /\boperations\b|\bops\b/i },
  { label: "Finance", matcher: /\bfinance\b/i },
  { label: "People", matcher: /\bpeople\b|\bhr\b/i },
];
const orgIntentMatchers: Array<{ label: string; matcher: RegExp; tentative?: boolean }> = [
  { label: "Future roles", matcher: /future roles?|roles? .*future|what roles/i },
  { label: "Change risk", matcher: /change risks?|risk|automate/i },
  { label: "Leadership action", matcher: /leadership|what should .* do first|action/i },
  { label: "AI restructuring", matcher: /restructuring|reorgani[sz]ing|operating model/i },
  { label: "Team evolution", matcher: /team|function/i, tentative: true },
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
const departmentBorderColors: Record<string, string> = {
  Design: "#1B4F72",
  Engineering: "#2D6A4F",
  Growth: "#92400E",
  Research: "#5B21B6",
  Product: "#1B4F72",
  Leadership: "#1B4F72",
  Default: "#6B6660",
};

const orgTemplatePresets: OrgTemplatePreset[] = [
  {
    label: "Product SaaS",
    industry: "Figma",
    company: "Figma",
    yearlyGoal: "reduce time to AI feature shipment by 25%",
    questionFocus: "how to restructure our product, engineering and design teams",
  },
  {
    label: "Services",
    industry: "Accenture",
    company: "Accenture",
    yearlyGoal: "deploy AI assistants across 50% of client delivery teams",
    questionFocus: "how to redesign consulting, delivery and enablement roles around those assistants",
  },
  {
    label: "Financial Services",
    industry: "Goldman Sachs",
    company: "Goldman Sachs",
    yearlyGoal: "automate 25% of trading and risk analysis workflows",
    questionFocus: "which teams, controls and decision roles need to evolve first",
  },
];

function normalizeLookup(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function detectCompany(message: string): ChipValue | undefined {
  const normalized = normalizeLookup(message);
  if (!normalized) {
    return undefined;
  }

  for (const company of knownCompanies) {
    const normalizedCompany = normalizeLookup(company);
    const exactPattern = new RegExp(`(^|\\b)${normalizedCompany.replace(/\s+/g, "\\s+")}(\\b|$)`, "i");
    if (exactPattern.test(message)) {
      return { value: company, tentative: false };
    }
    if (normalized.includes(normalizedCompany)) {
      return { value: company, tentative: true };
    }
  }

  return undefined;
}

function detectTeam(message: string): ChipValue | undefined {
  for (const team of teamKeywords) {
    if (team.matcher.test(message)) {
      return { value: team.label, tentative: false };
    }
  }

  return undefined;
}

function detectOrgIntent(message: string): ChipValue | undefined {
  for (const intent of orgIntentMatchers) {
    if (intent.matcher.test(message)) {
      return { value: intent.label, tentative: !!intent.tentative };
    }
  }

  return undefined;
}

function extractOrgContext(message: string): OrgContext {
  return {
    company: detectCompany(message),
    team: detectTeam(message),
    intent: detectOrgIntent(message),
  };
}

function serializeContext(context: OrgContext) {
  return {
    ...(context.company?.value ? { company: context.company.value } : {}),
    ...(context.team?.value ? { team: context.team.value } : {}),
    ...(context.intent?.value ? { intent: context.intent.value } : {}),
  };
}

function cleanAnswerText(answer: string) {
  return answer
    .split("\n")
    .map((line) => line.replace(/\*\*(.*?)\*\*/g, "$1").trimEnd())
    .filter((line) => {
      const trimmed = line.trim();
      return !/^(ROUTE|run_id|company_id|sheet name|sheet|source table|generated by|visual_spec|raw source|report routing)\s*:/i.test(trimmed);
    })
    .join("\n")
    .trim();
}

function normalizeArrowLine(line: string) {
  if (line.includes("->")) {
    return line.replace(/->/g, " -> ");
  }

  return line;
}

function parseIntent(answer: string) {
  const firstLine = answer.split("\n").map((line) => line.trim()).find(Boolean);
  if (!firstLine) {
    return { intent: undefined, body: answer };
  }

  const match = firstLine.match(/^Intent:\s*(.+)$/i);
  if (!match) {
    return { intent: undefined, body: answer };
  }

  return {
    intent: match[1].trim(),
    body: answer.replace(firstLine, "").trim(),
  };
}

function parseAnswerBlocks(answer: string): { intent?: string; blocks: AnswerBlock[] } {
  const { intent, body } = parseIntent(answer);
  const lines = body.split("\n").map((line) => line.trim());
  const blocks: AnswerBlock[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) {
      continue;
    }

    if (/^[A-Z][A-Z\s/&-]+:$/.test(line)) {
      blocks.push({ type: "heading", text: line.slice(0, -1) });
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      let cursor = index;
      while (cursor < lines.length && /^\d+\.\s+/.test(lines[cursor])) {
        items.push(lines[cursor].replace(/^\d+\.\s+/, ""));
        cursor += 1;
      }
      blocks.push({ type: "ordered", items });
      index = cursor - 1;
      continue;
    }

    if (/^[-•]\s+/.test(line)) {
      const items: string[] = [];
      let cursor = index;
      while (cursor < lines.length && /^[-•]\s+/.test(lines[cursor])) {
        items.push(lines[cursor].replace(/^[-•]\s+/, ""));
        cursor += 1;
      }
      blocks.push({ type: "unordered", items });
      index = cursor - 1;
      continue;
    }

    const paragraphLines = [line];
    let cursor = index + 1;
    while (
      cursor < lines.length &&
      lines[cursor] &&
      !/^[A-Z][A-Z\s/&-]+:$/.test(lines[cursor]) &&
      !/^\d+\.\s+/.test(lines[cursor]) &&
      !/^[-•]\s+/.test(lines[cursor])
    ) {
      paragraphLines.push(lines[cursor]);
      cursor += 1;
    }

    blocks.push({ type: "paragraph", text: paragraphLines.join(" ") });
    index = cursor - 1;
  }

  return { intent, blocks };
}

function takeFirstSentence(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  const match = normalized.match(/.+?[.!?](?=\s|$)/);
  return match ? match[0].trim() : normalized;
}

function summarizeOrgBrief(answer: string) {
  const { blocks } = parseAnswerBlocks(cleanAnswerText(answer));
  const paragraphs = blocks.filter((block): block is Extract<AnswerBlock, { type: "paragraph" }> => block.type === "paragraph");
  const ordered = blocks.find((block): block is Extract<AnswerBlock, { type: "ordered" }> => block.type === "ordered");
  const unordered = blocks.find((block): block is Extract<AnswerBlock, { type: "unordered" }> => block.type === "unordered");
  const mainInsight = takeFirstSentence(paragraphs[0]?.text || "");
  const priorityMoves = (ordered?.items || unordered?.items || paragraphs.slice(1).map((item) => item.text)).slice(0, 3);
  const leadershipNext = takeFirstSentence(paragraphs[1]?.text || priorityMoves[0] || "");

  return {
    mainInsight,
    priorityMoves,
    leadershipNext,
  };
}

function parseCurrentRole(segment: string): CurrentRole {
  const cleaned = segment.replace(/^current roles?:/i, "").trim();
  const match = cleaned.match(/^(.*?)(?:\(([^)]+)\))?$/);
  const title = match?.[1]?.trim() || cleaned;
  const department = match?.[2]?.trim() || "Default";

  return { title, department };
}

function parseFutureRole(segment: string): FutureRole {
  const cleaned = segment.replace(/^future roles?:/i, "").trim();
  const pieces = cleaned.split("|").map((piece) => piece.trim()).filter(Boolean);
  const title = pieces[0] || cleaned;
  const fit = /high fit/i.test(pieces[1] || "") ? "High Fit" : "Medium Fit";
  const description = pieces[2] || "Full learning path available in your CareerOS report.";

  return {
    title,
    description,
    fit,
  };
}

function parseRoleConnections(answer: string): RoleConnection[] {
  const lines = answer
    .split("\n")
    .map((line) => normalizeArrowLine(line).trim())
    .filter(Boolean);

  const parsed = lines.flatMap((line) => {
    if (line.includes("->")) {
      const [left, right] = line.split("->");
      if (!left || !right) {
        return [];
      }
      return [{ current: parseCurrentRole(left), future: parseFutureRole(right) }];
    }

    if (line.includes("→")) {
      const [left, right] = line.split("→");
      if (!left || !right) {
        return [];
      }
      return [{ current: parseCurrentRole(left), future: parseFutureRole(right) }];
    }

    if (/ maps to /i.test(line)) {
      const [left, right] = line.split(/ maps to /i);
      if (!left || !right) {
        return [];
      }
      return [{ current: parseCurrentRole(left), future: parseFutureRole(right) }];
    }

    return [];
  });

  if (parsed.length > 0) {
    return parsed.map((connection) => {
      const fallback = fallbackConnections.find((item) => item.future.title === connection.future.title);
      return fallback
        ? {
            current: connection.current,
            future: {
              ...connection.future,
              learningPath: fallback.future.learningPath,
            },
          }
        : connection;
    });
  }

  if (/(future role|future roles|current role|current roles|maps to|→|->)/i.test(answer)) {
    return fallbackConnections;
  }

  return [];
}

function buildRoleMap(connections: RoleConnection[]): RoleMap {
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
}

function getCurrentNodes(roleMap: RoleMap) {
  return roleMap.nodes.filter((node): node is CurrentRoleNode => node.type === "current");
}

function getFutureNodes(roleMap: RoleMap) {
  return roleMap.nodes.filter((node): node is FutureRoleNode => node.type === "future");
}

function getSelectedFutureRole(roleMap: RoleMap, selectedRoleId: string | null) {
  if (!selectedRoleId) {
    return null;
  }

  return getFutureNodes(roleMap).find((node) => node.id === selectedRoleId) || null;
}

function AnswerContent({ answer }: { answer: string }) {
  const { intent, blocks } = useMemo(() => parseAnswerBlocks(cleanAnswerText(answer)), [answer]);

  return (
    <div>
      {intent ? (
        <span className="mb-4 inline-block rounded-full bg-[rgba(27,79,114,0.08)] px-2.5 py-1 text-[12px] font-medium text-primary">
          {intent}
        </span>
      ) : null}

      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return (
            <h3 key={`${block.type}-${index}`} className="font-display mt-6 mb-2 text-[18px] text-text first:mt-0">
              {block.text}
            </h3>
          );
        }

        if (block.type === "ordered") {
          return (
            <ol key={`${block.type}-${index}`} className="mb-5 grid gap-3 p-0 md:grid-cols-1">
              {block.items.map((item, itemIndex) => (
                <li key={item} className="flex items-start gap-3 rounded-[14px] bg-[rgba(27,79,114,0.04)] px-4 py-4 text-[15px] leading-7 text-text">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[12px] font-semibold text-white">
                    {itemIndex + 1}
                  </span>
                  <div className="pt-0.5">{item}</div>
                </li>
              ))}
            </ol>
          );
        }

        if (block.type === "unordered") {
          return (
            <ul key={`${block.type}-${index}`} className="mb-4 list-none p-0">
              {block.items.map((item) => (
                /:$/.test(item) ? (
                  <li key={item} className="mb-2 pt-1 text-[13px] font-semibold uppercase tracking-[0.08em] text-muted last:mb-0">
                    {item.slice(0, -1)}
                  </li>
                ) : (
                  <li key={item} className="mb-3 flex items-start gap-3 text-[15px] leading-7 text-text last:mb-0">
                    <span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{item}</span>
                  </li>
                )
              ))}
            </ul>
          );
        }

        return (
          <p key={`${block.type}-${index}`} className="mb-4 text-[15px] leading-7 text-text last:mb-0">
            {block.text}
          </p>
        );
      })}
    </div>
  );
}

function OrgBrief({ answer, reportUrl }: { answer: string; reportUrl: string }) {
  const [expanded, setExpanded] = useState(false);
  const brief = useMemo(() => summarizeOrgBrief(answer), [answer]);
  const hasSummary = brief.mainInsight || brief.priorityMoves.length > 0 || brief.leadershipNext;

  return (
    <section className="fade-in mt-10 rounded-[20px] border border-border bg-surface px-7 py-7 shadow-[0_10px_30px_rgba(28,25,23,0.05)]">
      <div className="flex items-start justify-between gap-4 max-sm:flex-col">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted">Org Intelligence Brief</p>
          <h2 className="font-display mt-2 text-[28px] text-text">What matters now</h2>
        </div>
        {reportUrl ? (
          <a
            href={reportUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded-full border border-primary px-4 py-2 text-[13px] font-medium text-primary transition hover:bg-[rgba(27,79,114,0.05)]"
          >
            Open report
          </a>
        ) : null}
      </div>

      {hasSummary ? (
        <div className="mt-7 grid gap-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted">Main insight</p>
            <p className="mt-2 text-[18px] leading-8 text-text">{brief.mainInsight || cleanAnswerText(answer)}</p>
          </div>

          {brief.priorityMoves.length > 0 ? (
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-muted">3 priority moves</p>
              <div className="mt-3 grid gap-3">
                {brief.priorityMoves.map((item, index) => (
                  <div key={item} className="flex items-start gap-3 rounded-[14px] bg-[rgba(27,79,114,0.04)] px-4 py-4">
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[12px] font-semibold text-white">
                      {index + 1}
                    </span>
                    <p className="text-[15px] leading-7 text-text">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {brief.leadershipNext ? (
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-muted">What leadership should do next</p>
              <p className="mt-2 text-[15px] leading-7 text-text">{brief.leadershipNext}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6 border-t border-border pt-5">
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="text-[13px] font-medium text-primary transition hover:opacity-80"
        >
          {expanded ? "Hide full analysis" : "View full analysis"}
        </button>
        {expanded ? <div className="mt-5"><AnswerContent answer={answer} /></div> : null}
      </div>
    </section>
  );
}

function EditableChip({
  chipKey,
  label,
  chip,
  editingKey,
  editingValue,
  accentClass,
  onStartEdit,
  onChangeValue,
  onSave,
  onCancel,
  onRemove,
}: EditableChipProps) {
  if (editingKey === chipKey) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-full border border-border bg-surface px-3 py-2">
        <span className="text-[12px] font-medium text-muted">{label}</span>
        <input
          autoFocus
          value={editingValue}
          onChange={(event) => onChangeValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onSave();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              onCancel();
            }
          }}
          className="min-w-[140px] bg-transparent text-[13px] text-text outline-none"
        />
        <button type="button" onClick={onSave} className="text-[12px] font-medium text-primary">
          Save
        </button>
        <button type="button" onClick={onCancel} className="text-[12px] text-muted">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 ${accentClass}`}>
      <button type="button" onClick={() => onStartEdit(chipKey, chip.value)} className="flex items-center gap-2 text-left">
        <span className="text-[12px] font-medium text-muted">{label}</span>
        <span className="text-[13px] font-medium text-text">{chip.value}{chip.tentative ? "?" : ""}</span>
      </button>
      <button type="button" onClick={() => onRemove(chipKey)} className="text-[12px] text-muted transition hover:text-primary">
        x
      </button>
    </div>
  );
}

function RoleEvolutionMap({
  roleMap,
  selectedRoleId,
  onSelectRole,
}: {
  roleMap: RoleMap;
  selectedRoleId: string | null;
  onSelectRole: (roleId: string | null) => void;
}) {
  const currentNodes = getCurrentNodes(roleMap);
  const futureNodes = getFutureNodes(roleMap);
  const rowCount = Math.max(currentNodes.length, futureNodes.length, 1);
  const svgHeight = Math.max(rowCount * 88 + 20, 120);
  const currentY = new Map(currentNodes.map((node, index) => [node.id, 34 + index * 88]));
  const futureY = new Map(futureNodes.map((node, index) => [node.id, 34 + index * 88]));

  return (
    <section className="mt-14">
      <h2 className="font-display mb-2 text-[24px] text-text">Role Evolution Map</h2>
      <p className="mb-8 text-[14px] leading-6 text-muted">Current roles and pressure points on the left. Recommended moves on the right.</p>

      <div className="grid grid-cols-[1fr_80px_1fr] gap-0 max-md:grid-cols-1 max-md:gap-4">
        <div>
          {currentNodes.map((node) => {
            const borderColor = departmentBorderColors[node.department] || departmentBorderColors.Default;
            return (
              <article
                key={node.id}
                className="mb-3 rounded-[14px] border border-border bg-surface px-4 py-3"
                style={{ borderLeft: `3px solid ${borderColor}` }}
              >
                <p className="text-[14px] font-semibold text-text">{node.label}</p>
                <p className="mt-1 text-[12px] text-muted">{node.department}</p>
              </article>
            );
          })}
        </div>

        <div className="flex items-stretch justify-center max-md:hidden">
          <svg width="80" height={svgHeight} viewBox={`0 0 80 ${svgHeight}`} fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <marker id="orgos-arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
                <path d="M0,0 L0,6 L9,3 z" fill="var(--color-primary)" />
              </marker>
            </defs>
            {roleMap.edges.map((edge, index) => {
              const startY = currentY.get(edge.from);
              const endY = futureY.get(edge.to);
              if (!startY || !endY) {
                return null;
              }

              return (
                <path
                  key={`${edge.from}-${edge.to}`}
                  className="role-line"
                  d={`M8 ${startY} C 28 ${startY}, 52 ${endY}, 72 ${endY}`}
                  stroke="var(--color-primary)"
                  strokeWidth="1.5"
                  opacity="0.4"
                  markerEnd="url(#orgos-arrow)"
                  style={{ animationDelay: `${index * 120}ms` }}
                />
              );
            })}
          </svg>
        </div>

        <div>
          {futureNodes.map((node) => {
            const active = selectedRoleId === node.id;
            return (
              <button
                key={node.id}
                type="button"
                onClick={() => onSelectRole(node.id)}
                className={`mb-3 w-full rounded-[14px] bg-primary px-4 py-4 text-left text-white transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(27,79,114,0.18)] ${active ? "ring-2 ring-[rgba(255,255,255,0.45)]" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[14px] font-semibold text-white">{node.label}</p>
                    <p className="mt-1 text-[12px] leading-5 text-white/80">{takeFirstSentence(node.description)}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] text-white ${node.fit === "High Fit" ? "bg-white/20" : "bg-white/12"}`}>
                    {node.fit}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function LearningPathPanel({ role, onClose }: { role: FutureRoleNode; onClose: () => void }) {
  return (
    <section className="mt-4 overflow-hidden rounded-[6px] border border-border border-t-[3px] border-t-primary bg-surface px-8 py-7 shadow-[0_1px_3px_rgba(28,25,23,0.08)]">
      <div className="mb-6 flex items-start justify-between gap-4">
        <h3 className="font-display text-[22px] text-text">Your path to {role.label}</h3>
        <button type="button" onClick={onClose} className="text-[20px] text-muted transition hover:text-primary">
          x
        </button>
      </div>

      {role.learningPath ? (
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <p className="mb-3 text-[11px] uppercase tracking-[0.1em] text-muted">Skills to build</p>
            <div>
              {role.learningPath.skills.map((skill) => (
                <span
                  key={skill}
                  className="mr-1 mt-1 inline-block rounded-full border border-primary bg-[rgba(27,79,114,0.04)] px-3 py-1.5 text-[13px] text-primary"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-3 text-[11px] uppercase tracking-[0.1em] text-muted">Where to begin</p>
            <div>
              {role.learningPath.steps.map((step, index) => (
                <div key={step} className="mb-3.5 flex items-start gap-3 last:mb-0">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[12px] font-semibold text-white">
                    {index + 1}
                  </span>
                  <p className="text-[14px] leading-6 text-text">{step}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.1em] text-muted">
              <span className="inline-block h-2 w-2 rounded-full bg-accent" />
              Learn now
            </p>
            <div>
              {role.learningPath.resources.map((resource) => (
                <article key={resource.title} className="mb-2 rounded-[6px] border border-border px-3.5 py-3 last:mb-0">
                  <p className="text-[14px] font-medium text-text">{resource.title}</p>
                  <p className="mt-0.5 text-[12px] text-muted">{resource.source}</p>
                  <a href={resource.url} target="_blank" rel="noreferrer" className="mt-1.5 block text-[13px] text-primary hover:underline">
                    {"Open ->"}
                  </a>
                </article>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <p className="text-[14px] italic text-muted">Full learning path available in your CareerOS report.</p>
      )}
    </section>
  );
}

export default function Home() {
  const debounceRef = useRef<number | null>(null);
  const [userId, setUserId] = useState("");
  const [message, setMessage] = useState("");
  const [context, setContext] = useState<OrgContext>({});
  const [answer, setAnswer] = useState("");
  const [reportUrl, setReportUrl] = useState("");
  const [source, setSource] = useState<"live" | "mock" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [activeCompanyName, setActiveCompanyName] = useState("");
  const [roleMap, setRoleMap] = useState<RoleMap | null>(null);
  const [editingKey, setEditingKey] = useState<OrgContextKey | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [needsFollowUp, setNeedsFollowUp] = useState(false);
  const [followUpQuestion, setFollowUpQuestion] = useState("");
  const [templateValues, setTemplateValues] = useState<OrgTemplateValues>({
    company: "Figma",
    yearlyGoal: "reduce time to AI feature shipment by 25%",
    questionFocus: "how to restructure our product, engineering and design teams",
  });

  const derivedRoleMap = useMemo(() => {
    if (roleMap) {
      return roleMap;
    }

    return buildRoleMap(parseRoleConnections(answer));
  }, [answer, roleMap]);
  const showRoleMap = !needsFollowUp && getCurrentNodes(derivedRoleMap).length > 0 && getFutureNodes(derivedRoleMap).length > 0;
  const selectedRole = getSelectedFutureRole(derivedRoleMap, selectedRoleId);

  useEffect(() => {
    let id = window.localStorage.getItem("evo_user_id");
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem("evo_user_id", id);
    }
    setUserId(id);
  }, []);

  useEffect(() => {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }

    debounceRef.current = window.setTimeout(() => {
      setContext(extractOrgContext(message));
    }, 220);

    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [message]);

  function applyTemplate(prompt: string) {
    setMessage(prompt);
    setContext(extractOrgContext(prompt));
    setNeedsFollowUp(false);
    setFollowUpQuestion("");
    setError("");
  }

  function applyTemplatePreset(preset: OrgTemplatePreset) {
    setTemplateValues({
      company: preset.company,
      yearlyGoal: preset.yearlyGoal,
      questionFocus: preset.questionFocus,
    });
    applyTemplate(`At ${preset.company}, our goal this year is to ${preset.yearlyGoal}, and for that we need to know ${preset.questionFocus}.`);
  }

  function handleStartEdit(key: OrgContextKey, value: string) {
    setEditingKey(key);
    setEditingValue(value);
  }

  function handleSaveEdit() {
    if (!editingKey) {
      return;
    }

    const nextValue = editingValue.trim();
    setContext((current) => {
      const nextContext = { ...current };
      if (!nextValue) {
        delete nextContext[editingKey];
      } else {
        nextContext[editingKey] = { value: nextValue, tentative: false };
      }
      return nextContext;
    });
    setEditingKey(null);
    setEditingValue("");
  }

  function handleRemoveChip(key: OrgContextKey) {
    setContext((current) => {
      const nextContext = { ...current };
      delete nextContext[key];
      return nextContext;
    });
    if (editingKey === key) {
      setEditingKey(null);
      setEditingValue("");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) {
      return;
    }

    if (!message.trim()) {
      setError("Please type your question or use the template first.");
      setNeedsFollowUp(false);
      setFollowUpQuestion("");
      return;
    }

    const companyLabel = context.company?.value || "this organization";

    setLoading(true);
    setError("");
    setNeedsFollowUp(false);
    setFollowUpQuestion("");
    setSelectedRoleId(null);
    setActiveCompanyName(companyLabel);

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          mode: "org",
          user_id: userId,
          context: serializeContext(context),
        }),
      });

      const data = (await response.json()) as ApiResponse;
      if (!response.ok) {
        throw new Error(data.error || "Unable to reach OrgOS.");
      }

      const nextAnswer = (data.answer || "").trim();
      setAnswer(nextAnswer);
      setReportUrl(data.reportUrl || "");
      setSource(data.source || "live");
      setNeedsFollowUp(Boolean(data.needsFollowUp));
      setFollowUpQuestion(data.followUpQuestion || "");
      setRoleMap(data.roleMap || (nextAnswer ? buildRoleMap(parseRoleConnections(nextAnswer)) : null));
    } catch (submitError) {
      const nextMessage = submitError instanceof Error ? submitError.message : "Something went wrong.";
      setError(nextMessage);
      setAnswer("");
      setReportUrl("");
      setSource(null);
      setRoleMap(null);
      setSelectedRoleId(null);
      setNeedsFollowUp(false);
      setFollowUpQuestion("");
    } finally {
      setLoading(false);
    }
  }

  const chips: Array<{ key: OrgContextKey; label: string; chip?: ChipValue; accentClass: string }> = [
    { key: "company", label: "Company", chip: context.company, accentClass: "border-[rgba(27,79,114,0.18)] bg-[rgba(27,79,114,0.05)]" },
    { key: "team", label: "Team", chip: context.team, accentClass: "border-border bg-surface" },
    { key: "intent", label: "Intent", chip: context.intent, accentClass: "border-border bg-surface" },
  ];

  return (
    <main className="bg-bg text-text">
      <nav className="sticky top-0 z-30 h-14 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-full max-w-[860px] items-center justify-between px-6">
          <div>
            <span className="font-display text-[20px] text-primary">OrgOS</span>
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted">EvolutionOS system</p>
          </div>
          <a href="https://careeros-supriya.vercel.app/" target="_blank" rel="noreferrer" className="text-[14px] text-muted transition hover:text-primary">
            {"-> CareerOS"}
          </a>
        </div>
      </nav>

      <div className="mx-auto max-w-[860px] px-6 pb-16">
        <section className="pb-12 pt-16">
          <p className="mb-3 text-[11px] uppercase tracking-[0.12em] text-muted">ORGOS - ROLE INTELLIGENCE</p>
          <h1 className="font-display max-w-[620px] text-[48px] leading-[1.15] text-text max-md:text-[40px]">
            Redesign your org
            <br />
            for the <span className="text-primary">AI era.</span>
          </h1>
          <p className="mt-5 max-w-[520px] text-[17px] leading-[1.7] text-muted">
            Ask how roles, capabilities, and teams should evolve. Powered by live intelligence and your organizational context.
          </p>

          <form onSubmit={handleSubmit} className="mt-10">
            <div>
              <label htmlFor="message" className="mb-2 block text-[13px] text-muted">
                Ask about an organization
              </label>
              <textarea
                id="message"
                value={message}
                onChange={(event) => {
                  setMessage(event.target.value);
                  setNeedsFollowUp(false);
                  setFollowUpQuestion("");
                  setError("");
                }}
                placeholder="e.g. What are the top future roles at Figma? What change risks should Accenture leadership act on first? How is McKinsey restructuring for AI?"
                className="min-h-[140px] w-full resize-none rounded-[12px] border border-border bg-surface px-5 py-4 text-[16px] text-text outline-none transition focus:border-primary focus:shadow-[0_0_0_3px_rgba(27,79,114,0.1)]"
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {chips.some((item) => item.chip) ? <p className="w-full text-[11px] uppercase tracking-[0.1em] text-muted">Detected context</p> : null}
              {chips.map((item) =>
                item.chip ? (
                  <EditableChip
                    key={item.key}
                    chipKey={item.key}
                    label={item.label}
                    chip={item.chip}
                    editingKey={editingKey}
                    editingValue={editingValue}
                    accentClass={item.accentClass}
                    onStartEdit={handleStartEdit}
                    onChangeValue={setEditingValue}
                    onSave={handleSaveEdit}
                    onCancel={() => {
                      setEditingKey(null);
                      setEditingValue("");
                    }}
                    onRemove={handleRemoveChip}
                  />
                ) : null,
              )}
            </div>

            <div className="mt-6 rounded-[18px] border border-border/80 bg-[rgba(255,255,255,0.7)] p-5">
              <div className="flex items-start justify-between gap-4 max-md:flex-col">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.1em] text-muted">Optional helper</p>
                  <h3 className="font-display mt-2 text-[24px] leading-tight text-text">Fill in the blanks, then ask OrgOS</h3>
                  <p className="mt-2 max-w-[560px] text-[14px] leading-6 text-muted">
                    Use one clear operating sentence so the question feels strategic, not technical.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    applyTemplate(
                      `At ${templateValues.company}, our goal this year is to ${templateValues.yearlyGoal}, and for that we need to know ${templateValues.questionFocus}.`,
                    )
                  }
                  className="rounded-[999px] border border-primary px-4 py-2 text-[13px] font-medium text-primary transition hover:bg-[rgba(27,79,114,0.05)]"
                >
                  Use this template
                </button>
              </div>

              <div className="mt-5 overflow-x-auto pb-2">
                <div className="flex gap-3 min-w-max">
                  {orgTemplatePresets.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => applyTemplatePreset(preset)}
                      className="w-[272px] shrink-0 rounded-[16px] border border-border bg-[rgba(27,79,114,0.03)] p-4 text-left transition hover:-translate-y-px hover:border-primary hover:bg-[rgba(27,79,114,0.06)]"
                    >
                      <p className="text-[11px] uppercase tracking-[0.08em] text-muted">{preset.industry}</p>
                      <h4 className="mt-2 font-display text-[20px] text-text">{preset.company}</h4>
                      <p className="mt-3 text-[14px] leading-6 text-text">{preset.yearlyGoal}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 rounded-[14px] bg-[rgba(27,79,114,0.04)] px-4 py-4 text-[18px] leading-[1.9] text-text max-md:text-[16px]">
                <span className="text-muted">At </span>
                <input
                  value={templateValues.company}
                  onChange={(event) => setTemplateValues((current) => ({ ...current, company: event.target.value }))}
                  className="mx-1 inline-block min-w-[120px] rounded-[10px] border border-[rgba(27,79,114,0.18)] bg-white px-3 py-2 text-[16px] font-medium text-text outline-none"
                />
                <span className="text-muted"> our goal this year is to </span>
                <input
                  value={templateValues.yearlyGoal}
                  onChange={(event) => setTemplateValues((current) => ({ ...current, yearlyGoal: event.target.value }))}
                  className="mx-1 inline-block min-w-[320px] rounded-[10px] border border-[rgba(27,79,114,0.18)] bg-white px-3 py-2 text-[16px] font-medium text-text outline-none max-md:min-w-[220px]"
                />
                <span className="text-muted"> and for that we need to know </span>
                <input
                  value={templateValues.questionFocus}
                  onChange={(event) => setTemplateValues((current) => ({ ...current, questionFocus: event.target.value }))}
                  className="mx-1 inline-block min-w-[360px] rounded-[10px] border border-[rgba(27,79,114,0.18)] bg-white px-3 py-2 text-[16px] font-medium text-text outline-none max-md:min-w-[240px]"
                />
              </div>
            </div>

            <div className="mt-6">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex rounded-[999px] border-none bg-primary px-7 py-3 text-[15px] font-medium text-white transition duration-150 ease-out hover:-translate-y-px hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70"
              >
                Ask OrgOS
              </button>
            </div>
          </form>

          {error ? (
            <div className="mt-4 rounded-[10px] border border-[rgba(27,79,114,0.2)] bg-[rgba(27,79,114,0.08)] px-4 py-3 text-[14px] text-primary">
              {error}
            </div>
          ) : null}

          {loading ? (
            <section className="fade-in mt-8 rounded-[6px] border border-border border-l-[3px] border-l-primary bg-surface px-8 py-7 shadow-[0_1px_3px_rgba(28,25,23,0.08)]">
              <div className="mb-3 flex items-center gap-1.5">
                {[0, 1, 2].map((dot) => (
                  <span
                    key={dot}
                    className="loading-dot inline-block h-2 w-2 rounded-full bg-primary"
                    style={{ animationDelay: `${dot * 400}ms` }}
                  />
                ))}
              </div>
              <p className="text-[14px] italic text-muted">Analyzing {activeCompanyName || "this organization"}...</p>
            </section>
          ) : null}

          {!loading && answer ? <OrgBrief answer={answer} reportUrl={reportUrl || GENERIC_ORG_REPORT_URL} /> : null}

          {!loading && followUpQuestion ? (
            <section className="fade-in mt-6 rounded-[6px] border border-border bg-surface px-6 py-5 shadow-[0_1px_3px_rgba(28,25,23,0.08)]">
              <p className="text-[12px] font-medium uppercase tracking-[0.1em] text-muted">Follow-up</p>
              <p className="mt-2 text-[15px] leading-7 text-text">{followUpQuestion}</p>
              <p className="mt-2 text-[13px] text-muted">Update the message or edit the chips above, then ask again.</p>
            </section>
          ) : null}

          {showRoleMap ? (
            <>
              <RoleEvolutionMap roleMap={derivedRoleMap} selectedRoleId={selectedRoleId} onSelectRole={setSelectedRoleId} />
              <div
                className="overflow-hidden transition-[max-height] duration-350 ease-in-out"
                style={{ maxHeight: selectedRole ? "640px" : "0px" }}
              >
                {selectedRole ? <LearningPathPanel role={selectedRole} onClose={() => setSelectedRoleId(null)} /> : null}
              </div>
            </>
          ) : null}
        </section>

        <footer className="mt-24 border-t border-border py-8 text-[13px] text-muted">
          <div className="flex items-center justify-between max-sm:flex-col max-sm:items-start max-sm:gap-3">
            <span>OrgOS by EvolutionOS</span>
            <a href="https://careeros-supriya.vercel.app/" target="_blank" rel="noreferrer" className="text-primary">
              {"-> Try CareerOS"}
            </a>
          </div>
          <p className="mt-3 text-[12px] leading-6 text-muted">
            EvolutionOS maps how organizations evolve and how people grow with them.
          </p>
        </footer>
      </div>
    </main>
  );
}
