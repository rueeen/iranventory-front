import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useQuery } from '@tanstack/react-query'

import { prestamosApi } from '../api/prestamos'
import { queryKeys } from '../lib/queryKeys'
import { clasesInacap } from '../lib/theme'
import {
  accionesDisponibles,
  condicionesDevolucion,
  etiquetasCondicion,
  etiquetasEstado,
  estilosEstado,
  formatearFecha,
  formatearTexto,
  obtenerNombreSolicitante,
  type AccionPrestamo,
} from '../lib/prestamos'
import { extractApiErrorMessage } from '../types/api'
import type { EstadoUnidad } from '../types/inventario'
import type { DetallePrestamo, Prestamo, RegistrarDevolucionItem } from '../types/prestamos'

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

type PrestamoDetalleModalProps = {
  prestamoId: number | null
  puedeGestionar: boolean
  accionPendiente: AccionPendiente | null
  accionError: string | null
  onClose: () => void
  onAccion: (prestamo: Prestamo, accion: AccionPrestamo, motivoAccion?: string) => void
  onRegistrarDevolucion: (prestamo: Prestamo, detalles: RegistrarDevolucionItem[]) => void
}

const estilosAccion: Record<AccionPrestamo, string> = {
  aprobar: 'bg-[#16A34A] text-white hover:bg-green-700',
  rechazar: 'bg-[#DC2626] text-white hover:bg-red-700',
  preparar: 'bg-[#E30613] text-white hover:bg-[#C90010]',
  entregar: 'bg-[#2563EB] text-white hover:bg-blue-700',
  'iniciar-devolucion': 'bg-[#D97706] text-white hover:bg-amber-700',
  cerrar: 'border border-slate-300 text-slate-700 hover:bg-slate-50',
  cancelar: 'border border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200',
}

const etiquetasAccion: Record<AccionPrestamo, string> = {
  aprobar: 'Aprobar',
  rechazar: 'Rechazar',
  preparar: 'Marcar como preparado',
  entregar: 'Entregar',
  'iniciar-devolucion': 'Iniciar devolución',
  cerrar: 'Cerrar préstamo',
  cancelar: 'Cancelar préstamo',
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#DC2626]">
      {message}
    </div>
  )
}

