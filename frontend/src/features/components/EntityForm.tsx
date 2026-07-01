import { useState } from 'react'

export type Field = {
  name: string
  label: string
  type: 'text' | 'number' | 'date' | 'select' | 'checkbox'
  options?: { value: string; label: string }[]
  required?: boolean
  placeholder?: string
}

export function EntityForm({
  title, fields, initial, onSubmit, onClose, submitting,
}: {
  title: string
  fields: Field[]
  initial: Record<string, any>
  onSubmit: (values: Record<string, any>) => void
  onClose: () => void
  submitting?: boolean
}) {
  const [values, setValues] = useState<Record<string, any>>(initial)
  const [err, setErr] = useState<string | null>(null)

  const set = (name: string, val: any) => setValues((v) => ({ ...v, [name]: val }))

  const submit = () => {
    for (const f of fields) {
      if (f.required && (values[f.name] === undefined || values[f.name] === '' || values[f.name] === null)) {
        setErr(`${f.label} is required`)
        return
      }
    }
    setErr(null)
    onSubmit(values)
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 fade-in" onClick={onClose}>
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-8 max-w-md w-full space-y-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold text-slate-50">{title}</h2>
        {err && <div className="bg-red-500/15 border border-red-500/30 rounded-lg px-4 py-2 text-sm text-red-300">{err}</div>}
        <div className="space-y-4">
          {fields.map((f) => (
            <div key={f.name}>
              <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1.5">{f.label}{f.required && <span className="text-red-400"> *</span>}</label>
              {f.type === 'select' ? (
                <select value={values[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-50 focus:outline-none focus:border-blue-500">
                  <option value="" disabled>Select…</option>
                  {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : f.type === 'checkbox' ? (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={values[f.name] !== false} onChange={(e) => set(f.name, e.target.checked)} className="w-4 h-4 accent-blue-500" />
                  <span className="text-sm text-slate-300">Active</span>
                </label>
              ) : (
                <input type={f.type} value={values[f.name] ?? ''} placeholder={f.placeholder}
                  step={f.type === 'number' ? 'any' : undefined}
                  onChange={(e) => set(f.name, e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-50 placeholder-slate-500 focus:outline-none focus:border-blue-500" />
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-3 pt-2">
          <button disabled={submitting} onClick={submit} className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold hover:shadow-lg active:scale-95 transition-all disabled:opacity-50">{submitting ? 'Saving…' : 'Save'}</button>
          <button onClick={onClose} className="px-6 py-2.5 rounded-lg border border-slate-600 text-slate-200 font-medium hover:bg-slate-700/50 transition-all">Cancel</button>
        </div>
      </div>
    </div>
  )
}

export function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <button onClick={onEdit} title="Edit" className="w-8 h-8 rounded-lg text-slate-400 hover:text-blue-300 hover:bg-slate-700/50 transition-all">✎</button>
      <button onClick={onDelete} title="Delete" className="w-8 h-8 rounded-lg text-slate-400 hover:text-red-300 hover:bg-slate-700/50 transition-all">🗑</button>
    </div>
  )
}
