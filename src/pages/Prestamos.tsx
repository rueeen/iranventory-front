import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  aprobarPrestamo,
  cancelarPrestamo,
  cerrarPrestamo,
  entregarPrestamo,
  iniciarDevolucion,
  prepararPrestamo,
  rechazarPrestamo,
  registrarDevolucion,
} from '../api/actions'
import { catalogoApi } from '../api/catalogo'
import { AsyncCombobox } from '../components/AsyncCombobox'
import { PrestamoDetalleModal } from '../components/PrestamoDetalleModal'
import { inventarioApi } from '../api/inventario'
import { prestamosApi } from '../api/prestamos'
import { useAuth, tieneRol } from '../features/auth/AuthContext'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { queryKeys } from '../lib/queryKeys'
import { clasesInacap } from '../lib/theme'
import {
  PRESTAMOS_PAGE_SIZE,
  estadosPrestamo,
  etiquetasCondicion,
  etiquetasEstado,
  estilosEstado,
  formatearFechaCorta,
  obtenerUsernameSolicitante,
  type AccionPrestamo,
} from '../lib/prestamos'
import { extractApiErrorMessage } from '../types/api'
import type { TipoEquipo } from '../types/catalogo'
import type { Unidad } from '../types/inventario'
import type {
  EstadoPrestamo,
  Prestamo,
  PrestamoInput,
  RegistrarDevolucionItem,
} from '../types/prestamos'

type SolicitudDetalleForm = {
  tipoEquipoId: string
  tipoEquipo: TipoEquipo | null
  unidadId: string
  cantidad: string
  observaciones: string
}

type SolicitudFormState = {
  fechaRequerida: string
  fechaDevolucionComprometida: string
  asignaturaId: string
  observaciones: string
  detalles: SolicitudDetalleForm[]
}

type AccionPendiente = {
  prestamoId: number
  accion: AccionPrestamo | 'registrar-devolucion'
}

const detalleVacio: SolicitudDetalleForm = {
  tipoEquipoId: '',
  tipoEquipo: null,
  unidadId: '',
  cantidad: '1',
  observaciones: '',
}

function crearEstadoSolicitudInicial(): SolicitudFormState {
  return {
    fechaRequerida: '',
    fechaDevolucionComprometida: '',
    asignaturaId: '',
    observaciones: '',
    detalles: [{ ...detalleVacio }],
  }
}

function obtenerTipoEquipo(detalle: SolicitudDetalleForm): TipoEquipo | null {
  return detalle.tipoEquipo
}

function obtenerUnidadesDisponibles(detalle: SolicitudDetalleForm, unidades: Unidad[]): Unidad[] {
  const tipoEquipoId = Number(detalle.tipoEquipoId)

  if (!Number.isFinite(tipoEquipoId)) {
    return []
  }

  return unidades.filter(
    (unidad) => unidad.tipo_equipo.id === tipoEquipoId && unidad.situacion === 'DISPONIBLE',
  )
}

function crearPayloadSolicitud(form: SolicitudFormState): PrestamoInput {
  return {
    asignatura_id: form.asignaturaId ? Number(form.asignaturaId) : null,
    fecha_requerida: form.fechaRequerida || null,
    fecha_devolucion_comprometida: form.fechaDevolucionComprometida || null,
    observaciones: form.observaciones.trim(),
    detalles: form.detalles.map((detalle) => {
      const tipo = obtenerTipoEquipo(detalle)
      const esSerie = tipo?.tipo_seguimiento === 'SERIE'

      return {
        tipo_equipo_id: Number(detalle.tipoEquipoId),
        unidad_id: esSerie ? Number(detalle.unidadId) : null,
        cantidad: esSerie ? 1 : Number(detalle.cantidad),
        observaciones: detalle.observaciones.trim(),
      }
    }),
  }
}

function validarSolicitud(form: SolicitudFormState): string | null {
  if (!form.fechaRequerida) {
    return 'Ingresa la fecha requerida del préstamo.'
  }

  if (!form.fechaDevolucionComprometida) {
    return 'Ingresa la fecha comprometida de devolución.'
  }

  if (form.detalles.length === 0) {
    return 'Agrega al menos un detalle de préstamo.'
  }

  for (const [index, detalle] of form.detalles.entries()) {
    const numero = index + 1
    const tipo = obtenerTipoEquipo(detalle)

    if (!tipo) {
      return `Selecciona el tipo de equipo del detalle ${numero}.`
    }

    if (tipo.tipo_seguimiento === 'SERIE' && !detalle.unidadId) {
      return `Selecciona una unidad disponible para el detalle ${numero}.`
    }

    if (tipo.tipo_seguimiento === 'GRANEL') {
      const cantidad = Number(detalle.cantidad)

      if (!Number.isInteger(cantidad) || cantidad < 1) {
        return `Ingresa una cantidad válida para el detalle ${numero}.`
      }
    }
  }

  return null
}

