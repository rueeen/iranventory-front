import { useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'

import { catalogoApi } from '../api/catalogo'
import { inventarioApi } from '../api/inventario'
import { extractApiErrorMessage } from '../types/api'
import { clasesInacap } from '../lib/theme'
import { queryKeys } from '../lib/queryKeys'
import type { TipoEquipo, TipoSeguimiento } from '../types/catalogo'
import type { EstadoUnidad, SituacionUnidad, Unidad } from '../types/inventario'

const tiposSeguimiento: TipoSeguimiento[] = ['SERIE', 'GRANEL']
const situacionesUnidad: SituacionUnidad[] = ['DISPONIBLE', 'PRESTADA', 'REPARACION', 'BAJA']
const estadosUnidad: EstadoUnidad[] = ['BUENO', 'REPARABLE', 'MALO']

type FiltroRevision = 'TODAS' | 'SI' | 'NO'

const etiquetasSeguimiento: Record<TipoSeguimiento, string> = {
  SERIE: 'Serie',
  GRANEL: 'Granel',
}

const etiquetasSituacion: Record<SituacionUnidad, string> = {
  DISPONIBLE: 'Disponible',
  PRESTADA: 'Prestada',
  REPARACION: 'Reparación',
  BAJA: 'Baja',
}

const etiquetasEstado: Record<EstadoUnidad, string> = {
  BUENO: 'Bueno',
  REPARABLE: 'Reparable',
  MALO: 'Malo',
}

const estilosSeguimiento: Record<TipoSeguimiento, string> = {
  SERIE: 'bg-blue-50 text-blue-700 ring-blue-200',
  GRANEL: 'bg-slate-100 text-slate-700 ring-slate-300',
}

const estilosSituacion: Record<SituacionUnidad, string> = {
  DISPONIBLE: 'bg-green-50 text-green-700 ring-green-200',
  PRESTADA: 'bg-blue-50 text-blue-700 ring-blue-200',
  REPARACION: 'bg-amber-50 text-amber-700 ring-amber-200',
  BAJA: 'bg-red-50 text-red-700 ring-red-200',
}

const estilosEstado: Record<EstadoUnidad, string> = {
  BUENO: 'bg-green-50 text-green-700 ring-green-200',
  REPARABLE: 'bg-amber-50 text-amber-700 ring-amber-200',
  MALO: 'bg-red-50 text-red-700 ring-red-200',
}

function normalizarTexto(valor: string): string {
  return valor.toLocaleLowerCase('es-CL').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function formatearNumero(valor: number): string {
  return new Intl.NumberFormat('es-CL').format(valor)
}

function Badge({ children, className }: { children: ReactNode; className: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${className}`}>
      {children}
    </span>
  )
}

function tiposEquipoCoincide(tipo: TipoEquipo, busqueda: string, seguimiento: TipoSeguimiento | 'TODOS') {
  const termino = normalizarTexto(busqueda.trim())
  const coincideBusqueda = termino
    ? [tipo.nombre, tipo.especificacion, tipo.tipo_seguimiento].some((valor) =>
        normalizarTexto(valor ?? '').includes(termino),
      )
    : true

  return coincideBusqueda && (seguimiento === 'TODOS' || tipo.tipo_seguimiento === seguimiento)
}

function unidadCoincide(
  unidad: Unidad,
  busqueda: string,
  situacion: SituacionUnidad | 'TODAS',
  estado: EstadoUnidad | 'TODOS',
  revision: FiltroRevision,
) {
  const termino = normalizarTexto(busqueda.trim())
  const coincideBusqueda = termino
    ? [
        unidad.codigo_activo ?? '',
        unidad.tipo_equipo.nombre,
        unidad.estado,
        unidad.situacion,
        unidad.ubicacion?.nombre ?? '',
        unidad.ubicacion?.sede ?? '',
      ].some((valor) => normalizarTexto(valor).includes(termino))
    : true

  const coincideRevision =
    revision === 'TODAS' || (revision === 'SI' ? unidad.requiere_revision : !unidad.requiere_revision)

  return (
    coincideBusqueda &&
    (situacion === 'TODAS' || unidad.situacion === situacion) &&
    (estado === 'TODOS' || unidad.estado === estado) &&
    coincideRevision
  )
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
      {message}
    </div>
  )
}

export function Inventario() {
  const [busqueda, setBusqueda] = useState('')
  const [tipoSeguimiento, setTipoSeguimiento] = useState<TipoSeguimiento | 'TODOS'>('TODOS')
  const [situacion, setSituacion] = useState<SituacionUnidad | 'TODAS'>('TODAS')
  const [estado, setEstado] = useState<EstadoUnidad | 'TODOS'>('TODOS')
  const [requiereRevision, setRequiereRevision] = useState<FiltroRevision>('TODAS')

  const tiposEquipoQuery = useQuery<TipoEquipo[], Error>({
    queryKey: queryKeys.tiposEquipo.list(),
    queryFn: () => catalogoApi.obtenerTiposEquipo(),
  })

  const unidadesQuery = useQuery<Unidad[], Error>({
    queryKey: queryKeys.unidades.list(),
    queryFn: () => inventarioApi.obtenerUnidades(),
  })

  const tiposEquipoFiltrados = useMemo(
    () =>
      (tiposEquipoQuery.data ?? []).filter((tipo) =>
        tiposEquipoCoincide(tipo, busqueda, tipoSeguimiento),
      ),
    [busqueda, tipoSeguimiento, tiposEquipoQuery.data],
  )

  const unidadesFiltradas = useMemo(
    () =>
      (unidadesQuery.data ?? []).filter((unidad) =>
        unidadCoincide(unidad, busqueda, situacion, estado, requiereRevision),
      ),
    [busqueda, estado, requiereRevision, situacion, unidadesQuery.data],
  )

  const isLoading = tiposEquipoQuery.isLoading || unidadesQuery.isLoading
  const errorMessage = tiposEquipoQuery.isError
    ? extractApiErrorMessage(tiposEquipoQuery.error)
    : unidadesQuery.isError
      ? extractApiErrorMessage(unidadesQuery.error)
      : null

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className={`text-sm font-semibold uppercase tracking-widest ${clasesInacap.textoMarca}`}>
          Inventario
        </p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">Vista real de inventario</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
              Consulta de solo lectura para tipos de equipo y unidades registradas. Los filtros se
              aplican sobre la respuesta actual del backend.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200">
            Si la API pagina resultados, esta vista muestra la primera página devuelta y queda
            preparada para filtros server-side en la siguiente fase.
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-5">
          <label className="space-y-2 lg:col-span-2">
            <span className="text-sm font-semibold text-slate-700">Búsqueda por nombre o código</span>
            <input
              className={`w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none transition ${clasesInacap.focoMarca}`}
              placeholder="Notebook, cámara, ACT-001..."
              type="search"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Seguimiento</span>
            <select
              className={`w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none transition ${clasesInacap.focoMarca}`}
              value={tipoSeguimiento}
              onChange={(event) => setTipoSeguimiento(event.target.value as TipoSeguimiento | 'TODOS')}
            >
              <option value="TODOS">Todos</option>
              {tiposSeguimiento.map((tipo) => (
                <option key={tipo} value={tipo}>{etiquetasSeguimiento[tipo]}</option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Situación</span>
            <select
              className={`w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none transition ${clasesInacap.focoMarca}`}
              value={situacion}
              onChange={(event) => setSituacion(event.target.value as SituacionUnidad | 'TODAS')}
            >
              <option value="TODAS">Todas</option>
              {situacionesUnidad.map((item) => (
                <option key={item} value={item}>{etiquetasSituacion[item]}</option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Estado</span>
            <select
              className={`w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none transition ${clasesInacap.focoMarca}`}
              value={estado}
              onChange={(event) => setEstado(event.target.value as EstadoUnidad | 'TODOS')}
            >
              <option value="TODOS">Todos</option>
              {estadosUnidad.map((item) => (
                <option key={item} value={item}>{etiquetasEstado[item]}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex max-w-xs flex-col gap-2">
            <span className="text-sm font-semibold text-slate-700">Requiere revisión</span>
            <select
              className={`rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none transition ${clasesInacap.focoMarca}`}
              value={requiereRevision}
              onChange={(event) => setRequiereRevision(event.target.value as FiltroRevision)}
            >
              <option value="TODAS">Todas</option>
              <option value="SI">Sí</option>
              <option value="NO">No</option>
            </select>
          </label>
          <button
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            type="button"
            onClick={() => {
              setBusqueda('')
              setTipoSeguimiento('TODOS')
              setSituacion('TODAS')
              setEstado('TODOS')
              setRequiereRevision('TODAS')
            }}
          >
            Limpiar filtros
          </button>
        </div>
      </div>

      {isLoading ? <p className="rounded-2xl bg-white p-5 text-sm text-slate-500 shadow-sm">Cargando inventario...</p> : null}
      {errorMessage ? <ErrorPanel message={`No se pudo cargar inventario: ${errorMessage}`} /> : null}

      {!isLoading && !errorMessage ? (
        <>
          <article className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-2 border-b border-slate-200 px-6 py-5 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-950">Tipos de equipo</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {formatearNumero(tiposEquipoFiltrados.length)} de {formatearNumero(tiposEquipoQuery.data?.length ?? 0)} resultados
                </p>
              </div>
            </div>
            {tiposEquipoFiltrados.length === 0 ? (
              <div className="p-6"><EmptyState message="No hay tipos de equipo que coincidan con los filtros." /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Nombre</th>
                      <th className="px-6 py-3 font-semibold">Especificación</th>
                      <th className="px-6 py-3 font-semibold">Seguimiento</th>
                      <th className="px-6 py-3 font-semibold">Stock total</th>
                      <th className="px-6 py-3 font-semibold">Disponible</th>
                      <th className="px-6 py-3 font-semibold">Brecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {tiposEquipoFiltrados.map((tipo) => (
                      <tr key={tipo.id} className="align-top">
                        <td className="px-6 py-4 font-semibold text-slate-950">{tipo.nombre}</td>
                        <td className="max-w-md px-6 py-4 text-slate-600">{tipo.especificacion || 'Sin especificación'}</td>
                        <td className="px-6 py-4"><Badge className={estilosSeguimiento[tipo.tipo_seguimiento]}>{etiquetasSeguimiento[tipo.tipo_seguimiento]}</Badge></td>
                        <td className="px-6 py-4 text-slate-700">{formatearNumero(tipo.stock_total)}</td>
                        <td className="px-6 py-4 text-slate-700">{formatearNumero(tipo.stock_disponible)}</td>
                        <td className="px-6 py-4 text-slate-700">{formatearNumero(tipo.brecha)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-2 border-b border-slate-200 px-6 py-5 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-950">Unidades</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {formatearNumero(unidadesFiltradas.length)} de {formatearNumero(unidadesQuery.data?.length ?? 0)} resultados
                </p>
              </div>
            </div>
            {unidadesFiltradas.length === 0 ? (
              <div className="p-6"><EmptyState message="No hay unidades que coincidan con los filtros." /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Código activo</th>
                      <th className="px-6 py-3 font-semibold">Tipo equipo</th>
                      <th className="px-6 py-3 font-semibold">Estado</th>
                      <th className="px-6 py-3 font-semibold">Situación</th>
                      <th className="px-6 py-3 font-semibold">Revisión</th>
                      <th className="px-6 py-3 font-semibold">Ubicación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {unidadesFiltradas.map((unidad) => (
                      <tr key={unidad.id} className="align-top">
                        <td className="px-6 py-4 font-semibold text-slate-950">{unidad.codigo_activo ?? `Unidad #${unidad.id}`}</td>
                        <td className="px-6 py-4 text-slate-700">{unidad.tipo_equipo.nombre}</td>
                        <td className="px-6 py-4"><Badge className={estilosEstado[unidad.estado]}>{etiquetasEstado[unidad.estado]}</Badge></td>
                        <td className="px-6 py-4"><Badge className={estilosSituacion[unidad.situacion]}>{etiquetasSituacion[unidad.situacion]}</Badge></td>
                        <td className="px-6 py-4 text-slate-700">{unidad.requiere_revision ? 'Sí' : 'No'}</td>
                        <td className="px-6 py-4 text-slate-600">
                          {unidad.ubicacion ? `${unidad.ubicacion.nombre}${unidad.ubicacion.sede ? ` · ${unidad.ubicacion.sede}` : ''}` : 'Sin ubicación'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </>
      ) : null}
    </section>
  )
}
