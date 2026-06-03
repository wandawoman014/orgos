import { NextRequest, NextResponse } from "next/server";

type OrgOSApiResponse = {
  answer: string;
  reportUrl?: string;
  source: "live" | "mock";
};

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

const normalizeWebhookText = (payload: unknown): { answer: string; reportUrl?: string } => {
  if (typeof payload === "string") {
    return { answer: payload };
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { answer: "Webhook response was empty." };
  }

  const record = payload as Record<string, unknown>;
  const answer = [
    record.answer,
    record.text,
    record.message,
    record.output,
    record.response,
    typeof record.body === "object" && record.body !== null ? (record.body as Record<string, unknown>).answer : undefined,
  ].find((value) => typeof value === "string" && value.trim().length > 0) as string | undefined;

  const reportUrl = [record.report_url, record.reportUrl, record.url, record.report].find(
    (value) => typeof value === "string" && value.trim().length > 0,
  ) as string | undefined;

  return {
    answer: answer?.trim() || "Webhook returned JSON without answer text.",
    ...(reportUrl ? { reportUrl } : {}),
  };
};

export async function POST(req: NextRequest) {
  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const query = typeof payload.query === "string" ? payload.query.trim() : typeof payload.question === "string" ? payload.question.trim() : "";
  const company = typeof payload.company === "string" ? payload.company.trim() : typeof payload.company_name === "string" ? payload.company_name.trim() : "";

  if (!query) {
    return NextResponse.json({ error: "Query cannot be blank." }, { status: 400 });
  }

  const webhookUrl = (process.env.WEBHOOK_URL || process.env.MAKE_WEBHOOK_URL || "").trim();
  if (!webhookUrl) {
    const response: OrgOSApiResponse = {
      answer: fallbackAnswer(company, query),
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
        company,
        mode: "org",
      }),
      signal: AbortSignal.timeout(30000),
    });

    const responseText = await webhookResponse.text();
    const parsed = safeParseJson(responseText);
    const normalized = parsed === null ? { answer: responseText.trim() || fallbackAnswer(company, query) } : normalizeWebhookText(parsed);

    if (!webhookResponse.ok) {
      return NextResponse.json(
        {
          answer: normalized.answer || fallbackAnswer(company, query),
          ...(normalized.reportUrl ? { reportUrl: normalized.reportUrl } : {}),
          source: "live",
        },
        { status: 200 },
      );
    }

    const response: OrgOSApiResponse = {
      answer: normalized.answer || fallbackAnswer(company, query),
      ...(normalized.reportUrl ? { reportUrl: normalized.reportUrl } : {}),
      source: "live",
    };

    return NextResponse.json(response);
  } catch {
    const response: OrgOSApiResponse = {
      answer: fallbackAnswer(company, query),
      source: "mock",
    };

    return NextResponse.json(response);
  }
}
