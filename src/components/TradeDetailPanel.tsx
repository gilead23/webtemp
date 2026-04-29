/**
 * TradeDetailPanel — Phase 1 Trade Data Viewer
 *
 * Renders as an expandable row beneath a trade in the trades table.
 * Shows:
 *  - Trade header (ticker, dates, prices)
 *  - Dependency dropdown (grouped by node_type)
 *  - Line chart for numeric series
 *  - Boolean band for boolean series
 *  - Data table toggle for raw values
 *
 * Used in both backtest (Trades.tsx) and active (ActiveStrategyDetailPage.tsx).
 */

import React, { useEffect, useMemo, useState } from "react";
import { X, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { StatusBadge } from "./ui/StatusBadge";
import {
  auditClient,
  DependencyNode,
  DependencyResponse,
  SeriesResponse,
  AuditRecordData,
  FlagSnapshotData,
} from "../services/auditClient";

// ── Types ──────────────────────────────────────────────────────────────────

type BacktestContext = {
  kind: "backtest";
  runId: string;
  permId: string;
  tradeIdx: number;
};

type ActiveContext = {
  kind: "active";
  activeId: string;
  tradeId: string;
};

type TradeDetailPanelProps = {
  context: BacktestContext | ActiveContext;
  onClose?: () => void;
};

// ── Styles (matching Trades.tsx dark theme) ─────────────────────────────────

const panelWrap: React.CSSProperties = {
  background: "#0b1220",
  border: "1px solid #1f2937",
  borderRadius: "6px",
  padding: "16px",
  margin: "4px 0 8px 0",
};

const headerRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "12px",
};

const headerTitle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
  color: "#e5e7eb",
};

const headerMeta: React.CSSProperties = {
  fontSize: "12px",
  color: "#9ca3af",
};

const closeBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#9ca3af",
  cursor: "pointer",
  fontSize: "16px",
  padding: "4px 8px",
};

const sectionLabel: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: "6px",
};

const dropdownWrap: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "6px",
  marginBottom: "12px",
};

const chipBase: React.CSSProperties = {
  fontSize: "12px",
  padding: "3px 10px",
  borderRadius: "4px",
  cursor: "pointer",
  border: "1px solid #374151",
  transition: "all 0.15s",
};

const chipColors: Record<string, { bg: string; border: string; text: string }> = {
  primitive:  { bg: "#1e3a5f", border: "#3b82f6", text: "#93c5fd" },
  indicator:  { bg: "#1a3a2a", border: "#22c55e", text: "#86efac" },
  event:      { bg: "#3b1f44", border: "#a855f7", text: "#d8b4fe" },
  flag:       { bg: "#3b2f1f", border: "#f59e0b", text: "#fcd34d" },
  comparison: { bg: "#1f2937", border: "#6b7280", text: "#d1d5db" },
  boolean:    { bg: "#1f2937", border: "#6b7280", text: "#d1d5db" },
  // Exit flag deps — red-tinted variants
  exit_primitive:  { bg: "#3b1520", border: "#ef4444", text: "#fca5a5" },
  exit_indicator:  { bg: "#3b1520", border: "#f87171", text: "#fecaca" },
  exit_event:      { bg: "#3b1520", border: "#ef4444", text: "#fca5a5" },
  exit_flag:       { bg: "#3b1f1f", border: "#dc2626", text: "#fca5a5" },
  exit_comparison: { bg: "#2d1f1f", border: "#b91c1c", text: "#fecaca" },
  exit_boolean:    { bg: "#2d1f1f", border: "#b91c1c", text: "#fecaca" },
};

const chartContainer: React.CSSProperties = {
  background: "#020617",
  border: "1px solid #1f2937",
  borderRadius: "4px",
  padding: "12px",
  marginBottom: "12px",
};

const tableContainer: React.CSSProperties = {
  maxHeight: "300px",
  overflowY: "auto",
  fontSize: "11px",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  color: "#e5e7eb",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "4px 8px",
  borderBottom: "1px solid #1f2937",
  color: "#9ca3af",
  fontSize: "10px",
  fontWeight: 600,
  position: "sticky",
  top: 0,
  background: "#0b1220",
};

const tdStyle: React.CSSProperties = {
  padding: "3px 8px",
  borderBottom: "1px solid #111827",
  fontFamily: "monospace",
  fontSize: "11px",
};

