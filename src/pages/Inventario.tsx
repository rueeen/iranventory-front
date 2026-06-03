import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { catalogoApi } from '../api/catalogo'
import { inventarioApi, type UnidadesFiltros } from '../api/inventario'
import { extractApiErrorMessage, type Paginated } from '../types/api'
import { clasesInacap } from '../lib/theme'
import { queryKeys } from '../lib/queryKeys'
import type { Categoria, TipoEquipo, TipoEquipoInput, TipoSeguimiento } from '../types/catalogo'
import type { EstadoUnidad, SituacionUnidad, Unidad, UnidadInput } from '../types/inventario'

const tiposSeguimiento: TipoSeguimiento[] = ['SERIE', 'GRANEL']
const situacionesUnidad: SituacionUnidad[] = ['DISPONIBLE', 'PRESTADA', 'REPARACION', 'BAJA']
const estadosUnidad: EstadoUnidad[] = ['BUENO', 'REPARABLE', 'MALO']
const UNIDADES_PAGE_SIZE = 25

type FiltroRevision = 'TODAS' | 'SI' | 'NO'
type TabInventario = 'TIPOS' | 'UNIDADES'
type TipoEquipoFormMode = { mode: 'create' } | { mode: 'edit'; tipo: TipoEquipo }
type UnidadFormMode = { mode: 'create' } | { mode: 'edit'; unidad: Unidad }

type TipoEquipoFormState = {
  nombre: string
  especificacion: string
  categoriaId: string
  tipoSeguimiento: TipoSeguimiento
  valorUf: string
  cantidadNecesaria: string
  stockGranel: string
  observaciones: string
}

type UnidadFormState = {
  tipoEquipoId: string
  codigoActivo: string
  estado: EstadoUnidad
  situacion: SituacionUnidad
  ubicacionId: string
  requiereRevision: boolean
}

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
  SERIE: clasesInacap.chipInformacion,
  GRANEL: 'bg-slate-100 text-slate-700 ring-slate-300',
}

const estilosSituacion: Record<SituacionUnidad, string> = {
  DISPONIBLE: clasesInacap.chipExito,
  PRESTADA: clasesInacap.chipInformacion,
  REPARACION: clasesInacap.chipAdvertencia,
  BAJA: clasesInacap.chipError,
}

const estilosEstado: Record<EstadoUnidad, string> = {
  BUENO: clasesInacap.chipExito,
  REPARABLE: clasesInacap.chipAdvertencia,
  MALO: clasesInacap.chipError,
}

