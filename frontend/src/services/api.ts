import type { Review, ReviewsResponse, DashboardStats, RepoSummary } from '../types'

const BASE = import.meta.env.VITE_API_URL ?? ''

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? `HTTP ${res.status}: ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  getStats: (): Promise<DashboardStats> => request<DashboardStats>('/api/reviews/stats'),
  getReviews: (params: { page?: number; limit?: number; repo?: string; status?: string } = {}): Promise<ReviewsResponse> => {
    const q = new URLSearchParams()
    if (params.page)   q.set('page',   String(params.page))
    if (params.limit)  q.set('limit',  String(params.limit))
    if (params.repo)   q.set('repo',   params.repo)
    if (params.status) q.set('status', params.status)
    const qs = q.toString()
    return request<ReviewsResponse>(`/api/reviews${qs ? '?' + qs : ''}`)
  },
  getReview: (id: string): Promise<Review> => request<Review>(`/api/reviews/${id}`),
  getRepos: (): Promise<RepoSummary[]> => request<RepoSummary[]>('/api/repos'),
}