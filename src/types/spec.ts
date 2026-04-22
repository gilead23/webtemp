// Types mirroring Spec §4. Keep synchronized with UPDATED_SPEC_MERGED.md
// Spec §4.1 Run Header
export interface RunHeader {
  run_id: string
  config_sha1: string
  sweep_version: string
  created_at: string
  mode: 'backtest' | 'validate'
  data_versions: { ohlc: string }
  universe?: unknown
  eval?: unknown
  constraints?: string[]
}

// Spec §4.2 Summary Row
export interface SummaryRow {
  perm_id: string
  // ... more fields per writer
}

// Spec §4.3 Manifest
export interface ManifestRecord {
  type: 'INTERIM' | 'FINAL'
  perm_id: string
  pruned?: boolean
}

// Spec §4.4 Resume
export interface ResumeIndex {
  perms: Record<string, { status: 'RUNNING' | 'DONE' | 'PRUNED' | 'FAILED'; updated_at: string }>
  cursor: string | null
}

// Spec §4.5 SLM Trade Row
export interface SLMTradeRow {
  perm_id: string
  trade_idx: number
  days_open: number
  days_ago?: number
  fold?: number
  Ticker: string
  Strategy: string
  Trigger_Date: string
  Close_Date: string
  Exit_Date?: string
  Trigger_Close: number
  Return: number
  MaxReturn: number
  MaxReturn_Day: number
  MaxDrawDown: number
  StopTriggered: boolean
  expected_return: number
  Sell_Price: number
  buy_price: number
  sigma: number | null
  DaysHeld: number
  stop_level: number
  trigger_type: string
}

// Spec §4.6 Raw Entry (reference)
export interface RawEntry {
  entry_id: string
  ticker: string
  ts: string
  px: number
  side: 'long'
  label: string
  params_json: string
}

// Instrument classification filter for corporate/company_reference.
// Only checked fields are present; unchecked fields are omitted (not false).
// Mirrors config_schema.py UniverseSpec.instrument_filter: Optional[Dict[str, bool]]
export interface InstrumentFilter {
  is_operating_company?: boolean
  is_fund?: boolean
  is_foreign?: boolean
  is_financial_institution?: boolean
}
