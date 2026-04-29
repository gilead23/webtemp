import React, { useEffect, useMemo, useReducer, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Modal from "../components/ui/Modal";
import { artifactClient } from "../services/artifactClient";
import TradeDetailPanel from "../components/TradeDetailPanel";
import { SortIndicator } from "../components/ui/SortIndicator";

type TradeRow = {
  perm_id: string;
  trade_idx: number | string;
  days_open: number | string;
  days_ago: number | string;
  fold: number | string;
  Ticker: string;
  Strategy: string;
  Trigger_Date: string;
  Close_Date: string | null;
  Exit_Date: string | null;
  Trigger_Close: number | string;
  Return: number | string;
  MaxReturn: number | string;
  MaxReturn_Day: number | string;
  MaxDrawDown: number | string;
  StopTriggered: boolean | string | number;
  expected_return: number | string;
  Sell_Price: number | string;
  buy_price: number | string;
  DaysHeld: number | string;
  stop_level: number | string;
  trigger_type: string;
  [k: string]: any;
};

type TradesState = {
  loading: boolean;
  error: string | null;
  rawCsv: string | null;
  trades: TradeRow[];
};

type TradesAction =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; csv: string; trades: TradeRow[] }
  | { type: "FETCH_ERROR"; error: string };

const initialState: TradesState = {
  loading: false,
  error: null,
  rawCsv: null,
  trades: [],
};

function tradesReducer(state: TradesState, action: TradesAction): TradesState {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, loading: true, error: null };
    case "FETCH_SUCCESS":
      return {
        ...state,
        loading: false,
        rawCsv: action.csv,
        trades: action.trades,
        error: null,
      };
    case "FETCH_ERROR":
      return { ...state, loading: false, error: action.error };
    default:
      return state;
  }
}

