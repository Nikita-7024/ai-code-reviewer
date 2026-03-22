import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import type { Review, ReviewComment } from '../types'
import { ScoreBadge, Spinner } from './dashboard'

const card: React.CSSProperties = { background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'16px 18px' }
const cardTitle: React.CSSProperties = { fontSize:14, fontWeight:500, color:'var(--text)', marginBottom:12 }

export default function ReviewDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [review, setReview] = useState<Review | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeFile, setActiveFile] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    api.getReview(id)
      .then(r => { setReview(r); if (r.comments.length > 0) setActiveFile(r.comments[0].path) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <Spinner />
  if (!review) return (
    <div style={{ textAlign:'center', padding:60, color:'var(--text3)' }}>
      Review not found. <button onClick={() => navigate('/reviews')} style={{ background:'none', border:'none', color:'var(--blue)', cursor:'pointer', fontSize:13 }}>Go back</button>
    </div>
  )

  const byFile = review.comments.reduce<Record<string,ReviewComment[]>>((acc,c) => {
    ;(acc[c.path] ??= []).push(c); return acc
  }, {})
  const files = Object.keys(byFile)

  return (
    <div>
      <button onClick={() => navigate('/reviews')} style={{ background:'none', border:'none', color:'var(--blue)', fontSize:13, cursor:'pointer', marginBottom:16 }}>← Back to Reviews</button>

      <div style={{ ...card, marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:14 }}>
          <ScoreBadge score={review.score} />
          <div style={{ flex:1, minWidth:0 }}>
            <h2 style={{ fontSize:17, fontWeight:600, color:'var(--text)', marginBottom:6 }}>{review.prTitle}</h2>
            <div style={{ display:'flex', flexWrap:'wrap', gap:12, color:'var(--text2)', fontSize:12 }}>
              <span>Repo: <span style={{ color:'var(--text)' }}>{review.repoFullName}</span></span>
              <span>PR: <a href={review.prUrl} target="_blank" rel="noreferrer" style={{ color:'var(--blue)' }}>#{review.prNumber}</a></span>
              <span>Author: <span style={{ color:'var(--text)' }}>{review.prAuthor}</span></span>
              <span style={{ color:'var(--purple)' }}>{review.headBranch} → {review.baseBranch}</span>
            </div>
          </div>
          <div style={{ display:'flex', gap:6, flexShrink:0 }}>
            {[{l:`+${review.additions}`,c:'var(--green)'},{l:`-${review.deletions}`,c:'var(--red)'},{l:`${review.changedFiles} files`,c:'var(--text2)'}].map(({l,c})=>(
              <span key={l} style={{ fontSize:12, padding:'3px 8px', borderRadius:'var(--radius)', background:'var(--bg3)', border:'1px solid var(--border)', color:c }}>{l}</span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
        <div style={card}>
          <div style={cardTitle}>Summary</div>
          <p style={{ color:'var(--text2)', fontSize:13, lineHeight:1.7 }}>{review.summary}</p>
          {review.positives.length > 0 && (
            <div style={{ marginTop:12 }}>
              <div style={{ fontSize:12, color:'var(--green)', fontWeight:500, marginBottom:6 }}>✓ What&apos;s good</div>
              {review.positives.map((p,i) => <div key={i} style={{ fontSize:12, color:'var(--text2)', padding:'3px 0' }}>• {p}</div>)}
            </div>
          )}
        </div>
        <div style={card}>
          <div style={cardTitle}>Issue Breakdown</div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[
              { label:'Errors', count: review.issueCount?.errors ?? 0, color:'var(--red)', bg:'var(--red-bg)' },
              { label:'Warnings', count: review.issueCount?.warnings ?? 0, color:'var(--yellow)', bg:'var(--yellow-bg)' },
              { label:'Suggestions', count: review.issueCount?.suggestions ?? 0, color:'var(--blue)', bg:'var(--blue-bg)' },
            ].map(({ label, count, color, bg }) => (
              <div key={label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span style={{ color:'var(--text2)', fontSize:13 }}>{label}</span>
                <span style={{ background:bg, color, padding:'2px 10px', borderRadius:10, fontSize:13, fontWeight:600 }}>{count}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop:14, paddingTop:12, borderTop:'1px solid var(--border)' }}>
            {[['Model', review.aiModel],['Tokens', String(review.tokensUsed ?? '—')],['Time', `${review.processingMs}ms`]].map(([k,v]) => (
              <div key={k} style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                <span style={{ color:'var(--text3)' }}>{k}</span>
                <span style={{ color:'var(--text2)', fontFamily:'monospace' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {review.comments.length === 0 ? (
        <div style={{ ...card, textAlign:'center', color:'var(--green)', padding:32 }}>✓ No issues found — this PR looks great!</div>
      ) : (
        <div style={card}>
          <div style={cardTitle}>Inline Comments ({review.comments.length})</div>
          {files.length > 1 && (
            <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:14 }}>
              {files.map(f => (
                <button key={f} onClick={() => setActiveFile(f)}
                  style={{ background: activeFile===f ? 'var(--bg4)' : 'var(--bg3)', border:`1px solid ${activeFile===f ? 'var(--border2)' : 'var(--border)'}`, borderRadius:'var(--radius)', color: activeFile===f ? 'var(--text)' : 'var(--text2)', padding:'4px 10px', fontSize:12, cursor:'pointer' }}>
                  {f.split('/').pop()} ({byFile[f].length})
                </button>
              ))}
            </div>
          )}
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {(byFile[activeFile ?? files[0]] ?? []).map((c,i) => {
              const sev = { error:{ color:'var(--red)', bg:'var(--red-bg)', label:'ERROR' }, warning:{ color:'var(--yellow)', bg:'var(--yellow-bg)', label:'WARNING' }, suggestion:{ color:'var(--blue)', bg:'var(--blue-bg)', label:'SUGGESTION' } }[c.severity]
              return (
                <div key={i} style={{ border:'1px solid var(--border)', borderRadius:'var(--radius)', overflow:'hidden' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 12px', background:'var(--bg3)', borderBottom:'1px solid var(--border)' }}>
                    <span style={{ background:sev.bg, color:sev.color, fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:4 }}>{sev.label}</span>
                    <span style={{ fontFamily:'monospace', fontSize:12, color:'var(--text2)' }}>{c.path}</span>
                    <span style={{ color:'var(--text3)', fontSize:12, marginLeft:'auto' }}>Line {c.line}</span>
                  </div>
                  <div style={{ padding:'10px 12px' }}>
                    <p style={{ color:'var(--text)', fontSize:13, lineHeight:1.6, marginBottom: c.suggestion ? 10 : 0 }}>{c.comment}</p>
                    {c.suggestion && (
                      <div style={{ background:'var(--bg)', borderRadius:'var(--radius)', border:'1px solid var(--border)', overflow:'hidden', marginTop:8 }}>
                        <div style={{ padding:'4px 10px', background:'var(--green-bg)', borderBottom:'1px solid var(--border)', fontSize:11, color:'var(--green)', fontWeight:500 }}>Suggested fix</div>
                        <pre style={{ padding:'10px 12px', fontSize:12, color:'var(--green)', overflowX:'auto', margin:0, lineHeight:1.6 }}>{c.suggestion}</pre>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}