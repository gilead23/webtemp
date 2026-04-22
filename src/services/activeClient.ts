export type ActiveStrategySummary = {
  active_id: string
  run_id?: string | null
  perm_id?: string | null
  promoted_at?: string | null
  name?: string | null
  description?: string | null
  is_active: boolean
  deleted: boolean
  last_stop_gen_date?: number | null
  last_successful_run_date?: number | null
  strategy_name?: string | null
}

export type ExitInstruction = {
  exit_kind: 'STOP' | 'MARKET' | 'NONE'
  exit_price: number | null
  exit_reason: string
}

const API_BASE = '/api'

async function httpJson(method: 'GET' | 'POST' | 'DELETE', path: string, body?: any): Promise<any> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`
  const init: RequestInit = { method }
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(body)
  }
  const r = await fetch(url, init)
  if (!r.ok) {
    const txt = await r.text().catch(() => '')
    throw new Error(txt || `${method} ${url} failed (${r.status})`)
  }
  // Some endpoints may return empty responses.
  const ct = r.headers.get('content-type') || ''
  if (!ct.toLowerCase().includes('application/json')) {
    const txt = await r.text().catch(() => '')
    return txt
  }
  return await r.json()
}

export async function listActiveStrategies(): Promise<ActiveStrategySummary[]> {
  return httpJson('GET', '/active')
}


export async function activateStrategy(active_id: string): Promise<any> {
  return httpJson('POST', `/active/${encodeURIComponent(active_id)}/activate`)
}

export async function deactivateStrategy(active_id: string): Promise<any> {
  return httpJson('POST', `/active/${encodeURIComponent(active_id)}/deactivate`)
}

export async function reactivateStrategy(active_id: string): Promise<any> {
  return httpJson('POST', `/active/${encodeURIComponent(active_id)}/reactivate`)
}

export async function deleteStrategy(active_id: string): Promise<any> {
  return httpJson('POST', `/active/${encodeURIComponent(active_id)}/delete`)
}

export async function removeStrategy(active_id: string): Promise<any> {
  return httpJson('POST', `/active/${encodeURIComponent(active_id)}/remove`)
}

export type TradeRow = {
  trade_id: string
  ticker: string
  side?: string | null
  entry_date?: number | null
  entry_price?: number | null
  exit_date?: number | null
  exit_price?: number | null
  exit_type?: 'STOP' | 'MARKET' | 'NONE' | null
  state: 'OPEN' | 'CLOSED' | 'DISABLED'
  exit_instruction?: ExitInstruction | null
}

export type WeeklyPoint = {
  week_end: number
  weekly_return: number
  open_trades: number
}

export async function fetchTradeHistory(active_id: string): Promise<TradeRow[]> {
  return httpJson('GET', `/active/${encodeURIComponent(active_id)}/trades/history`)
}

export async function fetchWeeklyHistory(active_id: string): Promise<{ active_id: string; weeks: WeeklyPoint[] }> {
  return httpJson('GET', `/active/${encodeURIComponent(active_id)}/history/weekly`)
}

export type ActiveStrategyDetail = {
  active_id: string
  manifest: any
  config: any
}

export async function fetchActiveDetail(active_id: string): Promise<ActiveStrategyDetail> {
  return httpJson('GET', `/active/${encodeURIComponent(active_id)}`)
}

export async function fetchOpenTrades(active_id: string): Promise<TradeRow[]> {
  return httpJson('GET', `/active/${encodeURIComponent(active_id)}/trades/open`)
}

// ActiveStrategy page expects combined detail + open trades.
export type ActiveDetail = ActiveStrategyDetail & {
  open_trades: TradeRow[]
}

export async function getActive(active_id: string): Promise<ActiveDetail> {
  const [detail, open_trades] = await Promise.all([
    fetchActiveDetail(active_id),
    fetchOpenTrades(active_id),
  ])
  return { ...detail, open_trades }
}

export type ExitInstructionHistoryRow = {
  date: number
  exit_kind: string
  exit_price: number | null
  exit_reason: string
}

export type StopHistoryPayload = {
  active_id: string
  trade_id: string
  start: number
  end: number
  history: ExitInstructionHistoryRow[]
}

export async function fetchTradeStopHistory(
  active_id: string,
  trade_id: string,
  start: number,
  end: number
): Promise<StopHistoryPayload> {
  const qs = new URLSearchParams({ start: String(start), end: String(end) }).toString()
  return httpJson(
    'GET',
    `/active/${encodeURIComponent(active_id)}/trades/${encodeURIComponent(trade_id)}/stops?${qs}`
  )
}


export async function runActiveWorkflow(active_id: string, start_date: number, end_date: number): Promise<any> {
  const body = { start_date, end_date }
  return httpJson('POST', `/active/${encodeURIComponent(active_id)}/run`, body)
}

export async function generateStops(active_id: string, for_date?: number): Promise<any> {
  const body: any = {}
  if (for_date != null) body.for_date = for_date
  return httpJson('POST', `/active/${encodeURIComponent(active_id)}/stops/generate`, body)
}

// Convenience facade used by pages.
export const activeClient = {
  listActiveStrategies,
  activateStrategy,
  deactivateStrategy,
  reactivateStrategy,
  deleteStrategy,
  removeStrategy,
  getActive,
  fetchActiveDetail,
  fetchOpenTrades,
  fetchTradeHistory,
  fetchWeeklyHistory,
  getTradeStopHistory: fetchTradeStopHistory,
  runActiveWorkflow,
  generateStops,
}
