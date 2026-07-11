const { GoogleGenAI } = require('@google/genai');

// Uses the same model family you already know from TrustHire.
const MODEL = 'gemini-2.5-flash';

let client = null;
function getClient() {
  if (!client) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not set in .env');
    }
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return client;
}

/**
 * Given the structured header checks from analyzeHeaders(), ask Gemini
 * for a short, prioritized, plain-English fix plan a developer can act on.
 * Falls back to a rule-based summary if the API call fails, so the feature
 * degrades gracefully instead of breaking the whole scan.
 */
async function generateFixSummary({ url, score, grade, checks }) {
  const failed = checks.filter((c) => c.recommendation !== 'Looks good.');

  if (failed.length === 0) {
    return 'All checked headers are correctly configured. No action needed.';
  }

  const prompt = buildPrompt({ url, score, grade, failed });

  try {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
    });

    const text = response.text?.trim();
    if (!text) throw new Error('Empty response from Gemini');
    return text;
  } catch (err) {
    console.error('Gemini call failed, using fallback summary:', err.message);
    return buildFallbackSummary(failed);
  }
}

function buildPrompt({ url, score, grade, failed }) {
  const issueList = failed
    .map((c) => `- ${c.name} (${c.severity}): ${c.recommendation}`)
    .join('\n');

  return `You are a security engineer helping a developer fix HTTP header
issues on their website "${url}" (score ${score}/100, grade ${grade}).

Missing/misconfigured headers:
${issueList}

Write a short, prioritized fix plan (max 5 bullet points, plain English,
no headers/markdown titles). Order by severity (high first). For each
point, give the one-line fix and, if relevant, a one-line code snippet
for Express.js (e.g. using the "helmet" npm package). Keep the whole
response under 150 words. Do not repeat the raw header names verbatim as
a list — synthesize them into actionable advice.`;
}

// Simple deterministic fallback if Gemini is unreachable/quota-limited,
// so the feature never hard-fails the user's scan.
function buildFallbackSummary(failed) {
  const bySeverity = { high: [], medium: [], low: [] };
  failed.forEach((c) => bySeverity[c.severity].push(c));

  const lines = [];
  ['high', 'medium', 'low'].forEach((sev) => {
    bySeverity[sev].forEach((c) => {
      lines.push(`[${sev.toUpperCase()}] ${c.recommendation}`);
    });
  });

  return `AI summary unavailable, showing rule-based priority list instead:\n${lines.join('\n')}`;
}

module.exports = { generateFixSummary };