function parseCsvTrades(csv: string): TradeRow[] {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return [];

  const headerLine = lines[0];
  const headers = headerLine.split(",").map((h) => h.trim());

  const rows: TradeRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const fields: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (ch === '"') {
        if (inQuotes && line[j + 1] === '"') {
          current += '"';
          j++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    fields.push(current);

    const row: any = {};
    headers.forEach((h, idx) => {
      row[h] = fields[idx] ?? "";
    });

    rows.push(row as TradeRow);
  }

  return rows;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const s = String(value).trim();
  if (!s) return "";

  // Accept common encodings and normalize to YYYY/MM/DD.
  // - YYYYMMDD (e.g. 20250101)
  // - YYYY-MM-DD
  // - YYYY/MM/DD
  // - Strings with a leading date (e.g. YYYY-MM-DDTHH:mm:ss...)
  const head10 = s.slice(0, 10);
  const head8 = s.slice(0, 8);

  if (/^\d{8}$/.test(head8)) {
    const yyyy = head8.slice(0, 4);
    const mm = head8.slice(4, 6);
    const dd = head8.slice(6, 8);
    return `${yyyy}/${mm}/${dd}`;
  }

  const m10 = head10.match(/^(\d{4})[-\/](\d{2})[-\/](\d{2})$/);
  if (m10) {
    return `${m10[1]}/${m10[2]}/${m10[3]}`;
  }

  return s;
}

const COLS: Array<{ key: keyof TradeRow; label: string; minWidth?: number }> = [
  { key: "DaysHeld", label: "Days", minWidth: 60 },
  { key: "Ticker", label: "Ticker", minWidth: 60 },
  { key: "Strategy", label: "Strategy", minWidth: 140 },
  { key: "Trigger_Date", label: "Trig Date", minWidth: 110 },
  { key: "Close_Date", label: "Close", minWidth: 110 },
  { key: "Exit_Date", label: "Exit", minWidth: 110 },
  { key: "Trigger_Close", label: "Trig Close", minWidth: 70 },
  { key: "Return", label: "Ret", minWidth: 60 },
  { key: "MaxReturn", label: "Max Ret", minWidth: 70 },
  { key: "MaxReturn_Day", label: "MaxRet Day", minWidth: 70 },
  { key: "MaxDrawDown", label: "Max DD", minWidth: 70 },
  { key: "StopTriggered", label: "Stopped?", minWidth: 70 },
  { key: "Sell_Price", label: "Sell", minWidth: 60 },
  { key: "buy_price", label: "Buy", minWidth: 60 },
  { key: "stop_level", label: "Stop Lvl", minWidth: 70 },
  { key: "trigger_type", label: "Trigger", minWidth: 90 },
];

const NUMERIC_FIELDS = new Set<string>([
  "trade_idx",
  "days_open",
  "days_ago",
  "fold",
  "Trigger_Close",
  "Return",
  "MaxReturn",
  "MaxReturn_Day",
  "MaxDrawDown",
  "expected_return",
  "Sell_Price",
  "buy_price",
  "DaysHeld",
  "stop_level",
]);

const PAGE_SIZE = 200;


function formatCell(key: keyof TradeRow, raw: any): string {
  if (raw === null || raw === undefined || raw === "") return "";

  if (key === "StopTriggered") {
    if (typeof raw === "boolean") return raw ? "Yes" : "No";
    const s = String(raw).toLowerCase();
    if (s === "true" || s === "1" || s === "y" || s === "yes") return "Yes";
    if (s === "false" || s === "0" || s === "n" || s === "no") return "No";
    return String(raw);
  }

  const k = String(key);


  if (k === "Return" || k === "MaxReturn" || k === "MaxDrawDown") {
    const num = typeof raw === "number" ? raw : parseFloat(String(raw));
    if (!Number.isNaN(num)) return `${(num * 100.0).toFixed(2)}%`;
  }

  if (k === "MaxReturn_Day") {
    const num = typeof raw === "number" ? raw : parseFloat(String(raw));
    if (!Number.isNaN(num)) return String(Math.round(num));
  }

  if (k === "DaysHeld" || k === "days_open" || k === "days_ago") {
    const num = typeof raw === "number" ? raw : parseFloat(String(raw));
    if (!Number.isNaN(num)) return String(Math.round(num));
  }

  if (NUMERIC_FIELDS.has(k)) {
    const num = typeof raw === "number" ? raw : parseFloat(String(raw));
    if (!Number.isNaN(num)) return num.toFixed(2);
  }

  if (k === "Trigger_Date" || k === "Close_Date" || k === "Exit_Date") {
    return formatDate(String(raw));
  }

  return String(raw);
}

const td: React.CSSProperties = {
  padding: "3px 4px",
  fontSize: "10px",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const tdNum: React.CSSProperties = {
  ...td,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
};

const headerCell: React.CSSProperties = {
  padding: "4px 4px",
  fontSize: "10px",
  whiteSpace: "normal",
  textAlign: "left",
  borderBottom: "1px solid #1f2937",
  color: "#e5e7eb",
  position: "sticky",
  top: 0,
  zIndex: 5,
  backgroundColor: "#020617",
};

const headerCellNum: React.CSSProperties = {
  ...headerCell,
  textAlign: "right",
};

const tableStyle: React.CSSProperties = {
  borderCollapse: "collapse",
  width: "100%",
  tableLayout: "fixed",
};

const containerStyle: React.CSSProperties = {
  padding: "12px 16px",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, -system-ui, sans-serif',
  fontSize: "12px",
};

const tableWrapper: React.CSSProperties = {

  border: "1px solid #1f2937",
  borderRadius: "6px",
  overflowX: "auto",
  overflowY: "auto",
  maxHeight: "70vh",
};

const headerRow: React.CSSProperties = {
  backgroundColor: "#020617",
};

const metaRow: React.CSSProperties = {
  marginBottom: "8px",
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  fontSize: "11px",
};

const metaLabel: React.CSSProperties = {
  fontWeight: 600,
};

const badge: React.CSSProperties = {
  display: "inline-block",
  padding: "2px 6px",
  borderRadius: "4px",
  backgroundColor: "rgba(15, 23, 42, 0.85)",
  border: "1px solid #4b5563",
  fontSize: "10px",
  color: "#e5e7eb",
  maxWidth: "100%",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

function decodePermId(encoded: string | undefined): string | null {
  if (!encoded) return null;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
}


type HistogramBin = {
  x0: number;
  x1: number;
  count: number;
};

type HistogramModel = {
  bins: HistogramBin[];
  min: number;
  max: number;
  maxCount: number;
};

function computeHistogramZeroSplit(values: number[], binCount: number): HistogramModel | null {
  const cleaned = values.filter((v) => Number.isFinite(v));
  if (cleaned.length === 0) return null;

  // Raw min/max
  let min = cleaned[0];
  let max = cleaned[0];
  for (let i = 1; i < cleaned.length; i++) {
    const v = cleaned[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }

  // Robust range (trim outliers) so the histogram doesn't waste most bins on extreme tails.
  // Values outside [rangeMin, rangeMax] are clamped into the first/last bin.
  let rangeMin = min;
  let rangeMax = max;
  if (cleaned.length >= 20) {
    const sorted = [...cleaned].sort((a, b) => a - b);
    const loIdx = Math.max(0, Math.floor((sorted.length - 1) * 0.01));
    const hiIdx = Math.min(sorted.length - 1, Math.ceil((sorted.length - 1) * 0.99));
    const lo = sorted[loIdx];
    const hi = sorted[hiIdx];
    if (Number.isFinite(lo) && Number.isFinite(hi) && lo < hi) {
      rangeMin = lo;
      rangeMax = hi;
    }
  }

  if (binCount <= 0) binCount = 1;

  // All values identical -> single bin.
  if (rangeMin === rangeMax) {
    return {
      bins: [{ x0: rangeMin, x1: rangeMax, count: cleaned.length }],
      min: rangeMin,
      max: rangeMax,
      maxCount: cleaned.length,
    };
  }

  const bins: HistogramBin[] = [];

  const pushBins = (xStart: number, xEnd: number, n: number) => {
    if (n <= 0) return;
    const width = (xEnd - xStart) / n;
    for (let i = 0; i < n; i++) {
      const x0 = xStart + i * width;
      const x1 = i === n - 1 ? xEnd : xStart + (i + 1) * width;
      bins.push({ x0, x1, count: 0 });
    }
  };

  // Ensure 0 is a hard boundary when the range straddles it.
  if (rangeMin < 0 && rangeMax > 0) {
    const negBins = Math.floor(binCount / 2);
    const posBins = binCount - negBins;
    // Negative bins cover [min, 0)
    pushBins(rangeMin, 0, Math.max(1, negBins));
    // Positive bins cover [0, max]
    pushBins(0, rangeMax, Math.max(1, posBins));
  } else {
    pushBins(rangeMin, rangeMax, binCount);
  }

  const pickIndex = (v: number) => {
    // Find bin by range; bins are ordered.
    // v==max should land in last bin.
    for (let i = 0; i < bins.length; i++) {
      const b = bins[i];
      const isLast = i === bins.length - 1;
      if (v >= b.x0 && (v < b.x1 || (isLast && v <= b.x1))) return i;
    }
    // Shouldn't happen due to min/max computed from values.
    return bins.length - 1;
  };

  for (let i = 0; i < cleaned.length; i++) {
    const v0 = cleaned[i];
    const v = v0 < rangeMin ? rangeMin : v0 > rangeMax ? rangeMax : v0;
    bins[pickIndex(v)].count += 1;
  }

  let maxCount = 0;
  for (let i = 0; i < bins.length; i++) {
    if (bins[i].count > maxCount) maxCount = bins[i].count;
  }

  return { bins, min: rangeMin, max: rangeMax, maxCount };
}

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function rgb(r: number, g: number, b: number): string {
  return `rgb(${r}, ${g}, ${b})`;
}

function colorForValueDiverging(v: number, min: number, max: number): string {
  // Red -> Neutral -> Green, centered at 0 when range straddles 0.
  const RED = { r: 220, g: 38, b: 38 };
  const NEU = { r: 107, g: 114, b: 128 };
  const GRN = { r: 34, g: 197, b: 94 };

  // Non-linear (gamma) mapping to make colors pop sooner:
  // - negative side: stay red longer (less "grey")
  // - positive side: turn green faster (less "grey")
  const NEG_GAMMA = 3.0;
  const POS_GAMMA = 0.35;

  if (min < 0 && max > 0) {
    if (v < 0) {
      const t = clamp01((v - min) / (0 - min)); // min..0 => 0..1
      const tt = Math.pow(t, NEG_GAMMA);
      return rgb(
        lerp(RED.r, NEU.r, tt),
        lerp(RED.g, NEU.g, tt),
        lerp(RED.b, NEU.b, tt)
      );
    }
    if (v > 0) {
      const t = clamp01((v - 0) / (max - 0)); // 0..max => 0..1
      const tt = Math.pow(t, POS_GAMMA);
      return rgb(
        lerp(NEU.r, GRN.r, tt),
        lerp(NEU.g, GRN.g, tt),
        lerp(NEU.b, GRN.b, tt)
      );
    }
    return rgb(NEU.r, NEU.g, NEU.b);
  }

  // Range is single-sided: shade toward the extreme.
  if (max <= 0) {
    const t = clamp01((v - min) / (max - min)); // min..max => 0..1
    const tt = Math.pow(t, NEG_GAMMA);
    return rgb(lerp(RED.r, NEU.r, tt), lerp(RED.g, NEU.g, tt), lerp(RED.b, NEU.b, tt));
  }

  // min >= 0
  const t = clamp01((v - min) / (max - min)); // min..max => 0..1
  const tt = Math.pow(t, POS_GAMMA);
  return rgb(lerp(NEU.r, GRN.r, tt), lerp(NEU.g, GRN.g, tt), lerp(NEU.b, GRN.b, tt));
}

type HistogramProps = {
  title: string;
  values: number[];
  binCount?: number;
  valueFormatter: (v: number) => string;
  xLabel: string;
  yLabel: string;
};

const histogramCard: React.CSSProperties = {
  border: "1px solid #1f2937",
  borderRadius: "6px",
  padding: "10px 10px 8px 10px",
  flex: "1 1 420px",
  minWidth: "340px",
  background: "#0b1220",
};

const histogramTitle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  margin: 0,
  marginBottom: "6px",
  color: "#e5e7eb",
};

const histogramPlotWrap: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "44px 1fr",
  gridTemplateRows: "160px auto auto",
  columnGap: "8px",
};

const yAxisCell: React.CSSProperties = {
  position: "relative",
  height: "160px",
};

const yTickLabel: React.CSSProperties = {
  position: "absolute",
  left: 0,
  transform: "translateY(50%)",
  fontSize: "10px",
  color: "#e5e7eb",
  fontWeight: 700,
};

const yAxisLabel: React.CSSProperties = {
  position: "absolute",
  left: "-2px",
  top: "50%",
  transform: "translate(-100%, -50%) rotate(-90deg)",
  transformOrigin: "center",
  fontSize: "10px",
  fontWeight: 700,
  color: "#e5e7eb",
  whiteSpace: "nowrap",
};

const barsCell: React.CSSProperties = {
  height: "160px",
  display: "flex",
  alignItems: "flex-end",
  gap: "2px",
  border: "1px solid #1f2937",
  borderRadius: "8px",
  padding: "6px 6px 4px 6px",
  backgroundColor: "#020617",
  position: "relative",
  overflow: "hidden",
};

const gridLine: React.CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  height: "1px",
  backgroundColor: "#111827",
};

const xTickRow: React.CSSProperties = {
  gridColumn: "2 / 3",
  display: "flex",
  justifyContent: "space-between",
  fontSize: "10px",
  color: "#e5e7eb",
  fontWeight: 700,
  marginTop: "4px",
};

const xAxisLabel: React.CSSProperties = {
  gridColumn: "2 / 3",
  textAlign: "center",
  fontSize: "10px",
  fontWeight: 700,
  color: "#e5e7eb",
  marginTop: "2px",
};

const tooltipStyle: React.CSSProperties = {
  position: "absolute",
  zIndex: 10,
  pointerEvents: "none",
  backgroundColor: "#0b1220",
  border: "1px solid #1f2937",
  borderRadius: "10px",
  padding: "6px 8px",
  boxShadow: "0 8px 22px rgba(0, 0, 0, 0.35)",
  fontSize: "11px",
  color: "#e5e7eb",
  whiteSpace: "nowrap",
};

const Histogram: React.FC<HistogramProps> = ({
  title,
  values,
  binCount,
  valueFormatter,
  xLabel,
  yLabel,
}) => {
  const barsRef = React.useRef<HTMLDivElement | null>(null);
  const [autoBinCount, setAutoBinCount] = useState<number | null>(null);

  useEffect(() => {
    if (binCount != null) return;
    const el = barsRef.current;
    if (!el) return;

    const compute = () => {
      const rect = el.getBoundingClientRect();
      // barsCell has left/right padding of 6px and gap of 2px; target a ~6px bar.
      const innerW = Math.max(0, rect.width - 12);
      const targetPerBar = 8; // ~6px bar + ~2px gap
      const wanted = Math.floor(innerW / targetPerBar);
      const clamped = Math.max(24, Math.min(140, wanted));
      setAutoBinCount(clamped);
    };

    compute();

    const ro = new ResizeObserver(() => compute());
    ro.observe(el);
  

  return () => ro.disconnect();
  }, [binCount]);

  const effectiveBinCount = binCount ?? autoBinCount ?? 60;

  const hist = useMemo(
    () => computeHistogramZeroSplit(values, effectiveBinCount),
    [values, effectiveBinCount]
  );
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null);

  if (!hist) {
    return (
      <div style={histogramCard}>
        <p style={histogramTitle}>{title}</p>
        <div style={{ fontSize: "11px", color: "#9ca3af" }}>No data</div>
      </div>
    );
  }

  const yTicks = [0, Math.round(hist.maxCount / 2), hist.maxCount];
  const yTickPosPct = (count: number) => {
    if (hist.maxCount <= 0) return 0;
    return (count / hist.maxCount) * 100;
  };

  const xTicks =
    hist.min < 0 && hist.max > 0
      ? [hist.min, hist.min / 2, 0, hist.max / 2, hist.max]
      : [
          hist.min,
          hist.min + (hist.max - hist.min) * 0.25,
          hist.min + (hist.max - hist.min) * 0.5,
          hist.min + (hist.max - hist.min) * 0.75,
          hist.max,
        ];

  const hovered = hoverIdx != null ? hist.bins[hoverIdx] : null;

  const tooltipPos = (() => {
    if (!mouse) return null;
    const pad = 8;
    const approxW = 190;
    const approxH = 46;
    let left = mouse.x + 12;
    let top = mouse.y - approxH - 10;

    // Keep tooltip in-bounds (approximate; stable enough for our container).
    const maxLeft = 600 - approxW;
    const maxTop = 160 - approxH;
    if (left > maxLeft) left = mouse.x - approxW - 12;
    left = Math.max(pad, left);
    top = Math.max(pad, Math.min(top, maxTop));
    return { left, top };
  })();

  return (
    <div style={histogramCard}>
      <p style={histogramTitle}>{title}</p>

      <div style={histogramPlotWrap}>
        <div style={yAxisCell}>
          <div style={yAxisLabel}>{yLabel}</div>
          {yTicks.map((t) => (
            <div
              key={t}
              style={{
                ...yTickLabel,
                bottom: `${yTickPosPct(t)}%`,
              }}
            >
              {t}
            </div>
          ))}
        </div>

        <div
          ref={barsRef}
          style={barsCell}
          onMouseLeave={() => {
            setHoverIdx(null);
            setMouse(null);
          }}
          onMouseMove={(e) => {
            const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
            setMouse({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          }}
        >
          {yTicks.map((t) => (
            <div
              key={t}
              style={{
                ...gridLine,
                bottom: `${yTickPosPct(t)}%`,
              }}
            />
          ))}

          {hovered && tooltipPos && (
            <div style={{ ...tooltipStyle, left: tooltipPos.left, top: tooltipPos.top }}>
              <div style={{ fontWeight: 800 }}>
                {valueFormatter(hovered.x0)} → {valueFormatter(hovered.x1)}
              </div>
              <div>Trades: {hovered.count}</div>
            </div>
          )}

          {hist.bins.map((b, i) => {
            const h = hist.maxCount > 0 ? Math.round((b.count / hist.maxCount) * 100) : 0;
            const center = (b.x0 + b.x1) / 2;
            const color = colorForValueDiverging(center, hist.min, hist.max);
            return (
              <div
                key={i}
                onMouseEnter={() => setHoverIdx(i)}
                style={{
                  width: `${100 / hist.bins.length}%`,
                  height: `${h}%`,
                  backgroundColor: color,
                  borderRadius: "3px",
                }}
              />
            );
          })}
        </div>

        <div />

        <div style={xTickRow}>
          {xTicks.map((t, i) => (
            <span key={i}>{valueFormatter(t)}</span>
          ))}
        </div>

        <div />

        <div style={xAxisLabel}>{xLabel}</div>
      </div>
    </div>
  );
};

function buildTradeCsvUrl(runId: string, permKeyEncoded: string): string {
  return `/api/runs/${encodeURIComponent(runId)}/trades/${encodeURIComponent(
    permKeyEncoded
  )}.csv`;
}

const TradesPage: React.FC = () => {
  const params = useParams<{ runId?: string; permId?: string }>();
  const runIdParam = params.runId ?? "";
  const permIdParam = params.permId ?? "";

  const [state, dispatch] = useReducer(tradesReducer, initialState);
  const [sortKey, setSortKey] = useState<keyof TradeRow>("trade_idx");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const [promoteModalOpen, setPromoteModalOpen] = useState(false);
  const [expandedTradeIdx, setExpandedTradeIdx] = useState<number | null>(null);
  const [promoteName, setPromoteName] = useState("");
  const [promoteDescription, setPromoteDescription] = useState("");
  const [promoteBusy, setPromoteBusy] = useState(false);
  const [promoteError, setPromoteError] = useState<string | null>(null);
  const [promotedActiveId, setPromotedActiveId] = useState<string | null>(null);

  function onPromote() {
    setPromoteError(null);
    setPromotedActiveId(null);
    if (!runIdParam || !permIdParam) {
      setPromoteError("Missing runId/permId in route.");
      return;
    }
    setPromoteName("");
    setPromoteDescription("");
    setPromoteModalOpen(true);
  }

  async function confirmPromote() {
    if (!runIdParam || !permIdParam) {
      setPromoteError("Missing runId/permId in route.");
      return;
    }
    if (!promoteName.trim()) {
      setPromoteError("name is required");
      return;
    }
    if (!promoteDescription.trim()) {
      setPromoteError("description is required");
      return;
    }
    setPromoteBusy(true);
    setPromoteError(null);
    setPromotedActiveId(null);
    try {
      const resp = await artifactClient.promotePermutation(runIdParam, permIdParam, promoteName.trim(), promoteDescription.trim());
      setPromotedActiveId(resp?.active_id || null);
      setPromoteModalOpen(false);
    } catch (e: any) {
      setPromoteError(String(e?.message || e));
    } finally {
      setPromoteBusy(false);
    }
  }

  const decodedPermId = decodePermId(permIdParam);

  const totalReturnPctValues = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < state.trades.length; i++) {
      const r = state.trades[i];
      const v = r?.Return;
      const num = typeof v === "number" ? v : parseFloat(String(v));
      if (Number.isFinite(num)) out.push(num * 100.0);
    }
    return out;
  }, [state.trades]);

  const avgDailyReturnPctValues = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < state.trades.length; i++) {
      const r = state.trades[i];
      const v = r?.Return;
      const d = r?.DaysHeld;
      const ret = typeof v === "number" ? v : parseFloat(String(v));
      const days = typeof d === "number" ? d : parseFloat(String(d));
      if (!Number.isFinite(ret) || !Number.isFinite(days) || days <= 0) continue;
      out.push((ret / days) * 100.0);
    }
    return out;
  }, [state.trades]);


  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    async function load() {
      if (!runIdParam || !permIdParam) {
        dispatch({
          type: "FETCH_ERROR",
          error: "Missing run or permutation id in route params.",
        });
        return;
      }

      dispatch({ type: "FETCH_START" });

      try {
        const tradeCsvUrl = buildTradeCsvUrl(runIdParam, permIdParam);
        const resp = await fetch(tradeCsvUrl, { signal });

        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(
            `Failed to fetch trades CSV (${resp.status} ${resp.statusText}): ${text}`
          );
        }

        const csv = await resp.text();
        const trades = parseCsvTrades(csv);

        dispatch({
          type: "FETCH_SUCCESS",
          csv,
          trades,
        });
      } catch (err: any) {
        if (signal.aborted) return;
        dispatch({
          type: "FETCH_ERROR",
          error: err?.message ?? String(err),
        });
      }
    }

    load();
    return () => controller.abort();
  }, [runIdParam, permIdParam]);

  const sortedRows = useMemo(() => {
    const rows = [...state.trades];
    rows.sort((a, b) => {
      const key = sortKey;
      const isNum = NUMERIC_FIELDS.has(String(key));

      const av = a[key];
      const bv = b[key];

      let cmp = 0;

      if (isNum) {
        const na = av === null || av === undefined || av === "" ? NaN : Number(av);
        const nb = bv === null || bv === undefined || bv === "" ? NaN : Number(bv);

        if (Number.isNaN(na) && Number.isNaN(nb)) {
          cmp = 0;
        } else if (Number.isNaN(na)) {
          cmp = 1;
        } else if (Number.isNaN(nb)) {
          cmp = -1;
        } else {
          cmp = na - nb;
        }
      } else {
        const sa = av === null || av === undefined ? "" : String(av);
        const sb = bv === null || bv === undefined ? "" : String(bv);
        cmp = sa.localeCompare(sb);
      }

      return sortDir === "asc" ? cmp : -cmp;
    });

    return rows;
  }, [state.trades, sortKey, sortDir]);

  const pageInfo = useMemo(() => {
    const total = sortedRows.length;
    const pageCount = total === 0 ? 1 : Math.ceil(total / PAGE_SIZE);
    const currentPage = Math.min(page, pageCount - 1);
    const startIndex = currentPage * PAGE_SIZE;
    const endIndex = Math.min(total, startIndex + PAGE_SIZE);
    const rows = sortedRows.slice(startIndex, endIndex);
    return { total, pageCount, currentPage, startIndex, endIndex, rows };
  }, [sortedRows, page]);

  return (
    <div style={containerStyle}>
      <div style={{ marginBottom: "8px" }}>
        <Link to="/runs" style={{ fontSize: "11px", color: "#2563eb" }}>
          ← Back to runs
        </Link>
      </div>

      <h2
        style={{
          fontSize: "16px",
          margin: 0,
          marginBottom: "6px",
          fontWeight: 600,
        }}
      >
        Trades
      </h2>

      <div style={{ fontSize: "11px", color: "#4b5563", marginBottom: "8px" }}>
        {runIdParam && (
          <span>
            Run: <span style={metaLabel}>{runIdParam}</span>
          </span>
        )}
      </div>

      <div style={metaRow}>
        {decodedPermId && (
          <div>
            <span style={metaLabel}>Permutation:</span>{" "}
            <span style={badge}>{decodedPermId}</span>
          </div>
        )}
        <div>
          <span style={metaLabel}>Trades:</span>{" "}
          <span>{state.trades.length.toString()}</span>
        </div>
        <div>
          <button
            onClick={onPromote}
            disabled={promoteBusy || !runIdParam || !permIdParam}
            style={{
              fontSize: "11px",
              padding: "6px 10px",
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
              background: "white",
              cursor: promoteBusy ? "default" : "pointer",
            }}
          >
            {promoteBusy ? "Promoting…" : "Promote"}
          </button>
        </div>
      </div>

      {promoteError && (
        <div style={{ fontSize: '11px', marginBottom: '8px', color: '#b91c1c' }}>
          Promote failed: {promoteError}
        </div>
      )}
      {promotedActiveId && (
        <div style={{ fontSize: '11px', marginBottom: '8px' }}>
          Promoted: <span style={metaLabel}>{promotedActiveId}</span>
        </div>
      )}

      {state.loading && (
        <div style={{ marginTop: 8, marginBottom: 8, fontSize: 12, opacity: 0.8 }}>
          Loading…
        </div>
      )}

      {promoteModalOpen && (
        <Modal
          title="Promote Permutation"
          onClose={() => { if (!promoteBusy) setPromoteModalOpen(false) }}
          width={520}
        >
          <div style={{ marginBottom: 10 }}>
            Promote permutation <code>{permIdParam}</code> from run <code>{runIdParam}</code> into an active strategy?
          </div>
          <div style={{ marginBottom: 12, opacity: 0.9 }}>
            Promotion is explicit and irreversible. Runs are not mutated.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontWeight: 600 }}>Name</div>
              <input
                value={promoteName}
                onChange={(e) => setPromoteName(e.target.value)}
                placeholder="e.g. RSI breakout - small caps"
                disabled={promoteBusy}
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #ccc' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontWeight: 600 }}>Description</div>
              <textarea
                value={promoteDescription}
                onChange={(e) => setPromoteDescription(e.target.value)}
                placeholder="What is this strategy and why should I care?"
                disabled={promoteBusy}
                rows={3}
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #ccc' }}
              />
            </label>
          </div>
          {promoteError && <div style={{ color: 'crimson', marginTop: 10 }}>Error: {promoteError}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button className="button ghost" onClick={() => setPromoteModalOpen(false)} disabled={promoteBusy}>Cancel</button>
            <button className="button" onClick={confirmPromote} disabled={promoteBusy}>
              {promoteBusy ? 'Promoting…' : 'Promote'}
            </button>
          </div>
        </Modal>
      )}
      {state.error && (
        <div
          style={{
            fontSize: "11px",
            marginBottom: "8px",
            color: "#b91c1c",
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            padding: "6px 8px",
            borderRadius: "4px",
          }}
        >
          Error loading trades: {state.error}
        </div>
      )}


      {state.trades.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            marginBottom: "12px",
          }}
        >
          <Histogram
            title="Histogram: total returns per trade (%)"
            values={totalReturnPctValues}
            xLabel="Return (%)"
            yLabel="Trades"
            valueFormatter={(v) => `${v.toFixed(2)}%`}
          />
          <Histogram
            title="Histogram: average daily returns per trade (%/day)"
            values={avgDailyReturnPctValues}
            xLabel="Avg daily return (%/day)"
            yLabel="Trades"
            valueFormatter={(v) => `${v.toFixed(4)}%`}
          />
        </div>
      )}

      <div style={tableWrapper}>
        <table style={tableStyle}>
          <thead>
            <tr style={headerRow}>
              {COLS.map((col) => {
                const isNum = NUMERIC_FIELDS.has(String(col.key));
                const style = isNum ? headerCellNum : headerCell;
                const active = sortKey === col.key;
                return (
                  <th
                    key={String(col.key)}
                    style={{
                      ...style,
                      minWidth: col.minWidth,
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                    onClick={() => {
                      setSortKey(col.key);
                      setSortDir((prev) =>
                        sortKey === col.key ? (prev === "asc" ? "desc" : "asc") : "asc"
                      );
                    }}
                  >
                    <span>{col.label}</span>
                    <SortIndicator active={active} direction={sortDir} />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageInfo.rows.map((r, i) => {
              const globalIdx = pageInfo.startIndex + i;
              const isExpanded = expandedTradeIdx === globalIdx;
              return (
                <React.Fragment key={globalIdx}>
              <tr
                style={{ borderBottom: "1px solid #f2f2f2", cursor: "pointer", background: isExpanded ? "#0b1220" : undefined }}
                onClick={() => setExpandedTradeIdx(isExpanded ? null : globalIdx)}
              >
                {COLS.map((col) => {
                  const key = col.key as keyof TradeRow;
                  const raw = r[key];
                  const isNum = NUMERIC_FIELDS.has(String(key));
                  const value = formatCell(key, raw);
                  return (
                    <td
                      key={String(key)}
                      style={isNum ? tdNum : td}
                      title={value}
                    >
                      {value}
                    </td>
                  );
                })}
              </tr>
              {isExpanded && (
                <tr>
                  <td colSpan={COLS.length} style={{ padding: 0, border: "none" }}>
                    <TradeDetailPanel
                      context={{
                        kind: "backtest",
                        runId: runIdParam,
                        permId: permIdParam,
                        tradeIdx: typeof r.trade_idx === "number" ? r.trade_idx : parseInt(String(r.trade_idx), 10) || i,
                      }}
                      onClose={() => setExpandedTradeIdx(null)}
                    />
                  </td>
                </tr>
              )}
                </React.Fragment>
              );
            })}

            {sortedRows.length === 0 && !state.loading && !state.error && (
              <tr>
                <td
                  colSpan={COLS.length}
                  style={{
                    ...td,
                    padding: "12px",
                    textAlign: "center",
                    color: "#9ca3af",
                  }}
                >
                  No trades found for this permutation.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      <div
        style={{
          marginTop: "4px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "10px",
          color: "#9ca3af",
          gap: "8px",
        }}
      >
        <div>
          Showing{" "}
          {pageInfo.total === 0
            ? 0
            : `${pageInfo.startIndex + 1}–${pageInfo.endIndex}`}{" "}
          of {pageInfo.total} trades
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={pageInfo.currentPage <= 0 || pageInfo.total === 0}
            style={{
              padding: "2px 6px",
              fontSize: "10px",
              borderRadius: "4px",
              border: "1px solid #4b5563",
              backgroundColor: "#020617",
              color: "#e5e7eb",
              cursor:
                pageInfo.currentPage <= 0 || pageInfo.total === 0
                  ? "default"
                  : "pointer",
              opacity:
                pageInfo.currentPage <= 0 || pageInfo.total === 0 ? 0.4 : 1,
            }}
          >
            Prev
          </button>
          <span>
            Page {pageInfo.total === 0 ? 0 : pageInfo.currentPage + 1} of{" "}
            {pageInfo.total === 0 ? 0 : pageInfo.pageCount}
          </span>
          <button
            onClick={() =>
              setPage((p) =>
                Math.min(
                  p + 1,
                  pageInfo.pageCount > 0 ? pageInfo.pageCount - 1 : 0,
                )
              )
            }
            disabled={
              pageInfo.total === 0 ||
              pageInfo.currentPage >= pageInfo.pageCount - 1
            }
            style={{
              padding: "2px 6px",
              fontSize: "10px",
              borderRadius: "4px",
              border: "1px solid #4b5563",
              backgroundColor: "#020617",
              color: "#e5e7eb",
              cursor:
                pageInfo.total === 0 ||
                pageInfo.currentPage >= pageInfo.pageCount - 1
                  ? "default"
                  : "pointer",
              opacity:
                pageInfo.total === 0 ||
                pageInfo.currentPage >= pageInfo.pageCount - 1
                  ? 0.4
                  : 1,
            }}
          >
            Next
          </button>
        </div>
      </div>
      </div>
    </div>
  );
};

export default TradesPage;
