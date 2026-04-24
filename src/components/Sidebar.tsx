import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { artifactClient, ListedRun, Study } from '../services/artifactClient'
import { listActiveStrategies, ActiveStrategySummary } from '../services/activeClient'

type SectionKey = 'runs' | 'active' | 'studies'

const COLLAPSED_W = 52
const EXPANDED_W = 232

export default function Sidebar() {
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>({ runs: true, active: false, studies: false })
  const [runs, setRuns] = useState<ListedRun[]>([])
  const [activeStrats, setActiveStrats] = useState<ActiveStrategySummary[]>([])
  const [studies, setStudies] = useState<Study[]>([])

  const toggle = (k: SectionKey) => setExpanded(prev => ({ ...prev, [k]: !prev[k] }))

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const r = await artifactClient.listRuns()
        if (alive) setRuns(r.slice(0, 20))
      } catch {}
      try {
        const a = await listActiveStrategies()
        if (alive) setActiveStrats(a.filter(s => !s.deleted))
      } catch {}
      try {
        const s = await artifactClient.listStudies()
        if (alive) setStudies(s)
      } catch {}
    }
    load()
    const t = setInterval(load, 15000)
    return () => { alive = false; clearInterval(t) }
  }, [])

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/')

  const w = collapsed ? COLLAPSED_W : EXPANDED_W

  // ── Collapsed icon rail ──
  if (collapsed) {
    return (
      <nav style={{ ...sidebarBase, width: w, minWidth: w }}>
        <button onClick={() => setCollapsed(false)} style={collapseBtn} title="Expand sidebar">☰</button>
        <IconLink to="/runs" icon="📋" title="Runs" active={isActive('/runs') || isActive('/run') || isActive('/results') || isActive('/trades')} />
        <IconLink to="/new" icon="+" title="New Sweep" active={isActive('/new')} />
        <IconLink to="/studies" icon="📚" title="Studies" active={isActive('/studies')} />
        <IconLink to="/active" icon="⚡" title="Active" active={isActive('/active')} />
        <IconLink to="/screener" icon="◇" title="Screener" active={isActive('/screener')} />
        <div style={{ flex: 1 }} />
        <IconLink to="/help/expression-language" icon="?" title="Help" active={isActive('/help')} />
      </nav>
    )
  }

  // ── Expanded full sidebar ──
  return (
    <nav style={{ ...sidebarBase, width: w, minWidth: w }}>
      {/* Collapse toggle */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 6px 4px' }}>
        <button onClick={() => setCollapsed(true)} style={collapseBtn} title="Collapse sidebar">«</button>
      </div>

      {/* Runs accordion */}
      <SectionHeader
        label="Runs" count={runs.length} open={expanded.runs}
        active={isActive('/runs') || isActive('/run') || isActive('/results') || isActive('/trades')}
        onClick={() => toggle('runs')} href="/runs"
      />
      {expanded.runs && (
        <div style={treeStyle}>
          {runs.slice(0, 15).map(r => {
            const runActive = isActive(`/results/${r.id}`) || isActive(`/run/${r.id}`) || isActive(`/trades/${r.id}`)
            return (
              <RunTreeItem key={r.id} run={r} active={runActive} isActive={isActive} />
            )
          })}
          {runs.length === 0 && <div style={{ ...treeItemStyle, opacity: 0.5, fontSize: 11 }}>No runs yet</div>}
        </div>
      )}

      <NavLink to="/new" label="+ New Sweep" active={isActive('/new')} />

      {/* Studies accordion */}
      <SectionHeader
        label="Studies" count={studies.length} open={expanded.studies}
        active={isActive('/studies')} onClick={() => toggle('studies')} href="/studies"
      />
      {expanded.studies && (
        <div style={treeStyle}>
          {studies.slice(0, 15).map(s => {
            const studyActive = isActive(`/studies/${s.study_id}`)
            return (
              <div key={s.study_id} style={treeItemStyle}>
                <Link
                  to={`/studies/${s.study_id}`}
                  style={{ ...treeLinkStyle, color: studyActive ? 'var(--link)' : 'var(--muted)' }}
                  title={s.name}
                >
                  {truncate(s.name, 20)} <span style={{ opacity: 0.5, fontSize: 10 }}>({s.run_count ?? 0})</span>
                </Link>
              </div>
            )
          })}
          {studies.length === 0 && <div style={{ ...treeItemStyle, opacity: 0.5, fontSize: 11 }}>No studies yet</div>}
        </div>
      )}

      {/* Active accordion */}
      <SectionHeader
        label="Active" count={activeStrats.length} open={expanded.active}
        active={isActive('/active')} onClick={() => toggle('active')} href="/active"
      />
      {expanded.active && (
        <div style={treeStyle}>
          {activeStrats.slice(0, 15).map(a => {
            const stratActive = isActive(`/active/${a.active_id}`)
            return (
              <ActiveTreeItem key={a.active_id} strat={a} active={stratActive} isActive={isActive} />
            )
          })}
          {activeStrats.length === 0 && <div style={{ ...treeItemStyle, opacity: 0.5, fontSize: 11 }}>No strategies</div>}
        </div>
      )}

      <NavLink to="/screener" label="◇ Screener" active={isActive('/screener')} />
      <div style={{ flex: 1 }} />
      <NavLink to="/help/expression-language" label="? Help" active={isActive('/help')} />
    </nav>
  )
}

