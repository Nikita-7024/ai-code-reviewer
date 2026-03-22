export type CommentSeverity = 'error' | 'warning' | 'suggestion'
export type ReviewStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'skipped'

export interface ReviewComment {
  path: string
  line: number
  severity: CommentSeverity
  comment: string
  suggestion: string | null
}

export interface IssueCount {
  errors: number
  warnings: number
  suggestions: number
  total: number
}

export interface Review {
  _id: string
  repoFullName: string
  owner: string
  repo: string
  prNumber: number
  prTitle: string
  prAuthor: string
  prAuthorAvatar: string
  prUrl: string
  headBranch: string
  baseBranch: string
  additions: number
  deletions: number
  changedFiles: number
  score: number
  summary: string
  positives: string[]
  comments: ReviewComment[]
  processingMs: number
  aiModel: string
  tokensUsed?: number
  status: ReviewStatus
  errorMessage?: string
  createdAt: string
  updatedAt: string
  issueCount: IssueCount
}

export interface DashboardStats {
  totalReviews: number
  avgScore: number
  totalComments: number
  totalErrors: number
  recentActivity: Array<{ _id: string; count: number; avgScore: number }>
  queue: { waiting: number; active: number; completed: number; failed: number }
}

export interface Pagination {
  page: number
  limit: number
  total: number
  pages: number
}

export interface ReviewsResponse {
  reviews: Review[]
  pagination: Pagination
}

export interface RepoSummary {
  repoFullName: string
  owner: string
  repo: string
  totalReviews: number
  avgScore: number
  lastReviewAt: string
}