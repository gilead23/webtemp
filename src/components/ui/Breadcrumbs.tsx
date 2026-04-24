import { Link, useLocation, useParams, matchPath } from 'react-router-dom'

type Crumb = { label: string; to?: string }

/**
 * Route → breadcrumb config. Order matters: first match wins for a given
 * level, but we use matchPath on each pattern to build the trail from the
 * current URL.
 */
const ROUTES: Array<{ pattern: string; trail: (p: Record<string, string | undefined>) => Crumb[] }> = [
  { pattern: '/runs',                          trail: () => [{ label: 'Backtests' }] },
  { pattern: '/new',                           trail: () => [{ label: 'Backtests', to: '/runs' }, { label: 'New' }] },
  { pattern: '/run/:id',                       trail: (p) => [{ label: 'Backtests', to: '/runs' }, { label: p.id || 'Run' }] },
  { pattern: '/results/:id',                   trail: (p) => [{ label: 'Backtests', to: '/runs' }, { label: p.id || 'Results' }, { label: 'Results' }] },
  { pattern: '/trades/:runId/:permId',         trail: (p) => [
      { label: 'Backtests', to: '/runs' },
      { label: p.runId || 'Run', to: p.runId ? `/results/${p.runId}` : undefined },
      { label: `Permutation ${p.permId ?? ''}`.trim() },
      { label: 'Trades' },
    ] },
  { pattern: '/active',                        trail: () => [{ label: 'Active Strategies' }] },
  { pattern: '/active/:activeId',              trail: (p) => [{ label: 'Active Strategies', to: '/active' }, { label: p.activeId || 'Strategy' }] },
  { pattern: '/active/:activeId/history',      trail: (p) => [
      { label: 'Active Strategies', to: '/active' },
      { label: p.activeId || 'Strategy', to: p.activeId ? `/active/${p.activeId}` : undefined },
      { label: 'History' },
    ] },
  { pattern: '/studies',                       trail: () => [{ label: 'Studies' }] },
  { pattern: '/studies/:studyId',              trail: (p) => [{ label: 'Studies', to: '/studies' }, { label: p.studyId || 'Study' }] },
  { pattern: '/screener',                      trail: () => [{ label: 'Screener' }] },
  { pattern: '/help/expression-language',      trail: () => [{ label: 'Help', to: undefined }, { label: 'Expression language' }] },
]

export default function Breadcrumbs() {
  const loc = useLocation()
  // matchPath returns { params } when the pattern matches the current pathname.
  let crumbs: Crumb[] | null = null
  for (const r of ROUTES) {
    const match = matchPath({ path: r.pattern, end: true }, loc.pathname)
    if (match) {
      crumbs = r.trail((match.params as Record<string, string | undefined>) || {})
      break
    }
  }
  // Also respect index route '/' as Backtests home
  if (!crumbs && loc.pathname === '/') crumbs = [{ label: 'Backtests' }]
  if (!crumbs || crumbs.length === 0) return null

  return (
    <nav aria-label="Breadcrumb" style={wrap}>
      <Link to="/runs" style={homeLink} aria-label="Home">
        <HomeGlyph />
      </Link>
      {crumbs.map((c, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={sep} aria-hidden>/</span>
          {c.to ? (
            <Link to={c.to} style={link}>{c.label}</Link>
          ) : (
            <span style={i === crumbs!.length - 1 ? current : link}>{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}

function HomeGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
      <path d="M3 10.5L12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  )
}

const wrap: React.CSSProperties = {
  display: 'flex', alignItems: 'center', flexWrap: 'wrap',
  gap: 6, fontSize: 12, color: 'var(--muted)',
  padding: '2px 0 12px', margin: 0,
}
const homeLink: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  color: 'var(--muted)', textDecoration: 'none',
  width: 22, height: 22, borderRadius: 4,
}
const sep: React.CSSProperties = { color: 'var(--line-strong, var(--line))', fontSize: 12 }
const link: React.CSSProperties = {
  color: 'var(--muted)', textDecoration: 'none', fontWeight: 500,
}
const current: React.CSSProperties = {
  color: 'var(--text, var(--fg))', fontWeight: 600,
}
