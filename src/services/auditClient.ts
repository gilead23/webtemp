// auditClient.ts — Trade Audit & Data Viewer API client (Phase 1)

const API_BASE = '/api';

// ── Types ──────────────────────────────────────────────────────────────────

export type DependencyNode = {
  label: string;
  expression: string;
  node_type: 'primitive' | 'indicator' | 'event' | 'flag' | 'comparison' | 'boolean';
  data_type: 'numeric_series' | 'boolean_series' | 'event_dates' | 'scalar';
  children: string[];
  params: Record<string, any>;
};

export type TradeContext = {
  ticker: string;
  trigger_date: string;
  close_date?: string | null;
  exit_date?: string | null;
  strategy: string;
  return?: string | number | null;
  buy_price?: string | number | null;
  sell_price?: string | number | null;
  trade_id?: string;
};

export type DependencyResponse = {
  trade: TradeContext;
  expression: string;
  dependencies: DependencyNode[];
  groups: Record<string, DependencyNode[]>;
  max_lookback: number;
};

export type SeriesResponse = {
  dates: number[];
  values: (number | boolean | null)[];
  data_type: string;
  ticker: string;
};

// ── Audit Record Types (Phase 2) ──────────────────────────────────────────

export type FlagSnapshotData = {
  flag_name: string;
  flag_label: string;
  ok: boolean;
  gate: boolean;
  numeric: number | null;
  expression: string | null;
  meta: Record<string, any> | null;
};

export type DailySnapshotData = {
  date: number;
  close: number;
  high: number;
  low: number;
  stop_level: number | null;
  hwm: number | null;
  flag_gates: Record<string, boolean>;
};

export type AuditRecordData = {
  trade_id: string;
  ticker: string;
  strategy: string;
  trigger_date: number;
  entry_date: number;
  exit_date: number | null;
  context_type: 'backtest' | 'active';
  run_id: string | null;
  perm_id: string | null;
  active_id: string | null;
  config_sha1: string;
  entry_price: number;
  entry_flag_states: Record<string, FlagSnapshotData>;
  exit_price: number | null;
  exit_trigger_type: string | null;
  exit_flag_states: Record<string, FlagSnapshotData>;
  exit_stop_level: number | null;
  sigma_at_trigger: number | null;
  params: Record<string, Record<string, any>>;
  sweep_version: string;
  engine_hash: string | null;
  daily_snapshots: DailySnapshotData[] | null;
};

export type AuditListResponse = {
  count: number;
  records?: { trade_id: string; ticker: string; trigger_date: number; strategy: string; has_exit: boolean; exit_trigger_type: string | null }[];
  trade_ids?: string[];
};

// ── API calls ──────────────────────────────────────────────────────────────

export const auditClient = {
  /**
   * Get dependency graph for a backtest trade.
   */
  async getBacktestDependencies(
    runId: string,
    permId: string,
    tradeIdx: number
  ): Promise<DependencyResponse> {
    const url = `${API_BASE}/runs/${encodeURIComponent(runId)}/trades/${encodeURIComponent(permId)}/${tradeIdx}/dependencies`;
    const r = await fetch(url);
    if (!r.ok) {
      const detail = await r.text().catch(() => r.statusText);
      throw new Error(`Failed to load dependencies: ${detail}`);
    }
    return r.json();
  },

  /**
   * Get a series evaluation for a backtest trade.
   */
  async getBacktestSeries(
    runId: string,
    permId: string,
    tradeIdx: number,
    expr: string,
    start?: number,
    end?: number
  ): Promise<SeriesResponse> {
    const params = new URLSearchParams({ expr });
    if (start != null) params.set('start', String(start));
    if (end != null) params.set('end', String(end));
    const url = `${API_BASE}/runs/${encodeURIComponent(runId)}/trades/${encodeURIComponent(permId)}/${tradeIdx}/series?${params}`;
    const r = await fetch(url);
    if (!r.ok) {
      const detail = await r.text().catch(() => r.statusText);
      throw new Error(`Failed to load series: ${detail}`);
    }
    return r.json();
  },

  /**
   * Get dependency graph for an active trade.
   */
  async getActiveDependencies(
    activeId: string,
    tradeId: string
  ): Promise<DependencyResponse> {
    const url = `${API_BASE}/active/${encodeURIComponent(activeId)}/trades/${encodeURIComponent(tradeId)}/dependencies`;
    const r = await fetch(url);
    if (!r.ok) {
      const detail = await r.text().catch(() => r.statusText);
      throw new Error(`Failed to load dependencies: ${detail}`);
    }
    return r.json();
  },

  /**
   * Get a series evaluation for an active trade.
   */
  async getActiveSeries(
    activeId: string,
    tradeId: string,
    expr: string,
    start?: number,
    end?: number
  ): Promise<SeriesResponse> {
    const params = new URLSearchParams({ expr });
    if (start != null) params.set('start', String(start));
    if (end != null) params.set('end', String(end));
    const url = `${API_BASE}/active/${encodeURIComponent(activeId)}/trades/${encodeURIComponent(tradeId)}/series?${params}`;
    const r = await fetch(url);
    if (!r.ok) {
      const detail = await r.text().catch(() => r.statusText);
      throw new Error(`Failed to load series: ${detail}`);
    }
    return r.json();
  },

  // ── Audit Record Methods (Phase 2) ─────────────────────────────────────

  /**
   * Get audit record for a backtest trade.
   */
  async getBacktestAudit(
    runId: string,
    permId: string,
    tradeIdx: number
  ): Promise<AuditRecordData> {
    const url = `${API_BASE}/runs/${encodeURIComponent(runId)}/trades/${encodeURIComponent(permId)}/${tradeIdx}/audit`;
    const r = await fetch(url);
    if (!r.ok) {
      const detail = await r.text().catch(() => r.statusText);
      throw new Error(`Failed to load audit: ${detail}`);
    }
    return r.json();
  },

  /**
   * Get audit record for an active trade.
   */
  async getActiveAudit(
    activeId: string,
    tradeId: string
  ): Promise<AuditRecordData> {
    const url = `${API_BASE}/active/${encodeURIComponent(activeId)}/trades/${encodeURIComponent(tradeId)}/audit`;
    const r = await fetch(url);
    if (!r.ok) {
      const detail = await r.text().catch(() => r.statusText);
      throw new Error(`Failed to load audit: ${detail}`);
    }
    return r.json();
  },
};