// ── Helpers ─────────────────────────────────────────────────────────────────

const NODE_TYPE_ORDER = [
  "primitive", "indicator", "event", "flag", "comparison", "boolean",
  "exit_primitive", "exit_indicator", "exit_event", "exit_flag", "exit_comparison", "exit_boolean",
];

function groupLabel(nodeType: string): string {
  const labels: Record<string, string> = {
    primitive: "Primitives",
    indicator: "Indicators",
    event: "Events",
    flag: "Flags",
    comparison: "Comparisons",
    boolean: "Boolean Logic",
    exit_primitive: "Exit — Primitives",
    exit_indicator: "Exit — Indicators",
    exit_event: "Exit — Events",
    exit_flag: "Exit — Flags",
    exit_comparison: "Exit — Comparisons",
    exit_boolean: "Exit — Boolean Logic",
  };
  return labels[nodeType] || nodeType;
}

function formatDate(d: string | number | null | undefined): string {
  if (!d) return "—";
  const s = String(d);
  if (s.length === 8) {
    return `${s.slice(0, 4)}/${s.slice(4, 6)}/${s.slice(6, 8)}`;
  }
  return s;
}

// ── SVG Line Chart (multi-series overlay) ───────────────────────────────────

const SERIES_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#84cc16", "#6366f1",
];

type ChartProps = {
  dates: number[];
  values: (number | boolean | null)[];
  dataType: string;
  triggerDate?: string;
  exitDate?: string;
};

type MultiSeriesEntry = {
  label: string;
  dates: number[];
  values: (number | boolean | null)[];
  dataType: string;
  color: string;
};

type MultiChartProps = {
  series: MultiSeriesEntry[];
  triggerDate?: string;
  exitDate?: string;
};

