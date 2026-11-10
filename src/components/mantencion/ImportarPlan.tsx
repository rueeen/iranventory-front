import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { importarPlanMantencion } from '../../api/mantencion'
import { queryKeys } from '../../lib/queryKeys'
import type { ResumenImportacionPlan } from '../../types/mantencion'
import { ErrorPanel, Modal, buttonClass, primaryClass } from './Shared'

export function ImportarPlan({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [archivo, setArchivo] = useState<File | null>(null)
  const [crear, setCrear] = useState(false)
  const [resultado, setResultado] = useState<ResumenImportacionPlan | null>(null)
  const [simulacion, setSimulacion] = useState<{ archivo: File; crear: boolean } | null>(null)
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null)
  const mutation = useMutation({
    mutationFn: ({ archivo, crear, simular }: { archivo: File; crear: boolean; simular: boolean }) =>
      importarPlanMantencion(archivo, { crearFaltantes: crear, simular }),
    onSuccess: (data, args) => {
      setResultado(data)
      setSimulacion(args.simular && data.simulado ? { archivo: args.archivo, crear: args.crear } : null)
      if (!args.simular) {
        for (const key of [queryKeys.planesMantencion.all, queryKeys.unidades.all, queryKeys.tiposEquipo.all]) void qc.invalidateQueries({ queryKey: key })
      }
    },
    onError: () => setSimulacion(null),
  })
  const puedeAplicar = archivo && simulacion?.archivo === archivo && simulacion.crear === crear
  return <Modal title="Importar plan" onClose={onClose}>
    <div className="space-y-4">
      <label className="block text-sm font-medium">Plan de mantención (.xlsx)
        <input className="mt-2 block w-full" type="file" accept=".xlsx" disabled={mutation.isPending} onChange={e => {
          const file = e.target.files?.[0] ?? null
          setSimulacion(null); setResultado(null); mutation.reset()
          const error = file && !file.name.toLowerCase().endsWith('.xlsx') ? 'Selecciona un archivo .xlsx.' : null
          setErrorArchivo(error); setArchivo(error ? null : file)
        }} />
      </label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={crear} disabled={mutation.isPending} onChange={e => {
        setCrear(e.target.checked); setSimulacion(null); setResultado(null); mutation.reset()
      }} />Crear equipos que no existan en el inventario</label>
      {errorArchivo ? <p role="alert" className="text-red-600">{errorArchivo}</p> : null}
      <ErrorPanel error={mutation.error} />
      <div className="flex flex-wrap gap-3">
        <button className={buttonClass} disabled={!archivo || mutation.isPending} onClick={() => {
          if (archivo) { setSimulacion(null); mutation.mutate({ archivo, crear, simular: true }) }
        }}>Simular</button>
        <button className={primaryClass} disabled={!puedeAplicar || mutation.isPending} onClick={() => {
          if (archivo && puedeAplicar) mutation.mutate({ archivo, crear, simular: false })
        }}>Aplicar importación</button>
        {mutation.isPending ? <span role="status">Procesando...</span> : null}
      </div>
      {resultado ? <section aria-label="Resultado de importación" className="space-y-4">
        <h3 className="font-bold">{resultado.simulado ? 'Resultado de simulación' : 'Importación completada'}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {([
            ['Planes creados', resultado.planes_creados], ['Planes actualizados', resultado.planes_actualizados],
            ['Unidades creadas', resultado.unidades_creadas], ['Tipos creados', resultado.tipos_creados],
            ['PeopleSoft completados', resultado.codigos_peoplesoft_completados],
          ] as const).map(([label, n]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><strong className="mr-2">{n}</strong>{label}</div>)}
        </div>
        <h4 className="font-semibold">No encontrados</h4>
        {resultado.no_encontrados.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead><tr>{['Fila', 'Código inventario', 'PeopleSoft', 'Equipo'].map(c => <th className="p-2" key={c}>{c}</th>)}</tr></thead>
          <tbody>{resultado.no_encontrados.map((r, i) => <tr key={i}><td className="p-2">{r.fila}</td><td>{r.codigo_activo}</td><td>{r.codigo_peoplesoft}</td><td>{r.equipo}</td></tr>)}</tbody>
        </table></div> : <p className="text-sm text-slate-500">Sin equipos no encontrados.</p>}
        {resultado.advertencias.length ? <ul className="list-inside list-disc text-sm text-amber-700">{resultado.advertencias.map((a, i) => <li key={i}>{a}</li>)}</ul> : null}
      </section> : null}
    </div>
  </Modal>
}
