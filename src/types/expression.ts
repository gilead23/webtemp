// Expression AST and config types for Expression Flag editor.
// Frontend-only model that mirrors the backend expression language grammar
// at a high level. The backend still receives / parses raw DSL strings;
// this AST is for building / serializing expressions in the UI.

export type BinaryOp =
  | 'and' | 'or'
  | '==' | '!='
  | '>' | '>=' | '<' | '<='
  | 'in' | 'not_in';

export type UnaryOp = 'not' | '+' | '-';

export type LiteralValue = number | string | boolean;

export interface BinaryExpr {
  kind: 'binary';
  op: BinaryOp;
  left: Expr;
  right: Expr;
}

export interface UnaryExpr {
  kind: 'unary';
  op: UnaryOp;
  expr: Expr;
}

export interface CallExpr {
  kind: 'call';
  fn: string;
  args: Expr[];
}

export interface IdentifierExpr {
  kind: 'identifier';
  name: string;
}

// Grouping parentheses
export interface GroupExpr {
  kind: 'group';
  expr: Expr;
}

// Indexing / lag semantics.
// For now we distinguish lag-style indexing from generic indexing,
// but serialize both to the DSL forms defined in the language guide.
export type IndexKind = 'lag' | 'generic';

export interface IndexExpr {
  kind: 'index';
  target: Expr;
  indexKind: IndexKind;
  indices: Expr[];
}

// Set literal: { a, b, c }
export interface SetExpr {
  kind: 'set';
  elements: Expr[];
}

// Range literal: a .. b
export interface RangeExpr {
  kind: 'range';
  start: Expr;
  end: Expr;
}

// Raw fragment that should be passed through untouched.
// Used as an escape hatch when the UI cannot represent some structure.
export interface RawFragmentExpr {
  kind: 'raw_fragment';
  text: string;
}

// Optional conditional node. The current language guide does not define a
// concrete IF/THEN/ELSE syntax, so this is reserved for future use.
// The serializer intentionally does not emit a textual form for this node.
export interface ConditionalExpr {
  kind: 'conditional';
  condition: Expr;
  whenTrue: Expr;
  whenFalse: Expr;
}

export type Expr =
  | BinaryExpr
  | UnaryExpr
  | CallExpr
  | IdentifierExpr
  | LiteralExpr
  | GroupExpr
  | IndexExpr
  | SetExpr
  | RangeExpr
  | RawFragmentExpr
  | ConditionalExpr;

export interface LiteralExpr {
  kind: 'literal';
  value: LiteralValue;
}

export type ExpressionMode = 'visual' | 'raw';

export interface ExpressionFlagConfig {
  ast: Expr | null;
  raw: string;
  mode: ExpressionMode;
  validation?: ExpressionValidationResult;
}

export interface ExpressionValidationResult {
  ok: boolean;
  errors: ExpressionError[];
}

export interface ExpressionError {
  code: string;
  message: string;
  span?: { start: number; end: number };
  nodePath?: string;
}