function normalizarTexto(valor: string): string {
  return valor.toLocaleLowerCase('es-CL').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function formatearNumero(valor: number): string {
  return new Intl.NumberFormat('es-CL').format(valor)
}

function formatearUf(valor: string): string {
  const numero = Number(valor)
  return Number.isFinite(numero) ? `${new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(numero)} UF` : valor
}

function obtenerCategoriaId(tipo: TipoEquipo): string {
  return tipo.categoria ? String(tipo.categoria.id) : ''
}

function obtenerUbicacion(unidad: Unidad): string {
  return unidad.ubicacion ? `${unidad.ubicacion.nombre}${unidad.ubicacion.sede ? ` · ${unidad.ubicacion.sede}` : ''}` : 'Sin ubicación'
}

function crearEstadoTipoEquipo(tipo?: TipoEquipo): TipoEquipoFormState {
  return {
    nombre: tipo?.nombre ?? '',
    especificacion: tipo?.especificacion ?? '',
    categoriaId: tipo ? obtenerCategoriaId(tipo) : '',
    tipoSeguimiento: tipo?.tipo_seguimiento ?? 'SERIE',
    valorUf: tipo?.valor_uf ?? '0',
    cantidadNecesaria: String(tipo?.cantidad_necesaria ?? 0),
    stockGranel: String(tipo?.stock_granel ?? 0),
    observaciones: tipo?.observaciones ?? '',
  }
}

function crearEstadoUnidad(unidad?: Unidad): UnidadFormState {
  return {
    tipoEquipoId: unidad ? String(unidad.tipo_equipo.id) : '',
    codigoActivo: unidad?.codigo_activo ?? '',
    estado: unidad?.estado ?? 'BUENO',
    situacion: unidad?.situacion ?? 'DISPONIBLE',
    ubicacionId: unidad?.ubicacion ? String(unidad.ubicacion.id) : '',
    requiereRevision: unidad?.requiere_revision ?? false,
  }
}

function construirTipoEquipoInput(state: TipoEquipoFormState): TipoEquipoInput {
  return {
    nombre: state.nombre.trim(),
    especificacion: state.especificacion.trim(),
    categoria_id: state.categoriaId ? Number(state.categoriaId) : null,
    tipo_seguimiento: state.tipoSeguimiento,
    valor_uf: state.valorUf || '0',
    cantidad_necesaria: Number(state.cantidadNecesaria || 0),
    stock_granel: Number(state.stockGranel || 0),
    observaciones: state.observaciones.trim(),
  }
}

function construirUnidadInput(state: UnidadFormState): UnidadInput {
  return {
    tipo_equipo_id: Number(state.tipoEquipoId),
    codigo_activo: state.codigoActivo.trim() || null,
    estado: state.estado,
    situacion: state.situacion,
    ubicacion_id: state.ubicacionId ? Number(state.ubicacionId) : null,
    requiere_revision: state.requiereRevision,
  }
}

function Badge({ children, className }: { children: ReactNode; className: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${className}`}>
      {children}
    </span>
  )
}

function ActionButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      className={`rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition ${clasesInacap.botonPrimario}`}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function SecondaryButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${clasesInacap.botonSecundario}`}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function tiposEquipoCoincide(tipo: TipoEquipo, busqueda: string, seguimiento: TipoSeguimiento | 'TODOS') {
  const termino = normalizarTexto(busqueda.trim())
  const coincideBusqueda = termino
    ? [tipo.nombre, tipo.especificacion, tipo.categoria?.nombre ?? '', tipo.tipo_seguimiento].some((valor) =>
        normalizarTexto(valor).includes(termino),
      )
    : true

  return coincideBusqueda && (seguimiento === 'TODOS' || tipo.tipo_seguimiento === seguimiento)
}


function ErrorPanel({ message }: { message: string }) {
  return <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#DC2626]">{message}</div>
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
      {message}
    </div>
  )
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="text-sm font-semibold text-slate-700">{children}</span>
}

export function Inventario() {
  const queryClient = useQueryClient()
  const [tabActiva, setTabActiva] = useState<TabInventario>('TIPOS')
  const [busqueda, setBusqueda] = useState('')
  const [tipoSeguimiento, setTipoSeguimiento] = useState<TipoSeguimiento | 'TODOS'>('TODOS')
  const [situacion, setSituacion] = useState<SituacionUnidad | 'TODAS'>('TODAS')
  const [estado, setEstado] = useState<EstadoUnidad | 'TODOS'>('TODOS')
  const [requiereRevision, setRequiereRevision] = useState<FiltroRevision>('TODAS')
  const [tipoFormMode, setTipoFormMode] = useState<TipoEquipoFormMode | null>(null)
  const [tipoForm, setTipoForm] = useState<TipoEquipoFormState>(crearEstadoTipoEquipo())
  const [unidadFormMode, setUnidadFormMode] = useState<UnidadFormMode | null>(null)
  const [unidadForm, setUnidadForm] = useState<UnidadFormState>(crearEstadoUnidad())
  const [unidadesPage, setUnidadesPage] = useState(1)

  const tiposEquipoQuery = useQuery<TipoEquipo[], Error>({
    queryKey: queryKeys.tiposEquipo.list(),
    queryFn: () => catalogoApi.obtenerTiposEquipo(),
  })

  const unidadesFiltros: UnidadesFiltros = useMemo(
    () => ({
      busqueda,
      estado,
      situacion,
      requiereRevision,
      page: unidadesPage,
    }),
    [busqueda, estado, requiereRevision, situacion, unidadesPage],
  )

  const unidadesQuery = useQuery<Paginated<Unidad>, Error>({
    queryKey: queryKeys.unidades.list(unidadesFiltros),
    queryFn: () => inventarioApi.obtenerUnidadesPaginadas(unidadesFiltros),
  })

  const categoriasQuery = useQuery<Categoria[], Error>({
    queryKey: queryKeys.categorias.list(),
    queryFn: () => catalogoApi.obtenerCategorias(),
  })

  const ubicacionesQuery = useQuery({
    queryKey: queryKeys.ubicaciones.list(),
    queryFn: () => catalogoApi.obtenerUbicaciones(),
  })

  const guardarTipoEquipoMutation = useMutation({
    mutationFn: (input: TipoEquipoInput) =>
      tipoFormMode?.mode === 'edit'
        ? catalogoApi.actualizarTipoEquipo(tipoFormMode.tipo.id, input)
        : catalogoApi.crearTipoEquipo(input),
    onSuccess: () => {
      setTipoFormMode(null)
      void queryClient.invalidateQueries({ queryKey: queryKeys.tiposEquipo.lists() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.unidades.lists() })
    },
  })

  const guardarUnidadMutation = useMutation({
    mutationFn: (input: UnidadInput) =>
      unidadFormMode?.mode === 'edit'
        ? inventarioApi.actualizarUnidad(unidadFormMode.unidad.id, input)
        : inventarioApi.crearUnidad(input),
    onSuccess: () => {
      setUnidadFormMode(null)
      void queryClient.invalidateQueries({ queryKey: queryKeys.unidades.lists() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.tiposEquipo.lists() })
    },
  })

  const tiposEquipoFiltrados = useMemo(
    () => (tiposEquipoQuery.data ?? []).filter((tipo) => tiposEquipoCoincide(tipo, busqueda, tipoSeguimiento)),
    [busqueda, tipoSeguimiento, tiposEquipoQuery.data],
  )

  const unidadesPagina = unidadesQuery.data?.results ?? []
  const totalUnidades = unidadesQuery.data?.count ?? 0
  const totalPaginasUnidades = Math.max(1, Math.ceil(totalUnidades / UNIDADES_PAGE_SIZE))
  const indiceInicialUnidades = totalUnidades === 0 ? 0 : (unidadesPage - 1) * UNIDADES_PAGE_SIZE + 1
  const indiceFinalUnidades = Math.min(unidadesPage * UNIDADES_PAGE_SIZE, totalUnidades)

  useEffect(() => {
    setUnidadesPage(1)
  }, [busqueda, estado, requiereRevision, situacion])

  useEffect(() => {
    if (unidadesPage > totalPaginasUnidades) {
      setUnidadesPage(totalPaginasUnidades)
    }
  }, [totalPaginasUnidades, unidadesPage])

  const isLoading = tiposEquipoQuery.isLoading || unidadesQuery.isLoading
  const errorMessage = tiposEquipoQuery.isError
    ? extractApiErrorMessage(tiposEquipoQuery.error)
    : unidadesQuery.isError
      ? extractApiErrorMessage(unidadesQuery.error)
      : null

  const abrirCrearTipoEquipo = () => {
    setTipoForm(crearEstadoTipoEquipo())
    setTipoFormMode({ mode: 'create' })
  }

  const abrirEditarTipoEquipo = (tipo: TipoEquipo) => {
    setTipoForm(crearEstadoTipoEquipo(tipo))
    setTipoFormMode({ mode: 'edit', tipo })
  }

  const abrirCrearUnidad = () => {
    setUnidadForm(crearEstadoUnidad())
    setUnidadFormMode({ mode: 'create' })
  }

  const abrirEditarUnidad = (unidad: Unidad) => {
    setUnidadForm(crearEstadoUnidad(unidad))
    setUnidadFormMode({ mode: 'edit', unidad })
  }

  const guardarTipoEquipo = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    guardarTipoEquipoMutation.mutate(construirTipoEquipoInput(tipoForm))
  }

  const guardarUnidad = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    guardarUnidadMutation.mutate(construirUnidadInput(unidadForm))
  }

  return (
    <section className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="absolute left-0 top-0 h-1 w-full bg-[#E30613]" />
        <p className={`text-sm font-semibold uppercase tracking-widest ${clasesInacap.textoMarca}`}>Inventario</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">Vista real de inventario</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
              Consulta y mantención alpha de tipos de equipo y unidades registradas contra la API real.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200">
            Resultados: {formatearNumero(tiposEquipoFiltrados.length)} tipos · {formatearNumero(totalUnidades)} unidades
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-center md:justify-between">
          <div className="flex rounded-2xl bg-slate-100 p-1">
            <button
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${tabActiva === 'TIPOS' ? 'bg-[#E30613] text-white shadow-sm' : 'text-slate-600 hover:text-slate-950'}`}
              type="button"
              onClick={() => setTabActiva('TIPOS')}
            >
              Tipos de equipo
            </button>
            <button
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${tabActiva === 'UNIDADES' ? 'bg-[#E30613] text-white shadow-sm' : 'text-slate-600 hover:text-slate-950'}`}
              type="button"
              onClick={() => setTabActiva('UNIDADES')}
            >
              Unidades
            </button>
          </div>
          <div className="flex gap-2">
            <ActionButton onClick={tabActiva === 'TIPOS' ? abrirCrearTipoEquipo : abrirCrearUnidad}>
              {tabActiva === 'TIPOS' ? 'Crear tipo' : 'Crear unidad'}
            </ActionButton>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-5">
          <label className="space-y-2 lg:col-span-2">
            <FieldLabel>Búsqueda</FieldLabel>
            <input
              className={`w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none transition ${clasesInacap.focoMarca}`}
              placeholder="Nombre, especificación o código activo..."
              type="search"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
            />
          </label>

          <label className="space-y-2">
            <FieldLabel>Seguimiento</FieldLabel>
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
            <FieldLabel>Situación</FieldLabel>
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
            <FieldLabel>Estado</FieldLabel>
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

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <label className="flex max-w-xs flex-col gap-2">
            <FieldLabel>Requiere revisión</FieldLabel>
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
          <SecondaryButton
            onClick={() => {
              setBusqueda('')
              setTipoSeguimiento('TODOS')
              setSituacion('TODAS')
              setEstado('TODOS')
              setRequiereRevision('TODAS')
            }}
          >
            Limpiar filtros
          </SecondaryButton>
        </div>
      </div>

      {isLoading ? <p className="rounded-2xl bg-white p-5 text-sm text-slate-500 shadow-sm">Cargando inventario...</p> : null}
      {errorMessage ? <ErrorPanel message={`No se pudo cargar inventario: ${errorMessage}`} /> : null}

      {!isLoading && !errorMessage && tabActiva === 'TIPOS' ? (
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
                    <th className="px-6 py-3 font-semibold">ID</th>
                    <th className="px-6 py-3 font-semibold">Nombre</th>
                    <th className="px-6 py-3 font-semibold">Especificación</th>
                    <th className="px-6 py-3 font-semibold">Categoría</th>
                    <th className="px-6 py-3 font-semibold">Seguimiento</th>
                    <th className="px-6 py-3 font-semibold">Stock total</th>
                    <th className="px-6 py-3 font-semibold">Disponible</th>
                    <th className="px-6 py-3 font-semibold">Brecha</th>
                    <th className="px-6 py-3 font-semibold">Necesaria</th>
                    <th className="px-6 py-3 font-semibold">Valor UF</th>
                    <th className="px-6 py-3 font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {tiposEquipoFiltrados.map((tipo) => (
                    <tr key={tipo.id} className="align-top">
                      <td className="px-6 py-4 text-slate-500">#{tipo.id}</td>
                      <td className="px-6 py-4 font-semibold text-slate-950">{tipo.nombre}</td>
                      <td className="max-w-md px-6 py-4 text-slate-600">{tipo.especificacion || 'Sin especificación'}</td>
                      <td className="px-6 py-4 text-slate-700">{tipo.categoria?.nombre ?? 'Sin categoría'}</td>
                      <td className="px-6 py-4"><Badge className={estilosSeguimiento[tipo.tipo_seguimiento]}>{etiquetasSeguimiento[tipo.tipo_seguimiento]}</Badge></td>
                      <td className="px-6 py-4 text-slate-700">{formatearNumero(tipo.stock_total)}</td>
                      <td className="px-6 py-4 text-slate-700">{formatearNumero(tipo.stock_disponible)}</td>
                      <td className="px-6 py-4 text-slate-700">{formatearNumero(tipo.brecha)}</td>
                      <td className="px-6 py-4 text-slate-700">{formatearNumero(tipo.cantidad_necesaria)}</td>
                      <td className="px-6 py-4 text-slate-700">{formatearUf(tipo.valor_uf)}</td>
                      <td className="px-6 py-4"><SecondaryButton onClick={() => abrirEditarTipoEquipo(tipo)}>Editar</SecondaryButton></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      ) : null}

      {!isLoading && !errorMessage && tabActiva === 'UNIDADES' ? (
        <article className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-200 px-6 py-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-950">Unidades</h2>
              <p className="mt-1 text-sm text-slate-500">
                Página {formatearNumero(unidadesPage)} de {formatearNumero(totalPaginasUnidades)}
              </p>
            </div>
          </div>
          {unidadesPagina.length === 0 ? (
            <div className="p-6"><EmptyState message="No hay unidades que coincidan con los filtros." /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-6 py-3 font-semibold">ID</th>
                    <th className="px-6 py-3 font-semibold">Código activo</th>
                    <th className="px-6 py-3 font-semibold">Tipo equipo</th>
                    <th className="px-6 py-3 font-semibold">Estado</th>
                    <th className="px-6 py-3 font-semibold">Situación</th>
                    <th className="px-6 py-3 font-semibold">Revisión</th>
                    <th className="px-6 py-3 font-semibold">Ubicación</th>
                    <th className="px-6 py-3 font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {unidadesPagina.map((unidad) => (
                    <tr key={unidad.id} className="align-top">
                      <td className="px-6 py-4 text-slate-500">#{unidad.id}</td>
                      <td className="px-6 py-4 font-semibold text-slate-950">{unidad.codigo_activo ?? `Unidad #${unidad.id}`}</td>
                      <td className="px-6 py-4 text-slate-700">{unidad.tipo_equipo.nombre}</td>
                      <td className="px-6 py-4"><Badge className={estilosEstado[unidad.estado]}>{etiquetasEstado[unidad.estado]}</Badge></td>
                      <td className="px-6 py-4"><Badge className={estilosSituacion[unidad.situacion]}>{etiquetasSituacion[unidad.situacion]}</Badge></td>
                      <td className="px-6 py-4 text-slate-700">{unidad.requiere_revision ? 'Sí' : 'No'}</td>
                      <td className="px-6 py-4 text-slate-600">{obtenerUbicacion(unidad)}</td>
                      <td className="px-6 py-4"><SecondaryButton onClick={() => abrirEditarUnidad(unidad)}>Editar</SecondaryButton></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {unidadesQuery.isSuccess ? (
            <div className="flex flex-col gap-3 border-t border-slate-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-slate-600" aria-live="polite">
                {totalUnidades > 0
                  ? `Mostrando ${formatearNumero(indiceInicialUnidades)}-${formatearNumero(indiceFinalUnidades)} de ${formatearNumero(totalUnidades)} unidades`
                  : 'Sin unidades para esta búsqueda'}
                {unidadesQuery.isFetching && !unidadesQuery.isLoading ? ' · Actualizando...' : ''}
              </p>
              <div className="flex gap-3">
                <button
                  className={`rounded-2xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${clasesInacap.botonSecundario}`}
                  disabled={unidadesPage <= 1 || unidadesQuery.isFetching}
                  onClick={() => setUnidadesPage((prev) => Math.max(1, prev - 1))}
                  type="button"
                >
                  Anterior
                </button>
                <button
                  className={`rounded-2xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${clasesInacap.botonSecundario}`}
                  disabled={unidadesPage >= totalPaginasUnidades || unidadesQuery.isFetching}
                  onClick={() => setUnidadesPage((prev) => Math.min(totalPaginasUnidades, prev + 1))}
                  type="button"
                >
                  Siguiente
                </button>
              </div>
            </div>
          ) : null}
        </article>
      ) : null}

      {tipoFormMode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <form className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl" onSubmit={guardarTipoEquipo}>
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-950">{tipoFormMode.mode === 'edit' ? 'Editar tipo de equipo' : 'Crear tipo de equipo'}</h2>
                <p className="mt-1 text-sm text-slate-500">Formulario conectado a /api/tipos-equipo/.</p>
              </div>
              <SecondaryButton onClick={() => setTipoFormMode(null)}>Cerrar</SecondaryButton>
            </div>
            {guardarTipoEquipoMutation.isError ? <div className="mt-4"><ErrorPanel message={extractApiErrorMessage(guardarTipoEquipoMutation.error)} /></div> : null}
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <FieldLabel>Nombre</FieldLabel>
                <input required className={`w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={tipoForm.nombre} onChange={(event) => setTipoForm((prev) => ({ ...prev, nombre: event.target.value }))} />
              </label>
              <label className="space-y-2">
                <FieldLabel>Categoría</FieldLabel>
                <select className={`w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={tipoForm.categoriaId} onChange={(event) => setTipoForm((prev) => ({ ...prev, categoriaId: event.target.value }))}>
                  <option value="">Sin categoría</option>
                  {(categoriasQuery.data ?? []).map((categoria) => <option key={categoria.id} value={categoria.id}>{categoria.nombre}</option>)}
                </select>
              </label>
              <label className="space-y-2">
                <FieldLabel>Seguimiento</FieldLabel>
                <select className={`w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={tipoForm.tipoSeguimiento} onChange={(event) => setTipoForm((prev) => ({ ...prev, tipoSeguimiento: event.target.value as TipoSeguimiento }))}>
                  {tiposSeguimiento.map((tipo) => <option key={tipo} value={tipo}>{etiquetasSeguimiento[tipo]}</option>)}
                </select>
              </label>
              <label className="space-y-2">
                <FieldLabel>Valor UF</FieldLabel>
                <input className={`w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} inputMode="decimal" value={tipoForm.valorUf} onChange={(event) => setTipoForm((prev) => ({ ...prev, valorUf: event.target.value }))} />
              </label>
              <label className="space-y-2">
                <FieldLabel>Cantidad necesaria</FieldLabel>
                <input min="0" type="number" className={`w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={tipoForm.cantidadNecesaria} onChange={(event) => setTipoForm((prev) => ({ ...prev, cantidadNecesaria: event.target.value }))} />
              </label>
              <label className="space-y-2">
                <FieldLabel>Stock granel</FieldLabel>
                <input min="0" type="number" className={`w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={tipoForm.stockGranel} onChange={(event) => setTipoForm((prev) => ({ ...prev, stockGranel: event.target.value }))} />
              </label>
              <label className="space-y-2 md:col-span-2">
                <FieldLabel>Especificación</FieldLabel>
                <textarea className={`min-h-24 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={tipoForm.especificacion} onChange={(event) => setTipoForm((prev) => ({ ...prev, especificacion: event.target.value }))} />
              </label>
              <label className="space-y-2 md:col-span-2">
                <FieldLabel>Observaciones</FieldLabel>
                <textarea className={`min-h-20 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={tipoForm.observaciones} onChange={(event) => setTipoForm((prev) => ({ ...prev, observaciones: event.target.value }))} />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <SecondaryButton onClick={() => setTipoFormMode(null)}>Cancelar</SecondaryButton>
              <button className={`rounded-xl px-4 py-2 text-sm font-semibold text-white ${clasesInacap.fondoMarca}`} disabled={guardarTipoEquipoMutation.isPending} type="submit">
                {guardarTipoEquipoMutation.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {unidadFormMode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <form className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl" onSubmit={guardarUnidad}>
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-950">{unidadFormMode.mode === 'edit' ? 'Editar unidad' : 'Crear unidad'}</h2>
                <p className="mt-1 text-sm text-slate-500">Formulario conectado a /api/unidades/.</p>
              </div>
              <SecondaryButton onClick={() => setUnidadFormMode(null)}>Cerrar</SecondaryButton>
            </div>
            {guardarUnidadMutation.isError ? <div className="mt-4"><ErrorPanel message={extractApiErrorMessage(guardarUnidadMutation.error)} /></div> : null}
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="space-y-2 md:col-span-2">
                <FieldLabel>Tipo de equipo</FieldLabel>
                <select required className={`w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={unidadForm.tipoEquipoId} onChange={(event) => setUnidadForm((prev) => ({ ...prev, tipoEquipoId: event.target.value }))}>
                  <option value="">Selecciona un tipo</option>
                  {(tiposEquipoQuery.data ?? []).map((tipo) => <option key={tipo.id} value={tipo.id}>{tipo.nombre}</option>)}
                </select>
              </label>
              <label className="space-y-2">
                <FieldLabel>Código activo</FieldLabel>
                <input className={`w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={unidadForm.codigoActivo} onChange={(event) => setUnidadForm((prev) => ({ ...prev, codigoActivo: event.target.value }))} />
              </label>
              <label className="space-y-2">
                <FieldLabel>Ubicación</FieldLabel>
                <select className={`w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={unidadForm.ubicacionId} onChange={(event) => setUnidadForm((prev) => ({ ...prev, ubicacionId: event.target.value }))}>
                  <option value="">Sin ubicación</option>
                  {(ubicacionesQuery.data ?? []).map((ubicacion) => <option key={ubicacion.id} value={ubicacion.id}>{ubicacion.nombre} · {ubicacion.sede}</option>)}
                </select>
              </label>
              <label className="space-y-2">
                <FieldLabel>Estado</FieldLabel>
                <select className={`w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={unidadForm.estado} onChange={(event) => setUnidadForm((prev) => ({ ...prev, estado: event.target.value as EstadoUnidad }))}>
                  {estadosUnidad.map((item) => <option key={item} value={item}>{etiquetasEstado[item]}</option>)}
                </select>
              </label>
              <label className="space-y-2">
                <FieldLabel>Situación</FieldLabel>
                <select className={`w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={unidadForm.situacion} onChange={(event) => setUnidadForm((prev) => ({ ...prev, situacion: event.target.value as SituacionUnidad }))}>
                  {situacionesUnidad.map((item) => <option key={item} value={item}>{etiquetasSituacion[item]}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 md:col-span-2">
                <input checked={unidadForm.requiereRevision} type="checkbox" onChange={(event) => setUnidadForm((prev) => ({ ...prev, requiereRevision: event.target.checked }))} />
                <span className="text-sm font-semibold text-slate-700">Requiere revisión</span>
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <SecondaryButton onClick={() => setUnidadFormMode(null)}>Cancelar</SecondaryButton>
              <button className={`rounded-xl px-4 py-2 text-sm font-semibold text-white ${clasesInacap.fondoMarca}`} disabled={guardarUnidadMutation.isPending} type="submit">
                {guardarUnidadMutation.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  )
}
