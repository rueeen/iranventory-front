import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { prestamosApi } from '../api/prestamos'
import { queryKeys } from '../lib/queryKeys'
import type { EstadoPrestamo, Prestamo } from '../types/prestamos'

const estadosPrestamo: EstadoPrestamo[] = [
  'SOLICITADA',
  'APROBADA',
  'PREPARADA',
  'ENTREGADA',
  'DEVOLUCION',
  'CERRADA',
  'RECHAZADA',
]

const etiquetasEstado: Record<EstadoPrestamo, string> = {
  SOLICITADA: 'Solicitada',
  APROBADA: 'Aprobada',
  PREPARADA: 'Preparada',
  ENTREGADA: 'Entregada',
  DEVOLUCION: 'Devolución',
  CERRADA: 'Cerrada',
  RECHAZADA: 'Rechazada',
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

function formatearTexto(valor: string | null | undefined): string {
  return valor?.trim() ? valor : 'Sin observaciones'
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
    prestamo.detalles?.map((detalle) => detalle.tipo_equipo.nombre).join(' ') ?? '',
  ]

  return valores.some((valor) => normalizarTexto(valor).includes(termino))
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
              <td className="px-4 py-3 text-slate-600">{formatearTexto(detalle.observaciones)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PrestamoCard({ prestamo }: { prestamo: Prestamo }) {
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
        </div>
        <EstadoBadge estado={prestamo.estado} />
      </div>

      <dl className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-4">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Fecha solicitud
          </dt>
          <dd className="mt-1 font-medium text-slate-950">{formatearFecha(prestamo.fecha_solicitud)}</dd>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Fecha requerida
          </dt>
          <dd className="mt-1 font-medium text-slate-950">{formatearFecha(prestamo.fecha_requerida)}</dd>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Devolución comprometida
          </dt>
          <dd className="mt-1 font-medium text-slate-950">
            {formatearFecha(prestamo.fecha_devolucion_comprometida)}
          </dd>
        </div>
      </dl>

      <div className="mt-6 rounded-2xl border border-slate-200 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Observaciones</h3>
        <p className="mt-2 text-sm leading-6 text-slate-700">{formatearTexto(prestamo.observaciones)}</p>
      </div>

      <div className="mt-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Detalles</h3>
        <DetallesPrestamo prestamo={prestamo} />
      </div>
    </article>
  )
}

export function Prestamos() {
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState<EstadoPrestamo | ''>('')

  const filtros = useMemo(() => ({ busqueda, estado }), [busqueda, estado])

  const prestamosQuery = useQuery<Prestamo[], Error>({
    queryKey: queryKeys.prestamos.list(filtros),
    queryFn: () => prestamosApi.obtenerPrestamos(filtros),
  })

  const prestamosFiltrados = useMemo(() => {
    const prestamos = prestamosQuery.data ?? []

    return prestamos.filter(
      (prestamo) =>
        (!estado || prestamo.estado === estado) && prestamoCoincideConBusqueda(prestamo, busqueda),
    )
  }, [busqueda, estado, prestamosQuery.data])

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-widest text-sky-600">Préstamos</p>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">Listado de préstamos</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
              Vista inicial de solo lectura conectada al backend para consultar solicitudes,
              estados, fechas, observaciones y detalles informados.
            </p>
          </div>
          <p className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600">
            {prestamosFiltrados.length} resultado{prestamosFiltrados.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Búsqueda por texto</span>
            <input
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Buscar por ID, solicitante, fecha, observaciones o detalle"
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
            Revisa la conexión con el backend o intenta nuevamente más tarde.
          </p>
        </div>
      ) : null}

      {prestamosQuery.isSuccess && prestamosFiltrados.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">Sin resultados</p>
          <h2 className="mt-2 text-xl font-bold text-slate-950">No hay préstamos para mostrar</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Ajusta los filtros o espera a que existan solicitudes registradas en el backend.
          </p>
        </div>
      ) : null}

      {prestamosQuery.isSuccess && prestamosFiltrados.length > 0 ? (
        <div className="space-y-4">
          {prestamosFiltrados.map((prestamo) => (
            <PrestamoCard key={prestamo.id} prestamo={prestamo} />
          ))}
        </div>
      ) : null}
    </section>
  )
}
