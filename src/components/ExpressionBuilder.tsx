import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Expr, ExpressionValidationResult } from '../types/expression';
import type {
  ExpressionRegistry,
  FunctionMeta,
  FunctionParamMeta,
} from '../types/expression_registry';
import type { UiParamSpec, ParamDefinition } from '../types/flags';
import { ParamEditor } from './ParamEditor';

interface ExpressionBuilderProps {
  ast?: Expr;
  onChange: (next: Expr | undefined) => void;
  registry: ExpressionRegistry;
  validation?: ExpressionValidationResult;
  disabled?: boolean;
  /** When true, expands to fill available space for use in a large modal. */
  large?: boolean;
  /**
   * Section IDs to expand on initial mount.
   * Valid values: 'section:fields' | 'section:functions' | 'section:operators' | 'section:flags'
   * Defaults to all collapsed.
   */
  initialExpanded?: string[];
}

interface BrowserItem {
  kind: 'field' | 'function' | 'operator' | 'flag';
  id: string;
  name: string;
  label: string;
  description: string;
  signature?: string;
  fnMeta?: FunctionMeta;
}

import { SWEEP_OPEN, SWEEP_CLOSE, expandSweepMarkers, hasSweepMarkers, countSweepPermutations } from '../utils/sweepMarkers';

// ---- Token-aware selection ----

interface TokenSpan {
  start: number;
  end: number;
  type: 'identifier' | 'number' | 'string' | 'operator' | 'paren' | 'whitespace';
}

/**
 * Tokenize an expression string into spans.
 * Returns array of non-overlapping token spans covering the full string.
 */
function tokenizeExpression(text: string): TokenSpan[] {
  const tokens: TokenSpan[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    // Whitespace
    if (/\s/.test(ch)) {
      const start = i;
      while (i < text.length && /\s/.test(text[i])) i++;
      tokens.push({ start, end: i, type: 'whitespace' });
    }
    // Identifier (including function/flag names)
    else if (/[A-Za-z_]/.test(ch)) {
      const start = i;
      while (i < text.length && /[A-Za-z0-9_]/.test(text[i])) i++;
      tokens.push({ start, end: i, type: 'identifier' });
    }
    // Number (int or float, including negative sign only if preceded by operator/paren)
    else if (/\d/.test(ch) || (ch === '.' && i + 1 < text.length && /\d/.test(text[i + 1]))) {
      const start = i;
      while (i < text.length && /[\d.]/.test(text[i])) i++;
      // Handle scientific notation e.g. 1e5, 2.5E-3
      if (i < text.length && /[eE]/.test(text[i])) {
        i++;
        if (i < text.length && /[+-]/.test(text[i])) i++;
        while (i < text.length && /\d/.test(text[i])) i++;
      }
      tokens.push({ start, end: i, type: 'number' });
    }
    // String literals
    else if (ch === '"' || ch === "'") {
      const quote = ch;
      const start = i;
      i++; // skip opening quote
      while (i < text.length && text[i] !== quote) {
        if (text[i] === '\\') i++; // skip escaped char
        i++;
      }
      if (i < text.length) i++; // skip closing quote
      tokens.push({ start, end: i, type: 'string' });
    }
    // Parens, brackets, commas
    else if ('()[]{},' .includes(ch)) {
      tokens.push({ start: i, end: i + 1, type: 'paren' });
      i++;
    }
    // Multi-char operators
    else if (i + 1 < text.length && ['==', '!=', '<=', '>=', '&&', '||'].includes(text.slice(i, i + 2))) {
      tokens.push({ start: i, end: i + 2, type: 'operator' });
      i += 2;
    }
    // Single-char operators
    else if ('+-*/<>=%!&|^~@:'.includes(ch) || ch === SWEEP_OPEN || ch === SWEEP_CLOSE) {
      tokens.push({ start: i, end: i + 1, type: 'operator' });
      i++;
    }
    // Anything else — advance one char
    else {
      tokens.push({ start: i, end: i + 1, type: 'operator' });
      i++;
    }
  }
  return tokens;
}

/**
 * Find the token at a given cursor position.
 * Returns the token span, or null if the position is whitespace or out of bounds.
 */
function findTokenAtPosition(text: string, pos: number): TokenSpan | null {
  const tokens = tokenizeExpression(text);
  for (const tok of tokens) {
    if (pos >= tok.start && pos <= tok.end && tok.type !== 'whitespace') {
      return tok;
    }
  }
  return null;
}

// ---- UiParamSpec ↔ expression text bridge ----
// UiParamSpec imported from types/flags

/**
 * Expand a UiParamSpec to concrete values (mirrors backend expand logic).
 */
function expandUiParamSpec(spec: UiParamSpec): (number | string | boolean)[] {
  if (spec.kind === 'values') return spec.values;
  if (spec.kind === 'as_is') return [];
  if (spec.kind === 'range') {
    const { start, stop, step, inclusive } = spec;
    if (!isFinite(start) || !isFinite(stop) || !isFinite(step) || step <= 0) return [];
    const vals: number[] = [];
    if (start <= stop) {
      for (let x = start; x < stop + (inclusive ? step * 0.001 : -step * 0.001); x += step) {
        vals.push(parseFloat(x.toFixed(10)));
      }
      if (inclusive && (vals.length === 0 || Math.abs(vals[vals.length - 1] - stop) > step * 0.001)) {
        vals.push(stop);
      }
    } else {
      for (let x = start; x > stop - (inclusive ? step * 0.001 : -step * 0.001); x -= step) {
        vals.push(parseFloat(x.toFixed(10)));
      }
      if (inclusive && (vals.length === 0 || Math.abs(vals[vals.length - 1] - stop) > step * 0.001)) {
        vals.push(stop);
      }
    }
    return vals;
  }
  if (spec.kind === 'log_range') {
    const { start, stop, num, inclusive } = spec;
    if (start <= 0 || stop <= 0 || num < 1) return [];
    const arr: number[] = [];
    for (let i = 0; i < num; i++) {
      arr.push(start * Math.pow(stop / start, i / Math.max(1, num - 1)));
    }
    if (!inclusive && arr.length > 1) arr.pop();
    if (spec.roundToTick && spec.roundToTick > 0) {
      const tick = spec.roundToTick;
      return arr.map(v => parseFloat((Math.round(v / tick) * tick).toFixed(10)));
    }
    return arr.map(v => parseFloat(v.toFixed(10)));
  }
  return [];
}

/**
 * Parse existing expression arg text back into a UiParamSpec.
 * Handles: «10,20,50» → values list, plain "20" → single value.
 */
function argTextToUiParamSpec(text: string): UiParamSpec {
  const trimmed = text.trim();
  // Sweep marker: «10,20,50» → values list
  const sweepRe = new RegExp(
    `^${SWEEP_OPEN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(.+)${SWEEP_CLOSE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`
  );
  const sweepMatch = trimmed.match(sweepRe);
  if (sweepMatch) {
    const vals = sweepMatch[1].split(',').map(s => s.trim()).filter(Boolean);
    return {
      kind: 'values',
      values: vals.map(v => {
        const n = Number(v);
        return isFinite(n) ? n : v;
      }),
    };
  }
  // Plain value
  const n = Number(trimmed);
  const val = isFinite(n) && trimmed !== '' ? n : trimmed;
  return { kind: 'values', values: [val] };
}

/**
 * Convert a FunctionParamMeta (from expression registry) to a ParamDefinition
 * (expected by ParamEditor).
 */
function fnParamToParamDefinition(p: FunctionParamMeta): ParamDefinition {
  const pType = String(p.type || '').toLowerCase();
  let dataType: 'int' | 'float' | 'enum' | 'bool' | 'string' = 'float';
  if (pType.includes('int')) dataType = 'int';
  else if (pType.includes('bool')) dataType = 'bool';
  else if (pType.includes('str') || pType.includes('text')) dataType = 'string';

  // Check for choices / enum values
  const choices = (p as any).choices;
  const enumValues = Array.isArray(choices)
    ? choices.map((c: any) => ({ value: typeof c === 'object' ? c.value : c, label: typeof c === 'object' ? c.label : String(c) }))
    : undefined;
  if (enumValues && enumValues.length > 0) dataType = 'enum';

  const allowedModes: import('../types/flags').ParamMode[] = ['value'];
  if (dataType === 'int' || dataType === 'float') {
    allowedModes.push('range');
  }

  return {
    name: p.name,
    label: (p as any).label || p.name,
    description: (p as any).description || (p as any).help || undefined,
    dataType,
    allowedModes,
    defaultMode: 'value',
    enumValues,
    defaultValue: p.default !== undefined ? p.default as any : undefined,
  };
}