function EstadoBadge({ estado }: { estado: EstadoPrestamo }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${estilosEstado[estado]}`}
    >
      {etiquetasEstado[estado]}
    </span>
  )
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#DC2626]">
      {message}
    </div>
  )
}

function SolicitudPrestamoForm({ unidades }: { unidades: Unidad[] }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<SolicitudFormState>(() => crearEstadoSolicitudInicial())
  const [error, setError] = useState<string | null>(null)

  const asignaturasQuery = useQuery({
    queryKey: queryKeys.asignaturas.list(),
    queryFn: () => catalogoApi.obtenerAsignaturas(),
  })

  const crearMutation = useMutation({
    mutationFn: (input: PrestamoInput) => prestamosApi.crearPrestamo(input),
    onSuccess: () => {
      setForm(crearEstadoSolicitudInicial())
      setError(null)
      void queryClient.invalidateQueries({ queryKey: queryKeys.prestamos.all })
    },
    onError: (mutationError) => setError(extractApiErrorMessage(mutationError)),
  })

  function actualizarDetalle(index: number, patch: Partial<SolicitudDetalleForm>) {
    setForm((prev) => ({
      ...prev,
      detalles: prev.detalles.map((detalle, detalleIndex) =>
        detalleIndex === index ? { ...detalle, ...patch } : detalle,
      ),
    }))
  }

  function agregarDetalle() {
    setForm((prev) => ({ ...prev, detalles: [...prev.detalles, { ...detalleVacio }] }))
  }

  function quitarDetalle(index: number) {
    setForm((prev) => ({
      ...prev,
      detalles: prev.detalles.filter((_, detalleIndex) => detalleIndex !== index),
    }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validationError = validarSolicitud(form)

    if (validationError) {
      setError(validationError)
      return
    }

    setError(null)
    crearMutation.mutate(crearPayloadSolicitud(form))
  }

  return (
    <form className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" onSubmit={handleSubmit}>
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-[#E30613]">Nueva solicitud</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Crear préstamo</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Alumnos y docentes pueden solicitar equipos por serie o granel. Las unidades seriadas se eligen desde el stock disponible.
        </p>
      </div>

      {error ? <ErrorAlert message={error} /> : null}
      {crearMutation.isSuccess ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-[#16A34A]">
          Solicitud creada correctamente.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Fecha requerida</span>
          <input
            className={`mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:ring-4 ${clasesInacap.focoMarca}`}
            onChange={(event) => setForm((prev) => ({ ...prev, fechaRequerida: event.target.value }))}
            type="date"
            value={form.fechaRequerida}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Devolución comprometida</span>
          <input
            className={`mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:ring-4 ${clasesInacap.focoMarca}`}
            onChange={(event) => setForm((prev) => ({ ...prev, fechaDevolucionComprometida: event.target.value }))}
            type="date"
            value={form.fechaDevolucionComprometida}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Asignatura</span>
          <select
            className={`mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:ring-4 ${clasesInacap.focoMarca}`}
            disabled={asignaturasQuery.isLoading}
            onChange={(event) => setForm((prev) => ({ ...prev, asignaturaId: event.target.value }))}
            value={form.asignaturaId}
          >
            <option value="">Sin asignatura</option>
            {(asignaturasQuery.data ?? []).map((asignatura) => (
              <option key={asignatura.id} value={asignatura.id}>
                {asignatura.codigo ? `${asignatura.codigo} · ${asignatura.nombre}` : asignatura.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">Observaciones</span>
        <textarea
          className={`mt-2 min-h-24 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:ring-4 ${clasesInacap.focoMarca}`}
          onChange={(event) => setForm((prev) => ({ ...prev, observaciones: event.target.value }))}
          placeholder="Indica contexto, laboratorio, sección u otra información relevante."
          value={form.observaciones}
        />
      </label>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Detalles</h3>
          <button
            className="rounded-2xl border border-[#E30613]/30 px-4 py-2 text-sm font-semibold text-[#E30613] transition hover:bg-red-50"
            onClick={agregarDetalle}
            type="button"
          >
            Agregar detalle
          </button>
        </div>

        {form.detalles.map((detalle, index) => {
          const tipo = obtenerTipoEquipo(detalle)
          const esSerie = tipo?.tipo_seguimiento === 'SERIE'
          const unidadesDisponibles = obtenerUnidadesDisponibles(detalle, unidades)

          return (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" key={`detalle-${index}`}>
              <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr_120px]">
                <div className="block">
                  <label className="text-sm font-medium text-slate-700" htmlFor={`tipo-equipo-prestamo-${index}`}>
                    Tipo de equipo
                  </label>
                  <div className="mt-2">
                    <AsyncCombobox<TipoEquipo>
                      fetchOptions={catalogoApi.buscarTiposEquipo}
                      getOptionId={(tipoEquipo) => tipoEquipo.id}
                      getOptionLabel={(tipoEquipo) =>
                        `${tipoEquipo.nombre} · ${
                          tipoEquipo.tipo_seguimiento === 'SERIE'
                            ? 'Serie'
                            : `Granel (${tipoEquipo.stock_disponible} disp.)`
                        }`
                      }
                      id={`tipo-equipo-prestamo-${index}`}
                      onChange={(id, tipoEquipo) =>
                        actualizarDetalle(index, {
                          tipoEquipoId: id ? String(id) : '',
                          tipoEquipo,
                          unidadId: '',
                          cantidad: '1',
                        })
                      }
                      placeholder="Buscar tipo de equipo"
                      selectedItem={detalle.tipoEquipo}
                      value={detalle.tipoEquipoId ? Number(detalle.tipoEquipoId) : null}
                    />
                  </div>
                </div>

                {esSerie ? (
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Unidad disponible</span>
                    <select
                      className={`mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:ring-4 ${clasesInacap.focoMarca}`}
                      onChange={(event) => actualizarDetalle(index, { unidadId: event.target.value })}
                      value={detalle.unidadId}
                    >
                      <option value="">Selecciona unidad</option>
                      {unidadesDisponibles.map((unidad) => (
                        <option key={unidad.id} value={unidad.id}>
                          {unidad.codigo_activo ?? `Unidad #${unidad.id}`} · {etiquetasCondicion[unidad.estado]}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Cantidad</span>
                    <input
                      className={`mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:ring-4 ${clasesInacap.focoMarca}`}
                      min="1"
                      onChange={(event) => actualizarDetalle(index, { cantidad: event.target.value })}
                      type="number"
                      value={detalle.cantidad}
                    />
                  </label>
                )}

                <div className="flex items-end">
                  <button
                    className="w-full rounded-2xl border border-red-200 px-4 py-3 text-sm font-semibold text-[#DC2626] transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={form.detalles.length === 1}
                    onClick={() => quitarDetalle(index)}
                    type="button"
                  >
                    Quitar
                  </button>
                </div>
              </div>

              <label className="mt-4 block">
                <span className="text-sm font-medium text-slate-700">Observaciones del detalle</span>
                <input
                  className={`mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:ring-4 ${clasesInacap.focoMarca}`}
                  onChange={(event) => actualizarDetalle(index, { observaciones: event.target.value })}
                  placeholder="Accesorios requeridos, uso esperado u otra nota."
                  value={detalle.observaciones}
                />
              </label>
            </div>
          )
        })}
      </div>

      <div className="flex justify-end">
        <button
          className="rounded-2xl bg-[#E30613] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#C90010] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={crearMutation.isPending}
          type="submit"
        >
          {crearMutation.isPending ? 'Creando...' : 'Crear solicitud'}
        </button>
      </div>
    </form>
  )
}


