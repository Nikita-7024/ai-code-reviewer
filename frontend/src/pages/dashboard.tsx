import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { api } from '../services/api'
import type { DashboardStats, Review } from '../types'

export function ScoreBadge({ score }: { score: number }) {
  const color = score >= 8 ? 'var(--green)' : score >= 6 ? 'var(--yellow)' : 'var(--red)'
  const bg = score >= 8 ? 'var(--green-bg)' : score >= 6 ? 'var(--yellow-bg)' : 'var(--red-bg)'
  return (
    <div style={{ width:36, height:36, borderRadius:8, background:bg, color, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:14, flexShrink:0 }}>
      {score}
    </div>
  )
}

export function Spinner() {
  return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:200, color:'var(--text3)', fontSize:13 }}>Loading...</div>
}

export function Empty({ text }: { text: string }) {
  return <div style={{ padding:'32px 0', textAlign:'center', color:'var(--text3)', fontSize:13 }}>{text}</div>
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const card: React.CSSProperties = { background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'16px 18px' }
const cardTitle: React.CSSProperties = { fontSize:14, fontWeight:500, color:'var(--text)', marginBottom:12 }

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recent, setRecent] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([api.getStats(), api.getReviews({ limit: 5 })])
      .then(([s, r]) => { setStats(s); setRecent(r.reviews) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />

  return (
    <div>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:22, fontWeight:600, color:'var(--text)', marginBottom:4 }}>Dashboard</h1>
        <p style={{ color:'var(--text2)', fontSize:13 }}>AI-powered code reviews across all your repositories</p>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:24 }}>
        {[
          { label:'Total Reviews', value: stats?.totalReviews ?? 0, color:'var(--blue)' },
          { label:'Avg Score', value:`${stats?.avgScore ?? 0}/10`, color:'var(--green)' },
          { label:'Issues Found', value: stats?.totalComments ?? 0, color:'var(--yellow)' },
          { label:'Errors Caught', value: stats?.totalErrors ?? 0, color:'var(--red)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'16px 18px' }}>
            <div style={{ fontSize:12, color:'var(--text2)', marginBottom:6 }}>{label}</div>
            <div style={{ fontSize:26, fontWeight:600, color }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:24 }}>
        <div style={card}>
          <div style={cardTitle}>Reviews (last 7 days)</div>
          {stats && stats.recentActivity.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={stats.recentActivity} margin={{ top:4, right:4, left:-20, bottom:0 }}>
                <XAxis dataKey="_id" tick={{ fontSize:11, fill:'var(--text3)' }} tickLine={false} axisLine={false} tickFormatter={(v:string) => v.slice(5)} />
                <YAxis tick={{ fontSize:11, fill:'var(--text3)' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:6, fontSize:12 }} labelStyle={{ color:'var(--text2)' }} itemStyle={{ color:'var(--blue)' }} />
                <Bar dataKey="count" radius={[4,4,0,0]}>
                  {stats.recentActivity.map((_,i) => <Cell key={i} fill="var(--blue)" fillOpacity={0.75} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty text="No reviews yet — open a PR on a connected repo" />}
        </div>

        <div style={card}>
          <div style={cardTitle}>Queue Status</div>
          {stats && (
            <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:8 }}>
              {[
                { label:'Waiting', value:stats.queue.waiting, color:'var(--yellow)' },
                { label:'Active', value:stats.queue.active, color:'var(--blue)' },
                { label:'Completed', value:stats.queue.completed, color:'var(--green)' },
                { label:'Failed', value:stats.queue.failed, color:'var(--red)' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ color:'var(--text2)', fontSize:13 }}>{label}</span>
                  <span style={{ color, fontWeight:600, fontSize:15 }}>{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={card}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <div style={cardTitle}>Recent Reviews</div>
          <button onClick={() => navigate('/reviews')} style={{ background:'none', border:'none', color:'var(--blue)', fontSize:12, cursor:'pointer' }}>View all →</button>
        </div>
        {recent.length === 0 ? <Empty text="No reviews yet — connect a GitHub repo to get started" /> : (
          recent.map((r, i) => (
            <div key={r._id} onClick={() => navigate(`/reviews/${r._id}`)}
              style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', cursor:'pointer', borderTop: i===0 ? 'none' : '1px solid var(--border)' }}>
              <ScoreBadge score={r.score} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ color:'var(--text)', fontSize:13, fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{r.prTitle}</div>
                <div style={{ color:'var(--text3)', fontSize:12, marginTop:2 }}>{r.repoFullName} · PR #{r.prNumber} · {r.prAuthor}</div>
              </div>
              <div style={{ color:'var(--text3)', fontSize:12 }}>{timeAgo(r.createdAt)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}