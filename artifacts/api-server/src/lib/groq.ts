/**
 * Groq LLM client + AI helpers for the (deterministic) scoring engine's
 * explanation layer. Groq is the chosen provider (OpenAI-compatible API); the
 * models here only ever *explain* an already-computed scorecard — they never
 * compute or alter a score. See CLAUDE.md: the scoring engine stays pure TS.
 */
import Groq from "groq-sdk";
import type { Card } from "../scoring";

// High-quality + cheap, 131K context, supports strict JSON-schema decoding.
// Confirm against Groq's live model list if this ever 404s (Groq churns models).
const MEMO_MODEL = "openai/gpt-oss-120b";

// Lazy so importing this module never touches GROQ_API_KEY — the whole route
// tree (and every route test that imports `app`) transitively imports this
// file, and the Groq constructor throws when the key is unset.
let client: Groq | null = null;
function groq(): Groq {
  if (!client) {
    client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return client;
}

const MEMO_SYSTEM_PROMPT = [
  "You are a credit analyst writing a concise underwriting memo for a lender.",
  "Use ONLY the scorecard data provided in the user message. Do not invent numbers,",
  "and do not recompute, dispute, or second-guess the score — your job is to explain it.",
  "Write 4–6 short paragraphs covering: the overall assessment and rating band; the",
  "strongest pillars and why; the key risks (call out any cross-source consistency alert);",
  "and a repayment-capacity note grounded in the sustainable EMI. Plain prose — no markdown",
  "headers, no bullet lists, no restating the raw JSON.",
].join(" ");

/** Generate a plain-English underwriting memo from a computed scorecard. */
export async function generateCreditMemo(card: Card): Promise<string> {
  const res = await groq().chat.completions.create({
    model: MEMO_MODEL,
    max_tokens: 1200,
    messages: [
      { role: "system", content: MEMO_SYSTEM_PROMPT },
      { role: "user", content: `Scorecard JSON:\n${JSON.stringify(card, null, 2)}` },
    ],
  });
  return res.choices[0]?.message?.content?.trim() ?? "";
}
