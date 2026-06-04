import { client } from './client'
import { fetchAllPages, obtenerPagina } from './pagination'
import type { ListParams, Paginated } from '../types/api'
import type {
  AccionRechazarOrdenCompraInput,
  EstadoOrdenCompra,
  ItemOrdenCompra,
  ItemOrdenCompraCreateInput,
  ItemOrdenCompraUpdateInput,
  OrdenCompra,
  OrdenCompraInput,
  PreviewOrdenCompra,
} from '../types/compras'

export type ComprasFiltros = {
  busqueda?: string
  estado?: EstadoOrdenCompra | ''
  page?: number
}

function construirParams(filtros?: ComprasFiltros): ListParams {
  const params: ListParams = {}
  const busqueda = filtros?.busqueda?.trim()

  if (busqueda) {
    params.search = busqueda
  }

  if (filtros?.estado) {
    params.estado = filtros.estado
  }

  if (filtros?.page) {
    params.page = filtros.page
  }

  return params
}

export function obtenerOrdenesCompra(filtros?: ComprasFiltros): Promise<OrdenCompra[]> {
  return fetchAllPages<OrdenCompra>('/api/ordenes-compra/', construirParams(filtros))
}

export function obtenerOrdenesCompraPaginadas(filtros?: ComprasFiltros): Promise<Paginated<OrdenCompra>> {
  return obtenerPagina<OrdenCompra>('/api/ordenes-compra/', construirParams(filtros))
}

export async function crearOrdenCompra(input: OrdenCompraInput): Promise<OrdenCompra> {
  const { data } = await client.post<OrdenCompra>('/api/ordenes-compra/', input)
  return data
}

export async function importarPreviewOrdenCompra(texto: string): Promise<PreviewOrdenCompra> {
  const { data } = await client.post<PreviewOrdenCompra>('/api/ordenes-compra/importar-preview/', { texto })
  return data
}

export async function actualizarOrdenCompra(id: number, input: OrdenCompraInput): Promise<OrdenCompra> {
  const { data } = await client.patch<OrdenCompra>(`/api/ordenes-compra/${id}/`, input)
  return data
}

export async function obtenerItemsOrdenCompra(ordenCompraId?: number): Promise<ItemOrdenCompra[]> {
  const params: ListParams = {}

  if (ordenCompraId) {
    params.orden_compra = ordenCompraId
  }

  return fetchAllPages<ItemOrdenCompra>('/api/items-orden-compra/', params)
}

export async function crearItemOrdenCompra(input: ItemOrdenCompraCreateInput): Promise<ItemOrdenCompra> {
  const { data } = await client.post<ItemOrdenCompra>('/api/items-orden-compra/', input)
  return data
}

export async function actualizarItemOrdenCompra(
  id: number,
  input: ItemOrdenCompraUpdateInput,
): Promise<ItemOrdenCompra> {
  const { data } = await client.patch<ItemOrdenCompra>(`/api/items-orden-compra/${id}/`, input)
  return data
}

export async function eliminarItemOrdenCompra(id: number): Promise<void> {
  await client.delete(`/api/items-orden-compra/${id}/`)
}

export async function enviarOrdenARevision(id: number): Promise<OrdenCompra> {
  const { data } = await client.post<OrdenCompra>(`/api/ordenes-compra/${id}/enviar-revision/`)
  return data
}

export async function aceptarOrdenCompra(id: number): Promise<OrdenCompra> {
  const { data } = await client.post<OrdenCompra>(`/api/ordenes-compra/${id}/aceptar/`)
  return data
}

export async function rechazarOrdenCompra(
  id: number,
  input: AccionRechazarOrdenCompraInput,
): Promise<OrdenCompra> {
  const { data } = await client.post<OrdenCompra>(`/api/ordenes-compra/${id}/rechazar/`, input)
  return data
}

export const comprasApi = {
  obtenerOrdenesCompra,
  obtenerOrdenesCompraPaginadas,
  crearOrdenCompra,
  importarPreviewOrdenCompra,
  actualizarOrdenCompra,
  obtenerItemsOrdenCompra,
  crearItemOrdenCompra,
  actualizarItemOrdenCompra,
  eliminarItemOrdenCompra,
  enviarOrdenARevision,
  aceptarOrdenCompra,
  rechazarOrdenCompra,
}
