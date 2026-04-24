import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../components/ui/Modal';
import { artifactClient, Study } from '../services/artifactClient';

/** ======== DEBUG TRACE HELPERS ======== */
const __RUNS_TAG = '[Runs]';
const __RUNS_log  = (...args: any[]) => { try { console.log(__RUNS_TAG, ...args) } catch {} };
const __RUNS_warn = (...args: any[]) => { try { console.warn(__RUNS_TAG, ...args) } catch {} };
const __RUNS_err  = (...args: any[]) => { try { console.error(__RUNS_TAG, ...args) } catch {} };
/** ===================================== */

type Row = {
  id: string;
  testName: string | null;
  runDate: string | null;
  runTs: number | null;
  status: string | null;
  totalPerms: number | null;
  donePerms: number | null;
  bestSharpe: number | null;
  bestReturn: number | null;
  bestPerDayReturn: number | null;
  bestProfitFactor: number | null;
};

type SortKey = keyof Row;
type SortDir = 'asc' | 'desc';

export default function Runs() {
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | undefined>(undefined);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('runDate');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Move to study
  const [moveRunId, setMoveRunId] = useState<string | null>(null);
  const [studies, setStudies] = useState<Study[]>([]);
  const [selectedStudy, setSelectedStudy] = useState<string>('');
  const [moving, setMoving] = useState(false);
  const [moveErr, setMoveErr] = useState<string | null>(null);
  const nav = useNavigate();

  useEffect(() => {
    let alive = true;
    let inFlight = false;
    let tick = 0;

    async function refreshRuns(reason: 'mount' | 'poll'){
      if (!alive) return;
      if (inFlight) {
        __RUNS_warn('Refresh skipped (inFlight)', { reason, tick });
        return;
      }
      inFlight = true;
      tick++;
      __RUNS_log('Refresh start', { reason, tick });
      setErr(undefined);
      setLoading(true);
      try{
        const list = await artifactClient.listRuns();
        if (!alive) return;
        // Server now returns metrics inline — no per-run summary fetches needed
        const out: Row[] = list.map(run => {
          let runDate: string | null = null;
          let runTs: number | null = null;
          if (typeof run.created_at === 'string') {
            const ts = Date.parse(run.created_at);
            if (Number.isFinite(ts)) {
              runTs = ts;
              runDate = fmtYMDSlash(run.created_at);
            } else {
              runDate = fmtYMDSlash(run.created_at);
            }
          }
          return {
            id: run.id,
            testName: run.test_name ?? null,
            runDate,
            runTs,
            status: run.status ?? null,
            totalPerms: run.total_permutations ?? null,
            donePerms: run.done_perms ?? null,
            bestSharpe: typeof run.best_sharpe === 'number' ? run.best_sharpe : null,
            bestReturn: typeof run.best_return === 'number' ? run.best_return : null,
            bestPerDayReturn: typeof run.best_per_day_return === 'number' ? run.best_per_day_return : null,
            bestProfitFactor: typeof run.best_profit_factor === 'number' ? run.best_profit_factor : null,
          };
        });
        setRows(out);
        __RUNS_log('Refresh done', { reason, tick, rows: out.length });
      } catch (e:any){
        if (!alive) return;
        setErr(String((e as any)?.message ?? e));
        __RUNS_err('Refresh error', { reason, tick, e });
      } finally {
        if (alive) setLoading(false);
        inFlight = false;
      }
    }

    // immediate fetch
    refreshRuns('mount');

    // polling: keep list fresh so newly-started sweeps appear once backend artifacts are created.
    const POLL_MS = 5000;
    const timer = window.setInterval(() => {
      refreshRuns('poll');
    }, POLL_MS);

    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return rows.filter(r => r.id.toLowerCase().includes(f) || (r.testName ?? '').toLowerCase().includes(f));
  }, [rows, filter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => compare(a, b, sortKey, sortDir));
    return arr;
  }, [filtered, sortKey, sortDir]);

  function onSort(k: SortKey){
    if (k === sortKey){ setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }
    else { setSortKey(k); setSortDir('asc'); }
  }

  function openResults(runId: string){
    __RUNS_log('Results icon click', { runId });
    nav(`/results/${encodeURIComponent(runId)}`);
  }


  function requestDeleteRun(runId: string){
    __RUNS_log('Delete icon click', { runId });
    setDeleteErr(null);
    setConfirmDeleteId(runId);
  }

  async function confirmDeleteRun(){
    if (!confirmDeleteId) return;
    const runId = confirmDeleteId;
    setDeleting(true);
    setDeleteErr(null);
    __RUNS_log('Delete confirm start', { runId });
    try{
      await artifactClient.deleteRun(runId);
      setRows(prev => prev.filter(r => r.id !== runId));
      setConfirmDeleteId(null);
      __RUNS_log('Delete confirm success', { runId });
    }catch(e:any){
      const msg = String((e as any)?.message ?? e);
      setDeleteErr(msg);
      __RUNS_err('Delete confirm error', { runId, msg });
    }finally{
      setDeleting(false);
    }
  }

  async function openMoveToStudy(runId: string) {
    setMoveRunId(runId);
    setMoveErr(null);
    setSelectedStudy('');
    try {
      const list = await artifactClient.listStudies();
      setStudies(list);
    } catch {}
  }

  async function confirmMoveToStudy() {
    if (!moveRunId || !selectedStudy) return;
    setMoving(true);
    setMoveErr(null);
    try {
      await artifactClient.moveRunToStudy(selectedStudy, moveRunId);
      setRows(prev => prev.filter(r => r.id !== moveRunId));
      setMoveRunId(null);
    } catch (e: any) {
      setMoveErr(e?.message || String(e));
    } finally {
      setMoving(false);
    }
  }


  /**
   * Authoritative seed:
   *  1) Executed permutations (if present)
   *  2) Otherwise: flags at TOP-LEVEL on header (entry_flags / exit_flags), per run/config JSONs
   *     (Your uploaded config/run files show flags here, not under header.config.*)
   */
  async function newSweepFromRun(runId: string){
    __RUNS_log('New sweep (from run) start', { runId });
    try{
      const header = await artifactClient.getRunHeader(runId);

      const uni = normalizeUniverse(header?.universe ?? null);
      __RUNS_log('Header.universe normalized:', uni);
      if (!uni){
        __RUNS_err('Aborted: header.universe missing/invalid (requires start_date & end_date).', { hasUniverse: !!header?.universe });
        return;
      }

      // STRICT: Use header top-level flags only. No permutation collapse.
      const hasTopEntry = Array.isArray((header as any)?.entry_flags);
      const hasTopExit  = Array.isArray((header as any)?.exit_flags);
      if (!hasTopEntry && !hasTopExit){
        __RUNS_err('Cannot seed: header entry_flags/exit_flags are missing. Legacy collapse is disabled by policy.', {
          runId,
          headerKeys: (header && typeof header === 'object') ? Object.keys(header) : null,
        });
        return;
      }

      const entry = ((header as any).entry_flags ?? []).map(coerceHeaderFlagToSeed);
      const exit  = ((header as any).exit_flags  ?? []).map(coerceHeaderFlagToSeed);

      __RUNS_log('Seed payload from header top-level flags (STRICT)', {
        entryCount: entry.length, exitCount: exit.length,
        entryNames: entry.map(e => e.name || e.label), exitNames: exit.map(e=> e.name || e.label)
      });

      nav('/new', {
        state: {
          seed: {
            source_run_id: runId,
            universe: uni,
            permutation: { entry, exit },
          }
        }
      });
      __RUNS_log('Navigate -> /new with state.seed', {
        universe: uni,
        entryLen: entry.length,
        exitLen: exit.length
      });
    }catch(e:any){
      __RUNS_err('newSweepFromRun error', e);
    }
  }

  if (err){
    return <div style={{padding:16}}>
      <h1>Runs</h1>
      <div style={{color:'crimson'}}>Error: {err}</div>
    </div>;
  }

  return (
    <div style={{padding:16}}>
      <h1>Runs</h1>
      <div style={{display:'flex', gap:8, alignItems:'center', margin:'8px 0 16px'}}>
        <input
          value={filter}
          onChange={e=>setFilter(e.target.value)}
          placeholder="Filter by Run ID or Test Name…"
          style={{padding:'6px 8px', border:'1px solid var(--line)', borderRadius:6, minWidth:260}}
        />
        {loading && <span>Loading…</span>}
      </div>


      {confirmDeleteId && (
        <Modal title="Delete Run" onClose={() => { if (!deleting) setConfirmDeleteId(null); }} width={520}>
          <div className="stack" style={{ gap: 12 }}>
            <div>
              This will permanently delete run <code>{confirmDeleteId}</code> and its files.
            </div>
            {deleteErr && <div style={{ color: 'crimson' }}>Error: {deleteErr}</div>}
            <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
              <button className="button ghost" onClick={() => setConfirmDeleteId(null)} disabled={deleting}>
                Cancel
              </button>
              <button className="button" onClick={confirmDeleteRun} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {moveRunId && (
        <Modal title="Move to Study" onClose={() => !moving && setMoveRunId(null)} width={440}>
          <div className="stack" style={{ gap: 12 }}>
            <div>
              Move <code>{rows.find(r => r.id === moveRunId)?.testName || moveRunId}</code> to a study:
            </div>
            {studies.length > 0 ? (
              <select className="input" value={selectedStudy} onChange={e => setSelectedStudy(e.target.value)}>
                <option value="">Select a study…</option>
                {studies.map(s => (
                  <option key={s.study_id} value={s.study_id}>
                    {s.name} ({s.run_count ?? 0} runs)
                  </option>
                ))}
              </select>
            ) : (
              <div style={{ opacity: 0.6 }}>
                No studies yet. <a href="/studies" style={{ color: 'var(--link)' }}>Create one first</a>.
              </div>
            )}
            {moveErr && <div style={{ color: 'crimson' }}>Error: {moveErr}</div>}
            <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
              <button className="button ghost" onClick={() => setMoveRunId(null)} disabled={moving}>Cancel</button>
              <button className="button primary" onClick={confirmMoveToStudy} disabled={moving || !selectedStudy}>
                {moving ? 'Moving…' : 'Move'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <div style={{overflowX:'auto'}}>
      <table style={{borderCollapse:'collapse', width:'100%', tableLayout:'fixed'}}>
        <colgroup>
          <col />                    {/* Test Name — gets remaining space */}
          <col style={{width:100}} /> {/* Run Date */}
          <col style={{width:105}} /> {/* Status */}
          <col style={{width:80}} />  {/* Total Perms */}
          <col style={{width:80}} />  {/* Perms Completed */}
          <col style={{width:85}} />  {/* Best Sharpe */}
          <col style={{width:80}} />  {/* Best Return */}
          <col style={{width:90}} />  {/* Best Per-Day */}
          <col style={{width:85}} />  {/* Best PF */}
          <col style={{width:36}} />  {/* 📊 */}
          <col style={{width:36}} />  {/* ➕ */}
          <col style={{width:36}} />  {/* 📁 */}
          <col style={{width:36}} />  {/* 🗑️ */}
        </colgroup>
        <thead>
          <tr>
            <Th label="Test Name" sortKey="testName" sortKeyState={sortKey} sortDir={sortDir} onSort={onSort} />
            <Th label="Run Date" sortKey="runDate" sortKeyState={sortKey} sortDir={sortDir} onSort={onSort} />
            <Th label="Status" sortKey="status" sortKeyState={sortKey} sortDir={sortDir} onSort={onSort} />
            <Th label="Perms" sortKey="totalPerms" sortKeyState={sortKey} sortDir={sortDir} onSort={onSort} />
            <Th label="Done" sortKey="donePerms" sortKeyState={sortKey} sortDir={sortDir} onSort={onSort} />
            <Th label="Sharpe" sortKey="bestSharpe" sortKeyState={sortKey} sortDir={sortDir} onSort={onSort} />
            <Th label="Return" sortKey="bestReturn" sortKeyState={sortKey} sortDir={sortDir} onSort={onSort} />
            <Th label="Per-Day" sortKey="bestPerDayReturn" sortKeyState={sortKey} sortDir={sortDir} onSort={onSort} />
            <Th label="PF" sortKey="bestProfitFactor" sortKeyState={sortKey} sortDir={sortDir} onSort={onSort} />
            <th style={{...th, textAlign:'center'}} title="Open results">📊</th>
            <th style={{...th, textAlign:'center'}} title="New sweep from this run">➕</th>
            <th style={{...th, textAlign:'center'}} title="Move to study">📁</th>
            <th style={{...th, textAlign:'center'}} title="Delete run">🗑️</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(r => (
            <tr key={r.id}>
              <td style={tdEllipsis} title={r.testName || r.id}>{r.testName || r.id}</td>
              <td style={tdNowrap}>{r.runDate ?? '—'}</td>
              <td style={tdNowrap}>{r.status ?? '—'}</td>
              <td style={tdNowrap}>{fmtNum(r.totalPerms)}</td>
              <td style={tdNowrap}>{fmtNum(r.donePerms)}</td>
              <td style={tdNowrap}>{fmtFixed(r.bestSharpe,4)}</td>
              <td style={tdNowrap}>{fmtPct(r.bestReturn)}</td>
              <td style={tdNowrap}>{fmtPct(r.bestPerDayReturn)}</td>
              <td style={tdNowrap}>{fmtFixed(r.bestProfitFactor,3)}</td>
              <td style={{...tdNowrap, textAlign:'center'}}>
                <button onClick={()=>openResults(r.id)} title="Open results" style={glyphBtn} aria-label="open results">📊</button>
              </td>
              <td style={{...tdNowrap, textAlign:'center'}}>
                <button onClick={()=>newSweepFromRun(r.id)} title="Start new sweep from this run" style={glyphBtn} aria-label="new sweep">➕</button>
              </td>
              <td style={{...tdNowrap, textAlign:'center'}}>
                <button onClick={()=>openMoveToStudy(r.id)} title="Move to study" style={glyphBtn} aria-label="move to study">📁</button>
              </td>
              <td style={{...tdNowrap, textAlign:'center'}}>
                <button onClick={()=>requestDeleteRun(r.id)} title="Delete this run" style={glyphBtn} aria-label="delete run">🗑️</button>
              </td>
            </tr>
          ))}
          {sorted.length === 0 && <tr><td colSpan={13} style={{padding:'12px 8px'}}><em>No runs match.</em></td></tr>}
        </tbody>
      </table>
      </div>
    </div>
  );
}

/** ======================= Helpers ======================= */

function compare(a: Row, b: Row, key: SortKey, dir: SortDir){
  const sgn = dir === 'asc' ? 1 : -1;
  const va = a[key], vb = b[key];
  if (key === 'runDate'){
    const ca = typeof a.runTs === 'number' ? a.runTs : Number.NEGATIVE_INFINITY;
    const cb = typeof b.runTs === 'number' ? b.runTs : Number.NEGATIVE_INFINITY;
    return (ca - cb) * sgn;
  }
  if (['totalPerms','donePerms','bestSharpe','bestReturn','bestPerDayReturn','bestProfitFactor'].includes(key)){
    const na = typeof va === 'number' ? va : Number.NEGATIVE_INFINITY;
    const nb = typeof vb === 'number' ? vb : Number.NEGATIVE_INFINITY;
    return (na - nb) * sgn;
  }
  const sa = (va ?? '').toString();
  const sb = (vb ?? '').toString();
  return sa.localeCompare(sb) * sgn;
}

function fmtNum(n: number | null){ return n == null ? '—' : String(n); }
function fmtFixed(n: number | null, digits = 2){ return n == null ? '—' : n.toFixed(digits); }
function fmtPct(n: number | null, digits = 2){ return (n == null || !Number.isFinite(n)) ? '—' : (n * 100).toFixed(digits) + '%'; }

function fmtYMDSlash(s: string): string {
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return s;
  const d = new Date(t);
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  const yyyy = d.getFullYear();
  return `${yyyy}/${mm}/${dd}`;
}

/** Universe normalizer — shape expected by NewSweep */
function normalizeUniverse(u: any): { tickers: 'ALL' | string[]; start_date?: string; end_date?: string; warmup_days?: number } | null {
  if (!u || typeof u !== 'object') return null;
  const out: any = {};
  if (u.tickers === 'ALL') out.tickers = 'ALL';
  else if (Array.isArray(u.tickers)) out.tickers = u.tickers.slice();
  else if (typeof u.tickers === 'string') out.tickers = u.tickers.split(',').map((s:string)=>s.trim()).filter(Boolean);
  else out.tickers = 'ALL';

  const sd = typeof u.start_date === 'string' ? u.start_date.slice(0,10) : undefined;
  const ed = typeof u.end_date   === 'string' ? u.end_date.slice(0,10)   : undefined;
  if (sd) out.start_date = sd;
  if (ed) out.end_date = ed;

  const w = Number(u.warmup_days ?? 365);
  if (Number.isFinite(w)) out.warmup_days = w;
  return out;
}

/** Coerce a header flag into NewSweep seed format */
function coerceHeaderFlagToSeed(f: any){
  const params: Record<string, any> = {};
  for (const k of Object.keys(f?.params || {})){
    const v = f.params[k];
    if (v && typeof v === 'object' && Array.isArray(v.values)) { params[k] = { values: v.values.slice() }; continue; }
    if (Array.isArray(v)) { params[k] = { values: v.slice() }; continue; }
    params[k] = { values: (v === undefined || v === null) ? [] : [v] };
  }
  return {
    name:  (f?.name ?? f?.label ?? '').trim(),
    label: (f?.label ?? f?.name  ?? '').trim(),
    params,
  };
}

/**
 * Collapse executed permutations → a single "ranged" permutation.
 * Each strategy appears once; each param → {values:[distinct values]}.
 */
function collapsePermutationsToSeed(perms: any[]){
  type Agg = Map<string, { name: string, label: string, params: Map<string, Set<any>> }>;
  const entryAgg: Agg = new Map();
  const exitAgg: Agg  = new Map();

  const bump = (agg: Agg, f: any) => {
    const name = String(f?.name ?? f?.label ?? '');
    const label = String(f?.label ?? f?.name ?? name);
    if (!name) return;
    if (!agg.has(name)) agg.set(name, { name, label, params: new Map() });
    const slot = agg.get(name)!;
    const params = f?.params || {};
    for (const k of Object.keys(params)){
      const v = params[k];
      const vals = (v && typeof v === 'object' && Array.isArray(v.values)) ? v.values
                 : Array.isArray(v) ? v
                 : (v === undefined || v === null) ? [] : [v];
      if (!slot.params.has(k)) slot.params.set(k, new Set());
      const set = slot.params.get(k)!;
      for (const val of vals) set.add(val);
    }
  };

  for (const p of perms){
    if (Array.isArray(p?.entry)) for (const f of p.entry) bump(entryAgg, f);
    if (Array.isArray(p?.exit))  for (const f of p.exit)  bump(exitAgg,  f);
  }

  const finalize = (agg: Agg) => {
    const out: any[] = [];
    for (const { name, label, params } of agg.values()){
      const oParams: Record<string, any> = {};
      for (const [k, set] of params.entries()){
        oParams[k] = { values: Array.from(set.values()) };
      }
      out.push({ name, label, params: oParams });
    }
    return out;
  };

  const entry = finalize(entryAgg);
  const exit  = finalize(exitAgg);

  if (entry.length === 0 || exit.length === 0){
    __RUNS_warn('collapsePermutationsToSeed produced empty flags', {
      permsLen: Array.isArray(perms) ? perms.length : null,
      entryEmpty: entry.length === 0,
      exitEmpty: exit.length === 0
    });
  }

  return { entry, exit };
}

/** Sortable TH helper */
function Th(props: {label: string, sortKey: SortKey, sortKeyState: SortKey, sortDir: SortDir, onSort: (k: SortKey)=>void}){
  const { label, sortKey, sortKeyState, sortDir, onSort } = props;
  const active = sortKeyState === sortKey;
  return (
    <th style={th}>
      <button onClick={()=>onSort(sortKey)} style={thBtn}>
        {label}{' '}{active ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
      </button>
    </th>
  );
}

const th: React.CSSProperties = { textAlign:'left', borderBottom:'1px solid var(--line)', padding:'8px 6px', whiteSpace:'nowrap' };
const td: React.CSSProperties = { borderBottom:'1px solid var(--line)', padding:'8px 6px', verticalAlign:'top' };
const tdNowrap: React.CSSProperties = { ...td, whiteSpace:'nowrap' };
const tdEllipsis: React.CSSProperties = { ...td, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:0 };

/** Glyph button style mirroring Results */
const glyphBtn: React.CSSProperties = {
  width:24,
  height:24,
  display:'inline-flex',
  alignItems:'center',
  justifyContent:'center',
  border:'1px solid var(--line)',
  borderRadius:6,
  background:'transparent',
  cursor:'pointer',
  fontSize:14,
  lineHeight:1,
  padding:0,
  color:'var(--fg)',
};

const thBtn: React.CSSProperties = {
  background:'transparent',
  border:'none',
  padding:0,
  margin:0,
  color:'var(--fg)',
  cursor:'pointer',
  fontWeight:600
};