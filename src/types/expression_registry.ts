// Registry metadata for expression fields, functions, operators, and flags.
// This is UI-facing metadata; the backend owns the authoritative
// implementation and semantics of each item.

export type UiGroup = 'field' | 'function' | 'operator' | 'flag';

export type FieldUiCategory =
  | 'price_volume'
  | 'indicator'
  | 'event'
  | 'econ'
  | 'period'
  | 'misc';

export type FunctionUiCategory =
  | 'trend'
  | 'volatility'
  | 'volume'
  | 'oscillator'
  | 'calendar'
  | 'event'
  | 'misc';

export type OperatorUiCategory =
  | 'arithmetic'
  | 'comparison'
  | 'logical'
  | 'membership'
  | 'range'
  | 'time_window';

export type FlagUiCategory = FunctionUiCategory;

/**
 * Backend field metadata.
 */
export interface FieldMeta {
  // Source identity
  domain: string;
  dataset: string;
  field: string | null;
  key: string;

  // Registry metadata
  title: string;
  description: string;
  type?: string | null;
  units?: string | null;
  depends_on?: unknown;
  examples?: unknown;

  // UI hints
  ui_group: 'field';
  ui_category: FieldUiCategory | string;

  // Allow future backend keys without breaking TS
  [key: string]: unknown;
}

export interface FunctionParamMeta {
  name: string;
  type?: string | null;
  default?: unknown;
  [key: string]: unknown;
}

export interface FunctionMeta {
  name: string;

  // Registry metadata
  title: string;
  description: string;
  params?: FunctionParamMeta[];
  returns?: string;
  depends_on?: unknown;
  examples?: unknown;

  // UI hints
  ui_group: 'function';
  ui_category: FunctionUiCategory | string;

  [key: string]: unknown;
}

export type OperatorArity = 'unary' | 'binary' | 'postfix';

export interface OperatorMeta {
  key: string;
  symbol: string;

  title: string;
  description: string;

  arity: OperatorArity;
  precedence: number;

  ui_group: 'operator';
  ui_category: OperatorUiCategory | string;

  examples: string[];

  [key: string]: unknown;
}

export interface FlagParamMeta {
  name: string;
  type?: string | null;
  default?: unknown;
  [key: string]: unknown;
}

export interface FlagMeta {
  name: string;

  // Registry metadata
  title: string;
  description: string;
  params?: FlagParamMeta[];
  returns?: string;
  depends_on?: unknown;
  examples?: unknown;

  // UI hints
  ui_group: 'flag';
  ui_category: FlagUiCategory | string;

  [key: string]: unknown;
}

/**
 * Backend payload shape for /api/registry/expression.
 */
export interface ExpressionRegistryBackendPayload {
  fields: FieldMeta[];
  functions: FunctionMeta[];
  operators: OperatorMeta[];
  flags: FlagMeta[];
  function_count: number;
  flag_count: number;
  error: string | null;
}

/**
 * Normalized registry used throughout the UI.
 */
export interface ExpressionRegistry {
  fields: FieldMeta[];
  functions: FunctionMeta[];
  operators: OperatorMeta[];
  flags: FlagMeta[];
  error: string | null;
}
