export type ParamMeta = {
  help?: string
  choices?: string[]
  kind?: 'number' | 'integer' | 'float' | 'percent' | 'string' | 'boolean'
  min?: number
  max?: number
  step?: number
  required?: boolean
  pattern?: string
  placeholder?: string
  unit?: string
}

export type StrategyParam = {
  name: string
  type?: string
  default?: any
  choices?: string[]
  help?: string
  meta?: ParamMeta
}

export type StrategyDef = {
  name: string
  label: string
  description?: string
  category?: string
  params: StrategyParam[]
}

export async function fetchStrategies(): Promise<StrategyDef[]> {
  const r = await fetch('/api/registry/strategies')
  if (!r.ok) return []
  return await r.json()
}
