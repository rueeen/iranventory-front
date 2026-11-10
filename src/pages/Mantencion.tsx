import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { mantencionApi, type PlanesMantencionFiltros, type RegistrosMantencionFiltros } from '../api/mantencion'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { queryKeys } from '../lib/queryKeys'
import { clasesInacap } from '../lib/theme'
import { generarPdfFichaMantencion } from '../lib/pdfFichaMantencion'
import {
  etiquetasEstadoPlan, estilosEstadoPlan, etiquetasFrecuencia, etiquetasPrioridad, estilosPrioridad,
  etiquetasTipoMantencion, estilosTipoMantencion, formatearFechaCorta, formatearCLP,
} from '../lib/mantencion'
import type { EstadoPlan, PlanMantencion, RegistroMantencion } from '../types/mantencion'
import { Chip, ErrorPanel, Field, Modal, buttonClass, primaryClass, inputClass } from '../components/mantencion/Shared'
import { PlanForm, RegistroForm } from '../components/mantencion/Forms'
import { ImportarPlan } from '../components/mantencion/ImportarPlan'

type Editor = { tipo: 'plan'; plan?: PlanMantencion } |
  { tipo: 'registro'; registro?: RegistroMantencion; plan?: PlanMantencion } | { tipo: 'importar' }
