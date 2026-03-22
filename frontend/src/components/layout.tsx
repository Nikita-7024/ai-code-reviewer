import { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

interface LayoutProps { children: ReactNode }

export default function Layout({ children }: LayoutProps) {
  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg)' }}>
      <aside style={{ width:220, minWidth:220, background:'var(--bg2)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', position:'sticky', top:0, height:'100vh' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'20px 16px 16px', borderBottom:'1px solid var(--border)' }}>
          <div style={{ width:36, height:36, borderRadius:8, background:'var(--blue-bg)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--blue)', flexShrink:0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/>
            </svg>
          </div>
          <div>
            <div style={{ fontWeight:600, fontSize:14, color:'var(--text)', lineHeight:1.2 }}>AI Reviewer</div>
            <div style={{ fontSize:11, color:'var(--text3)' }}>Code Review Assistant</div>
          </div>
        </div>
        <nav style={{ display:'flex', flexDirection:'column', gap:2, padding:'12px 8px', flex:1 }}>
          {[{ to:'/', label:'Dashboard', exact:true }, { to:'/reviews', label:'Reviews', exact:false }].map(({ to, label, exact }) => (
            <NavLink key={to} to={to} end={exact} style={({ isActive }) => ({
              display:'flex', alignItems:'center', gap:8, padding:'8px 10px',
              borderRadius:'var(--radius)', textDecoration:'none', fontSize:13,
              color: isActive ? 'var(--text)' : 'var(--text2)',
              background: isActive ? 'var(--bg3)' : 'transparent',
              fontWeight: isActive ? 500 : 400,
            })}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div style={{ padding:'12px 16px', borderTop:'1px solid var(--border)' }}>
          <div style={{ fontSize:11, color:'var(--text3)', marginBottom:6 }}>Stack</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
            {['Node.js','MongoDB','Redis','GPT-4o'].map(t => (
              <span key={t} style={{ fontSize:10, padding:'2px 6px', borderRadius:10, background:'var(--bg3)', color:'var(--text3)', border:'1px solid var(--border)' }}>{t}</span>
            ))}
          </div>
        </div>
      </aside>
      <main style={{ flex:1, overflow:'auto', minWidth:0 }}>
        <div style={{ maxWidth:1100, margin:'0 auto', padding:'28px 24px' }}>{children}</div>
      </main>
    </div>
  )
}