function EstadoBadge({ estado }: { estado: Prestamo['estado'] }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${estilosEstado[estado]}`}
    >
      {etiquetasEstado[estado]}
    </span>
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

  useEffect(() => {
    setItems(
      detalles.map((detalle) => ({
        id: detalle.id,
        cantidadDevuelta: String(detalle.cantidad_devuelta || detalle.cantidad),
        cantidadNoDevuelta: String(detalle.cantidad_no_devuelta || 0),
        condicion: detalle.condicion_devolucion || 'BUENO',
      })),
    )
  }, [detalles])

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

    if (
      payload.some(
        (item) =>
          !Number.isInteger(item.cantidad_devuelta) ||
          !Number.isInteger(item.cantidad_no_devuelta) ||
          item.cantidad_devuelta < 0 ||
          item.cantidad_no_devuelta < 0,
      )
    ) {
      setError('Ingresa cantidades devueltas y no devueltas válidas para todos los detalles.')
      return
    }

    setError(null)

    if (window.confirm('¿Registrar devolución con las cantidades y condiciones indicadas?')) {
      onSubmit(payload)
    }
  }

  return (
    <form className="mt-4 space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-4" onSubmit={handleSubmit}>
      <div>
        <h4 className="text-sm font-semibold uppercase tracking-wide text-[#D97706]">Registrar devolución</h4>
        <p className="mt-1 text-sm text-amber-900">Completa cantidades y condición final para cada detalle.</p>
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
                  className={`mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-4 ${clasesInacap.focoMarca}`}
                  min="0"
                  onChange={(event) => actualizarItem(detalle.id, { cantidadDevuelta: event.target.value })}
                  type="number"
                  value={item.cantidadDevuelta}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">No devuelta</span>
                <input
                  className={`mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-4 ${clasesInacap.focoMarca}`}
                  min="0"
                  onChange={(event) => actualizarItem(detalle.id, { cantidadNoDevuelta: event.target.value })}
                  type="number"
                  value={item.cantidadNoDevuelta}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Condición</span>
                <select
                  className={`mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-4 ${clasesInacap.focoMarca}`}
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
        className="rounded-2xl bg-[#D97706] px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled}
        type="submit"
      >
        Registrar devolución
      </button>
    </form>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 font-medium text-slate-950">{value}</dd>
    </div>
  )
}

export function PrestamoDetalleModal({
  prestamoId,
  puedeGestionar,
  accionPendiente,
  accionError,
  onClose,
  onAccion,
  onRegistrarDevolucion,
}: PrestamoDetalleModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const [motivoRechazo, setMotivoRechazo] = useState('')
  const [motivoCancelacion, setMotivoCancelacion] = useState('')
  const [motivoError, setMotivoError] = useState<string | null>(null)

  const detalleQuery = useQuery({
    queryKey: prestamoId ? queryKeys.prestamos.detail(prestamoId) : queryKeys.prestamos.detail(0),
    queryFn: () => prestamosApi.obtenerPrestamo(prestamoId as number),
    enabled: prestamoId !== null,
  })

  useEffect(() => {
    if (!prestamoId) {
      return
    }

    setMotivoRechazo('')
    setMotivoCancelacion('')
    setMotivoError(null)
    const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null
    window.setTimeout(() => closeButtonRef.current?.focus(), 0)

    return () => previousActiveElement?.focus()
  }, [prestamoId])

  useEffect(() => {
    if (!prestamoId) {
      return undefined
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, prestamoId])

  if (!prestamoId) {
    return null
  }

  const prestamo = detalleQuery.data
  const detalles = prestamo?.detalles ?? []
  const accionEnCurso = prestamo ? accionPendiente?.prestamoId === prestamo.id : false
  const devolucionEnCurso = prestamo
    ? accionPendiente?.prestamoId === prestamo.id && accionPendiente.accion === 'registrar-devolucion'
    : false

  function handleDialogKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab' || !dialogRef.current) {
      return
    }

    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    )

    if (focusable.length === 0) {
      return
    }

    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  function ejecutarAccion(accion: AccionPrestamo) {
    if (!prestamo) {
      return
    }

    if (accion === 'rechazar') {
      const motivo = motivoRechazo.trim()

      if (!motivo) {
        setMotivoError('Ingresa un motivo de rechazo antes de continuar.')
        return
      }

      setMotivoError(null)
      onAccion(prestamo, accion, motivo)
      return
    }

    if (accion === 'cancelar') {
      setMotivoError(null)
      onAccion(prestamo, accion, motivoCancelacion.trim() || undefined)
      return
    }

    onAccion(prestamo, accion)
  }

  return (
    <div
      aria-labelledby="prestamo-detalle-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
      role="dialog"
    >
      <div
        className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-3xl bg-white shadow-2xl outline-none"
        onKeyDown={handleDialogKeyDown}
        ref={dialogRef}
        tabIndex={-1}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 p-6 backdrop-blur">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-[#E30613]">Detalle de préstamo</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950" id="prestamo-detalle-title">
              {prestamo ? `Préstamo #${prestamo.id}` : `Préstamo #${prestamoId}`}
            </h2>
          </div>
          <button
            className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${clasesInacap.botonSecundario}`}
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            Cerrar
          </button>
        </div>

        <div className="space-y-6 p-6">
          {detalleQuery.isLoading ? (
            <div className="rounded-2xl border border-slate-200 p-6 text-center text-sm font-medium text-slate-500">
              Cargando detalle...
            </div>
          ) : null}

          {detalleQuery.isError ? <ErrorAlert message={extractApiErrorMessage(detalleQuery.error)} /> : null}

          {prestamo ? (
            <>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-950">{obtenerNombreSolicitante(prestamo)}</h3>
                  <p className="mt-2 text-sm font-medium text-slate-600">
                    {prestamo.asignatura ? `Asignatura: ${prestamo.asignatura.nombre}` : 'Sin asignatura asociada'}
                  </p>
                </div>
                <EstadoBadge estado={prestamo.estado} />
              </div>

              <dl className="grid gap-4 md:grid-cols-3">
                <InfoItem label="Fecha solicitud" value={formatearFecha(prestamo.fecha_solicitud)} />
                <InfoItem label="Fecha requerida" value={formatearFecha(prestamo.fecha_requerida)} />
                <InfoItem label="Devolución comprometida" value={formatearFecha(prestamo.fecha_devolucion_comprometida)} />
              </dl>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Observaciones</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{formatearTexto(prestamo.observaciones)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Rechazo</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {formatearTexto(prestamo.motivo_rechazo, 'Sin motivo de rechazo')}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Detalle del préstamo</h3>
                <DetallesPrestamo prestamo={prestamo} />
              </div>

              {puedeGestionar ? (
                <div className="space-y-4 border-t border-slate-100 pt-5">
                  <div className="flex flex-wrap gap-3">
                    {accionesDisponibles(prestamo.estado).map((accion) => (
                      <button
                        className={`rounded-2xl px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${estilosAccion[accion]}`}
                        disabled={accionEnCurso || (accion === 'rechazar' && !motivoRechazo.trim())}
                        key={accion}
                        onClick={() => ejecutarAccion(accion)}
                        type="button"
                      >
                        {etiquetasAccion[accion]}
                      </button>
                    ))}
                    {accionEnCurso ? (
                      <span className="self-center text-sm font-medium text-slate-500">Procesando acción...</span>
                    ) : null}
                  </div>

                  {prestamo.estado === 'SOLICITADA' && accionesDisponibles(prestamo.estado).includes('rechazar') ? (
                    <label className="block max-w-xl">
                      <span className="text-sm font-medium text-slate-700">Motivo de rechazo</span>
                      <textarea
                        className={`mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:ring-4 ${clasesInacap.focoMarca}`}
                        onChange={(event) => setMotivoRechazo(event.target.value)}
                        placeholder="Describe el motivo solo si vas a rechazar la solicitud."
                        rows={3}
                        value={motivoRechazo}
                      />
                      {motivoError ? <span className="mt-2 block text-sm text-[#DC2626]">{motivoError}</span> : null}
                    </label>
                  ) : null}

                  {accionesDisponibles(prestamo.estado).includes('cancelar') ? (
                    <label className="block max-w-xl">
                      <span className="text-sm font-medium text-slate-700">Motivo de cancelación</span>
                      <textarea
                        className={`mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:ring-4 ${clasesInacap.focoMarca}`}
                        onChange={(event) => setMotivoCancelacion(event.target.value)}
                        placeholder="Describe por qué se cancela el préstamo (opcional)."
                        rows={3}
                        value={motivoCancelacion}
                      />
                    </label>
                  ) : null}

                  {accionError ? <ErrorAlert message={accionError} /> : null}
                </div>
              ) : null}

              {puedeGestionar && prestamo.estado === 'DEVOLUCION' && detalles.length > 0 ? (
                <DevolucionForm
                  detalles={detalles}
                  disabled={devolucionEnCurso}
                  onSubmit={(payload) => onRegistrarDevolucion(prestamo, payload)}
                />
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