const estados = Object.keys(etiquetasEstadoPlan)
const cell = 'px-4 py-3'
function Paginacion({ page, total, next, previous, pending, onChange }: {
  page: number; total: number; next: string | null; previous: string | null; pending: boolean; onChange: (p: number) => void
}) {
  return <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm">
    <p>Página {page} · {total} resultados</p>
    <div className="flex gap-2"><button className={buttonClass} disabled={!previous || pending} onClick={() => onChange(page - 1)}>Anterior</button><button className={buttonClass} disabled={!next || pending} onClick={() => onChange(page + 1)}>Siguiente</button></div>
  </div>
}
export function Mantencion() {
  const qc = useQueryClient()
  const [url, setUrl] = useSearchParams()
  const estadoParam = url.get('estado_plan') ?? ''
  const estado = estados.includes(estadoParam) ? estadoParam as EstadoPlan : ''
  const [tab, setTab] = useState<'planes' | 'registros'>('planes')
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search, 300)
  const [prioridad, setPrioridad] = useState<PlanesMantencionFiltros['prioridad']>('')
  const [frecuencia, setFrecuencia] = useState<PlanesMantencionFiltros['frecuencia']>('')
  const [inactivos, setInactivos] = useState(false)
  // Each filter combination has its own page; a changed filter always starts at one.
  const filterId = JSON.stringify([debounced, estado, prioridad, frecuencia, inactivos])
  const [pagina, setPagina] = useState({ filtro: '', page: 1 })
  const page = pagina.filtro === filterId ? pagina.page : 1
  useEffect(() => { setPagina({ filtro: filterId, page: 1 }) }, [filterId])
  const [registroFiltros, setRegistroFiltros] = useState<RegistrosMantencionFiltros>({ page: 1 })
  const [busquedaRegistros, setBusquedaRegistros] = useState('')
  const busquedaRegistrosDebounced = useDebouncedValue(busquedaRegistros, 300)
  const filtrosRegistros = useMemo<RegistrosMantencionFiltros>(() => ({
    ...registroFiltros,
    search: busquedaRegistrosDebounced,
    page: (registroFiltros.search ?? '') === busquedaRegistrosDebounced ? registroFiltros.page : 1,
  }), [registroFiltros, busquedaRegistrosDebounced])
  useEffect(() => {
    setRegistroFiltros(prev => (prev.search ?? '') === busquedaRegistrosDebounced
      ? prev
      : { ...prev, search: busquedaRegistrosDebounced, page: 1 })
  }, [busquedaRegistrosDebounced])

  const [editor, setEditor] = useState<Editor | null>(null)
  const [borrar, setBorrar] = useState<{ tipo: 'plan' | 'registro'; id: number } | null>(null)
  const filtros = useMemo<PlanesMantencionFiltros>(() => ({
    page, search: debounced, estado_plan: estado, prioridad, frecuencia,
    ...(!inactivos && estado !== 'INACTIVO' ? { activo: true } : {}),
  }), [page, debounced, estado, prioridad, frecuencia, inactivos])
  const resumen = useQuery({ queryKey: queryKeys.resumenMantencion(), queryFn: mantencionApi.obtenerResumenMantencion, staleTime: 60_000 })
  const planes = useQuery({ queryKey: queryKeys.planesMantencion.list(filtros), queryFn: () => mantencionApi.obtenerPlanesMantencion(filtros), enabled: tab === 'planes' })
  const registros = useQuery({ queryKey: queryKeys.registrosMantencion.list(filtrosRegistros), queryFn: () => mantencionApi.obtenerRegistrosMantencion(filtrosRegistros), enabled: tab === 'registros' })
  const pdf = useMutation({
    mutationFn: async (id: number) => {
      const ficha = await qc.fetchQuery({ queryKey: queryKeys.fichaMantencion(id), queryFn: () => mantencionApi.obtenerFichaMantencion(id) })
      generarPdfFichaMantencion(ficha, id)
    },
  })
  const exportar = useMutation({
    mutationFn: () => { const { page: _page, ...todos } = filtros; return mantencionApi.exportarPlanMantencion(todos) },
  })
  const eliminar = useMutation({
    mutationFn: async () => {
      if (!borrar) return
      if (borrar.tipo === 'plan') await mantencionApi.eliminarPlanMantencion(borrar.id)
      else await mantencionApi.eliminarRegistroMantencion(borrar.id)
    },
    onSuccess: () => {
      for (const key of [queryKeys.planesMantencion.all, queryKeys.registrosMantencion.all, queryKeys.unidades.all, ['fichaMantencion']]) void qc.invalidateQueries({ queryKey: key })
      setBorrar(null)
    },
  })
  function filtrarEstado(v: string) {
    setTab('planes')
    setUrl(prev => { const next = new URLSearchParams(prev); if (v) next.set('estado_plan', v); else next.delete('estado_plan'); return next })
  }
  function filtroRegistro(key: string, value: string) {
    setRegistroFiltros(prev => ({ ...prev, [key]: value, page: 1 }))
  }
  return <section className="space-y-6">
    <header className={`rounded-3xl p-6 ${clasesInacap.superficie}`}><h1 className="text-3xl font-bold">Mantención de equipos</h1><p className="mt-2 text-slate-500">Planificación, registros y fichas de los equipos.</p></header>
    <div className="grid gap-4 sm:grid-cols-3">
      {([
        ['Vencidas', 'VENCIDO', resumen.data?.vencidos], ['Próximos 30 días', 'PROXIMO', resumen.data?.proximos_30_dias], ['Al día', 'AL_DIA', resumen.data?.al_dia],
      ] as const).map(([label, value, n]) => <button key={value} className={`rounded-2xl p-6 text-left ${clasesInacap.superficie} ${estado === value ? 'ring-2 ring-[#E30613]' : ''}`} onClick={() => filtrarEstado(value)}>
        <span className="text-sm text-slate-500">{label}</span><strong className="mt-2 block text-3xl">{resumen.isLoading ? '...' : resumen.isError ? 'No disponible' : n}</strong>
      </button>)}
    </div>
    <ErrorPanel error={resumen.error} />
    <div className="flex flex-wrap gap-3" role="tablist" aria-label="Mantención">
      {(['planes', 'registros'] as const).map(t => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? primaryClass : buttonClass} onClick={() => setTab(t)}>{t === 'planes' ? 'Plan de mantención' : 'Registros'}</button>)}
    </div>
    <ErrorPanel error={pdf.error || exportar.error} />
    {tab === 'planes' ? <div className={`rounded-3xl p-5 ${clasesInacap.superficie}`}>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Búsqueda"><input type="search" className={inputClass} value={search} onChange={e => setSearch(e.target.value)} /></Field>
        <Field label="Estado del plan"><select className={inputClass} value={estado} onChange={e => filtrarEstado(e.target.value)}><option value="">Todos</option>{Object.entries(etiquetasEstadoPlan).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Prioridad"><select className={inputClass} value={prioridad} onChange={e => setPrioridad(e.target.value as typeof prioridad)}><option value="">Todas</option>{Object.entries(etiquetasPrioridad).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Frecuencia"><select className={inputClass} value={frecuencia} onChange={e => setFrecuencia(e.target.value as typeof frecuencia)}><option value="">Todas</option>{Object.entries(etiquetasFrecuencia).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={inactivos} onChange={e => setInactivos(e.target.checked)} />Mostrar inactivos</label>
      </div>
      <div className="mb-4 flex flex-wrap gap-3"><button className={primaryClass} onClick={() => setEditor({ tipo: 'plan' })}>Nuevo plan</button><button className={buttonClass} disabled={exportar.isPending} onClick={() => exportar.mutate()}>Exportar Excel</button><button className={buttonClass} onClick={() => setEditor({ tipo: 'importar' })}>Importar plan</button></div>
      <ErrorPanel error={planes.error} />
      {planes.isLoading ? <p role="status">Cargando planes...</p> : null}
      {planes.isSuccess && !planes.data.results.length ? <p className="p-5 text-slate-500">No hay planes que coincidan con los filtros.</p> : null}
      <div className="overflow-x-auto"><table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{['Código inventario', 'Equipo', 'Especificación', 'Actividad', 'Frecuencia', 'Prioridad', 'Última mantención', 'Próxima', 'Acciones'].map(c => <th className={cell} key={c}>{c}</th>)}</tr></thead>
        <tbody>{planes.data?.results.map(p => <tr key={p.id} className="border-t align-top hover:bg-slate-50">
          <td className={cell}>{p.unidad.codigo_activo}<small className="block text-slate-500">{p.unidad.codigo_peoplesoft}</small></td>
          <td className={cell}>{p.unidad.tipo_equipo_nombre}</td>
          <td className={cell}><div className="max-w-48 truncate" title={p.unidad.especificacion}>{p.unidad.especificacion}</div></td>
          <td className={cell}>{p.actividad}</td><td className={cell}>{etiquetasFrecuencia[p.frecuencia]}</td>
          <td className={cell}><Chip text={etiquetasPrioridad[p.prioridad]} style={estilosPrioridad[p.prioridad]} /></td>
          <td className={cell}>{formatearFechaCorta(p.fecha_ultima_mantencion)}</td>
          <td className={cell}>{formatearFechaCorta(p.fecha_proxima_mantencion)}<div className="mt-1"><Chip text={etiquetasEstadoPlan[p.estado_plan]} style={estilosEstadoPlan[p.estado_plan]} /></div></td>
          <td className={cell}><div className="flex flex-wrap gap-2">
            <button className={buttonClass} onClick={() => setEditor({ tipo: 'registro', plan: p })}>Registrar</button>
            <button className={buttonClass} onClick={() => setEditor({ tipo: 'plan', plan: p })}>Editar</button>
            <button className={buttonClass} disabled={pdf.isPending} onClick={() => pdf.mutate(p.unidad.id)}>Ficha PDF</button>
            <button className={buttonClass} onClick={() => { eliminar.reset(); setBorrar({ tipo: 'plan', id: p.id }) }}>Eliminar</button>
          </div></td>
        </tr>)}</tbody>
      </table></div>
      {planes.data ? <Paginacion page={page} total={planes.data.count} next={planes.data.next} previous={planes.data.previous} pending={planes.isFetching} onChange={n => setPagina({ filtro: filterId, page: n })} /> : null}
    </div> : <div className={`rounded-3xl p-5 ${clasesInacap.superficie}`}>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Búsqueda"><input type="search" className={inputClass} value={busquedaRegistros} onChange={e => setBusquedaRegistros(e.target.value)} /></Field>
        <Field label="Tipo"><select className={inputClass} value={registroFiltros.tipo ?? ''} onChange={e => filtroRegistro('tipo', e.target.value)}><option value="">Todos</option>{Object.entries(etiquetasTipoMantencion).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Desde"><input className={inputClass} type="date" value={registroFiltros.fecha_desde ?? ''} onChange={e => filtroRegistro('fecha_desde', e.target.value)} /></Field>
        <Field label="Hasta"><input className={inputClass} type="date" value={registroFiltros.fecha_hasta ?? ''} min={registroFiltros.fecha_desde} onChange={e => filtroRegistro('fecha_hasta', e.target.value)} /></Field>
      </div>
      <button className={primaryClass} onClick={() => setEditor({ tipo: 'registro' })}>Nuevo registro</button>
      <ErrorPanel error={registros.error} />
      {registros.isLoading ? <p role="status">Cargando registros...</p> : null}
      {registros.isSuccess && !registros.data.results.length ? <p className="p-5 text-slate-500">No hay registros que coincidan con los filtros.</p> : null}
      <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{['Fecha', 'Código', 'Equipo', 'Tipo', 'Descripción', 'Empresa', 'OC', 'Costo', 'Realizado por', 'Estado resultante', 'Acciones'].map(c => <th className={cell} key={c}>{c}</th>)}</tr></thead>
        <tbody>{registros.data?.results.map(r => {
          return <tr key={r.id} className="border-t align-top hover:bg-slate-50">
            <td className={cell}>{formatearFechaCorta(r.fecha_realizacion)}</td><td className={cell}>{r.unidad_detalle.codigo_activo ?? `#${r.unidad}`}<small className="block text-slate-500">{r.unidad_detalle.codigo_peoplesoft}</small></td><td className={cell}>{r.unidad_detalle.tipo_equipo_nombre}</td>
            <td className={cell}><Chip text={etiquetasTipoMantencion[r.tipo]} style={estilosTipoMantencion[r.tipo]} /></td><td className={cell}>{r.descripcion}</td><td className={cell}>{r.empresa}</td>
            <td className={cell}>{r.orden_compra?.numero || r.numero_orden_compra}</td><td className={cell}>{formatearCLP(r.costo)}</td><td className={cell}>{r.realizado_por}</td>
            <td className={cell}>{{ BUENO: 'Bueno', REPARABLE: 'Reparable', MALO: 'Malo', '': 'Sin cambio' }[r.estado_resultante]}</td>
            <td className={cell}><button className={buttonClass} onClick={() => setEditor({ tipo: 'registro', registro: r })}>Editar</button><button className={buttonClass} onClick={() => { eliminar.reset(); setBorrar({ tipo: 'registro', id: r.id }) }}>Eliminar</button></td>
          </tr>
        })}</tbody>
      </table></div>
      {registros.data ? <Paginacion page={filtrosRegistros.page ?? 1} total={registros.data.count} next={registros.data.next} previous={registros.data.previous} pending={registros.isFetching} onChange={n => setRegistroFiltros({ ...registroFiltros, page: n })} /> : null}
    </div>}
    {editor?.tipo === 'plan' ? <PlanForm plan={editor.plan} onClose={() => setEditor(null)} /> : null}
    {editor?.tipo === 'registro' ? <RegistroForm registro={editor.registro} unidadPlan={editor.plan?.unidad} planId={editor.plan?.id} onClose={() => setEditor(null)} /> : null}
    {editor?.tipo === 'importar' ? <ImportarPlan onClose={() => setEditor(null)} /> : null}
    {borrar ? <Modal title="Confirmar eliminación" onClose={() => { if (!eliminar.isPending) setBorrar(null) }}>
      <p>¿Eliminar {borrar.tipo === 'plan' ? 'el plan' : 'el registro'} #{borrar.id}? Esta acción no se puede deshacer.</p>
      <ErrorPanel error={eliminar.error} /><button className={primaryClass} disabled={eliminar.isPending} onClick={() => eliminar.mutate()}>Confirmar eliminación</button>
    </Modal> : null}
  </section>
}