/* ── Sub-components ── */

function RunTreeItem({ run, active, isActive }: {
  run: ListedRun; active: boolean; isActive: (p: string) => boolean
}) {
  const [open, setOpen] = useState(false)
  const id = encodeURIComponent(run.id)
  return (
    <div>
      <div style={treeItemStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button onClick={() => setOpen(o => !o)} style={miniChevronStyle}>
            <span style={{ display: 'inline-block', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.12s', fontSize: 8 }}>▶</span>
          </button>
          <Link
            to={`/results/${id}`}
            style={{ ...treeLinkStyle, flex: 1, color: active ? 'var(--link)' : 'var(--muted)' }}
            title={run.test_name || run.id}
          >
            {truncate(run.test_name || run.id, 20)}
          </Link>
        </div>
      </div>
      {open && (
        <div style={{ paddingLeft: 24 }}>
          <div style={subItemStyle}>
            <Link to={`/results/${id}`} style={{ ...subLinkStyle, color: isActive(`/results/${run.id}`) ? 'var(--link)' : 'var(--muted)' }}>
              Results
            </Link>
          </div>
          <div style={subItemStyle}>
            <Link to={`/trades/${id}/best`} style={{ ...subLinkStyle, color: isActive(`/trades/${run.id}`) ? 'var(--link)' : 'var(--muted)' }}>
              Trades
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function ActiveTreeItem({ strat, active, isActive }: {
  strat: ActiveStrategySummary; active: boolean; isActive: (p: string) => boolean
}) {
  const [open, setOpen] = useState(false)
  const id = encodeURIComponent(strat.active_id)
  return (
    <div>
      <div style={treeItemStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button onClick={() => setOpen(o => !o)} style={miniChevronStyle}>
            <span style={{ display: 'inline-block', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.12s', fontSize: 8 }}>▶</span>
          </button>
          <span style={{
            display: 'inline-block', width: 6, height: 6, borderRadius: 3,
            background: strat.is_active ? 'var(--ok)' : 'var(--warn)',
            marginRight: 4, flexShrink: 0,
          }} />
          <Link
            to={`/active/${id}`}
            style={{ ...treeLinkStyle, flex: 1, color: active ? 'var(--link)' : 'var(--muted)' }}
            title={strat.name || strat.active_id}
          >
            {truncate(strat.name || strat.active_id, 18)}
          </Link>
        </div>
      </div>
      {open && (
        <div style={{ paddingLeft: 24 }}>
          <div style={subItemStyle}>
            <Link to={`/active/${id}`} style={{ ...subLinkStyle, color: isActive(`/active/${strat.active_id}`) && !isActive(`/active/${strat.active_id}/history`) ? 'var(--link)' : 'var(--muted)' }}>
              Overview
            </Link>
          </div>
          <div style={subItemStyle}>
            <Link to={`/active/${id}/history`} style={{ ...subLinkStyle, color: isActive(`/active/${strat.active_id}/history`) ? 'var(--link)' : 'var(--muted)' }}>
              History
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function SectionHeader({ label, count, open, active, onClick, href }: {
  label: string; count: number; open: boolean; active: boolean
  onClick: () => void; href: string
}) {
  return (
    <div style={{ ...sectionHeaderStyle, background: active ? 'rgba(96,165,250,0.08)' : 'transparent' }}>
      <button onClick={onClick} style={chevronBtnStyle} aria-label={`Toggle ${label}`}>
        <span style={{ display: 'inline-block', transition: 'transform 0.15s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', fontSize: 10 }}>▶</span>
      </button>
      <Link to={href} style={{ ...sectionLabelStyle, color: active ? 'var(--link)' : 'var(--text)' }}>{label}</Link>
      <span style={countBadgeStyle}>{count}</span>
    </div>
  )
}

function NavLink({ to, label, active }: { to: string; label: string; active: boolean }) {
  return (
    <Link to={to} style={{
      ...navLinkStyle,
      color: active ? 'var(--link)' : 'var(--muted)',
      background: active ? 'rgba(96,165,250,0.08)' : 'transparent',
    }}>{label}</Link>
  )
}

function IconLink({ to, icon, title, active }: { to: string; icon: string; title: string; active: boolean }) {
  return (
    <Link to={to} title={title} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: 36, height: 36, margin: '2px auto',
      borderRadius: 8, textDecoration: 'none',
      fontSize: 16,
      color: active ? 'var(--link)' : 'var(--muted)',
      background: active ? 'rgba(96,165,250,0.10)' : 'transparent',
    }}>{icon}</Link>
  )
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

/* ── Styles ── */

const sidebarBase: React.CSSProperties = {
  height: '100vh',
  position: 'sticky',
  top: 0,
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--panel)',
  borderRight: '1px solid var(--line)',
  padding: '10px 0 12px',
  overflowY: 'auto',
  overflowX: 'hidden',
  fontSize: 13,
  transition: 'width 0.15s ease, min-width 0.15s ease',
}

const collapseBtn: React.CSSProperties = {
  background: 'var(--panel2)',
  border: '1px solid var(--line)',
  borderRadius: 8,
  color: 'var(--muted)',
  cursor: 'pointer',
  width: 30,
  height: 30,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 13,
  margin: '2px auto 6px',
  transition: 'background 120ms ease, color 120ms ease, border-color 120ms ease',
}

const sectionHeaderStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '7px 12px',
  margin: '4px 6px 2px',
  borderRadius: 8,
  transition: 'background 120ms ease',
}

const chevronBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--muted)',
  cursor: 'pointer', padding: '2px 4px', lineHeight: 1,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 16, height: 16, flexShrink: 0,
}

const sectionLabelStyle: React.CSSProperties = {
  fontWeight: 600, fontSize: 11.5, textDecoration: 'none',
  flex: 1, letterSpacing: '0.06em',
  textTransform: 'uppercase',
}

const countBadgeStyle: React.CSSProperties = {
  fontSize: 10.5, color: 'var(--muted)',
  background: 'var(--panel2)',
  border: '1px solid var(--line)',
  borderRadius: 999,
  padding: '1px 7px',
  fontWeight: 500,
  minWidth: 20,
  textAlign: 'center',
}

const treeStyle: React.CSSProperties = {
  padding: '2px 6px 6px',
  margin: '0 8px 4px 18px',
  borderLeft: '1px solid var(--line)',
}

const treeItemStyle: React.CSSProperties = { padding: '2px 6px 2px 8px' }

const subItemStyle: React.CSSProperties = { padding: '1px 0' }

const subLinkStyle: React.CSSProperties = {
  fontSize: 11.5, textDecoration: 'none', display: 'block',
  padding: '2px 6px', borderRadius: 4,
  color: 'var(--muted)',
}

const miniChevronStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--muted)',
  cursor: 'pointer', padding: '0 2px', lineHeight: 1, flexShrink: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 14, height: 14,
}

const treeLinkStyle: React.CSSProperties = {
  fontSize: 12.5, textDecoration: 'none', display: 'flex', alignItems: 'center',
  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  padding: '3px 6px', borderRadius: 6,
}

const navLinkStyle: React.CSSProperties = {
  display: 'block',
  padding: '7px 14px 7px 12px',
  margin: '2px 6px',
  fontWeight: 500,
  fontSize: 13,
  textDecoration: 'none',
  borderRadius: 8,
  transition: 'background 120ms ease, color 120ms ease',
}
