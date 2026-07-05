// AI narration layer — QUARANTINED to explanation. It only ever puts an
// already-computed, deterministic Scorecard into words; it never recomputes,
// re-ranks, or second-guesses the score. When GROQ_API_KEY is unset it returns
// a deterministic template so the product works with no external dependency.

import type { Scorecard } from "../scoring/score";

const SYSTEM_PROMPT = `You are a credit-memo writer for an MSME lender. You are given a
pre-computed, deterministic credit scorecard. Your ONLY job is to narrate it in clear,
professional language for a loan officer. You MUST NOT invent, recompute, re-rank, or
second-guess any number, band, reason code, or flag. Never suggest a different score.
Only explain the scorecard exactly as given.`;

function templateMemo(sc: Scorecard): string {
  const topReasons = sc.reasons
    .map((r) => `${r.label} (${r.direction})`)
    .join(", ");
  const flagLine = sc.flags.consistencyAlert
    ? ` A cross-source consistency alert was raised: ${sc.flags.detail}`
    : " No cross-source consistency alerts were raised.";
  return (
    `${sc.msmeId} scores ${sc.overallScore}/100 — ${sc.ratingBand}. ` +
    `Confidence is ${sc.confidence.level} (coverage ${sc.confidence.coverageScore}). ` +
    `The most influential adverse factors were: ${topReasons || "none"}.` +
    flagLine +
    ` Suggested sustainable EMI based on projected worst-month cashflow: ₹${sc.repayment.sustainableEmi.toLocaleString("en-IN")}.`
  );
}

export async function narrateScorecard(sc: Scorecard): Promise<string> {
  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) return templateMemo(sc);

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env["GROQ_MODEL"] ?? "llama-3.3-70b-versatile",
        temperature: 0.2,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Narrate this scorecard for a loan officer:\n${JSON.stringify(sc)}`,
          },
        ],
      }),
    });
    if (!res.ok) return templateMemo(sc);
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content?.trim() || templateMemo(sc);
  } catch {
    return templateMemo(sc);
  }
}
