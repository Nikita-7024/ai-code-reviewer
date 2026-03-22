import { App } from '@octokit/app';
import { Octokit } from '@octokit/rest';
import { PRDetails, PRFile, AIReviewResult, CommentSeverity } from '../types';

let githubApp: App | null = null;

function getApp(): App {
  if (!githubApp) {
    const appId = process.env.GITHUB_APP_ID;
    const rawKey = process.env.GITHUB_PRIVATE_KEY;
    if (!appId || !rawKey) throw new Error('GITHUB_APP_ID and GITHUB_PRIVATE_KEY are required');

    const privateKey = rawKey.replace(/\\n/g, '\n');

    githubApp = new App({
      appId,
      privateKey,
      webhooks: { secret: process.env.GITHUB_WEBHOOK_SECRET ?? '' },
    });
  }
  return githubApp;
}

/**
 * Returns an Octokit REST client authenticated for a specific installation.
 * @octokit/app v14 returns its own Octokit type — we use @octokit/rest directly instead.
 */
export async function getInstallationOctokit(installationId: number): Promise<Octokit> {
  const app = getApp();

  // Get installation token from the App
  const { data: { token } } = await app.octokit.request(
    'POST /app/installations/{installation_id}/access_tokens',
    { installation_id: installationId }
  );

  // Create a fresh @octokit/rest client with the installation token
  return new Octokit({ auth: token });
}

export async function getPRDiff(
  octokit: Octokit,
  owner: string,
  repo: string,
  pull_number: number
): Promise<string> {
  const response = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number,
    mediaType: { format: 'diff' },
  });
  return typeof response.data === 'string' ? response.data : String(response.data);
}

export async function getPRDetails(
  octokit: Octokit,
  owner: string,
  repo: string,
  pull_number: number
): Promise<PRDetails> {
  const { data } = await octokit.rest.pulls.get({ owner, repo, pull_number });
  return {
    title: data.title,
    author: data.user?.login ?? 'unknown',
    authorAvatar: data.user?.avatar_url ?? '',
    baseBranch: data.base.ref,
    headBranch: data.head.ref,
    additions: data.additions ?? 0,
    deletions: data.deletions ?? 0,
    changedFiles: data.changed_files ?? 0,
    htmlUrl: data.html_url,
  };
}

export async function getPRFiles(
  octokit: Octokit,
  owner: string,
  repo: string,
  pull_number: number
): Promise<PRFile[]> {
  const { data } = await octokit.rest.pulls.listFiles({
    owner,
    repo,
    pull_number,
    per_page: 30,
  });
  return data.map((f) => ({
    filename: f.filename,
    status: f.status as PRFile['status'],
    additions: f.additions,
    deletions: f.deletions,
    patch: f.patch,
  }));
}

export async function postReview(
  octokit: Octokit,
  owner: string,
  repo: string,
  pull_number: number,
  review: AIReviewResult
): Promise<number | undefined> {
  const reviewComments = review.comments
    .filter((c) => c.path && c.line > 0)
    .map((c) => ({
      path: c.path,
      line: c.line,
      side: 'RIGHT' as const,
      body: formatComment(c.severity, c.comment, c.suggestion),
    }));

  const body = buildReviewBody(review);
  const event = review.score >= 7 ? ('COMMENT' as const) : ('REQUEST_CHANGES' as const);

  try {
    const { data } = await octokit.rest.pulls.createReview({
      owner,
      repo,
      pull_number,
      event,
      body,
      comments: reviewComments,
    });
    console.log(`[GitHub] Posted review ${data.id} on PR #${pull_number}`);
    return data.id;
  } catch (err) {
    console.warn('[GitHub] Inline review failed, falling back to comment:', (err as Error).message);
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: pull_number,
      body: body + '\n\n> ⚠️  Inline comments unavailable — line numbers may have shifted.',
    });
    return undefined;
  }
}

function formatComment(severity: CommentSeverity, comment: string, suggestion: string | null): string {
  const emoji: Record<CommentSeverity, string> = {
    error: '🔴',
    warning: '🟡',
    suggestion: '🔵',
  };
  let body = `${emoji[severity]} **${severity.toUpperCase()}**\n\n${comment}`;
  if (suggestion) {
    body += `\n\n**Suggested fix:**\n\`\`\`suggestion\n${suggestion}\n\`\`\``;
  }
  return body;
}

function buildReviewBody(review: AIReviewResult): string {
  const filled = Math.round(review.score);
  const scoreBar = '█'.repeat(filled) + '░'.repeat(10 - filled);
  const scoreEmoji = review.score >= 8 ? '🟢' : review.score >= 6 ? '🟡' : '🔴';

  const errors = review.comments.filter((c) => c.severity === 'error').length;
  const warnings = review.comments.filter((c) => c.severity === 'warning').length;
  const suggestions = review.comments.filter((c) => c.severity === 'suggestion').length;

  let body = `## 🤖 AI Code Review\n\n`;
  body += `**Quality Score:** ${scoreEmoji} ${review.score}/10  \`${scoreBar}\`\n\n`;
  body += `### Summary\n${review.summary}\n\n`;

  if (review.positives.length > 0) {
    body += `### ✅ What's good\n`;
    review.positives.forEach((p) => (body += `- ${p}\n`));
    body += '\n';
  }

  body += `### Issues found\n`;
  body += `| Severity | Count |\n|---|---|\n`;
  body += `| 🔴 Errors | **${errors}** |\n`;
  body += `| 🟡 Warnings | **${warnings}** |\n`;
  body += `| 🔵 Suggestions | **${suggestions}** |\n\n`;
  body += `---\n*Reviewed by AI Code Reviewer · ${review.aiModel} · ${review.processingMs}ms*`;

  return body;
}