import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { comprasApi } from '../api/compras'
import { queryKeys } from '../lib/queryKeys'
import type { EstadoOrdenCompra, ItemOrdenCompra, OrdenCompra } from '../types/compras'

const estadosOrdenCompra: EstadoOrdenCompra[] = ['BORRADOR', 'EN_REVISION', 'ACEPTADA', 'RECHAZADA']

const etiquetasEstado: Record<EstadoOrdenCompra, string> = {
  BORRADOR: 'Borrador',
  EN_REVISION: 'En revisión',
  ACEPTADA: 'Aceptada',
  RECHAZADA: 'Rechazada',
}

const estilosEstado: Record<EstadoOrdenCompra, string> = {
  BORRADOR: 'bg-slate-100 text-slate-700 ring-slate-200',
  EN_REVISION: 'bg-amber-50 text-amber-700 ring-amber-200',
  ACEPTADA: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
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
  }).format(date)
}

function formatearTexto(valor: string | null | undefined, reemplazo = 'Sin información'): string {
  return valor?.trim() ? valor : reemplazo
}

function normalizarTexto(valor: string): string {
  return valor.toLocaleLowerCase('es-CL').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function ordenCoincideConBusqueda(orden: OrdenCompra, busqueda: string): boolean {
  const termino = normalizarTexto(busqueda.trim())

  if (!termino) {
    return true
  }

  const valores = [
    String(orden.id),
    orden.numero,
    orden.proveedor,
    orden.numero_documento,
    orden.estado,
    orden.fecha_documento ?? '',
    orden.observaciones,
    orden.items?.map((item) => item.tipo_equipo.nombre).join(' ') ?? '',
  ]

  return valores.some((valor) => normalizarTexto(valor).includes(termino))
}

function EstadoBadge({ estado }: { estado: EstadoOrdenCompra }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${estilosEstado[estado]}`}
    >
      {etiquetasEstado[estado]}
    </span>
  )
}

function CodigosActivo({ codigos }: { codigos: string[] }) {
  if (codigos.length === 0) {
    return <span className="text-slate-500">Sin códigos</span>
  }

  return <span>{codigos.join(', ')}</span>
}

function ItemRow({ item }: { item: ItemOrdenCompra }) {
  return (
    <tr>
      <td className="px-4 py-3 font-medium text-slate-950">{item.tipo_equipo.nombre}</td>
      <td className="px-4 py-3 text-slate-600">{item.cantidad_solicitada}</td>
      <td className="px-4 py-3 text-slate-600">{item.cantidad_recibida}</td>
      <td className="px-4 py-3 text-slate-600">{item.pendiente}</td>
      <td className="px-4 py-3 text-slate-600">
        {item.ubicacion ? `${item.ubicacion.nombre} (${item.ubicacion.sede})` : 'Sin ubicación'}
      </td>
      <td className="px-4 py-3 text-slate-600">
        <CodigosActivo codigos={item.codigos_activo} />
      </td>
      <td className="px-4 py-3 text-slate-600">{formatearTexto(item.observaciones, 'Sin observaciones')}</td>
    </tr>
  )
}

function ItemsOrdenCompra({ orden }: { orden: OrdenCompra }) {
  if (!orden.items?.length) {
    return <p className="text-sm text-slate-500">Sin items informados.</p>
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-semibold">Tipo de equipo</th>
            <th className="px-4 py-3 font-semibold">Solicitada</th>
            <th className="px-4 py-3 font-semibold">Recibida</th>
            <th className="px-4 py-3 font-semibold">Pendiente</th>
            <th className="px-4 py-3 font-semibold">Ubicación</th>
            <th className="px-4 py-3 font-semibold">Códigos activo</th>
            <th className="px-4 py-3 font-semibold">Observaciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {orden.items.map((item) => (
            <ItemRow item={item} key={item.id} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function OrdenCompraCard({ orden }: { orden: OrdenCompra }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-sky-600">
            Orden de compra #{orden.id}
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
            {formatearTexto(orden.numero, 'Sin número')}
          </h2>
          <p className="mt-2 text-sm font-medium text-slate-600">
            Proveedor: {formatearTexto(orden.proveedor, 'Sin proveedor')}
          </p>
        </div>
        <EstadoBadge estado={orden.estado} />
      </div>

      <dl className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-4">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Documento</dt>
          <dd className="mt-1 font-medium text-slate-950">
            {formatearTexto(orden.numero_documento, 'Sin documento')}
          </dd>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fecha documento</dt>
          <dd className="mt-1 font-medium text-slate-950">{formatearFecha(orden.fecha_documento)}</dd>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Items</dt>
          <dd className="mt-1 font-medium text-slate-950">{orden.items?.length ?? 0}</dd>
        </div>
      </dl>

      <div className="mt-6 rounded-2xl bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Observaciones</p>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          {formatearTexto(orden.observaciones, 'Sin observaciones')}
        </p>
      </div>

      <div className="mt-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Items</h3>
        <ItemsOrdenCompra orden={orden} />
      </div>
    </article>
  )
}

export function Compras() {
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState<EstadoOrdenCompra | ''>('')

  const filtros = useMemo(() => ({ busqueda, estado }), [busqueda, estado])

  const ordenesCompraQuery = useQuery<OrdenCompra[], Error>({
    queryKey: queryKeys.ordenesCompra.list(filtros),
    queryFn: () => comprasApi.obtenerOrdenesCompra(filtros),
  })

  const ordenesFiltradas = useMemo(() => {
    const ordenes = ordenesCompraQuery.data ?? []

    return ordenes.filter(
      (orden) => (!estado || orden.estado === estado) && ordenCoincideConBusqueda(orden, busqueda),
    )
  }, [busqueda, estado, ordenesCompraQuery.data])

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-widest text-sky-600">Compras</p>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">Listado de compras</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
              Vista inicial de solo lectura conectada al backend para consultar órdenes de compra,
              proveedores, documentos, estados, observaciones e items informados.
            </p>
          </div>
          <p className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600">
            {ordenesFiltradas.length} resultado{ordenesFiltradas.length === 1 ? '' : 's'}
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
              placeholder="Buscar por proveedor, número o documento"
              type="search"
              value={busqueda}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Estado</span>
            <select
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              onChange={(event) => setEstado(event.target.value as EstadoOrdenCompra | '')}
              value={estado}
            >
              <option value="">Todos los estados</option>
              {estadosOrdenCompra.map((estadoOrdenCompra) => (
                <option key={estadoOrdenCompra} value={estadoOrdenCompra}>
                  {etiquetasEstado[estadoOrdenCompra]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {ordenesCompraQuery.isLoading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-500">Cargando órdenes de compra...</p>
        </div>
      ) : null}

      {ordenesCompraQuery.isError ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-widest text-rose-600">Error</p>
          <h2 className="mt-2 text-xl font-bold text-rose-950">No se pudieron cargar las compras</h2>
          <p className="mt-2 text-sm leading-6 text-rose-800">
            Revisa la conexión con el backend o intenta nuevamente más tarde.
          </p>
        </div>
      ) : null}

      {ordenesCompraQuery.isSuccess && ordenesFiltradas.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">Sin resultados</p>
          <h2 className="mt-2 text-xl font-bold text-slate-950">No hay compras para mostrar</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Ajusta los filtros o espera a que existan órdenes registradas en el backend.
          </p>
        </div>
      ) : null}

      {ordenesCompraQuery.isSuccess && ordenesFiltradas.length > 0 ? (
        <div className="space-y-4">
          {ordenesFiltradas.map((orden) => (
            <OrdenCompraCard key={orden.id} orden={orden} />
          ))}
        </div>
      ) : null}
    </section>
  )
}
