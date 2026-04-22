// Shared types for sweep flag UI

export type UiParamSpec =
  | { kind: 'values'; values: (number | string | boolean)[] }
  | { kind: 'range'; start: number; stop: number; step: number; inclusive: boolean }
  | { kind: 'log_range'; start: number; stop: number; num: number; inclusive: boolean; roundToTick?: number }
  | { kind: 'as_is' };

export interface UiFlagInstance {
  id: string;
  label: string;
  name: string;
  title: string;
  description?: string;
  params: Record<string, UiParamSpec>;
}

export type ParamMode = 'value' | 'range' | 'log_range' | 'as_is';

export interface ParamDefinition {
  name: string;
  label: string;
  description?: string;
  dataType: 'int' | 'float' | 'enum' | 'bool' | 'string';
  allowedModes: ParamMode[];
  defaultMode: ParamMode;
  enumValues?: { value: string | number; label?: string }[];
  defaultValue?: number | string | boolean;
  defaultRange?: { start: number; stop: number; step: number; inclusive: boolean };
  defaultLogRange?: { start: number; stop: number; num: number; inclusive: boolean; roundToTick?: number };
}

export interface FlagDefinition {
  name: string;
  label: string;
  description?: string;
  category?: string;
  isEntry: boolean;
  params: ParamDefinition[];
}
