import { SelectedStrategy } from './StrategyPicker'

export default function SelectedStrategies({
  title,
  items,
  onEdit,
  onRemove
}:{
  title: string
  items: SelectedStrategy[]
  onEdit: (idx:number)=>void
  onRemove: (idx:number)=>void
}){
  return (
    <div className="card stack" style={{gap:12}}>
      <div className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
        <h3 style={{margin:0}}>{title}</h3>
        <span className="badge">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="hint">None selected yet.</div>
      ) : (
        <div className="stack" style={{gap:8}}>
          {items.map((s, i)=>{
            const exprArr = s.params?.expression;
            const exprCount = Array.isArray(exprArr) ? exprArr.length : 0;
            const hasSweepTemplate = Array.isArray(s.params?._sweep_template) && s.params._sweep_template.length > 0;
            // For display, show the template if available, otherwise the first expression
            const displayExpr = hasSweepTemplate
              ? String(s.params._sweep_template[0])
              : (exprCount > 0 ? String(exprArr[0]) : '');
            // For non-expression params, filter out internal keys
            const otherParams = Object.entries(s.params || {})
              .filter(([k]) => k !== 'expression' && k !== '_sweep_template')
              .map(([k, v]) => `${k}=[${(v || []).join(', ')}]`)
              .join('  ');

            return (
              <div key={i} className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.label}
                  </strong>
                  {displayExpr && (
                    <div className="hint" style={{
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {displayExpr}
                    </div>
                  )}
                  {exprCount > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <span style={{
                        fontSize: 10,
                        padding: '1px 6px',
                        borderRadius: 999,
                        border: '1px solid var(--link)',
                        color: 'var(--link)',
                        backgroundColor: 'color-mix(in oklab, var(--link) 18%, transparent)',
                      }}>
                        {exprCount} variants
                      </span>
                    </div>
                  )}
                  {otherParams && <div className="hint">{otherParams}</div>}
                </div>
                <div className="row" style={{gap:8, flexShrink: 0}}>
                  <button className="button ghost" onClick={()=>onEdit(i)}>Edit</button>
                  <button className="button ghost" onClick={()=>onRemove(i)}>Remove</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  )
}
