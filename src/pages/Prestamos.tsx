import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  aprobarPrestamo,
  cerrarPrestamo,
  entregarPrestamo,
  iniciarDevolucion,
  prepararPrestamo,
  rechazarPrestamo,
  registrarDevolucion,
} from '../api/actions'
import { catalogoApi } from '../api/catalogo'
import { inventarioApi } from '../api/inventario'
import { prestamosApi } from '../api/prestamos'
import { useAuth, tieneRol } from '../features/auth/AuthContext'
import { queryKeys } from '../lib/queryKeys'
import { extractApiErrorMessage } from '../types/api'
import type { TipoEquipo } from '../types/catalogo'
import type { EstadoUnidad, Unidad } from '../types/inventario'
import type {
  DetallePrestamo,
  EstadoPrestamo,
  Prestamo,
  PrestamoInput,
  RegistrarDevolucionItem,
} from '../types/prestamos'

const estadosPrestamo: EstadoPrestamo[] = [
  'SOLICITADA',
  'APROBADA',
  'PREPARADA',
  'ENTREGADA',
  'DEVOLUCION',
  'CERRADA',
  'RECHAZADA',
]

const condicionesDevolucion: EstadoUnidad[] = ['BUENO', 'REPARABLE', 'MALO']

const etiquetasEstado: Record<EstadoPrestamo, string> = {
  SOLICITADA: 'Solicitada',
  APROBADA: 'Aprobada',
  PREPARADA: 'Preparada',
  ENTREGADA: 'Entregada',
  DEVOLUCION: 'Devolución',
  CERRADA: 'Cerrada',
  RECHAZADA: 'Rechazada',
}

const etiquetasCondicion: Record<EstadoUnidad, string> = {
  BUENO: 'Bueno',
  REPARABLE: 'Reparable',
  MALO: 'Malo',
}

const estilosEstado: Record<EstadoPrestamo, string> = {
  SOLICITADA: 'bg-sky-50 text-sky-700 ring-sky-200',
  APROBADA: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  PREPARADA: 'bg-violet-50 text-violet-700 ring-violet-200',
  ENTREGADA: 'bg-amber-50 text-amber-700 ring-amber-200',
  DEVOLUCION: 'bg-orange-50 text-orange-700 ring-orange-200',
  CERRADA: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  RECHAZADA: 'bg-rose-50 text-rose-700 ring-rose-200',
}

type SolicitudDetalleForm = {
  tipoEquipoId: string
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

type AccionPrestamo = 'aprobar' | 'rechazar' | 'preparar' | 'entregar' | 'iniciar-devolucion' | 'cerrar'

type AccionPendiente = {
  prestamoId: number
  accion: AccionPrestamo | 'registrar-devolucion'
}

type DevolucionFormItem = {
  id: number
  cantidadDevuelta: string
  cantidadNoDevuelta: string
  condicion: EstadoUnidad
}

const detalleVacio: SolicitudDetalleForm = {
  tipoEquipoId: '',
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

function formatearFecha(fecha: string | null): string {
  if (!fecha) {
    return 'Sin fecha'
  }

  const date = new Date(fecha)

  if (Number.isNaN(date.getTime())) {
    return fecha
  }

  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'medium',
    timeStyle: fecha.includes('T') ? 'short' : undefined,
  }).format(date)
}

function formatearTexto(valor: string | null | undefined, fallback = 'Sin observaciones'): string {
  return valor?.trim() ? valor : fallback
}

function obtenerNombreSolicitante(prestamo: Prestamo): string {
  if (typeof prestamo.solicitante === 'number') {
    return `Usuario #${prestamo.solicitante}`
  }

  const nombreCompleto = [prestamo.solicitante.first_name, prestamo.solicitante.last_name]
    .filter(Boolean)
    .join(' ')
    .trim()

  return nombreCompleto || prestamo.solicitante.username || `Usuario #${prestamo.solicitante.id}`
}

