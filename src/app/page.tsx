"use client";

import { FormEvent, useMemo, useRef, useState } from "react";

type ApiResponse = {
  answer?: string;
  companyId?: string;
  companyName?: string;
  reportUrl?: string;
  roleMap?: RoleMap;
  source?: "live" | "mock";
  error?: string;
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

type CompanyContext = {
  companyId: string;
  companyName: string;
};

const companyDirectory: Array<CompanyContext & { aliases: string[] }> = [
  { companyName: "Figma", companyId: "ORG-FIGMA-001", aliases: ["figma"] },
  { companyName: "Accenture", companyId: "ORG-ACCENTURE-001", aliases: ["accenture"] },
  { companyName: "McKinsey", companyId: "ORG-MCKINSEY-001", aliases: ["mckinsey"] },
  { companyName: "Goldman Sachs", companyId: "ORG-GOLDMAN-001", aliases: ["goldman sachs", "goldman"] },
  { companyName: "Deloitte", companyId: "ORG-DELOITTE-001", aliases: ["deloitte"] },
  { companyName: "Infosys", companyId: "ORG-INFOSYS-001", aliases: ["infosys"] },
];

const suggestionChips = [
  "Top 3 future roles at Figma",
  "Show change risks at Accenture",
  "What should leadership do first?",
  "How is McKinsey restructuring for AI?",
  "Which roles will AI automate at Deloitte?",
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
  Default: "#6B6660",
};

function normalizeLookup(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function resolveCompanyContext(...candidates: string[]): CompanyContext | null {
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeLookup(candidate);
    if (!normalizedCandidate) {
      continue;
    }

    const match = companyDirectory.find((company) =>
      company.aliases.some((alias) => normalizedCandidate === normalizeLookup(alias) || normalizedCandidate.includes(normalizeLookup(alias))),
    );

    if (match) {
      return { companyId: match.companyId, companyName: match.companyName };
    }
  }

  return null;
}

function getRequestedCompanyLabel(company: string, query: string) {
  return company.trim() || resolveCompanyContext(query)?.companyName || "this company";
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
    if (line.includes("→")) {
      const [left, right] = line.split("→");
      if (!left || !right) {
        return [];
      }
      return [{ current: parseCurrentRole(left), future: parseFutureRole(right) }];
    }

    if (line.includes("->")) {
      const [left, right] = line.split("->");
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

    if (/ converge/i.test(line)) {
      const parts = line.split(/ converge(?:s)?(?: into)? /i);
      if (parts.length !== 2) {
        return [];
      }
      return [{ current: parseCurrentRole(parts[0]), future: parseFutureRole(parts[1]) }];
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

  if (/(future role|future roles|current role|current roles|converge|maps to|→|->)/i.test(answer)) {
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
  const { intent, blocks } = useMemo(() => parseAnswerBlocks(answer), [answer]);

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
            <ol key={`${block.type}-${index}`} className="mb-4 list-none p-0">
              {block.items.map((item, itemIndex) => (
                <li key={item} className="relative mb-2.5 pl-6 text-[15px] leading-7 text-text last:mb-0">
                  <span className="absolute left-0 top-0 font-semibold text-primary">{itemIndex + 1}.</span>
                  {item}
                </li>
              ))}
            </ol>
          );
        }

        if (block.type === "unordered") {
          return (
            <ul key={`${block.type}-${index}`} className="mb-4 list-none p-0">
              {block.items.map((item) => (
                <li key={item} className="mb-2.5 text-[15px] leading-7 text-text last:mb-0">
                  <span className="mr-2.5 inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle" />
                  <span className="align-middle">{item}</span>
                </li>
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
    <section className="mt-12">
      <h2 className="font-display mb-2 text-[24px] text-text">Role Evolution Map</h2>
      <p className="mb-8 text-[14px] text-muted">Current roles on the left. Future roles on the right.</p>

      <div className="grid grid-cols-[1fr_80px_1fr] gap-0 max-md:grid-cols-1 max-md:gap-4">
        <div>
          {currentNodes.map((node) => {
            const borderColor = departmentBorderColors[node.department] || departmentBorderColors.Default;
            return (
              <article
                key={node.id}
                className="mb-3 rounded-[6px] border border-border bg-surface px-4 py-3 shadow-[0_1px_3px_rgba(28,25,23,0.08)]"
                style={{ borderLeft: `3px solid ${borderColor}` }}
              >
                <p className="text-[14px] font-semibold text-text">{node.label}</p>
                <p className="mt-0.5 text-[12px] text-muted">{node.department}</p>
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
                className={`mb-3 w-full rounded-[6px] bg-primary px-4 py-3 text-left text-white shadow-[0_1px_3px_rgba(28,25,23,0.08)] transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(27,79,114,0.25)] ${active ? "ring-2 ring-[rgba(255,255,255,0.45)]" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[14px] font-semibold text-white">{node.label}</p>
                    <p className="mt-0.5 text-[12px] text-white/80">{node.description}</p>
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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const resizeFrameRef = useRef<number | null>(null);
  const [company, setCompany] = useState("");
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [reportUrl, setReportUrl] = useState("");
  const [source, setSource] = useState<"live" | "mock" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [activeCompanyName, setActiveCompanyName] = useState("");
  const [roleMap, setRoleMap] = useState<RoleMap | null>(null);

  const derivedRoleMap = useMemo(() => {
    if (roleMap) {
      return roleMap;
    }

    return buildRoleMap(parseRoleConnections(answer));
  }, [answer, roleMap]);
  const showRoleMap = getCurrentNodes(derivedRoleMap).length > 0 && getFutureNodes(derivedRoleMap).length > 0;
  const selectedRole = getSelectedFutureRole(derivedRoleMap, selectedRoleId);

  function scheduleTextareaResize(element: HTMLTextAreaElement) {
    if (resizeFrameRef.current !== null) {
      cancelAnimationFrame(resizeFrameRef.current);
    }

    resizeFrameRef.current = requestAnimationFrame(() => {
      element.style.height = "auto";
      element.style.height = `${Math.max(element.scrollHeight, 100)}px`;
      resizeFrameRef.current = null;
    });
  }

  function handleChipClick(chip: string) {
    setQuery(chip);
    const inferredCompany = resolveCompanyContext(chip);
    if (!company.trim() && inferredCompany) {
      setCompany(inferredCompany.companyName);
    }
    if (textareaRef.current) {
      textareaRef.current.value = chip;
      scheduleTextareaResize(textareaRef.current);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!query.trim() || loading) {
      return;
    }

    const requestedCompany = resolveCompanyContext(company, query);
    if (!requestedCompany) {
      const requestedLabel = getRequestedCompanyLabel(company, query);
      setError(`No role intelligence available for ${requestedLabel}. Run OrgOS analysis first.`);
      setAnswer("");
      setReportUrl("");
      setRoleMap(null);
      setSource(null);
      setSelectedRoleId(null);
      return;
    }

    setLoading(true);
    setError("");
    setSelectedRoleId(null);
    setActiveCompanyName(requestedCompany.companyName);

    try {
      const response = await fetch("/api/orgos", {
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
      });

      const data = (await response.json()) as ApiResponse;
      if (!response.ok) {
        throw new Error(data.error || "Unable to reach OrgOS.");
      }

      if (data.companyId !== requestedCompany.companyId) {
        throw new Error("Data mismatch - please retry");
      }

      const nextAnswer = (data.answer || "").trim();
      const nextRoleMap = data.roleMap || buildRoleMap(parseRoleConnections(nextAnswer));

      setAnswer(nextAnswer);
      setReportUrl(data.reportUrl || "");
      setSource(data.source || "live");
      setRoleMap(nextRoleMap);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Something went wrong.";
      setError(message);
      setAnswer("");
      setReportUrl("");
      setSource(null);
      setRoleMap(null);
      setSelectedRoleId(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="bg-bg text-text">
      <nav className="h-14 border-b border-border bg-surface">
        <div className="mx-auto flex h-full max-w-[860px] items-center justify-between px-6">
          <span className="font-display text-[20px] text-primary">OrgOS</span>
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
            Understand how roles need to evolve. Powered by live intelligence and your organizational context.
          </p>

          <form onSubmit={handleSubmit} className="mt-10">
            <div className="mb-5">
              <label htmlFor="company" className="mb-1.5 block text-[13px] text-muted">
                Company
              </label>
              <input
                id="company"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                placeholder="e.g. Figma, Deloitte, Infosys"
                className="w-full rounded-[6px] border border-border bg-surface px-4 py-3 text-[15px] text-text outline-none transition focus:border-primary focus:shadow-[0_0_0_3px_rgba(27,79,114,0.1)]"
              />
            </div>

            <div>
              <label htmlFor="query" className="mb-1.5 block text-[13px] text-muted">
                Your question
              </label>
              <textarea
                id="query"
                ref={textareaRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  scheduleTextareaResize(event.target);
                }}
                placeholder="e.g. What are the top 3 future roles in the Design team? Show me change risks at this org."
                className="min-h-[100px] w-full resize-none rounded-[6px] border border-border bg-surface px-4 py-3 text-[15px] text-text outline-none transition focus:border-primary focus:shadow-[0_0_0_3px_rgba(27,79,114,0.1)]"
              />
            </div>

            <div className="chip-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
              {suggestionChips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleChipClick(chip)}
                  className="whitespace-nowrap rounded-full border border-border bg-surface px-3.5 py-2 text-[13px] text-muted transition hover:border-primary hover:text-primary"
                >
                  {chip}
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-5 inline-flex rounded-[6px] border-none bg-primary px-7 py-3 text-[15px] font-medium text-white transition duration-150 ease-out hover:-translate-y-px hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70"
            >
              Ask OrgOS
            </button>
          </form>

          {error ? <p className="mt-4 text-[14px] text-primary">{error}</p> : null}

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
              <p className="text-[14px] italic text-muted">Analyzing {activeCompanyName || "this company"}...</p>
            </section>
          ) : null}

          {!loading && answer ? (
            <section className="fade-in mt-8 rounded-[6px] border border-border border-l-[3px] border-l-primary bg-surface px-8 py-7 shadow-[0_1px_3px_rgba(28,25,23,0.08)]">
              <AnswerContent answer={answer} />
              <div className="my-6 border-t border-border" />
              {reportUrl ? (
                <a
                  href={reportUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-[6px] border border-primary bg-transparent px-5 py-2.5 text-[14px] text-primary transition hover:bg-[rgba(27,79,114,0.05)]"
                >
                  Get Full Report
                </a>
              ) : (
                <button
                  type="button"
                  className="inline-flex rounded-[6px] border border-primary bg-transparent px-5 py-2.5 text-[14px] text-primary transition hover:bg-[rgba(27,79,114,0.05)]"
                >
                  Get Full Report
                </button>
              )}
              {source ? <p className="mt-3 text-[12px] text-muted">Source: {source === "live" ? "Live intelligence" : "Sample fallback"}</p> : null}
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

        <footer className="mt-20 flex items-center justify-between border-t border-border py-8 text-[13px] text-muted max-sm:flex-col max-sm:items-start max-sm:gap-3">
          <span>OrgOS by EvolutionOS</span>
          <a href="https://careeros-supriya.vercel.app/" target="_blank" rel="noreferrer" className="text-primary">
            {"-> Try CareerOS"}
          </a>
        </footer>
      </div>
    </main>
  );
}
