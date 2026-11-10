import { useEffect, useId, useRef, cloneElement, type ReactElement, type ReactNode } from 'react'
import { clasesInacap } from '../../lib/theme'
import { extractApiErrorMessage, extractFieldErrors } from '../../types/api'

export const inputClass = `w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ${clasesInacap.focoMarca}`
export const buttonClass = `rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${clasesInacap.botonSecundario}`
export const primaryClass = `rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${clasesInacap.botonPrimario}`

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const titleId = useId()
  const ref = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ref.current?.focus()
    function key(event: KeyboardEvent) {
      if (event.key === 'Escape') closeRef.current()
      if (event.key === 'Tab') {
        const nodes = ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')
        const first = nodes?.[0], last = nodes?.[nodes.length - 1]
        if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
          event.preventDefault(); last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first?.focus()
        }
      }
    }
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = previousOverflow; previous?.focus() }
  }, [])
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
    <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-xl">
      <div className="mb-5 flex items-center justify-between gap-4"><h2 id={titleId} className="text-xl font-bold">{title}</h2><button type="button" className={buttonClass} onClick={onClose}>Cerrar</button></div>
      {children}
    </div>
  </div>
}
export function ErrorPanel({ error }: { error: unknown }) {
  if (!error) return null
  const fields = extractFieldErrors(error)
  return <div role="alert" className={`my-3 rounded-xl p-4 text-sm ${clasesInacap.alertaError}`}>
    {extractApiErrorMessage(error)}
    {fields ? <ul className="mt-2 list-inside list-disc">{Object.entries(fields).map(([field, messages]) => <li key={field}>{field}: {messages.join(' ')}</li>)}</ul> : null}
  </div>
}
export function Field({ label, error, children }: { label: string; error?: string[]; children: ReactNode }) {
  const id = useId()
  return <div className="space-y-1">
    <label htmlFor={id} className="block text-sm font-medium text-slate-700">{label}</label>
    {cloneElement(children as ReactElement<{ id: string; 'aria-invalid': boolean; 'aria-describedby': string | undefined }>, {
      id, 'aria-invalid': Boolean(error), 'aria-describedby': error ? `${id}-error` : undefined,
    })}
    {error ? <p id={`${id}-error`} role="alert" className="text-sm text-red-600">{error.join(' ')}</p> : null}
  </div>
}
export function Chip({ text, style }: { text: string; style: string }) {
  return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ring-1 ring-inset ${style}`}>{text}</span>
}
