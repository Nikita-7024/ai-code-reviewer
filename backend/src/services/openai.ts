import OpenAI from 'openai';
import { AIReviewResult, PRDetails, PRFile } from '../types';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set');
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

// GPT-4o context window ≈ 128k tokens (~4 chars/token) = ~512k chars
// We leave headroom for the system prompt and response
const MAX_DIFF_CHARS = 80_000;

export async function reviewPullRequest(
  diff: string,
  files: PRFile[],
  prDetails: PRDetails
): Promise<AIReviewResult> {
  const openai = getClient();

  const truncated = diff.length > MAX_DIFF_CHARS;
  const diffToSend = truncated
    ? diff.substring(0, MAX_DIFF_CHARS) + '\n\n[... diff truncated due to size ...]'
    : diff;

  const fileSummary = files
    .map((f) => `${f.status.padEnd(8)} ${f.filename}  (+${f.additions}/-${f.deletions})`)
    .join('\n');

  const prompt = buildPrompt(diffToSend, fileSummary, prDetails, truncated);

  console.log(
    `[OpenAI] Reviewing PR "${prDetails.title}" — diff ${diff.length.toLocaleString()} chars, ${files.length} files`
  );

  const start = Date.now();

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: [
          'You are a senior software engineer doing a code review.',
          'Focus on: bugs, security, performance, maintainability.',
          'Never comment on formatting, style, or whitespace — that is linters job.',
          'Be specific and actionable. Provide corrected code where possible.',
          'Always respond with valid JSON only. No markdown outside the JSON.',
        ].join('\n'),
      },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' }, // Guarantees valid JSON — no regex parsing
    temperature: 0.2, // Low temperature = consistent, deterministic reviews
    max_tokens: 4_000,
  });

  const elapsed = Date.now() - start;
  console.log(`[OpenAI] Done in ${elapsed}ms — ${response.usage?.total_tokens} tokens used`);

  const raw = response.choices[0]?.message?.content ?? '{}';

  let parsed: AIReviewResult;
  try {
    parsed = JSON.parse(raw) as AIReviewResult;
  } catch {
    throw new Error(`OpenAI returned invalid JSON: ${raw.substring(0, 300)}`);
  }

  // Validate and clamp score (defensive — AI can sometimes drift)
  parsed.score = Math.max(1, Math.min(10, Math.round(parsed.score ?? 5)));
  parsed.comments = (parsed.comments ?? []).filter((c) => c.path && c.line);
  parsed.positives = parsed.positives ?? [];

  return {
    ...parsed,
    processingMs: elapsed,
    aiModel: response.model,
    tokensUsed: response.usage?.total_tokens,
  };
}

function buildPrompt(
  diff: string,
  fileSummary: string,
  pr: PRDetails,
  truncated: boolean
): string {
  return `Review this pull request and return a JSON object.

## PR Info
Title: ${pr.title}
Author: ${pr.author}
Branch: ${pr.headBranch} → ${pr.baseBranch}
Changes: ${pr.changedFiles} files  +${pr.additions}/-${pr.deletions} lines
${truncated ? '⚠️  Diff was truncated — focus on what is shown\n' : ''}
## Files Changed
\`\`\`
${fileSummary}
\`\`\`

## Diff
\`\`\`diff
${diff}
\`\`\`

## Return this exact JSON structure
{
  "score": <integer 1–10>,
  "summary": "<2–3 sentence overall assessment>",
  "positives": ["<strength>", "<another strength>"],
  "comments": [
    {
      "path": "<file path as shown in diff>",
      "line": <line number in new file, integer>,
      "severity": "<error | warning | suggestion>",
      "comment": "<clear explanation of the issue and why it matters>",
      "suggestion": "<corrected code snippet, or null>"
    }
  ]
}

## Severity guide
- error      → bug, security hole, crash risk, data loss
- warning    → performance issue, bad pattern, missing edge case
- suggestion → code quality, readability, better approach

## Score guide
10 = ship it  |  7-9 = minor fixes  |  4-6 = needs work  |  1-3 = major rework

## Review checklist
✓ Null/undefined handling       ✓ Input validation
✓ SQL injection / XSS / auth    ✓ Error handling & edge cases
✓ N+1 queries / memory leaks    ✓ Race conditions / async issues

## Do NOT review
✗ Indentation / spacing / formatting
✗ Variable naming preferences
✗ Anything a linter would catch`;
}