function MultiLineChart({ series, triggerDate, exitDate }: MultiChartProps) {
  const W = 720;
  const H = 240;
  const PAD = { top: 24, right: 60, bottom: 30, left: 60 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const numericSeries = series.filter(s => s.dataType !== "boolean_series");
  const boolSeries = series.filter(s => s.dataType === "boolean_series");

  const allDates = numericSeries.length > 0
    ? numericSeries.reduce((best, s) => s.dates.length > best.length ? s.dates : best, [] as number[])
    : series[0]?.dates || [];

  if (allDates.length < 2) {
    return <div style={{ color: "#6b7280", fontSize: "12px", padding: "20px" }}>Insufficient data points</div>;
  }

  let globalMin = Infinity, globalMax = -Infinity;
  for (const s of numericSeries) {
    for (const v of s.values) {
      if (v !== null && v !== undefined && typeof v === "number" && isFinite(v)) {
        if (v < globalMin) globalMin = v;
        if (v > globalMax) globalMax = v;
      }
    }
  }
  if (!isFinite(globalMin)) { globalMin = 0; globalMax = 1; }
  const yRange = globalMax - globalMin || 1;
  const yPad = yRange * 0.1;

  const scaleX = (i: number) => PAD.left + (i / (allDates.length - 1)) * plotW;
  const scaleY = (v: number) => PAD.top + plotH - ((v - (globalMin - yPad)) / (yRange + 2 * yPad)) * plotH;

  const dateToIdx = new Map<number, number>();
  allDates.forEach((d, i) => dateToIdx.set(d, i));

  const trigIdx = triggerDate
    ? allDates.findIndex(d => String(d) === String(triggerDate).replace(/\//g, ""))
    : -1;
  const exitIdx = exitDate
    ? allDates.findIndex(d => String(d) === String(exitDate).replace(/\//g, ""))
    : -1;

  const yTicks = 5;
  const yLabels = Array.from({ length: yTicks }, (_, i) => {
    const val = globalMin - yPad + ((yRange + 2 * yPad) * i) / (yTicks - 1);
    return { y: scaleY(val), label: val.toFixed(2) };
  });

  const xStep = Math.max(1, Math.floor(allDates.length / 6));
  const xLabels = allDates
    .filter((_, i) => i % xStep === 0)
    .map((d, i) => ({ x: scaleX(i * xStep), label: formatDate(d) }));

  const paths = numericSeries.map((s) => {
    let pathD = "";
    s.dates.forEach((d, di) => {
      const v = s.values[di];
      if (v === null || v === undefined || typeof v === "boolean") return;
      const num = Number(v);
      if (!isFinite(num)) return;
      const xi = dateToIdx.get(d);
      if (xi === undefined) return;
      const x = scaleX(xi);
      const y = scaleY(num);
      pathD += pathD ? ` L${x},${y}` : `M${x},${y}`;
    });
    return { label: s.label, color: s.color, pathD };
  });

  return (
    <div>
      <svg width={W} height={H} style={{ display: "block" }}>
        {yLabels.map(({ y, label }, i) => (
          <g key={`y-${i}`}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#1f2937" />
            <text x={PAD.left - 6} y={y + 3} fill="#6b7280" fontSize="10" textAnchor="end">{label}</text>
          </g>
        ))}
        {trigIdx >= 0 && (
          <g>
            <line x1={scaleX(trigIdx)} y1={PAD.top} x2={scaleX(trigIdx)} y2={H - PAD.bottom}
              stroke="#f59e0b" strokeDasharray="4,3" strokeWidth={1.5} />
            <text x={scaleX(trigIdx)} y={PAD.top - 6} fill="#f59e0b" fontSize="9" textAnchor="middle">trigger</text>
          </g>
        )}
        {exitIdx >= 0 && (
          <g>
            <line x1={scaleX(exitIdx)} y1={PAD.top} x2={scaleX(exitIdx)} y2={H - PAD.bottom}
              stroke="#ef4444" strokeDasharray="4,3" strokeWidth={1.5} />
            <text x={scaleX(exitIdx)} y={PAD.top - 6} fill="#ef4444" fontSize="9" textAnchor="middle">exit</text>
          </g>
        )}
        {paths.map((p) => (
          <path key={p.label} d={p.pathD} fill="none" stroke={p.color} strokeWidth={1.5} />
        ))}
        {xLabels.map(({ x, label }, i) => (
          <text key={`x-${i}`} x={x} y={H - 6} fill="#6b7280" fontSize="9" textAnchor="middle">{label}</text>
        ))}
      </svg>
      {numericSeries.length > 1 && (
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", padding: "4px 0 0 60px" }}>
          {numericSeries.map((s) => (
            <span key={s.label} style={{ fontSize: "10px", color: s.color, display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ width: "12px", height: "2px", background: s.color, display: "inline-block" }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
      {boolSeries.map((s) => (
        <div key={s.label} style={{ marginTop: "4px" }}>
          <div style={{ fontSize: "10px", color: s.color, marginBottom: "2px", paddingLeft: "60px" }}>{s.label}</div>
          <BooleanBand dates={s.dates} values={s.values} triggerDate={triggerDate} exitDate={exitDate} />
        </div>
      ))}
    </div>
  );
}

function LineChart({ dates, values, dataType, triggerDate, exitDate }: ChartProps) {
  if (dataType === "boolean_series") {
    return <BooleanBand dates={dates} values={values} triggerDate={triggerDate} exitDate={exitDate} />;
  }
  return (
    <MultiLineChart
      series={[{ label: "", dates, values, dataType, color: SERIES_COLORS[0] }]}
      triggerDate={triggerDate}
      exitDate={exitDate}
    />
  );
}

// ── Boolean Band ────────────────────────────────────────────────────────────

function BooleanBand({
  dates,
  values,
  triggerDate,
  exitDate,
}: {
  dates: number[];
  values: (number | boolean | null)[];
  triggerDate?: string;
  exitDate?: string;
}) {
  const W = 720;
  const H = 36;
  const PAD = { left: 60, right: 60 };
  const plotW = W - PAD.left - PAD.right;
  const barW = dates.length > 0 ? plotW / dates.length : 1;

  return (
    <svg width={W} height={H} style={{ display: "block" }}>
      {values.map((v, i) => {
        const isTrue = v === true || v === 1 || v === "true";
        return (
          <rect
            key={i}
            x={PAD.left + i * barW}
            y={4}
            width={Math.max(barW - 0.5, 0.5)}
            height={H - 8}
            fill={isTrue ? "#22c55e" : "#1f2937"}
            opacity={isTrue ? 0.7 : 0.3}
          />
        );
      })}
      {/* Trigger marker */}
      {(() => {
        const trigIdx = triggerDate
          ? dates.findIndex((d) => String(d) === String(triggerDate).replace(/\//g, ""))
          : -1;
        return trigIdx >= 0 ? (
          <line
            x1={PAD.left + trigIdx * barW}
            y1={0}
            x2={PAD.left + trigIdx * barW}
            y2={H}
            stroke="#f59e0b"
            strokeWidth={1.5}
            strokeDasharray="2,2"
          />
        ) : null;
      })()}
    </svg>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

// ── Tab styles ─────────────────────────────────────────────────────────────

const tabBar: React.CSSProperties = {
  display: "flex",
  gap: "0",
  marginBottom: "12px",
  borderBottom: "1px solid #1f2937",
};

const tabBtn = (active: boolean): React.CSSProperties => ({
  padding: "6px 16px",
  fontSize: "12px",
  fontWeight: active ? 600 : 400,
  color: active ? "#60a5fa" : "#9ca3af",
  background: "none",
  border: "none",
  borderBottom: active ? "2px solid #60a5fa" : "2px solid transparent",
  cursor: "pointer",
  marginBottom: "-1px",
});

// ── Audit Tab sub-component ────────────────────────────────────────────────

const flagGateStyle = (ok: boolean, gate: boolean): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "4px 10px",
  borderRadius: "4px",
  fontSize: "12px",
  fontFamily: "monospace",
  background: gate ? "#064e3b" : ok ? "#1f2937" : "#7f1d1d",
  color: gate ? "#6ee7b7" : ok ? "#9ca3af" : "#fca5a5",
  border: `1px solid ${gate ? "#065f46" : ok ? "#374151" : "#991b1b"}`,
});

function FlagSnapshotRow({ label, snap }: { label: string; snap: FlagSnapshotData }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
      <div style={flagGateStyle(snap.ok, snap.gate)}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <StatusBadge status={snap.gate ? "pass" : snap.ok ? "fail" : "error"} />
        {snap.numeric != null && (
          <span style={{ color: "#d1d5db" }}>= {snap.numeric.toFixed(4)}</span>
        )}
      </div>
      {snap.expression && (
        <span style={{ fontSize: "11px", color: "#6b7280", fontFamily: "monospace" }}>
          {snap.expression.length > 60 ? snap.expression.slice(0, 60) + "…" : snap.expression}
        </span>
      )}
    </div>
  );
}

function AuditTab({ context }: { context: TradeDetailPanelProps["context"] }) {
  const [audit, setAudit] = useState<AuditRecordData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const load = async () => {
      try {
        let data: AuditRecordData;
        if (context.kind === "backtest") {
          data = await auditClient.getBacktestAudit(
            context.runId, context.permId, context.tradeIdx
          );
        } else {
          data = await auditClient.getActiveAudit(
            context.activeId, context.tradeId
          );
        }
        setAudit(data);
      } catch (e: any) {
        setError(e.message || "Failed to load audit");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [context]);

  if (loading) {
    return <div style={{ color: "#9ca3af", fontSize: "12px", padding: "16px" }}>Loading audit record…</div>;
  }
  if (error) {
    return (
      <div style={{ color: "#6b7280", fontSize: "12px", padding: "16px" }}>
        No audit record available. Audit capture must be enabled in config.
      </div>
    );
  }
  if (!audit) return null;

  const entryFlags = Object.entries(audit.entry_flag_states || {});
  const exitFlags = Object.entries(audit.exit_flag_states || {});
  const fmtDate = (d: number | null) => d ? String(d).replace(/(\d{4})(\d{2})(\d{2})/, "$1/$2/$3") : "—";

  return (
    <div>
      {/* Decision summary */}
      <div style={{
        background: "#111827", borderRadius: "4px", padding: "10px 14px",
        marginBottom: "12px", fontSize: "12px", color: "#d1d5db",
        fontFamily: "monospace", lineHeight: "1.6",
      }}>
        <div>
          <span style={{ color: "#9ca3af" }}>Entry: </span>
          {fmtDate(audit.entry_date)} @ ${audit.entry_price?.toFixed(2)}
          {audit.sigma_at_trigger != null && (
            <span style={{ color: "#6b7280" }}> · σ = {audit.sigma_at_trigger.toFixed(4)}</span>
          )}
        </div>
        <div>
          <span style={{ color: "#9ca3af" }}>Exit: </span>
          {audit.exit_date ? (
            <>
              {fmtDate(audit.exit_date)} @ ${audit.exit_price?.toFixed(2)}
              <span style={{ color: "#6b7280" }}> · {audit.exit_trigger_type}</span>
              {audit.exit_stop_level != null && (
                <span style={{ color: "#6b7280" }}> · stop = {audit.exit_stop_level.toFixed(2)}</span>
              )}
            </>
          ) : (
            <span style={{ color: "#f59e0b" }}>Open</span>
          )}
        </div>
      </div>

      {/* Side-by-side flag states */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <div>
          <div style={{ ...sectionLabel, marginBottom: "8px" }}>Entry Flag States</div>
          {entryFlags.length === 0 ? (
            <div style={{ color: "#6b7280", fontSize: "11px" }}>No entry flags captured</div>
          ) : (
            entryFlags.map(([label, snap]) => (
              <FlagSnapshotRow key={label} label={label} snap={snap} />
            ))
          )}
        </div>
        <div>
          <div style={{ ...sectionLabel, marginBottom: "8px" }}>Exit Flag States</div>
          {exitFlags.length === 0 ? (
            <div style={{ color: "#6b7280", fontSize: "11px" }}>No exit flags captured</div>
          ) : (
            exitFlags.map(([label, snap]) => (
              <FlagSnapshotRow key={label} label={label} snap={snap} />
            ))
          )}
        </div>
      </div>

      {/* Meta details */}
      {(audit.sweep_version || audit.config_sha1) && (
        <div style={{ marginTop: "12px", fontSize: "10px", color: "#4b5563" }}>
          {audit.sweep_version && <span>Version: {audit.sweep_version} · </span>}
          {audit.config_sha1 && <span>Config: {audit.config_sha1.slice(0, 8)}</span>}
        </div>
      )}

      {/* Sub-expression values */}
      {((audit as any).entry_sub_values || (audit as any).exit_sub_values) && (
        <div style={{ marginTop: "16px" }}>
          <div style={{ ...sectionLabel, marginBottom: "8px" }}>Sub-Expression Values</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            {(audit as any).entry_sub_values && Object.keys((audit as any).entry_sub_values).length > 0 && (
              <div>
                <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "6px", fontWeight: 600 }}>At Entry ({fmtDate(audit.entry_date)})</div>
                <div style={{
                  background: "#111827", borderRadius: "4px", padding: "8px 10px",
                  fontFamily: "monospace", fontSize: "11px", lineHeight: "1.8",
                }}>
                  {Object.entries((audit as any).entry_sub_values).map(([label, val]) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", color: "#d1d5db" }}>
                      <span style={{ color: "#9ca3af" }}>{label}</span>
                      <span style={{
                        color: val === true ? "#6ee7b7" : val === false ? "#fca5a5" : typeof val === "string" && String(val).startsWith("error") ? "#ef4444" : "#e5e7eb",
                      }}>
                        {val === null ? "—" : typeof val === "boolean" ? String(val) : typeof val === "number" ? (val as number).toFixed(4) : String(val)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(audit as any).exit_sub_values && Object.keys((audit as any).exit_sub_values).length > 0 && (
              <div>
                <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "6px", fontWeight: 600 }}>At Exit ({fmtDate(audit.exit_date)})</div>
                <div style={{
                  background: "#111827", borderRadius: "4px", padding: "8px 10px",
                  fontFamily: "monospace", fontSize: "11px", lineHeight: "1.8",
                }}>
                  {Object.entries((audit as any).exit_sub_values).map(([label, val]) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", color: "#d1d5db" }}>
                      <span style={{ color: "#9ca3af" }}>{label}</span>
                      <span style={{
                        color: val === true ? "#6ee7b7" : val === false ? "#fca5a5" : typeof val === "string" && String(val).startsWith("error") ? "#ef4444" : "#e5e7eb",
                      }}>
                        {val === null ? "—" : typeof val === "boolean" ? String(val) : typeof val === "number" ? (val as number).toFixed(4) : String(val)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TradeDetailPanel({ context, onClose }: TradeDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<"data" | "audit">("data");
  const [depData, setDepData] = useState<DependencyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDeps, setSelectedDeps] = useState<Set<string>>(new Set());
  const [seriesCache, setSeriesCache] = useState<Record<string, SeriesResponse>>({});
  const [seriesLoading, setSeriesLoading] = useState<Set<string>>(new Set());
  const [showTable, setShowTable] = useState(false);

  // Load dependencies on mount
  useEffect(() => {
    setLoading(true);
    setError(null);
    const load = async () => {
      try {
        let resp: DependencyResponse;
        if (context.kind === "backtest") {
          resp = await auditClient.getBacktestDependencies(
            context.runId, context.permId, context.tradeIdx
          );
        } else {
          resp = await auditClient.getActiveDependencies(
            context.activeId, context.tradeId
          );
        }
        setDepData(resp);
        // Auto-select first primitive if available
        const firstPrim = resp.dependencies.find((d) => d.node_type === "primitive");
        if (firstPrim) {
          setSelectedDeps(new Set([firstPrim.label]));
        }
      } catch (e: any) {
        setError(e.message || "Failed to load dependencies");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [context]);

  // Load series when selection changes
  useEffect(() => {
    if (!depData) return;
    for (const label of selectedDeps) {
      if (seriesCache[label] || seriesLoading.has(label)) continue;
      const dep = depData.dependencies.find((d) => d.label === label);
      if (!dep) continue;

      setSeriesLoading((prev) => new Set(prev).add(label));
      const loadSeries = async () => {
        try {
          let resp: SeriesResponse;
          if (context.kind === "backtest") {
            resp = await auditClient.getBacktestSeries(
              context.runId, context.permId, context.tradeIdx, dep.expression
            );
          } else {
            resp = await auditClient.getActiveSeries(
              context.activeId, context.tradeId, dep.expression
            );
          }
          setSeriesCache((prev) => ({ ...prev, [label]: resp }));
        } catch {
          // Series endpoint may not be implemented yet (501)
          // Silently skip — the UI shows the dependency tree regardless
        } finally {
          setSeriesLoading((prev) => {
            const next = new Set(prev);
            next.delete(label);
            return next;
          });
        }
      };
      loadSeries();
    }
  }, [selectedDeps, depData, context]);

  // Toggle dependency selection
  const toggleDep = (label: string) => {
    setSelectedDeps((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  // ── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ ...panelWrap, color: "#6b7280", fontSize: "12px" }}>
        Loading trade data…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ ...panelWrap, color: "#ef4444", fontSize: "12px" }}>
        Error: {error}
      </div>
    );
  }

  if (!depData) return null;

  const { trade, expression, dependencies, groups, max_lookback } = depData;
  const exit_expressions: string[] = (depData as any).exit_expressions || [];

  // Group dependencies for the dropdown
  const orderedGroups = NODE_TYPE_ORDER
    .filter((nt) => groups[nt] && groups[nt].length > 0)
    .map((nt) => ({ type: nt, deps: groups[nt] }));

  return (
    <div style={panelWrap}>
      {/* Header */}
      <div style={headerRow}>
        <div>
          <span style={headerTitle}>
            {trade.ticker} — {trade.strategy}
          </span>
          <span style={{ ...headerMeta, marginLeft: "12px" }}>
            Trigger: {formatDate(trade.trigger_date)}
            {trade.exit_date && <> → Exit: {formatDate(trade.exit_date)}</>}
            {trade.buy_price && <> @ ${Number(trade.buy_price).toFixed(2)}</>}
          </span>
        </div>
        {onClose && (
          <button style={closeBtn} onClick={onClose} title="Close" aria-label="Close">
            <X size={14} aria-hidden />
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div style={tabBar}>
        <button style={tabBtn(activeTab === "data")} onClick={() => setActiveTab("data")}>
          Data
        </button>
        <button style={tabBtn(activeTab === "audit")} onClick={() => setActiveTab("audit")}>
          Audit
        </button>
      </div>

      {/* Audit tab */}
      {activeTab === "audit" && <AuditTab context={context} />}

      {/* Data tab (existing content) */}
      {activeTab === "data" && <>

      {/* Expression display */}
      <div
        style={{
          fontSize: "11px",
          color: "#9ca3af",
          fontFamily: "monospace",
          padding: "6px 8px",
          background: "#020617",
          borderRadius: "3px",
          marginBottom: "12px",
          overflowX: "auto",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ color: "#6b7280" }}>Entry: </span>{expression}
        {exit_expressions.length > 0 && (
          <>
            <br />
            <span style={{ color: "#6b7280" }}>Exit: </span>
            {exit_expressions.join(" AND ")}
          </>
        )}
      </div>

      {/* Dependency selector — grouped chips */}
      <div style={sectionLabel}>Data Series</div>
      {orderedGroups.map(({ type, deps: groupDeps }) => (
        <div key={type} style={{ marginBottom: "8px" }}>
          <div style={{ fontSize: "10px", color: "#4b5563", marginBottom: "3px" }}>
            {groupLabel(type)}
          </div>
          <div style={dropdownWrap}>
            {groupDeps.map((dep) => {
              const isSelected = selectedDeps.has(dep.label);
              const colors = chipColors[dep.node_type] || chipColors.boolean;
              return (
                <button
                  key={dep.label}
                  onClick={() => toggleDep(dep.label)}
                  style={{
                    ...chipBase,
                    background: isSelected ? colors.bg : "transparent",
                    borderColor: isSelected ? colors.border : "#374151",
                    color: isSelected ? colors.text : "#6b7280",
                    fontWeight: isSelected ? 600 : 400,
                  }}
                >
                  {dep.label}
                  {isSelected && seriesLoading.has(dep.label) && (
                    <Loader2
                      size={11}
                      style={{ marginLeft: 4, verticalAlign: 'middle', animation: 'icon-button-spin 0.7s linear infinite' }}
                      aria-hidden
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Charts for selected series — overlay numeric, stack booleans */}
      {(() => {
        const selected = Array.from(selectedDeps);
        const loadingLabels = selected.filter(l => seriesLoading.has(l) && !seriesCache[l]);
        const readyLabels = selected.filter(l => seriesCache[l]);

        if (loadingLabels.length > 0 && readyLabels.length === 0) {
          return (
            <div style={chartContainer}>
              <div style={{ color: "#4b5563", fontSize: "11px", padding: "8px" }}>
                Loading series data…
              </div>
            </div>
          );
        }

        if (readyLabels.length === 0) return null;

        const multiSeries: MultiSeriesEntry[] = readyLabels.map((label, i) => ({
          label,
          dates: seriesCache[label].dates,
          values: seriesCache[label].values,
          dataType: seriesCache[label].data_type,
          color: SERIES_COLORS[i % SERIES_COLORS.length],
        }));

        return (
          <div style={chartContainer}>
            <MultiLineChart
              series={multiSeries}
              triggerDate={trade.trigger_date}
              exitDate={trade.exit_date ?? undefined}
            />
          </div>
        );
      })()}

      {/* Data table toggle */}
      {Array.from(selectedDeps).some((l) => seriesCache[l]) && (
        <div>
          <button
            onClick={() => setShowTable(!showTable)}
            style={{
              ...chipBase,
              borderColor: "#374151",
              color: "#9ca3af",
              background: showTable ? "#1f2937" : "transparent",
              marginBottom: "8px",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {showTable ? "Hide Data Table" : "Show Data Table"}
            {showTable
              ? <ChevronUp size={12} aria-hidden />
              : <ChevronDown size={12} aria-hidden />}
          </button>
          {showTable && (
            <div style={tableContainer}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Date</th>
                    {Array.from(selectedDeps)
                      .filter((l) => seriesCache[l])
                      .map((label) => (
                        <th key={label} style={thStyle}>
                          {label}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const activeSeries = Array.from(selectedDeps).filter(
                      (l) => seriesCache[l]
                    );
                    if (activeSeries.length === 0) return null;
                    const dates = seriesCache[activeSeries[0]].dates;
                    return dates.map((d, i) => (
                      <tr key={d}>
                        <td style={tdStyle}>{formatDate(d)}</td>
                        {activeSeries.map((label) => {
                          const val = seriesCache[label].values[i];
                          return (
                            <td key={label} style={tdStyle}>
                              {val === null || val === undefined
                                ? "—"
                                : typeof val === "boolean"
                                ? val
                                  ? "True"
                                  : "False"
                                : typeof val === "number"
                                ? val.toFixed(4)
                                : String(val)}
                            </td>
                          );
                        })}
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Lookback info */}
      </>}

      {activeTab === "data" && (
      <div
        style={{ fontSize: "10px", color: "#4b5563", marginTop: "8px", textAlign: "right" }}
      >
        Max lookback: {max_lookback} bars · {dependencies.length} dependencies
      </div>
      )}
    </div>
  );
}
