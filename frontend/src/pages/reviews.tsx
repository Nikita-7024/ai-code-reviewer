import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import type { Review, Pagination } from '../types'
import { ScoreBadge, Spinner, Empty, timeAgo } from './dashboard'

export default function Reviews() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    setLoading(true)
    api.getReviews({ page, limit:15, status: filter || undefined })
      .then(r => { setReviews(r.reviews); setPagination(r.pagination) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [page, filter])

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:600, color:'var(--text)', marginBottom:4 }}>Reviews</h1>
          <p style={{ color:'var(--text2)', fontSize:13 }}>{pagination ? `${pagination.total} total reviews` : 'All AI code reviews'}</p>
        </div>
        <select value={filter} onChange={e => { setFilter(e.target.value); setPage(1) }}
          style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'var(--radius)', color:'var(--text)', padding:'6px 10px', cursor:'pointer' }}>
          <option value="">All statuses</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 16px', borderBottom:'1px solid var(--border)', fontSize:11, fontWeight:500, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.04em' }}>
          <div style={{ width:52 }}>Score</div>
          <div style={{ flex:1 }}>Pull Request</div>
          <div style={{ width:120 }}>Repository</div>
          <div style={{ width:80, textAlign:'center' }}>Issues</div>
          <div style={{ width:90, textAlign:'right' }}>Time</div>
        </div>

        {loading ? <Spinner /> : reviews.length === 0 ? <Empty text="No reviews found" /> : (
          reviews.map((r, i) => (
            <div key={r._id} onClick={() => navigate(`/reviews/${r._id}`)}
              style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', cursor:'pointer', borderTop: i===0 ? 'none' : '1px solid var(--border)', transition:'background 0.1s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <div style={{ width:52, display:'flex', justifyContent:'center' }}>
                {r.status === 'completed'
                  ? <ScoreBadge score={r.score} />
                  : <div style={{ fontSize:10, padding:'3px 6px', borderRadius:6, background:'var(--yellow-bg)', color:'var(--yellow)', fontWeight:600 }}>{r.status}</div>}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ color:'var(--text)', fontSize:13, fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{r.prTitle}</div>
                <div style={{ color:'var(--text3)', fontSize:12, marginTop:2 }}>PR #{r.prNumber} · {r.prAuthor} <span style={{ color:'var(--purple)', marginLeft:6 }}>{r.headBranch}</span></div>
              </div>
              <div style={{ width:120, color:'var(--text2)', fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.repo}</div>
              <div style={{ width:80, display:'flex', gap:4, justifyContent:'center' }}>
                {(r.issueCount?.errors ?? 0) > 0 && <span style={{ fontSize:10, padding:'1px 5px', borderRadius:4, background:'var(--red-bg)', color:'var(--red)', fontWeight:600 }}>{r.issueCount.errors}E</span>}
                {(r.issueCount?.warnings ?? 0) > 0 && <span style={{ fontSize:10, padding:'1px 5px', borderRadius:4, background:'var(--yellow-bg)', color:'var(--yellow)', fontWeight:600 }}>{r.issueCount.warnings}W</span>}
              </div>
              <div style={{ width:90, color:'var(--text3)', fontSize:12, textAlign:'right' }}>{timeAgo(r.createdAt)}</div>
            </div>
          ))
        )}
      </div>

      {pagination && pagination.pages > 1 && (
        <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:8, marginTop:16 }}>
          <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}
            style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius)', color:'var(--text)', padding:'6px 12px', cursor:'pointer' }}>← Prev</button>
          <span style={{ color:'var(--text2)', fontSize:13 }}>Page {page} of {pagination.pages}</span>
          <button onClick={() => setPage(p => Math.min(pagination.pages,p+1))} disabled={page===pagination.pages}
            style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius)', color:'var(--text)', padding:'6px 12px', cursor:'pointer' }}>Next →</button>
        </div>
      )}
    </div>
  )
}