function formatWorkedExamples(worked: unknown): string {
  if (!Array.isArray(worked) || worked.length === 0) return '';
  const blocks = worked
    .map((ex: any, idx: number) => {
      const lines: string[] = [];
      if (ex && typeof ex === 'object') {
        if (ex.explanation) lines.push(String(ex.explanation));
        if (ex.expression) lines.push(`Expression: ${String(ex.expression)}`);

        // Contract: worked examples are { input, output }.
        // No spackle: UI reads exactly that shape.
        const inputObj = (ex as any).input;
	        if (!inputObj || typeof inputObj !== 'object') {
	          const keys = Object.keys(ex as any);
	          // Loudly report contract violations, but keep the UI usable.
	          // We still render the rest of the valid worked examples.
	          // eslint-disable-next-line no-console
	          console.error(
	            `[ExpressionBuilder] worked_example missing required 'input' object. keys=${keys.join(',')}`,
	            ex,
	          );
	          lines.push(`Invalid worked example: missing required input object.`);
	          lines.push(`Keys: ${keys.join(',')}`);
	          return `Example ${idx + 1}:
${lines.join('\n')}`;
	        }

        const seriesNames = Object.keys(inputObj);
        if (seriesNames.length) {
          const chunks: string[] = [];
          for (const name of seriesNames) {
            const series = (inputObj as any)[name];
            if (series && typeof series === 'object') {
              const keys = Object.keys(series);
              const tailKeys = keys.slice(Math.max(0, keys.length - 3));
              const kv = tailKeys.map((k) => `${k}=${String((series as any)[k])}`).join(', \n');
              if (kv) chunks.push(`${name}:\n${kv}`);
            } else {
              chunks.push(`${name}=${String(series)}`);
            }
          }
          if (chunks.length) lines.push(`Inputs (tail):\n${chunks.join('\n\n')}`);
        }

        const result = (ex as any).output;
	        if (!result || typeof result !== 'object') {
	          const keys = Object.keys(ex as any);
	          // Loudly report contract violations, but keep the UI usable.
	          // eslint-disable-next-line no-console
	          console.error(
	            `[ExpressionBuilder] worked_example missing required 'output' object. keys=${keys.join(',')}`,
	            ex,
	          );
	          lines.push(`Invalid worked example: missing required output object.`);
	          lines.push(`Keys: ${keys.join(',')}`);
	          return `Example ${idx + 1}:
${lines.join('\n')}`;
	        }

        const keys = Object.keys(result);
        const tailKeys = keys.slice(Math.max(0, keys.length - 3));
        const tail = tailKeys.map((k) => `${k}=${(result as any)[k]}`).join(', \n');
        if (tail) lines.push(`Outputs (tail):\n${tail}`);
      }
      if (!lines.length) return '';
      return `Example ${idx + 1}:
${lines.join('\n')}`;
    })
    .filter(Boolean);
  if (!blocks.length) return '';
  return `

Worked examples:
${blocks.join('\n')}`;
}


function findFirstFieldLeaf(nodes: { id: string; items?: any[]; children?: any[] }[]): { id: string } | null {
  for (const n of nodes) {
    if (n.items) return n;
    if (n.children) {
      const found = findFirstFieldLeaf(n.children);
      if (found) return found;
    }
  }
  return null;
}

/**
 * DevExpress-style visual expression editor.
 *
 * Layout contract (no Tailwind / project CSS required):
 * - Top: read-only expression preview bar.
 * - Bottom: fixed-height row with three panes:
 *     1) category list (left, fixed width),
 *     2) function/operator list (middle, fixed width),
 *     3) details + validation (right, fills remaining space).
 */