function normalizarTexto(valor: string): string {
  return valor.toLocaleLowerCase('es-CL').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function prestamoCoincideConBusqueda(prestamo: Prestamo, busqueda: string): boolean {
  const termino = normalizarTexto(busqueda.trim())

  if (!termino) {
    return true
  }

  const valores = [
    String(prestamo.id),
    obtenerNombreSolicitante(prestamo),
    prestamo.estado,
    prestamo.fecha_solicitud,
    prestamo.fecha_requerida ?? '',
    prestamo.fecha_devolucion_comprometida ?? '',
    prestamo.observaciones,
    prestamo.motivo_rechazo,
    prestamo.asignatura?.nombre ?? '',
    prestamo.detalles?.map((detalle) => detalle.tipo_equipo.nombre).join(' ') ?? '',
  ]

  return valores.some((valor) => normalizarTexto(valor).includes(termino))
}

function obtenerTipoEquipo(tipoEquipoId: string, tiposEquipo: TipoEquipo[]): TipoEquipo | null {
  const id = Number(tipoEquipoId)
  return tiposEquipo.find((tipo) => tipo.id === id) ?? null
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

function crearPayloadSolicitud(form: SolicitudFormState, tiposEquipo: TipoEquipo[]): PrestamoInput {
  return {
    asignatura_id: form.asignaturaId ? Number(form.asignaturaId) : null,
    fecha_requerida: form.fechaRequerida || null,
    fecha_devolucion_comprometida: form.fechaDevolucionComprometida || null,
    observaciones: form.observaciones.trim(),
    detalles: form.detalles.map((detalle) => {
      const tipo = obtenerTipoEquipo(detalle.tipoEquipoId, tiposEquipo)
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

function validarSolicitud(form: SolicitudFormState, tiposEquipo: TipoEquipo[]): string | null {
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
    const tipo = obtenerTipoEquipo(detalle.tipoEquipoId, tiposEquipo)

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
    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
      {message}
    </div>
  )
}

function DetallesPrestamo({ prestamo }: { prestamo: Prestamo }) {
  if (!prestamo.detalles?.length) {
    return <p className="text-sm text-slate-500">Sin detalles informados.</p>
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-semibold">Tipo de equipo</th>
            <th className="px-4 py-3 font-semibold">Unidad</th>
            <th className="px-4 py-3 font-semibold">Cantidad</th>
            <th className="px-4 py-3 font-semibold">Devuelta</th>
            <th className="px-4 py-3 font-semibold">No devuelta</th>
            <th className="px-4 py-3 font-semibold">Condición</th>
            <th className="px-4 py-3 font-semibold">Observaciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {prestamo.detalles.map((detalle) => (
            <tr key={detalle.id}>
              <td className="px-4 py-3 font-medium text-slate-950">{detalle.tipo_equipo.nombre}</td>
              <td className="px-4 py-3 text-slate-600">
                {detalle.unidad?.codigo_activo ?? (detalle.unidad ? `Unidad #${detalle.unidad.id}` : 'Sin unidad')}
              </td>
              <td className="px-4 py-3 text-slate-600">{detalle.cantidad}</td>
              <td className="px-4 py-3 text-slate-600">{detalle.cantidad_devuelta}</td>
              <td className="px-4 py-3 text-slate-600">{detalle.cantidad_no_devuelta}</td>
              <td className="px-4 py-3 text-slate-600">
                {etiquetasCondicion[detalle.condicion_devolucion] ?? detalle.condicion_devolucion}
              </td>
              <td className="px-4 py-3 text-slate-600">{formatearTexto(detalle.observaciones)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SolicitudPrestamoForm({ tiposEquipo, unidades }: { tiposEquipo: TipoEquipo[]; unidades: Unidad[] }) {
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
    const validationError = validarSolicitud(form, tiposEquipo)

    if (validationError) {
      setError(validationError)
      return
    }

    setError(null)
    crearMutation.mutate(crearPayloadSolicitud(form, tiposEquipo))
  }

  return (
    <form className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" onSubmit={handleSubmit}>
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-sky-600">Nueva solicitud</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Crear préstamo</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Alumnos y docentes pueden solicitar equipos por serie o granel. Las unidades seriadas se eligen desde el stock disponible.
        </p>
      </div>

      {error ? <ErrorAlert message={error} /> : null}
      {crearMutation.isSuccess ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Solicitud creada correctamente.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Fecha requerida</span>
          <input
            className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            onChange={(event) => setForm((prev) => ({ ...prev, fechaRequerida: event.target.value }))}
            type="date"
            value={form.fechaRequerida}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Devolución comprometida</span>
          <input
            className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            onChange={(event) => setForm((prev) => ({ ...prev, fechaDevolucionComprometida: event.target.value }))}
            type="date"
            value={form.fechaDevolucionComprometida}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Asignatura</span>
          <select
            className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
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
          className="mt-2 min-h-24 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
          onChange={(event) => setForm((prev) => ({ ...prev, observaciones: event.target.value }))}
          placeholder="Indica contexto, laboratorio, sección u otra información relevante."
          value={form.observaciones}
        />
      </label>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Detalles</h3>
          <button
            className="rounded-2xl border border-sky-200 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-50"
            onClick={agregarDetalle}
            type="button"
          >
            Agregar detalle
          </button>
        </div>

        {form.detalles.map((detalle, index) => {
          const tipo = obtenerTipoEquipo(detalle.tipoEquipoId, tiposEquipo)
          const esSerie = tipo?.tipo_seguimiento === 'SERIE'
          const unidadesDisponibles = obtenerUnidadesDisponibles(detalle, unidades)

          return (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" key={`detalle-${index}`}>
              <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr_120px]">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Tipo de equipo</span>
                  <select
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                    onChange={(event) => actualizarDetalle(index, { tipoEquipoId: event.target.value, unidadId: '', cantidad: '1' })}
                    value={detalle.tipoEquipoId}
                  >
                    <option value="">Selecciona tipo</option>
                    {tiposEquipo.map((tipoEquipo) => (
                      <option key={tipoEquipo.id} value={tipoEquipo.id}>
                        {tipoEquipo.nombre} · {tipoEquipo.tipo_seguimiento === 'SERIE' ? 'Serie' : `Granel (${tipoEquipo.stock_disponible} disp.)`}
                      </option>
                    ))}
                  </select>
                </label>

                {esSerie ? (
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Unidad disponible</span>
                    <select
                      className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
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
                      className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                      min="1"
                      onChange={(event) => actualizarDetalle(index, { cantidad: event.target.value })}
                      type="number"
                      value={detalle.cantidad}
                    />
                  </label>
                )}

                <div className="flex items-end">
                  <button
                    className="w-full rounded-2xl border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
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
                  className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
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
          className="rounded-2xl bg-red-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={crearMutation.isPending}
          type="submit"
        >
          {crearMutation.isPending ? 'Creando...' : 'Crear solicitud'}
        </button>
      </div>
    </form>
  )
}

function DevolucionForm({
  detalles,
  disabled,
  onSubmit,
}: {
  detalles: DetallePrestamo[]
  disabled: boolean
  onSubmit: (detalles: RegistrarDevolucionItem[]) => void
}) {
  const [items, setItems] = useState<DevolucionFormItem[]>(() =>
    detalles.map((detalle) => ({
      id: detalle.id,
      cantidadDevuelta: String(detalle.cantidad_devuelta || detalle.cantidad),
      cantidadNoDevuelta: String(detalle.cantidad_no_devuelta || 0),
      condicion: detalle.condicion_devolucion || 'BUENO',
    })),
  )
  const [error, setError] = useState<string | null>(null)

  function actualizarItem(id: number, patch: Partial<DevolucionFormItem>) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const payload = items.map((item) => ({
      id: item.id,
      cantidad_devuelta: Number(item.cantidadDevuelta),
      cantidad_no_devuelta: Number(item.cantidadNoDevuelta),
      condicion: item.condicion,
    }))

    if (payload.some((item) => !Number.isInteger(item.cantidad_devuelta) || !Number.isInteger(item.cantidad_no_devuelta) || item.cantidad_devuelta < 0 || item.cantidad_no_devuelta < 0)) {
      setError('Ingresa cantidades devueltas y no devueltas válidas para todos los detalles.')
      return
    }

    setError(null)

    if (window.confirm('¿Registrar devolución con las cantidades y condiciones indicadas?')) {
      onSubmit(payload)
    }
  }

  return (
    <form className="mt-4 space-y-4 rounded-2xl border border-orange-200 bg-orange-50 p-4" onSubmit={handleSubmit}>
      <div>
        <h4 className="text-sm font-semibold uppercase tracking-wide text-orange-800">Registrar devolución</h4>
        <p className="mt-1 text-sm text-orange-900">Completa cantidades y condición final para cada detalle.</p>
      </div>
      {error ? <ErrorAlert message={error} /> : null}
      <div className="space-y-3">
        {detalles.map((detalle) => {
          const item = items.find((candidate) => candidate.id === detalle.id)

          if (!item) {
            return null
          }

          return (
            <div className="grid gap-3 rounded-2xl bg-white p-3 lg:grid-cols-[1fr_140px_160px_160px]" key={detalle.id}>
              <div>
                <p className="text-sm font-semibold text-slate-950">{detalle.tipo_equipo.nombre}</p>
                <p className="text-xs text-slate-500">
                  {detalle.unidad?.codigo_activo ?? (detalle.unidad ? `Unidad #${detalle.unidad.id}` : `Cantidad original: ${detalle.cantidad}`)}
                </p>
              </div>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Devuelta</span>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  min="0"
                  onChange={(event) => actualizarItem(detalle.id, { cantidadDevuelta: event.target.value })}
                  type="number"
                  value={item.cantidadDevuelta}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">No devuelta</span>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  min="0"
                  onChange={(event) => actualizarItem(detalle.id, { cantidadNoDevuelta: event.target.value })}
                  type="number"
                  value={item.cantidadNoDevuelta}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Condición</span>
                <select
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  onChange={(event) => actualizarItem(detalle.id, { condicion: event.target.value as EstadoUnidad })}
                  value={item.condicion}
                >
                  {condicionesDevolucion.map((condicion) => (
                    <option key={condicion} value={condicion}>
                      {etiquetasCondicion[condicion]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )
        })}
      </div>
      <button
        className="rounded-2xl bg-orange-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled}
        type="submit"
      >
        Registrar devolución
      </button>
    </form>
  )
}

function PrestamoCard({
  prestamo,
  puedeGestionar,
  accionPendiente,
  onAccion,
  onRegistrarDevolucion,
}: {
  prestamo: Prestamo
  puedeGestionar: boolean
  accionPendiente: AccionPendiente | null
  onAccion: (prestamo: Prestamo, accion: AccionPrestamo) => void
  onRegistrarDevolucion: (prestamo: Prestamo, detalles: RegistrarDevolucionItem[]) => void
}) {
  const detalles = prestamo.detalles ?? []
  const accionEnCurso = accionPendiente?.prestamoId === prestamo.id
  const devolucionEnCurso = accionPendiente?.prestamoId === prestamo.id && accionPendiente.accion === 'registrar-devolucion'

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-sky-600">
            Préstamo #{prestamo.id}
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
            {obtenerNombreSolicitante(prestamo)}
          </h2>
          <p className="mt-2 text-sm font-medium text-slate-600">
            {prestamo.asignatura ? `Asignatura: ${prestamo.asignatura.nombre}` : 'Sin asignatura asociada'}
          </p>
        </div>
        <EstadoBadge estado={prestamo.estado} />
      </div>

      <dl className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-4">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fecha solicitud</dt>
          <dd className="mt-1 font-medium text-slate-950">{formatearFecha(prestamo.fecha_solicitud)}</dd>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fecha requerida</dt>
          <dd className="mt-1 font-medium text-slate-950">{formatearFecha(prestamo.fecha_requerida)}</dd>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Devolución comprometida</dt>
          <dd className="mt-1 font-medium text-slate-950">{formatearFecha(prestamo.fecha_devolucion_comprometida)}</dd>
        </div>
      </dl>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Observaciones</h3>
          <p className="mt-2 text-sm leading-6 text-slate-700">{formatearTexto(prestamo.observaciones)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Rechazo</h3>
          <p className="mt-2 text-sm leading-6 text-slate-700">{formatearTexto(prestamo.motivo_rechazo, 'Sin motivo de rechazo')}</p>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Detalle del préstamo</h3>
        <DetallesPrestamo prestamo={prestamo} />
      </div>

      {puedeGestionar ? (
        <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-100 pt-5">
          {prestamo.estado === 'SOLICITADA' ? (
            <>
              <button
                className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={accionEnCurso}
                onClick={() => onAccion(prestamo, 'aprobar')}
                type="button"
              >
                Aprobar
              </button>
              <button
                className="rounded-2xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={accionEnCurso}
                onClick={() => onAccion(prestamo, 'rechazar')}
                type="button"
              >
                Rechazar
              </button>
            </>
          ) : null}
          {prestamo.estado === 'APROBADA' ? (
            <button className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60" disabled={accionEnCurso} onClick={() => onAccion(prestamo, 'preparar')} type="button">
              Preparar
            </button>
          ) : null}
          {prestamo.estado === 'PREPARADA' ? (
            <button className="rounded-2xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60" disabled={accionEnCurso} onClick={() => onAccion(prestamo, 'entregar')} type="button">
              Entregar
            </button>
          ) : null}
          {prestamo.estado === 'ENTREGADA' ? (
            <button className="rounded-2xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60" disabled={accionEnCurso} onClick={() => onAccion(prestamo, 'iniciar-devolucion')} type="button">
              Iniciar devolución
            </button>
          ) : null}
          {prestamo.estado === 'DEVOLUCION' ? (
            <button className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60" disabled={accionEnCurso} onClick={() => onAccion(prestamo, 'cerrar')} type="button">
              Cerrar préstamo
            </button>
          ) : null}
          {accionEnCurso ? <span className="self-center text-sm font-medium text-slate-500">Procesando acción...</span> : null}
        </div>
      ) : null}

      {puedeGestionar && prestamo.estado === 'DEVOLUCION' && detalles.length > 0 ? (
        <DevolucionForm
          detalles={detalles}
          disabled={devolucionEnCurso}
          onSubmit={(payload) => onRegistrarDevolucion(prestamo, payload)}
        />
      ) : null}
    </article>
  )
}

export function Prestamos() {
  const { usuario } = useAuth()
  const puedeCrearSolicitud = tieneRol(usuario, ['ALUMNO', 'DOCENTE'])
  const puedeGestionar = tieneRol(usuario, ['PANOLERO', 'DIRECTOR'])
  const queryClient = useQueryClient()
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState<EstadoPrestamo | ''>('')
  const [accionPendiente, setAccionPendiente] = useState<AccionPendiente | null>(null)
  const [accionError, setAccionError] = useState<string | null>(null)

  const filtros = useMemo(() => ({ busqueda, estado }), [busqueda, estado])

  const prestamosQuery = useQuery<Prestamo[], Error>({
    queryKey: queryKeys.prestamos.list(filtros),
    queryFn: () => prestamosApi.obtenerPrestamos(filtros),
  })

  const tiposEquipoQuery = useQuery({
    queryKey: queryKeys.tiposEquipo.list(),
    queryFn: () => catalogoApi.obtenerTiposEquipo(),
  })

  const unidadesQuery = useQuery({
    queryKey: queryKeys.unidades.list({ situacion: 'DISPONIBLE' }),
    queryFn: () => inventarioApi.obtenerUnidades({ situacion: 'DISPONIBLE' }),
  })

  const accionMutation = useMutation({
    mutationFn: async ({ prestamo, accion, detalles }: { prestamo: Prestamo; accion: AccionPrestamo | 'registrar-devolucion'; detalles?: RegistrarDevolucionItem[] }) => {
      setAccionPendiente({ prestamoId: prestamo.id, accion })

      switch (accion) {
        case 'aprobar':
          return aprobarPrestamo(prestamo.id)
        case 'rechazar': {
          const motivo = window.prompt(`Motivo de rechazo para préstamo #${prestamo.id}`)?.trim()

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
      }
    },
    onSuccess: () => {
      setAccionError(null)
      void queryClient.invalidateQueries({ queryKey: queryKeys.prestamos.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.unidades.all })
    },
    onError: (mutationError) => setAccionError(extractApiErrorMessage(mutationError)),
    onSettled: () => setAccionPendiente(null),
  })

  const prestamosFiltrados = useMemo(() => {
    const prestamos = prestamosQuery.data ?? []

    return prestamos.filter(
      (prestamo) =>
        (!estado || prestamo.estado === estado) && prestamoCoincideConBusqueda(prestamo, busqueda),
    )
  }, [busqueda, estado, prestamosQuery.data])

  function ejecutarAccion(prestamo: Prestamo, accion: AccionPrestamo) {
    const mensajes: Record<AccionPrestamo, string> = {
      aprobar: `¿Aprobar el préstamo #${prestamo.id}?`,
      rechazar: `¿Rechazar el préstamo #${prestamo.id}? Se solicitará un motivo.`,
      preparar: `¿Marcar como preparado el préstamo #${prestamo.id}?`,
      entregar: `¿Entregar el préstamo #${prestamo.id}?`,
      'iniciar-devolucion': `¿Iniciar devolución del préstamo #${prestamo.id}?`,
      cerrar: `¿Cerrar el préstamo #${prestamo.id}?`,
    }

    if (window.confirm(mensajes[accion])) {
      accionMutation.mutate({ prestamo, accion })
    }
  }

  function ejecutarRegistroDevolucion(prestamo: Prestamo, detalles: RegistrarDevolucionItem[]) {
    accionMutation.mutate({ prestamo, accion: 'registrar-devolucion', detalles })
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-widest text-sky-600">Préstamos</p>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">Flujo completo de préstamos</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
              Crea solicitudes, revisa el detalle y gestiona el ciclo operativo: aprobación, preparación, entrega, devolución y cierre.
            </p>
          </div>
          <p className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600">
            {prestamosFiltrados.length} resultado{prestamosFiltrados.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {puedeCrearSolicitud ? (
        <SolicitudPrestamoForm tiposEquipo={tiposEquipoQuery.data ?? []} unidades={unidadesQuery.data ?? []} />
      ) : null}

      {accionError ? <ErrorAlert message={accionError} /> : null}

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Búsqueda por texto</span>
            <input
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Buscar por ID, solicitante, fecha, observaciones, rechazo o detalle"
              type="search"
              value={busqueda}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Estado</span>
            <select
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              onChange={(event) => setEstado(event.target.value as EstadoPrestamo | '')}
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

      {prestamosQuery.isLoading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-500">Cargando préstamos...</p>
        </div>
      ) : null}

      {prestamosQuery.isError ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-widest text-rose-600">Error</p>
          <h2 className="mt-2 text-xl font-bold text-rose-950">No se pudieron cargar los préstamos</h2>
          <p className="mt-2 text-sm leading-6 text-rose-800">
            {extractApiErrorMessage(prestamosQuery.error)}
          </p>
        </div>
      ) : null}

      {prestamosQuery.isSuccess && prestamosFiltrados.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">Sin resultados</p>
          <h2 className="mt-2 text-xl font-bold text-slate-950">No hay préstamos para mostrar</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Ajusta los filtros o crea una nueva solicitud de préstamo.
          </p>
        </div>
      ) : null}

      {prestamosQuery.isSuccess && prestamosFiltrados.length > 0 ? (
        <div className="space-y-4">
          {prestamosFiltrados.map((prestamo) => (
            <PrestamoCard
              accionPendiente={accionPendiente}
              key={prestamo.id}
              onAccion={ejecutarAccion}
              onRegistrarDevolucion={ejecutarRegistroDevolucion}
              puedeGestionar={puedeGestionar}
              prestamo={prestamo}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}