export function Prestamos() {
  const { usuario } = useAuth()
  const puedeCrearSolicitud = tieneRol(usuario, ['ALUMNO', 'DOCENTE'])
  const puedeGestionar = tieneRol(usuario, ['PANOLERO', 'DIRECTOR'])
  const queryClient = useQueryClient()
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState<EstadoPrestamo | ''>('')
  const [page, setPage] = useState(1)
  const [prestamoSeleccionadoId, setPrestamoSeleccionadoId] = useState<number | null>(null)
  const [accionPendiente, setAccionPendiente] = useState<AccionPendiente | null>(null)
  const [accionError, setAccionError] = useState<string | null>(null)
  const busquedaDebounced = useDebouncedValue(busqueda, 300)

  const filtros = useMemo(
    () => ({ page, search: busquedaDebounced, estado }),
    [busquedaDebounced, estado, page],
  )

  const prestamosQuery = useQuery({
    queryKey: queryKeys.prestamos.list(filtros),
    queryFn: () => prestamosApi.obtenerPrestamos(filtros),
  })

  const prestamos = prestamosQuery.data?.results ?? []
  const totalPrestamos = prestamosQuery.data?.count ?? 0
  const totalPaginas = Math.max(1, Math.ceil(totalPrestamos / PRESTAMOS_PAGE_SIZE))
  const indiceInicialPagina = totalPrestamos === 0 ? 0 : (page - 1) * PRESTAMOS_PAGE_SIZE + 1
  const indiceFinalPagina = Math.min(page * PRESTAMOS_PAGE_SIZE, totalPrestamos)

  useEffect(() => {
    if (page > totalPaginas) {
      setPage(totalPaginas)
    }
  }, [page, totalPaginas])

  const unidadesQuery = useQuery({
    queryKey: queryKeys.unidades.list({ situacion: 'DISPONIBLE' }),
    queryFn: () => inventarioApi.obtenerUnidades({ situacion: 'DISPONIBLE' }),
  })

  const accionMutation = useMutation({
    mutationFn: async ({
      prestamo,
      accion,
      detalles,
      motivoRechazo,
      motivoCancelacion,
    }: {
      prestamo: Prestamo
      accion: AccionPrestamo | 'registrar-devolucion'
      detalles?: RegistrarDevolucionItem[]
      motivoRechazo?: string
      motivoCancelacion?: string
    }) => {
      setAccionPendiente({ prestamoId: prestamo.id, accion })

      switch (accion) {
        case 'aprobar':
          return aprobarPrestamo(prestamo.id)
        case 'rechazar': {
          const motivo = motivoRechazo?.trim()

          if (!motivo) {
            throw new Error('El motivo de rechazo es obligatorio.')
          }

          return rechazarPrestamo(prestamo.id, motivo)
        }
        case 'preparar':
          return prepararPrestamo(prestamo.id)
        case 'entregar':
          return entregarPrestamo(prestamo.id)
        case 'iniciar-devolucion':
          return iniciarDevolucion(prestamo.id)
        case 'registrar-devolucion':
          return registrarDevolucion(prestamo.id, detalles ?? [])
        case 'cerrar':
          return cerrarPrestamo(prestamo.id)
        case 'cancelar':
          return cancelarPrestamo(prestamo.id, motivoCancelacion?.trim())
      }
    },
    onSuccess: (_prestamoActualizado, variables) => {
      setAccionError(null)
      void queryClient.invalidateQueries({ queryKey: queryKeys.prestamos.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.prestamos.detail(variables.prestamo.id) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.unidades.all })
    },
    onError: (mutationError) => setAccionError(extractApiErrorMessage(mutationError)),
    onSettled: () => setAccionPendiente(null),
  })

  function actualizarBusqueda(valor: string) {
    setBusqueda(valor)
    setPage(1)
  }

  function actualizarEstado(valor: EstadoPrestamo | '') {
    setEstado(valor)
    setPage(1)
  }

  function ejecutarAccion(prestamo: Prestamo, accion: AccionPrestamo, motivoAccion?: string) {
    const mensajes: Record<AccionPrestamo, string> = {
      aprobar: `¿Aprobar el préstamo #${prestamo.id}?`,
      rechazar: `¿Rechazar el préstamo #${prestamo.id}?`,
      preparar: `¿Marcar como preparado el préstamo #${prestamo.id}?`,
      entregar: `¿Entregar el préstamo #${prestamo.id}?`,
      'iniciar-devolucion': `¿Iniciar devolución del préstamo #${prestamo.id}?`,
      cerrar: `¿Cerrar el préstamo #${prestamo.id}?`,
      cancelar: `¿Cancelar el préstamo #${prestamo.id}?`,
    }

    if (window.confirm(mensajes[accion])) {
      accionMutation.mutate({
        prestamo,
        accion,
        motivoRechazo: accion === 'rechazar' ? motivoAccion : undefined,
        motivoCancelacion: accion === 'cancelar' ? motivoAccion : undefined,
      })
    }
  }

  function ejecutarRegistroDevolucion(prestamo: Prestamo, detalles: RegistrarDevolucionItem[]) {
    accionMutation.mutate({ prestamo, accion: 'registrar-devolucion', detalles })
  }

  return (
    <section className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="absolute left-0 top-0 h-1 w-full bg-[#E30613]" />
        <p className="text-sm font-semibold uppercase tracking-widest text-[#E30613]">Préstamos</p>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">Flujo completo de préstamos</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
              Crea solicitudes, revisa el detalle y gestiona el ciclo operativo: aprobación, preparación, entrega, devolución y cierre.
            </p>
          </div>
          <p className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600">
            {totalPrestamos} resultado{totalPrestamos === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {puedeCrearSolicitud ? <SolicitudPrestamoForm unidades={unidadesQuery.data ?? []} /> : null}

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Búsqueda por texto</span>
            <input
              className={`mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:ring-4 ${clasesInacap.focoMarca}`}
              onChange={(event) => actualizarBusqueda(event.target.value)}
              placeholder="Buscar por solicitante u observaciones"
              type="search"
              value={busqueda}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Estado</span>
            <select
              className={`mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:ring-4 ${clasesInacap.focoMarca}`}
              onChange={(event) => actualizarEstado(event.target.value as EstadoPrestamo | '')}
              value={estado}
            >
              <option value="">Todos los estados</option>
              {estadosPrestamo.map((estadoPrestamo) => (
                <option key={estadoPrestamo} value={estadoPrestamo}>
                  {etiquetasEstado[estadoPrestamo]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {accionError ? <ErrorAlert message={accionError} /> : null}

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-4 font-semibold">#</th>
                <th className="px-5 py-4 font-semibold">Solicitante</th>
                <th className="px-5 py-4 font-semibold">Estado</th>
                <th className="px-5 py-4 font-semibold">Fecha solicitud</th>
                <th className="px-5 py-4 font-semibold">Ítems</th>
                <th className="px-5 py-4 font-semibold">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {prestamosQuery.isLoading ? (
                <tr>
                  <td className="px-5 py-8 text-center text-sm font-medium text-slate-500" colSpan={6}>
                    Cargando préstamos...
                  </td>
                </tr>
              ) : null}

              {prestamosQuery.isError ? (
                <tr>
                  <td className="px-5 py-8" colSpan={6}>
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
                      <p className="text-sm font-semibold uppercase tracking-widest text-[#DC2626]">Error</p>
                      <h2 className="mt-2 text-xl font-bold text-red-950">No se pudieron cargar los préstamos</h2>
                      <p className="mt-2 text-sm leading-6 text-[#DC2626]">
                        {extractApiErrorMessage(prestamosQuery.error)}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : null}

              {prestamosQuery.isSuccess && prestamos.length === 0 ? (
                <tr>
                  <td className="px-5 py-10 text-center" colSpan={6}>
                    <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">Sin resultados</p>
                    <h2 className="mt-2 text-xl font-bold text-slate-950">No hay préstamos para mostrar</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Ajusta los filtros o crea una nueva solicitud de préstamo.
                    </p>
                  </td>
                </tr>
              ) : null}

              {prestamos.map((prestamo) => (
                <tr className="transition hover:bg-slate-50" key={prestamo.id}>
                  <td className="px-5 py-4 font-semibold text-slate-950">#{prestamo.id}</td>
                  <td className="px-5 py-4 text-slate-700">{obtenerUsernameSolicitante(prestamo)}</td>
                  <td className="px-5 py-4"><EstadoBadge estado={prestamo.estado} /></td>
                  <td className="px-5 py-4 text-slate-600">{formatearFechaCorta(prestamo.fecha_solicitud)}</td>
                  <td className="px-5 py-4 text-slate-600">{prestamo.detalles?.length ?? 0}</td>
                  <td className="px-5 py-4">
                    <button
                      className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${clasesInacap.botonPrimario}`}
                      onClick={() => setPrestamoSeleccionadoId(prestamo.id)}
                      type="button"
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-600">
              Página {page} de {totalPaginas}
            </p>
            <p className="text-xs font-medium text-slate-500" aria-live="polite">
              {totalPrestamos > 0
                ? `Mostrando ${indiceInicialPagina}-${indiceFinalPagina} de ${totalPrestamos} préstamos`
                : 'Sin préstamos para esta búsqueda'}
              {prestamosQuery.isFetching && !prestamosQuery.isLoading ? ' · Actualizando...' : ''}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              className={`rounded-2xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${clasesInacap.botonSecundario}`}
              disabled={page <= 1 || prestamosQuery.isFetching}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              type="button"
            >
              Anterior
            </button>
            <button
              className={`rounded-2xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${clasesInacap.botonSecundario}`}
              disabled={page >= totalPaginas || prestamosQuery.isFetching}
              onClick={() => setPage((prev) => Math.min(totalPaginas, prev + 1))}
              type="button"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>

      <PrestamoDetalleModal
        accionError={accionError}
        accionPendiente={accionPendiente}
        onAccion={ejecutarAccion}
        onClose={() => setPrestamoSeleccionadoId(null)}
        onRegistrarDevolucion={ejecutarRegistroDevolucion}
        puedeGestionar={puedeGestionar}
        prestamoId={prestamoSeleccionadoId}
      />
    </section>
  )
}