const ExpressionBuilder: React.FC<ExpressionBuilderProps> = ({
  ast,
  onChange,
  registry,
  validation,
  disabled,
  large,
  initialExpanded,
}) => {
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<BrowserItem | null>(null);

  // RAW DOM diagnostic — remove after debugging
  const outerRef = React.useRef<HTMLDivElement>(null);
  const lastClickRef = React.useRef<{ id: string; ts: number }>({ id: '', ts: 0 });
  React.useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      console.log('[ExprBuilder] RAW dblclick on DOM', {
        tagName: target.tagName,
        textContent: target.textContent?.slice(0, 40),
        className: target.className,
        disabled: (target as any).disabled,
      });
    };
    el.addEventListener('dblclick', handler, true); // capture phase
    return () => el.removeEventListener('dblclick', handler, true);
  }, []);

  const [previewText, setPreviewText] = useState<string>(() => {
    if (ast && (ast as any).kind === 'raw_fragment') {
      const text = (ast as any).text;
      return typeof text === 'string' ? text : '';
    }
    return '';
  });

  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(
    null,
  );
  const [functionEditorItem, setFunctionEditorItem] = useState<BrowserItem | null>(
    null,
  );
  const [functionEditorSpecs, setFunctionEditorSpecs] = useState<Record<string, UiParamSpec>>({});
  const [functionEditorReplaceRange, setFunctionEditorReplaceRange] = useState<
    { start: number; end: number } | null
  >(null);


  // Operator suggestion dropdown — shown after a browser-panel insert when caret is at top level
  const [operatorDropdown, setOperatorDropdown] = useState<{
    caretPos: number; x: number; y: number;
  } | null>(null);

  // Preserve existing behaviour: call through once on mount.
  useEffect(() => {
    onChange(ast);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ast && (ast as any).kind === 'raw_fragment') {
      const text = (ast as any).text;
      setPreviewText(typeof text === 'string' ? text : '');
    }
  }, [ast]);

  const fieldItems: BrowserItem[] = useMemo(() => {
    const fields = registry.fields ?? [];
    return fields.map((field) => {
      const label = String(field.title || field.field || field.key || '');
      const key = String(field.key || '');
      // Display name: use the actual field column name (e.g. "close"),
      // NOT the expression shorthand key (e.g. "close()").
      // For dotted keys like "events.earnings.eps_actual", key is already clean.
      const fieldName = field.field ? String(field.field) : key;
      const name = fieldName;
      const description = String(field.description || '');
      const signature = key || label;
      return {
        kind: 'field',
        id: `field:${key}`,
        name,
        label,
        description,
        signature,
      };
    });
  }, [registry.fields]);

  const functionItems: BrowserItem[] = useMemo(() => {
    const funcs = registry.functions ?? [];
    return funcs.map((fn) => {
      const label = String(fn.title || fn.name || '');
      const name = String(fn.name || '');
      const baseDesc = String(((fn as any).long_description || fn.description || '') || '');
      const description = `${baseDesc}${formatWorkedExamples((fn as any).worked_examples)}`;
      const params = Array.isArray(fn.params) ? fn.params : [];
      const paramList = params.map((p: any) => String(p.name || '')).filter(Boolean);
      const signature = paramList.length
        ? `${name}(${paramList.join(', ')})`
        : `${name}()`;
      return {
        kind: 'function',
        id: `fn:${name}`,
        name,
        label,
        description,
        signature,
        fnMeta: fn,
      };
    });
  }, [registry.functions]);

  const operatorItems: BrowserItem[] = useMemo(() => {
    const ops = registry.operators ?? [];
    return ops.map((op) => {
      const symbol = String(op.symbol || '');
      const name = symbol || String(op.key || '');
      const label = String(op.title || name);
      const description = String(op.description || '');
      const signature = symbol ? symbol : name;
      return {
        kind: 'operator',
        id: `op:${op.key || name}`,
        name,
        label,
        description,
        signature,
      };
    });
  }, [registry.operators]);

  const flagItems: BrowserItem[] = useMemo(() => {
    const flags = registry.flags ?? [];
    return flags.map((fl) => {
      const label = String(fl.title || fl.name || '');
      const name = String(fl.name || '');
      const baseDesc = String(((fl as any).long_description || fl.description || '') || '');
      const description = `${baseDesc}${formatWorkedExamples((fl as any).worked_examples)}`;
      const params = Array.isArray(fl.params) ? fl.params : [];
      const paramList = params.map((p: any) => String(p.name || '')).filter(Boolean);
      const signature = paramList.length
        ? `${name}(${paramList.join(', ')})`
        : `${name}()`;
      return {
        kind: 'flag' as const,
        id: `flag:${name}`,
        name,
        label,
        description,
        signature,
        // Store flag metadata in fnMeta so the param editor works for flags
        // (FlagMeta and FunctionMeta are structurally compatible)
        fnMeta: params.length > 0 ? (fl as unknown as FunctionMeta) : undefined,
      };
    });
  }, [registry.flags]);
  // --- Hierarchical field tree ---
  // Built from each field's navigation path.
  // Dotted keys like "corporate.company_reference.cik" split by "." —
  // all segments except the last are navigation levels, the last is the field.
  // Non-dotted keys (OHLC) use domain + field: "ohlc" + "close" → "ohlc.close".
  //
  // corporate.company_reference.cik  → Corporate → Company Reference → [cik]
  // events.earnings.eps_actual       → Events → Earnings → [eps_actual]
  // ohlc + close                     → Ohlc → [close]
  interface FieldTreeNode {
    id: string;
    label: string;
    depth: number;
    items?: BrowserItem[];
    children?: FieldTreeNode[];
  }

  /** Humanize a path segment: underscores → spaces, title-case. */
  const humanize = (seg: string): string =>
    seg === 'ohlc' ? 'OHLC' : seg.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const fieldTree = useMemo((): FieldTreeNode[] => {
    if (!fieldItems.length) return [];
    const fields = registry.fields ?? [];

    interface TrieNode {
      items: BrowserItem[];
      children: Map<string, TrieNode>;
    }
    const makeTrie = (): TrieNode => ({ items: [], children: new Map() });
    const root = makeTrie();

    for (let i = 0; i < fieldItems.length; i++) {
      const item = fieldItems[i];
      const meta = fields[i];
      const key = String(meta?.key || '');
      const domain = String(meta?.domain || 'misc');
      const fieldName = meta?.field ? String(meta.field) : null;

      // Derive navigation path.
      // Dotted key IS the path: "events.earnings.eps_actual" → ["events","earnings","eps_actual"]
      // Non-dotted (OHLC shorthand like "close()"): use domain + field → ["ohlc","close"]
      let fullPath: string[];
      if (key.includes('.')) {
        fullPath = key.split('.');
      } else if (fieldName) {
        fullPath = [domain, fieldName];
      } else {
        fullPath = [domain, key.replace(/[()]/g, '') || 'unknown'];
      }

      // All segments except the last are navigation levels.
      // The last segment is the field shown in the middle pane.
      const navSegments = fullPath.slice(0, -1);

      let cur = root;
      for (const seg of navSegments) {
        if (!cur.children.has(seg)) cur.children.set(seg, makeTrie());
        cur = cur.children.get(seg)!;
      }
      cur.items.push(item);
    }

    // Convert trie → FieldTreeNode[]
    const trieToNodes = (node: TrieNode, idPrefix: string, depth: number): FieldTreeNode[] => {
      const result: FieldTreeNode[] = [];
      for (const [seg, child] of node.children) {
        const nodeId = `${idPrefix}.${seg}`;
        const label = humanize(seg);
        const hasChildren = child.children.size > 0;
        const hasItems = child.items.length > 0;

        if (hasChildren) {
          const childNodes = trieToNodes(child, nodeId, depth + 1);
          if (hasItems) {
            // Node has both direct fields and sub-paths
            childNodes.unshift({
              id: `${nodeId}.__fields__`,
              label: `${label} (fields)`,
              depth: depth + 1,
              items: child.items,
            });
          }
          result.push({ id: nodeId, label, depth, children: childNodes });
        } else if (hasItems) {
          result.push({ id: nodeId, label, depth, items: child.items });
        }
      }
      return result;
    };

    return trieToNodes(root, 'field', 1);
  }, [fieldItems, registry.fields]);

  // Track which field tree nodes are expanded.
  // Seeded from the initialExpanded prop so callers can open specific sections
  // on mount (e.g. 'section:fields' when used for column expression building).
  const [expandedFieldNodes, setExpandedFieldNodes] = useState<Set<string>>(
    () => new Set(initialExpanded ?? []),
  );

  const toggleFieldNode = (nodeId: string) => {
    setExpandedFieldNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const categories = useMemo(() => {
    const result: { id: string; label: string; items: BrowserItem[] }[] = [];
    // "Data Fields" is handled specially in the tree, but we still track
    // leaf field categories as selectable
    if (functionItems.length) {
      result.push({
        id: 'functions',
        label: 'Functions',
        items: functionItems,
      });
    }
    if (operatorItems.length) {
      result.push({
        id: 'operators',
        label: 'Operators',
        items: operatorItems,
      });
    }
    if (flagItems.length) {
      result.push({
        id: 'flags',
        label: 'Flags',
        items: flagItems,
      });
    }
    return result;
  }, [functionItems, operatorItems, flagItems]);

  // Active category can be a flat category id OR a field tree leaf id
  // Ensure a valid active category.
  useEffect(() => {
    const allIds = new Set<string>();
    categories.forEach(c => allIds.add(c.id));
    // Add field tree leaf ids
    const addFieldLeaves = (nodes: FieldTreeNode[]) => {
      for (const n of nodes) {
        if (n.items) allIds.add(n.id);
        if (n.children) addFieldLeaves(n.children);
      }
    };
    addFieldLeaves(fieldTree);

    if (!activeCategoryId || !allIds.has(activeCategoryId)) {
      // Start with nothing selected — user expands sections as needed
      if (categories.length) {
        setActiveCategoryId(categories[0].id);
      } else {
        setActiveCategoryId(null);
      }
    }
  }, [categories, fieldTree, activeCategoryId]);

  const filteredItems: BrowserItem[] = useMemo(() => {
    const q = query.trim().toLowerCase();

    // Check if it's a field tree leaf
    const findInTree = (nodes: FieldTreeNode[]): BrowserItem[] | null => {
      for (const n of nodes) {
        if (n.id === activeCategoryId && n.items) return n.items;
        if (n.children) {
          const found = findInTree(n.children);
          if (found) return found;
        }
      }
      return null;
    };

    const fieldLeafItems = findInTree(fieldTree);
    if (fieldLeafItems) {
      if (!q) return fieldLeafItems;
      return fieldLeafItems.filter(item => {
        const haystack = `${item.label} ${item.name} ${item.description}`.toLowerCase();
        return haystack.includes(q);
      });
    }

    // Otherwise check flat categories
    const cat = categories.find(c => c.id === activeCategoryId);
    if (!cat) return [];
    if (!q) return cat.items;
    return cat.items.filter(item => {
      const haystack = `${item.label} ${item.name} ${item.description}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [activeCategoryId, query, fieldTree, categories]);

  
  const insertSnippetAtSelection = (
    snippet: string,
    highlight?:
      | {
          startInSnippet: number;
          endInSnippet: number;
        }
      | undefined,
    replaceRange?: { start: number; end: number } | undefined,
  ) => {
    console.log('[ExprBuilder] insertSnippetAtSelection', { snippet, selection, replaceRange, previewText: previewText?.slice(0, 40) });
    if (!snippet) return;
    const currentText = previewText || '';

    const sel = selection;
    let start = currentText.length;
    let end = currentText.length;
    if (replaceRange) {
      start = Math.max(0, Math.min(replaceRange.start, currentText.length));
      end = Math.max(start, Math.min(replaceRange.end, currentText.length));
    } else if (sel && typeof sel.start === 'number' && typeof sel.end === 'number') {
      start = Math.max(0, Math.min(sel.start, currentText.length));
      end = Math.max(start, Math.min(sel.end, currentText.length));
    }

    const before = currentText.slice(0, start);
    const after = currentText.slice(end);

    const charBefore = before.slice(-1);
    const charAfter = after.slice(0, 1);

    const needsSpaceBefore =
      before.length > 0 &&
      !/\s/.test(charBefore) &&
      !['(', ',', '+', '-', '*', '/', '!', '&', '|'].includes(charBefore);

    const needsSpaceAfter =
      (after.length > 0 &&
      !/\s/.test(charAfter) &&
      ![')', ',', '+', '-', '*', '/', '&', '|'].includes(charAfter) &&
      !snippet.endsWith('('))
      || (snippet.endsWith(')'));  // always pad after complete function calls

    const insertText =
      (needsSpaceBefore ? ' ' : '') + snippet + (needsSpaceAfter ? ' ' : '');

    const nextText = before + insertText + after;

    setPreviewText(nextText);
    const nextAst: Expr = { kind: 'raw_fragment', text: nextText } as any;
    onChange(nextAst);

    // Always place cursor at end of the inserted text
    const nextCaret = (before + insertText).length;
    setSelection({ start: nextCaret, end: nextCaret });

    if (textAreaRef.current) {
      try {
        textAreaRef.current.focus();
        textAreaRef.current.selectionStart = nextCaret;
        textAreaRef.current.selectionEnd = nextCaret;
      } catch {
        // no-op
      }
    }
  };

  // ── Operator dropdown helpers ─────────────────────────────────────

  /** Count net unclosed parens in text[0..upTo], skipping string literals. */
  const countOpenParens = (text: string, upTo: number): number => {
    let depth = 0;
    let inStr: string | null = null;
    for (let i = 0; i < upTo && i < text.length; i++) {
      const ch = text[i];
      if (inStr) { if (ch === inStr) inStr = null; }
      else if (ch === '"' || ch === "'") { inStr = ch; }
      else if (ch === '(') { depth++; }
      else if (ch === ')') { depth = Math.max(0, depth - 1); }
    }
    return depth;
  };

  /** Estimate caret pixel position via a mirror div. Returns viewport coords. */
  const getCaretCoords = (ta: HTMLTextAreaElement, pos: number): { x: number; y: number } => {
    const mirror = document.createElement('div');
    const cs = window.getComputedStyle(ta);
    [
      'fontFamily','fontSize','fontWeight','letterSpacing','lineHeight',
      'paddingTop','paddingRight','paddingBottom','paddingLeft',
      'borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth',
      'boxSizing','width','wordWrap','whiteSpace',
    ].forEach(p => { (mirror.style as any)[p] = (cs as any)[p]; });
    mirror.style.position = 'fixed';
    mirror.style.visibility = 'hidden';
    mirror.style.top = '0';
    mirror.style.left = '0';
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.wordWrap = 'break-word';
    mirror.style.overflow = 'hidden';
    document.body.appendChild(mirror);
    mirror.appendChild(document.createTextNode(ta.value.substring(0, pos)));
    const span = document.createElement('span');
    span.textContent = '|';
    mirror.appendChild(span);
    const taRect = ta.getBoundingClientRect();
    const mRect  = mirror.getBoundingClientRect();
    const sRect  = span.getBoundingClientRect();
    document.body.removeChild(mirror);
    return {
      x: taRect.left + (sRect.left - mRect.left),
      y: taRect.top  + (sRect.top  - mRect.top) + parseFloat(cs.lineHeight || '16'),
    };
  };

  /** Show the operator dropdown if the caret is at the expression top level. */
  const triggerOperatorDropdown = (caretPos: number, text: string) => {
    if (countOpenParens(text, caretPos) !== 0) return;
    const ta = textAreaRef.current;
    if (!ta) return;
    const { x, y } = getCaretCoords(ta, caretPos);
    setOperatorDropdown({ caretPos, x, y });
  };

  const handleInsertItem = (item: BrowserItem) => {
    console.log('[ExprBuilder] handleInsertItem called', { kind: item.kind, name: item.name, hasFnMeta: !!item.fnMeta, paramsLen: Array.isArray(item.fnMeta?.params) ? item.fnMeta!.params!.length : 0 });
    if (disabled) return;

    // Functions and flags with params both use the param editor overlay
    if ((item.kind === 'function' || item.kind === 'flag') && item.fnMeta) {
      const fn = item.fnMeta as FunctionMeta;
      const paramsArray = Array.isArray(fn.params)
        ? (fn.params as FunctionParamMeta[])
        : [];
      if (paramsArray.length > 0) {
        const initialSpecs: Record<string, UiParamSpec> = {};
        paramsArray.forEach((p) => {
          const key = p.name;
          if (!key) return;
          const defVal = p.default !== undefined && p.default !== null ? p.default : '';
          initialSpecs[key] = { kind: 'values', values: [defVal] };
        });
        setFunctionEditorItem(item);
        setFunctionEditorSpecs(initialSpecs);
        setFunctionEditorReplaceRange(null);
        return;
      }
    }

    const snippet = item.signature || item.label || item.name;
    setFunctionEditorReplaceRange(null);
    insertSnippetAtSelection(snippet);
    requestAnimationFrame(() => {
      const ta = textAreaRef.current;
      if (ta) triggerOperatorDropdown(ta.selectionStart, ta.value);
    });
  };

  const handleConfirmFunctionInsert = () => {
    if (!functionEditorItem || !functionEditorItem.fnMeta) {
      setFunctionEditorItem(null);
      setFunctionEditorSpecs({});
      return;
    }
    const fn = functionEditorItem.fnMeta as FunctionMeta;
    const paramsArray = Array.isArray(fn.params)
      ? (fn.params as FunctionParamMeta[])
      : [];
    const isFlag = functionEditorItem.kind === 'flag';

    /** Format a single value, quoting strings when needed. */
    const formatValue = (val: unknown, p: FunctionParamMeta): string => {
      const raw = String(val);
      const pType = String(p.type || '').toLowerCase();
      // If it's a string-typed param and the value isn't already quoted and isn't a number
      if ((pType.includes('str') || pType.includes('text') || (p as any).choices)
          && !/^\d+(\.\d+)?$/.test(raw)
          && !raw.startsWith("'") && !raw.startsWith('"')) {
        return `'${raw}'`;
      }
      return raw;
    };

    const argParts: string[] = paramsArray.map((p) => {
      const key = p.name;
      const spec = functionEditorSpecs[key];
      let valueText: string;
      if (!spec) {
        if (p.default !== undefined && p.default !== null) valueText = formatValue(p.default, p);
        else valueText = p.name || 'arg';
      } else {
        const expanded = expandUiParamSpec(spec);
        if (expanded.length === 0) {
          if (p.default !== undefined && p.default !== null) valueText = formatValue(p.default, p);
          else valueText = p.name || 'arg';
        } else if (expanded.length === 1) {
          valueText = formatValue(expanded[0], p);
        } else {
          // Multiple values → sweep marker
          valueText = SWEEP_OPEN + expanded.map(v => formatValue(v, p)).join(',') + SWEEP_CLOSE;
        }
      }
      // Flags require keyword args; functions use positional
      return isFlag ? `${key}=${valueText}` : valueText;
    });

    const inner = argParts.join(', ');
    const snippet = `${fn.name}(${inner})`;

    let highlight:
      | {
          startInSnippet: number;
          endInSnippet: number;
        }
      | undefined;

    if (argParts.length > 0) {
      const prefixLen = fn.name.length + 1; // name(
      const firstVal = argParts[0];
      highlight = {
        startInSnippet: prefixLen,
        endInSnippet: prefixLen + firstVal.length,
      };
    }

    insertSnippetAtSelection(snippet, highlight, functionEditorReplaceRange ?? undefined);
    setFunctionEditorItem(null);
    setFunctionEditorSpecs({});
    setFunctionEditorReplaceRange(null);
    requestAnimationFrame(() => {
      const ta = textAreaRef.current;
      if (ta) triggerOperatorDropdown(ta.selectionStart, ta.value);
    });
  };

  /**
   * Pure parser: given expression text and a cursor position, attempt to parse
   * a function/flag call around that position.  Returns the BrowserItem, parsed
   * param specs, and the text range to replace — or null if nothing matched.
   *
   * Extracted so it can be reused by both the double-click handler and the
   * auto-open-on-edit effect without duplicating 100 lines of parsing.
   */
  const parseFunctionCallAtPosition = (
    text: string,
    pos: number,
    fns: BrowserItem[],
    flgs: BrowserItem[],
  ): {
    item: BrowserItem;
    specs: Record<string, UiParamSpec>;
    range: { start: number; end: number };
  } | null => {
    const safePos = Math.max(0, Math.min(pos, text.length));

    // Try to find the enclosing function/flag call.  Two strategies:
    //
    // Strategy A (original): search backwards from safePos for '('.
    //   Works when the cursor is inside the arg list: "fn(ar|gs)".
    //
    // Strategy B (new): if the cursor is on or just after the function name
    //   (e.g. double-click selected "SigmaSignalV2" placing cursor at end
    //   of the word, right before '('), the backward search finds a '('
    //   from a *previous* call.  So we also search forward for '(' from
    //   safePos, check if the text immediately before that '(' is an
    //   identifier, and use that instead.

    const tryParse = (leftParen: number): {
      item: BrowserItem;
      specs: Record<string, UiParamSpec>;
      range: { start: number; end: number };
    } | null => {
      if (leftParen < 0) return null;

      let nameEnd = leftParen;
      while (nameEnd > 0 && /\s/.test(text[nameEnd - 1])) nameEnd -= 1;
      let nameStart = nameEnd;
      while (nameStart > 0 && /[A-Za-z0-9_]/.test(text[nameStart - 1])) nameStart -= 1;
      const fnName = text.slice(nameStart, nameEnd);
      if (!fnName) return null;

      let depth = 0;
      let rightParen = -1;
      for (let i = leftParen; i < text.length; i += 1) {
        const ch = text[i];
        if (ch === '(') depth += 1;
        else if (ch === ')') {
          depth -= 1;
          if (depth === 0) { rightParen = i; break; }
        }
      }
      if (rightParen < 0) return null;

      // For strategy A the cursor must be within the call span.
      // For strategy B the cursor is on the name — nameStart..rightParen+1.
      if (safePos < nameStart || safePos > rightParen + 1) return null;

      const item = fns.find((it) => it.kind === 'function' && it.name === fnName)
        || flgs.find((it) => it.kind === 'flag' && it.name === fnName);
      if (!item || !item.fnMeta) return null;

      const fn = item.fnMeta as FunctionMeta;
      const paramsArray = Array.isArray(fn.params) ? (fn.params as FunctionParamMeta[]) : [];
      if (paramsArray.length === 0) return null;

      const argsText = text.slice(leftParen + 1, rightParen);

      const args: string[] = [];
      let current = '';
      let argDepth = 0;
      let inSweepMarker = false;
      for (let i = 0; i < argsText.length; i += 1) {
        const ch = argsText[i];
        if (ch === SWEEP_OPEN) { inSweepMarker = true; current += ch; }
        else if (ch === SWEEP_CLOSE) { inSweepMarker = false; current += ch; }
        else if (ch === '(') { argDepth += 1; current += ch; }
        else if (ch === ')') { argDepth = Math.max(0, argDepth - 1); current += ch; }
        else if (ch === ',' && argDepth === 0 && !inSweepMarker) { args.push(current.trim()); current = ''; }
        else { current += ch; }
      }
      if (current.trim().length > 0 || argsText.trim().length === 0) {
        args.push(current.trim());
      }

      const initialSpecs: Record<string, UiParamSpec> = {};
      const kwargMap: Record<string, string> = {};
      const positionalArgs: string[] = [];
      for (const arg of args) {
        const eqIdx = arg.indexOf('=');
        if (eqIdx > 0 && /^[A-Za-z_]\w*$/.test(arg.slice(0, eqIdx).trim()) && arg[eqIdx + 1] !== '=') {
          const kw = arg.slice(0, eqIdx).trim();
          let val = arg.slice(eqIdx + 1).trim();
          if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
            val = val.slice(1, -1);
          }
          kwargMap[kw] = val;
        } else {
          positionalArgs.push(arg);
        }
      }

      paramsArray.forEach((p, idx) => {
        const key = p.name;
        if (!key) return;
        let existing = kwargMap[key] ?? (idx < positionalArgs.length ? positionalArgs[idx].trim() : '');
        if (existing && ((existing.startsWith("'") && existing.endsWith("'")) || (existing.startsWith('"') && existing.endsWith('"')))) {
          existing = existing.slice(1, -1);
        }
        if (existing) {
          initialSpecs[key] = argTextToUiParamSpec(existing);
          return;
        }
        const defVal = p.default !== undefined && p.default !== null ? p.default : '';
        initialSpecs[key] = { kind: 'values', values: [defVal] };
      });

      return {
        item,
        specs: initialSpecs,
        range: { start: nameStart, end: rightParen + 1 },
      };
    };

    // Strategy A: backward search for '('
    const leftParenBack = text.lastIndexOf('(', safePos);
    const resultA = tryParse(leftParenBack);
    if (resultA) return resultA;

    // Strategy B: forward search for '(' — handles cursor on function name
    // (e.g. double-click selected the identifier, pos is at end of word)
    const leftParenFwd = text.indexOf('(', safePos);
    if (leftParenFwd >= 0 && leftParenFwd !== leftParenBack) {
      const resultB = tryParse(leftParenFwd);
      if (resultB) return resultB;
    }

    return null;
  };

  const tryOpenFunctionEditorAtPosition = (pos: number) => {
    const text = previewText || '';
    const result = parseFunctionCallAtPosition(text, pos, functionItems, flagItems);
    if (!result) return;
    setFunctionEditorItem(result.item);
    setFunctionEditorSpecs(result.specs);
    setFunctionEditorReplaceRange(result.range);
  };

  // Auto-open the param editor when editing a simple flag/function call.
  // When the builder mounts with an initial expression like "SigmaSignalV2(n=20, k=2.0)",
  // the user expects the param popup to appear automatically — they shouldn't have to
  // know to double-click inside the call text.  This effect fires once after the registry
  // loads (populating flagItems/functionItems), checks if the entire previewText is a
  // single function/flag call, and if so opens the param editor directly.
  const autoOpenFired = useRef(false);
  const hadInitialText = useRef(
    !!(ast && (ast as any).kind === 'raw_fragment' && typeof (ast as any).text === 'string' && (ast as any).text.trim().length > 0)
  );
  useEffect(() => {
    if (autoOpenFired.current) return;
    if (!hadInitialText.current) return;
    if (flagItems.length === 0 && functionItems.length === 0) return;

    const text = (previewText || '').trim();
    if (!text) return;

    // Quick structural check: must be exactly "Identifier(...)" spanning the full text
    const parenIdx = text.indexOf('(');
    if (parenIdx < 1) return;
    if (!text.endsWith(')')) return;
    const callName = text.slice(0, parenIdx);
    if (!/^[A-Za-z_]\w*$/.test(callName)) return;

    // Verify the opening paren matches the closing paren at end-of-string
    let depth = 0;
    let matchEnd = -1;
    for (let i = parenIdx; i < text.length; i++) {
      if (text[i] === '(') depth++;
      else if (text[i] === ')') { depth--; if (depth === 0) { matchEnd = i; break; } }
    }
    if (matchEnd !== text.length - 1) return;

    // Try to parse it as a function/flag call
    const result = parseFunctionCallAtPosition(text, parenIdx, functionItems, flagItems);
    if (!result) return;

    autoOpenFired.current = true;
    setFunctionEditorItem(result.item);
    setFunctionEditorSpecs(result.specs);
    setFunctionEditorReplaceRange(result.range);
  }, [flagItems, functionItems, previewText]); // eslint-disable-line react-hooks/exhaustive-deps

  const validationLabel =
    !validation
      ? 'pending'
      : validation.ok
      ? 'valid'
      : validation.errors && validation.errors.length
      ? 'invalid'
      : 'pending';

  // --- Inline styles -------------------------------------------------------

  const outerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    borderRadius: 8,
    border: '1px solid #1f2937',
    backgroundColor: '#020617',
    color: '#e5e7eb',
    fontSize: 11,
    minHeight: large ? 0 : 210,
    maxHeight: large ? undefined : 260,
    flex: large ? '1 1 0' : undefined,
    overflow: 'hidden',
    position: 'relative',
  };

  const topBarStyle: CSSProperties = {
    borderBottom: '1px solid #1f2937',
    padding: '8px 12px',
    backgroundColor: '#020617',
    flexShrink: 0,
  };

  const textAreaStyle: CSSProperties = {
    width: '100%',
    height: large ? 64 : 36,
    resize: 'none',
    borderRadius: 4,
    border: '1px solid #374151',
    backgroundColor: '#020617',
    color: '#9ca3af',
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    fontSize: large ? 13 : 11,
    padding: '4px 6px',
  };

  const bottomRowStyle: CSSProperties = {
    display: 'flex',
    flex: '1 1 0',
    minHeight: 0,
    borderTop: '1px solid #1f2937',
    overflow: 'hidden',
    position: 'relative',
  };

  const leftPaneStyle: CSSProperties = {
    width: large ? 180 : 140,
    borderRight: '1px solid #1f2937',
    backgroundColor: '#020617',
    display: 'flex',
    flexDirection: 'column',
  };

  const middlePaneStyle: CSSProperties = {
    width: large ? 260 : 220,
    borderRight: '1px solid #1f2937',
    backgroundColor: '#020617',
    display: 'flex',
    flexDirection: 'column',
  };

  const rightPaneStyle: CSSProperties = {
    flex: 1,
    backgroundColor: '#020617',
    display: 'flex',
    flexDirection: 'column',
  };

  const paneHeaderStyle: CSSProperties = {
    padding: '6px 10px',
    borderBottom: '1px solid #1f2937',
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#9ca3af',
  };

  const sectionHeaderStyle: CSSProperties = {
    fontSize: 9,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#6b7280',
    padding: '8px 10px 3px',
    borderTop: '1px solid #1e293b',
    marginTop: 2,
  };

  const sectionToggleStyle: CSSProperties = {
    width: '100%',
    textAlign: 'left',
    padding: '6px 10px',
    border: 'none',
    borderBottom: '1px solid #1e293b',
    cursor: 'pointer',
    backgroundColor: '#0f172a',
    color: '#d1d5db',
    fontSize: 11,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  };

  const chevronStyle = (expanded: boolean): CSSProperties => ({
    display: 'inline-block',
    width: 10,
    fontSize: 8,
    color: '#9ca3af',
    transition: 'transform 0.15s',
    transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
    flexShrink: 0,
  });

  const scrollBodyStyle: CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    padding: '4px 6px',
  };

  const categoryButtonStyle = (active: boolean): CSSProperties => ({
    width: '100%',
    textAlign: 'left',
    padding: '4px 10px',
    fontSize: 11,
    border: 'none',
    borderLeft: active ? '2px solid #0ea5e9' : '2px solid transparent',
    backgroundColor: active ? '#111827' : 'transparent',
    color: active ? '#f9fafb' : '#e5e7eb',
    cursor: disabled ? 'default' : 'pointer',
  });

  const searchInputStyle: CSSProperties = {
    width: '100%',
    padding: '4px 6px',
    fontSize: 11,
    borderRadius: 4,
    border: '1px solid #374151',
    backgroundColor: '#020617',
    color: '#e5e7eb',
  };

  const listButtonStyle = (selected: boolean): CSSProperties => ({
    width: '100%',
    textAlign: 'left',
    padding: '4px 10px',
    border: 'none',
    borderBottom: '1px solid #111827',
    cursor: disabled ? 'default' : 'pointer',
    backgroundColor: selected ? '#0369a1' : 'transparent',
    color: selected ? '#f9fafb' : '#e5e7eb',
    fontSize: 11,
  });

  const footerStyle: CSSProperties = {
    borderTop: '1px solid #1f2937',
    padding: '4px 10px',
    fontSize: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    color: '#9ca3af',
  };

  const pillBase: CSSProperties = {
    padding: '2px 8px',
    borderRadius: 999,
    border: '1px solid #4b5563',
    fontSize: 10,
  };

  const validPill: CSSProperties = {
    ...pillBase,
    borderColor: '#10b981',
    color: '#6ee7b7',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  };

  const invalidPill: CSSProperties = {
    ...pillBase,
    borderColor: '#f97373',
    color: '#fecaca',
    backgroundColor: 'rgba(248, 113, 113, 0.15)',
  };

  const pendingPill: CSSProperties = {
    ...pillBase,
    borderColor: '#4b5563',
    color: '#e5e7eb',
    backgroundColor: 'transparent',
  };


  const paramOverlayStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.5)',
    zIndex: 2100,  // above the modal backdrop (2000)
  };

  const paramCardStyle: CSSProperties = {
    padding: 14,
    borderRadius: 8,
    border: '1px solid #374151',
    backgroundColor: '#0f172a',
    boxShadow: '0 20px 40px rgba(0,0,0,0.7)',
    color: '#e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    // Auto-size to content, cap at overlay bounds
    maxHeight: '94%',
    maxWidth: '94%',
  };

  const paramTitleStyle: CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 2,
    color: '#f1f5f9',
  };

  const paramSubtitleStyle: CSSProperties = {
    fontSize: 10,
    color: '#9ca3af',
    marginBottom: 8,
    lineHeight: 1.4,
  };

  const paramRowStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    marginBottom: 8,
    padding: '6px 8px',
    borderRadius: 6,
    backgroundColor: '#020617',
    border: '1px solid #1e293b',
  };

  const paramLabelStyle: CSSProperties = {
    fontSize: 10,
    fontWeight: 500,
  };

  const paramHelpStyle: CSSProperties = {
    fontSize: 10,
    color: '#9ca3af',
  };

  const paramInputStyle: CSSProperties = {
    fontSize: 11,
    padding: '3px 4px',
    borderRadius: 4,
    border: '1px solid #4b5563',
    backgroundColor: '#020617',
    color: '#e5e7eb',
  };

  const paramButtonsRowStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTop: '1px solid #1e293b',
  };

  const paramButtonStyle: CSSProperties = {
    fontSize: 11,
    borderRadius: 999,
    padding: '4px 10px',
    border: '1px solid #4b5563',
    backgroundColor: '#111827',
    color: '#e5e7eb',
    cursor: 'pointer',
  };

  const paramPrimaryButtonStyle: CSSProperties = {
    ...paramButtonStyle,
    borderColor: '#0ea5e9',
    backgroundColor: '#0ea5e9',
    color: '#0b1120',
  };

  // Recursive renderer for field tree nodes (N-level depth).
  // Leaf nodes (items, no children) → category selector button.
  // Branch nodes (children) → expandable chevron toggle, recurse children.
  const renderFieldTreeNode = (node: FieldTreeNode, indent: number): React.ReactNode => {
    const hasChildren = !!(node.children && node.children.length > 0);

    if (!hasChildren && node.items) {
      // Leaf: clicking selects this as the active category → middle pane shows items
      const isActive = activeCategoryId === node.id;
      return (
        <button
          key={node.id}
          type="button"
          style={{ ...categoryButtonStyle(isActive), paddingLeft: indent }}
          onClick={() => {
            if (disabled) return;
            setActiveCategoryId(node.id);
            setSelectedItem(null);
          }}
          disabled={disabled}
        >
          {node.label}
        </button>
      );
    }

    if (hasChildren) {
      const isExpanded = expandedFieldNodes.has(node.id);
      return (
        <div key={node.id}>
          <button
            type="button"
            style={{
              ...categoryButtonStyle(false),
              paddingLeft: indent,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
            onClick={() => {
              if (disabled) return;
              toggleFieldNode(node.id);
            }}
            disabled={disabled}
          >
            <span style={chevronStyle(isExpanded)}>▶</span>
            {node.label}
          </button>
          {isExpanded && node.children!.map((child) =>
            renderFieldTreeNode(child, indent + 16)
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div ref={outerRef} style={outerStyle}>
      {/* Dark theme for ParamEditor inputs */}
      <style>{`
        .dark-param-editor input[type="text"],
        .dark-param-editor input[type="number"],
        .dark-param-editor select {
          background-color: #0f172a !important;
          color: #e5e7eb !important;
          border: 1px solid #374151 !important;
          border-radius: 4px !important;
        }
        .dark-param-editor input[type="text"]:focus,
        .dark-param-editor input[type="number"]:focus,
        .dark-param-editor select:focus {
          border-color: #0ea5e9 !important;
          outline: none !important;
        }
        .dark-param-editor span {
          color: #9ca3af !important;
        }
        .dark-param-editor label {
          color: #9ca3af !important;
        }
      `}</style>
      {/* Top expression bar */}
      <div style={topBarStyle}>
        <textarea
          ref={textAreaRef}
          style={textAreaStyle}
          value={previewText}
          placeholder="Type or double-click items below to build an expression."
          onMouseUp={(e) => {
            if (disabled) return;
            const target = e.target as HTMLTextAreaElement;
            // Defer to let browser finalize caret position
            requestAnimationFrame(() => {
              const pos = target.selectionStart;
              const selEnd = target.selectionEnd;
              // If user dragged a manual selection, don't override
              if (pos !== selEnd) return;
              // If clicking inside an already-selected token, allow precise cursor placement
              const curSel = selection;
              if (curSel && pos >= curSel.start && pos <= curSel.end && curSel.start !== curSel.end) {
                // User is clicking within current selection — let them place cursor precisely
                setSelection({ start: pos, end: pos });
                return;
              }
              const text = previewText || '';
              const tok = findTokenAtPosition(text, pos);
              if (tok) {
                target.selectionStart = tok.start;
                target.selectionEnd = tok.end;
                setSelection({ start: tok.start, end: tok.end });
              }
            });
          }}
          onDoubleClick={(e) => {
            if (disabled) return;
            const target = e.target as HTMLTextAreaElement;
            // Use selectionEnd: on double-click the browser selects the entire
            // word, setting selectionStart to word-start (before the '(') and
            // selectionEnd to word-end.  Using selectionEnd places the cursor
            // at or past the identifier, so the backward search for '(' in
            // parseFunctionCallAtPosition finds the correct opening paren
            // belonging to THIS function/flag call, not a previous one.
            const pos =
              typeof target.selectionEnd === 'number'
                ? target.selectionEnd
                : (previewText || '').length;
            tryOpenFunctionEditorAtPosition(pos);
          }}
          onChange={(e) => {
            if (operatorDropdown) setOperatorDropdown(null);
            if (disabled) return;
            const value = e.target.value;
            setPreviewText(value);
            const nextAst: Expr = { kind: 'raw_fragment', text: value } as any;
            onChange(nextAst);
            const start =
              typeof e.target.selectionStart === 'number'
                ? e.target.selectionStart
                : value.length;
            const end =
              typeof e.target.selectionEnd === 'number'
                ? e.target.selectionEnd
                : start;
            setSelection({ start, end });
          }}
          onSelect={(e) => {
            const target = e.target as HTMLTextAreaElement;
            const start =
              typeof target.selectionStart === 'number' ? target.selectionStart : 0;
            const end =
              typeof target.selectionEnd === 'number' ? target.selectionEnd : start;
            setSelection({ start, end });
          }}
          disabled={disabled}
        />
      </div>

      {/* Bottom three-pane browser */}
      <div style={bottomRowStyle}>
        {/* Categories — hierarchical tree */}
        <div style={leftPaneStyle}>
          <div style={paneHeaderStyle}>Browser</div>
          <div style={scrollBodyStyle}>
            {fieldTree.length === 0 && categories.length === 0 ? (
              <div style={{ fontSize: 11, color: '#6b7280', padding: '4px 2px' }}>
                No fields, functions, operators, or flags available.
              </div>
            ) : (
              <>
                {/* Data Fields — hierarchical drill-down */}
                {fieldTree.length > 0 && (
                  <>
                    <button
                      type="button"
                      style={sectionToggleStyle}
                      onClick={() => toggleFieldNode('section:fields')}
                    >
                      <span style={chevronStyle(expandedFieldNodes.has('section:fields'))}>▶</span>
                      Data Fields
                    </button>
                    {expandedFieldNodes.has('section:fields') && fieldTree.map((node) =>
                      renderFieldTreeNode(node, 20)
                    )}
                  </>
                )}

                {/* Functions */}
                {functionItems.length > 0 && (
                  <>
                    <button
                      type="button"
                      style={sectionToggleStyle}
                      onClick={() => {
                        toggleFieldNode('section:functions');
                        if (!expandedFieldNodes.has('section:functions')) {
                          setActiveCategoryId('functions');
                          setSelectedItem(null);
                        }
                      }}
                    >
                      <span style={chevronStyle(expandedFieldNodes.has('section:functions'))}>▶</span>
                      Functions
                      <span style={{ color: '#6b7280', marginLeft: 'auto', fontSize: 9, fontWeight: 400 }}>
                        {functionItems.length}
                      </span>
                    </button>
                    {expandedFieldNodes.has('section:functions') && (
                      <>
                        <button
                          type="button"
                          style={{ ...categoryButtonStyle(activeCategoryId === 'functions'), paddingLeft: 20 }}
                          onClick={() => {
                            if (disabled) return;
                            setActiveCategoryId('functions');
                            setSelectedItem(null);
                          }}
                          disabled={disabled}
                        >
                          All Functions
                        </button>
                        {functionItems.map((fn) => {
                          const isActive = selectedItem?.id === fn.id && activeCategoryId === 'functions';
                          return (
                            <button
                              key={fn.id}
                              type="button"
                              style={{
                                ...categoryButtonStyle(isActive),
                                paddingLeft: 32,
                                fontSize: 10,
                              }}
                              onClick={() => {
                                if (disabled) return;
                                setActiveCategoryId('functions');
                                setSelectedItem(fn);
                              }}
                              onDoubleClick={() => {
                                if (disabled) return;
                                handleInsertItem(fn);
                              }}
                              disabled={disabled}
                            >
                              {fn.label}
                            </button>
                          );
                        })}
                      </>
                    )}
                  </>
                )}

                {/* Operators */}
                {operatorItems.length > 0 && (
                  <>
                    <button
                      type="button"
                      style={sectionToggleStyle}
                      onClick={() => {
                        toggleFieldNode('section:operators');
                        if (!expandedFieldNodes.has('section:operators')) {
                          setActiveCategoryId('operators');
                          setSelectedItem(null);
                        }
                      }}
                    >
                      <span style={chevronStyle(expandedFieldNodes.has('section:operators'))}>▶</span>
                      Operators
                      <span style={{ color: '#6b7280', marginLeft: 'auto', fontSize: 9, fontWeight: 400 }}>
                        {operatorItems.length}
                      </span>
                    </button>
                    {expandedFieldNodes.has('section:operators') && (
                      <>
                        <button
                          type="button"
                          style={{ ...categoryButtonStyle(activeCategoryId === 'operators'), paddingLeft: 20 }}
                          onClick={() => {
                            if (disabled) return;
                            setActiveCategoryId('operators');
                            setSelectedItem(null);
                          }}
                          disabled={disabled}
                        >
                          All Operators
                        </button>
                        {operatorItems.map((op) => {
                          const isActive = selectedItem?.id === op.id && activeCategoryId === 'operators';
                          return (
                            <button
                              key={op.id}
                              type="button"
                              style={{
                                ...categoryButtonStyle(isActive),
                                paddingLeft: 32,
                                fontSize: 10,
                              }}
                              onClick={() => {
                                if (disabled) return;
                                setActiveCategoryId('operators');
                                setSelectedItem(op);
                              }}
                              onDoubleClick={() => {
                                if (disabled) return;
                                handleInsertItem(op);
                              }}
                              disabled={disabled}
                            >
                              {op.label}
                            </button>
                          );
                        })}
                      </>
                    )}
                  </>
                )}

                {/* Flags — list individual flags as children so they're directly browsable */}
                {flagItems.length > 0 && (
                  <>
                    <button
                      type="button"
                      style={sectionToggleStyle}
                      onClick={() => {
                        toggleFieldNode('section:flags');
                        if (!expandedFieldNodes.has('section:flags')) {
                          setActiveCategoryId('flags');
                          setSelectedItem(null);
                        }
                      }}
                    >
                      <span style={chevronStyle(expandedFieldNodes.has('section:flags'))}>▶</span>
                      Flags
                      <span style={{ color: '#6b7280', marginLeft: 'auto', fontSize: 9, fontWeight: 400 }}>
                        {flagItems.length}
                      </span>
                    </button>
                    {expandedFieldNodes.has('section:flags') && (
                      <>
                        <button
                          type="button"
                          style={{ ...categoryButtonStyle(activeCategoryId === 'flags'), paddingLeft: 20 }}
                          onClick={() => {
                            if (disabled) return;
                            setActiveCategoryId('flags');
                            setSelectedItem(null);
                          }}
                          disabled={disabled}
                        >
                          All Flags
                        </button>
                        {flagItems.map((flag) => {
                          const isActive = selectedItem?.id === flag.id && activeCategoryId === 'flags';
                          return (
                            <button
                              key={flag.id}
                              type="button"
                              style={{
                                ...categoryButtonStyle(isActive),
                                paddingLeft: 32,
                                fontSize: 10,
                              }}
                              onClick={() => {
                                if (disabled) return;
                                setActiveCategoryId('flags');
                                setSelectedItem(flag);
                              }}
                              onDoubleClick={() => {
                                if (disabled) return;
                                handleInsertItem(flag);
                              }}
                              disabled={disabled}
                            >
                              {flag.label}
                            </button>
                          );
                        })}
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Item list */}
        <div style={middlePaneStyle}>
          <div style={{ ...paneHeaderStyle, borderBottom: '1px solid #1f2937' }}>
            <input
              type="text"
              placeholder="Enter text to search..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={disabled}
              style={searchInputStyle}
            />
          </div>
          <div style={scrollBodyStyle}>
            {filteredItems.length === 0 ? (
              <div style={{ fontSize: 11, color: '#6b7280', padding: '4px 2px' }}>
                No items match this search.
              </div>
            ) : (
              filteredItems.map((item) => {
                const isSelected = selectedItem?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    style={listButtonStyle(isSelected)}
                    onClick={() => {
                      if (disabled) return;
                      // Manual double-click detection: if same item clicked within 400ms, treat as double-click
                      if (selectedItem?.id === item.id && lastClickRef.current.id === item.id &&
                          (Date.now() - lastClickRef.current.ts) < 400) {
                        lastClickRef.current = { id: '', ts: 0 };
                        handleInsertItem(item);
                        return;
                      }
                      lastClickRef.current = { id: item.id, ts: Date.now() };
                      setSelectedItem(item);
                    }}
                    disabled={disabled}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.label}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: '#9ca3af',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.name}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Details + validation */}
        <div style={rightPaneStyle}>
          <div style={scrollBodyStyle}>
            {selectedItem ? (
              <>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    marginBottom: 4,
                    color: '#e5e7eb',
                  }}
                >
                  {selectedItem.label}
                </div>
                <div
                  style={{
                    fontFamily:
                      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                    fontSize: 11,
                    color: '#7dd3fc',
                    marginBottom: 6,
                  }}
                >
                  {selectedItem.signature}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: '#e5e7eb',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {selectedItem.description || 'No description available.'}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 11, color: '#6b7280' }}>
                Select a field, function, operator, or flag to see its details.
              </div>
            )}
          </div>
          <div style={footerStyle}>
            <span>Validation</span>
            {validationLabel === 'valid' ? (
              <span style={validPill}>valid</span>
            ) : validationLabel === 'invalid' ? (
              <span style={invalidPill}>invalid</span>
            ) : (
              <span style={pendingPill}>pending</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Operator suggestion dropdown ── */}
      {operatorDropdown && (
        <div style={{
          position: 'fixed',
          left: Math.min(operatorDropdown.x, window.innerWidth - 170),
          top: operatorDropdown.y + 4,
          zIndex: 9999,
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderRadius: 6,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 130,
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '4px 10px', borderBottom: '1px solid var(--line)',
            fontSize: 11, color: 'var(--muted)' }}>
            <span>Insert operator</span>
            <button className="button ghost"
              onMouseDown={e => { e.preventDefault(); setOperatorDropdown(null); }}
              style={{ fontSize: 10, padding: '0 4px' }}>×</button>
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)', padding: '3px 10px 1px',
            letterSpacing: '0.05em', textTransform: 'uppercase' }}>Comparison</div>
          <button className="button ghost"
            style={{ fontSize: 12, padding: '3px 14px', textAlign: 'left',
              fontFamily: 'ui-monospace, monospace', borderRadius: 0, width: '100%' }}
            onMouseDown={e => {
              e.preventDefault();
              const ins = ' > ';
              const pos = operatorDropdown!.caretPos;
              const txt = previewText || '';
              const next = txt.slice(0, pos) + ins + txt.slice(pos);
              setPreviewText(next);
              onChange({ kind: 'raw_fragment', text: next } as any);
              const nc = pos + ins.length;
              setSelection({ start: nc, end: nc });
              requestAnimationFrame(() => {
                const ta = textAreaRef.current;
                if (ta) { ta.focus(); ta.selectionStart = nc; ta.selectionEnd = nc; }
              });
              setOperatorDropdown(null);
            }}
          >{'>'}</button>
          <button className="button ghost"
            style={{ fontSize: 12, padding: '3px 14px', textAlign: 'left',
              fontFamily: 'ui-monospace, monospace', borderRadius: 0, width: '100%' }}
            onMouseDown={e => {
              e.preventDefault();
              const ins = ' >= ';
              const pos = operatorDropdown!.caretPos;
              const txt = previewText || '';
              const next = txt.slice(0, pos) + ins + txt.slice(pos);
              setPreviewText(next);
              onChange({ kind: 'raw_fragment', text: next } as any);
              const nc = pos + ins.length;
              setSelection({ start: nc, end: nc });
              requestAnimationFrame(() => {
                const ta = textAreaRef.current;
                if (ta) { ta.focus(); ta.selectionStart = nc; ta.selectionEnd = nc; }
              });
              setOperatorDropdown(null);
            }}
          >{'>='}</button>
          <button className="button ghost"
            style={{ fontSize: 12, padding: '3px 14px', textAlign: 'left',
              fontFamily: 'ui-monospace, monospace', borderRadius: 0, width: '100%' }}
            onMouseDown={e => {
              e.preventDefault();
              const ins = ' < ';
              const pos = operatorDropdown!.caretPos;
              const txt = previewText || '';
              const next = txt.slice(0, pos) + ins + txt.slice(pos);
              setPreviewText(next);
              onChange({ kind: 'raw_fragment', text: next } as any);
              const nc = pos + ins.length;
              setSelection({ start: nc, end: nc });
              requestAnimationFrame(() => {
                const ta = textAreaRef.current;
                if (ta) { ta.focus(); ta.selectionStart = nc; ta.selectionEnd = nc; }
              });
              setOperatorDropdown(null);
            }}
          >{'<'}</button>
          <button className="button ghost"
            style={{ fontSize: 12, padding: '3px 14px', textAlign: 'left',
              fontFamily: 'ui-monospace, monospace', borderRadius: 0, width: '100%' }}
            onMouseDown={e => {
              e.preventDefault();
              const ins = ' <= ';
              const pos = operatorDropdown!.caretPos;
              const txt = previewText || '';
              const next = txt.slice(0, pos) + ins + txt.slice(pos);
              setPreviewText(next);
              onChange({ kind: 'raw_fragment', text: next } as any);
              const nc = pos + ins.length;
              setSelection({ start: nc, end: nc });
              requestAnimationFrame(() => {
                const ta = textAreaRef.current;
                if (ta) { ta.focus(); ta.selectionStart = nc; ta.selectionEnd = nc; }
              });
              setOperatorDropdown(null);
            }}
          >{'<='}</button>
          <button className="button ghost"
            style={{ fontSize: 12, padding: '3px 14px', textAlign: 'left',
              fontFamily: 'ui-monospace, monospace', borderRadius: 0, width: '100%' }}
            onMouseDown={e => {
              e.preventDefault();
              const ins = ' == ';
              const pos = operatorDropdown!.caretPos;
              const txt = previewText || '';
              const next = txt.slice(0, pos) + ins + txt.slice(pos);
              setPreviewText(next);
              onChange({ kind: 'raw_fragment', text: next } as any);
              const nc = pos + ins.length;
              setSelection({ start: nc, end: nc });
              requestAnimationFrame(() => {
                const ta = textAreaRef.current;
                if (ta) { ta.focus(); ta.selectionStart = nc; ta.selectionEnd = nc; }
              });
              setOperatorDropdown(null);
            }}
          >==</button>
          <button className="button ghost"
            style={{ fontSize: 12, padding: '3px 14px', textAlign: 'left',
              fontFamily: 'ui-monospace, monospace', borderRadius: 0, width: '100%' }}
            onMouseDown={e => {
              e.preventDefault();
              const ins = ' != ';
              const pos = operatorDropdown!.caretPos;
              const txt = previewText || '';
              const next = txt.slice(0, pos) + ins + txt.slice(pos);
              setPreviewText(next);
              onChange({ kind: 'raw_fragment', text: next } as any);
              const nc = pos + ins.length;
              setSelection({ start: nc, end: nc });
              requestAnimationFrame(() => {
                const ta = textAreaRef.current;
                if (ta) { ta.focus(); ta.selectionStart = nc; ta.selectionEnd = nc; }
              });
              setOperatorDropdown(null);
            }}
          >!=</button>
          <div style={{ fontSize: 10, color: 'var(--muted)', padding: '3px 10px 1px',
            letterSpacing: '0.05em', textTransform: 'uppercase' }}>Logical</div>
          <button className="button ghost"
            style={{ fontSize: 12, padding: '3px 14px', textAlign: 'left',
              fontFamily: 'ui-monospace, monospace', borderRadius: 0, width: '100%' }}
            onMouseDown={e => {
              e.preventDefault();
              const ins = ' and ';
              const pos = operatorDropdown!.caretPos;
              const txt = previewText || '';
              const next = txt.slice(0, pos) + ins + txt.slice(pos);
              setPreviewText(next);
              onChange({ kind: 'raw_fragment', text: next } as any);
              const nc = pos + ins.length;
              setSelection({ start: nc, end: nc });
              requestAnimationFrame(() => {
                const ta = textAreaRef.current;
                if (ta) { ta.focus(); ta.selectionStart = nc; ta.selectionEnd = nc; }
              });
              setOperatorDropdown(null);
            }}
          >and</button>
          <button className="button ghost"
            style={{ fontSize: 12, padding: '3px 14px', textAlign: 'left',
              fontFamily: 'ui-monospace, monospace', borderRadius: 0, width: '100%' }}
            onMouseDown={e => {
              e.preventDefault();
              const ins = ' or ';
              const pos = operatorDropdown!.caretPos;
              const txt = previewText || '';
              const next = txt.slice(0, pos) + ins + txt.slice(pos);
              setPreviewText(next);
              onChange({ kind: 'raw_fragment', text: next } as any);
              const nc = pos + ins.length;
              setSelection({ start: nc, end: nc });
              requestAnimationFrame(() => {
                const ta = textAreaRef.current;
                if (ta) { ta.focus(); ta.selectionStart = nc; ta.selectionEnd = nc; }
              });
              setOperatorDropdown(null);
            }}
          >or</button>
          <button className="button ghost"
            style={{ fontSize: 12, padding: '3px 14px', textAlign: 'left',
              fontFamily: 'ui-monospace, monospace', borderRadius: 0, width: '100%' }}
            onMouseDown={e => {
              e.preventDefault();
              const ins = ' not ';
              const pos = operatorDropdown!.caretPos;
              const txt = previewText || '';
              const next = txt.slice(0, pos) + ins + txt.slice(pos);
              setPreviewText(next);
              onChange({ kind: 'raw_fragment', text: next } as any);
              const nc = pos + ins.length;
              setSelection({ start: nc, end: nc });
              requestAnimationFrame(() => {
                const ta = textAreaRef.current;
                if (ta) { ta.focus(); ta.selectionStart = nc; ta.selectionEnd = nc; }
              });
              setOperatorDropdown(null);
            }}
          >not</button>
          <div style={{ fontSize: 10, color: 'var(--muted)', padding: '3px 10px 1px',
            letterSpacing: '0.05em', textTransform: 'uppercase' }}>Arithmetic</div>
          <button className="button ghost"
            style={{ fontSize: 12, padding: '3px 14px', textAlign: 'left',
              fontFamily: 'ui-monospace, monospace', borderRadius: 0, width: '100%' }}
            onMouseDown={e => {
              e.preventDefault();
              const ins = ' + ';
              const pos = operatorDropdown!.caretPos;
              const txt = previewText || '';
              const next = txt.slice(0, pos) + ins + txt.slice(pos);
              setPreviewText(next);
              onChange({ kind: 'raw_fragment', text: next } as any);
              const nc = pos + ins.length;
              setSelection({ start: nc, end: nc });
              requestAnimationFrame(() => {
                const ta = textAreaRef.current;
                if (ta) { ta.focus(); ta.selectionStart = nc; ta.selectionEnd = nc; }
              });
              setOperatorDropdown(null);
            }}
          >+</button>
          <button className="button ghost"
            style={{ fontSize: 12, padding: '3px 14px', textAlign: 'left',
              fontFamily: 'ui-monospace, monospace', borderRadius: 0, width: '100%' }}
            onMouseDown={e => {
              e.preventDefault();
              const ins = ' - ';
              const pos = operatorDropdown!.caretPos;
              const txt = previewText || '';
              const next = txt.slice(0, pos) + ins + txt.slice(pos);
              setPreviewText(next);
              onChange({ kind: 'raw_fragment', text: next } as any);
              const nc = pos + ins.length;
              setSelection({ start: nc, end: nc });
              requestAnimationFrame(() => {
                const ta = textAreaRef.current;
                if (ta) { ta.focus(); ta.selectionStart = nc; ta.selectionEnd = nc; }
              });
              setOperatorDropdown(null);
            }}
          >-</button>
          <button className="button ghost"
            style={{ fontSize: 12, padding: '3px 14px', textAlign: 'left',
              fontFamily: 'ui-monospace, monospace', borderRadius: 0, width: '100%' }}
            onMouseDown={e => {
              e.preventDefault();
              const ins = ' * ';
              const pos = operatorDropdown!.caretPos;
              const txt = previewText || '';
              const next = txt.slice(0, pos) + ins + txt.slice(pos);
              setPreviewText(next);
              onChange({ kind: 'raw_fragment', text: next } as any);
              const nc = pos + ins.length;
              setSelection({ start: nc, end: nc });
              requestAnimationFrame(() => {
                const ta = textAreaRef.current;
                if (ta) { ta.focus(); ta.selectionStart = nc; ta.selectionEnd = nc; }
              });
              setOperatorDropdown(null);
            }}
          >*</button>
          <button className="button ghost"
            style={{ fontSize: 12, padding: '3px 14px', textAlign: 'left',
              fontFamily: 'ui-monospace, monospace', borderRadius: 0, width: '100%' }}
            onMouseDown={e => {
              e.preventDefault();
              const ins = ' / ';
              const pos = operatorDropdown!.caretPos;
              const txt = previewText || '';
              const next = txt.slice(0, pos) + ins + txt.slice(pos);
              setPreviewText(next);
              onChange({ kind: 'raw_fragment', text: next } as any);
              const nc = pos + ins.length;
              setSelection({ start: nc, end: nc });
              requestAnimationFrame(() => {
                const ta = textAreaRef.current;
                if (ta) { ta.focus(); ta.selectionStart = nc; ta.selectionEnd = nc; }
              });
              setOperatorDropdown(null);
            }}
          >/</button>
        </div>
      )}

      {functionEditorItem && functionEditorItem.fnMeta && (() => {
        const paramsArr = Array.isArray(functionEditorItem.fnMeta.params)
          ? functionEditorItem.fnMeta.params
          : [];
        const paramCount = paramsArr.length;
        const useGrid = paramCount >= 4;
        const cardWidth = useGrid ? (paramCount >= 6 ? 760 : 680) : 420;

        return (
        <div
          style={paramOverlayStyle}
          onClick={() => {
            setFunctionEditorItem(null);
            setFunctionEditorSpecs({});
            setFunctionEditorReplaceRange(null);
          }}
        >
          <div
            style={{
              ...paramCardStyle,
              width: cardWidth,
              // ≤2 params: auto-size; 3+: use available height
              ...(paramCount <= 2
                ? {}
                : { height: '80vh', maxHeight: '80vh' }
              ),
            }}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            {/* Header */}
            <div style={{ flexShrink: 0, marginBottom: 8 }}>
              <div style={paramTitleStyle}>
                {(functionEditorItem.fnMeta.title as string) ||
                  functionEditorItem.fnMeta.name}
              </div>
              {functionEditorItem.fnMeta.description && (
                <div style={{
                  ...paramSubtitleStyle,
                  maxHeight: 32,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  marginBottom: 0,
                }}>
                  {String(functionEditorItem.fnMeta.description)}
                </div>
              )}
            </div>
            {/* Params */}
            <div style={{
              // When card has fixed height (3+ params), flex-grow to fill; otherwise just size to content
              ...(paramCount <= 2
                ? { overflowY: 'visible' as const }
                : { flex: '1 1 0', minHeight: 0, overflowY: 'auto' as const }
              ),
              ...(useGrid ? {
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 6,
                alignContent: 'start',
              } : {
                display: 'flex',
                flexDirection: 'column' as const,
                gap: 6,
              }),
            }}>
            {paramCount > 0 ? (
              paramsArr.map((p, idx) => {
                const key = p.name;
                const def = fnParamToParamDefinition(p);
                const spec = functionEditorSpecs[key] ?? { kind: 'values' as const, values: p.default != null ? [p.default] : [] };
                const helpText = ((p as any).help || (p as any).desc || (p as any).description) as string | undefined;
                return (
                  <div key={key || idx} style={paramRowStyle} className="dark-param-editor">
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#93c5fd' }}>
                        {key}
                      </span>
                      {p.type && (
                        <span style={{ fontSize: 9, color: '#6b7280', fontFamily: 'monospace' }}>
                          {String(p.type)}
                        </span>
                      )}
                      {p.default != null && (
                        <span style={{ fontSize: 9, color: '#6b7280' }}>
                          = {String(p.default)}
                        </span>
                      )}
                    </div>
                    {helpText && (
                      <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 2, lineHeight: 1.3 }}>
                        {helpText}
                      </div>
                    )}
                    <ParamEditor
                      def={def}
                      value={spec}
                      onChange={(newSpec) =>
                        setFunctionEditorSpecs((prev) => ({
                          ...prev,
                          [key]: newSpec,
                        }))
                      }
                    />
                  </div>
                );
              })
            ) : (
              <div style={paramHelpStyle}>This function has no parameters.</div>
            )}
            </div>
            {/* Footer — always visible */}
            <div style={{ ...paramButtonsRowStyle, flexShrink: 0 }}>
              <button
                type="button"
                style={paramButtonStyle}
                onClick={() => {
                  setFunctionEditorItem(null);
                  setFunctionEditorSpecs({});
                  setFunctionEditorReplaceRange(null);
                }}
              >
                Cancel
            </button>
              <button
                type="button"
                style={paramPrimaryButtonStyle}
                onClick={handleConfirmFunctionInsert}
              >
                Insert
            </button>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
};

export { ExpressionBuilder };
export default ExpressionBuilder;
