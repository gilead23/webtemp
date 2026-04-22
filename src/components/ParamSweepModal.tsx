import { useState } from 'react'
import ParamValueComposer, { ParamMeta, ParamState } from './ParamValueComposer'
import Modal from './ui/Modal'

export default function ParamSweepModal({
  name,
  meta,
  initial,
  onApply,
  onClose,
}:{
  name: string
  meta?: ParamMeta
  initial?: ParamState
  onApply: (state: ParamState, values: any[]) => void
  onClose: () => void
}){
  const [st, setSt] = useState<ParamState>(initial ?? { mode: 'single', value: '' })
  const [arr, setArr] = useState<any[]>([])
  const [valid, setValid] = useState<boolean>(true)
  const [err, setErr] = useState<string|undefined>(undefined)

  return (
    <Modal onClose={onClose} title={`Permutations for ${name}`}>
      <div className="stack" style={{gap:12}}>
        <ParamValueComposer
          name={name}
          meta={meta}
          initial={initial}
          onPreview={(state, values, vld, error) => {
            setSt(state)
            setArr(values)
            setValid(vld)
            setErr(error)
          }}
        />

        {!valid && <div className="err">Fix errors: {err}</div>}

        <div className="row" style={{justifyContent:'flex-end', gap:8}}>
          <button className="button ghost" onClick={onClose}>Cancel</button>
          <button
            className="button"
            onClick={()=>onApply(st, arr)}
            disabled={!valid || arr.length === 0}
          >
            Apply ({arr.length})
          </button>
        </div>
      </div>
    </Modal>
  )
}
