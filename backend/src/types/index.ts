// ─── GitHub Webhook Payloads ────────────────────────────────────────────────

export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  default_branch: string;
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  state: string;
  draft: boolean;
  user: GitHubUser;
  head: { ref: string; sha: string };
  base: { ref: string; sha: string; repo: GitHubRepo };
  diff_url: string;
  html_url: string;
  additions: number;
  deletions: number;
  changed_files: number;
}

export interface GitHubInstallation {
  id: number;
  account: GitHubUser;
}

export interface PullRequestWebhookPayload {
  action: 'opened' | 'closed' | 'synchronize' | 'reopened' | 'edited' | 'ready_for_review';
  number: number;
  pull_request: GitHubPullRequest;
  repository: GitHubRepo;
  installation: GitHubInstallation;
}

export interface InstallationWebhookPayload {
  action: 'created' | 'deleted' | 'suspend' | 'unsuspend';
  installation: GitHubInstallation;
  repositories?: Array<{ full_name: string }>;
}

// ─── PR Details (fetched from GitHub API) ───────────────────────────────────

export interface PRDetails {
  title: string;
  author: string;
  authorAvatar: string;
  baseBranch: string;
  headBranch: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  htmlUrl: string;
}

export interface PRFile {
  filename: string;
  status: 'added' | 'removed' | 'modified' | 'renamed';
  additions: number;
  deletions: number;
  patch?: string;
}

// ─── AI Review ───────────────────────────────────────────────────────────────

export type CommentSeverity = 'error' | 'warning' | 'suggestion';

export interface ReviewComment {
  path: string;
  line: number;
  severity: CommentSeverity;
  comment: string;
  suggestion: string | null;
}

export interface AIReviewResult {
  score: number;
  summary: string;
  positives: string[];
  comments: ReviewComment[];
  processingMs: number;
  aiModel: string;
  tokensUsed?: number;
}

// ─── Queue Job ───────────────────────────────────────────────────────────────

export interface ReviewJobData {
  repoFullName: string;
  prNumber: number;
  prTitle: string;
  prAuthor: string;
  installationId: number;
  diffUrl: string;
  deliveryId: string;
  action: string;
}

// ─── API Responses ───────────────────────────────────────────────────────────

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}

export interface DashboardStats {
  totalReviews: number;
  avgScore: number;
  totalComments: number;
  totalErrors: number;
  recentActivity: Array<{ _id: string; count: number; avgScore: number }>;
  queue: QueueStats;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}