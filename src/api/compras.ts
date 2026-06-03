import { client } from './client'
import type { ListParams, Paginated } from '../types/api'
import type {
  AccionRechazarOrdenCompraInput,
  EstadoOrdenCompra,
  ItemOrdenCompra,
  ItemOrdenCompraCreateInput,
  ItemOrdenCompraUpdateInput,
  OrdenCompra,
  OrdenCompraInput,
} from '../types/compras'

export type ComprasFiltros = {
  busqueda?: string
  estado?: EstadoOrdenCompra | ''
}

type RespuestaListaOrdenesCompra = Paginated<OrdenCompra> | OrdenCompra[]
type RespuestaListaItemsOrdenCompra = Paginated<ItemOrdenCompra> | ItemOrdenCompra[]

function esRespuestaPaginada<T>(response: Paginated<T> | T[]): response is Paginated<T> {
  return !Array.isArray(response) && Array.isArray(response.results)
}

function obtenerResultados<T>(response: Paginated<T> | T[]): T[] {
  return esRespuestaPaginada(response) ? response.results : response
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

  return params
}

export async function obtenerOrdenesCompra(filtros?: ComprasFiltros): Promise<OrdenCompra[]> {
  const { data } = await client.get<RespuestaListaOrdenesCompra>('/api/ordenes-compra/', {
    params: construirParams(filtros),
  })

  return obtenerResultados(data)
}

export async function crearOrdenCompra(input: OrdenCompraInput): Promise<OrdenCompra> {
  const { data } = await client.post<OrdenCompra>('/api/ordenes-compra/', input)
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

  const { data } = await client.get<RespuestaListaItemsOrdenCompra>('/api/items-orden-compra/', { params })
  return obtenerResultados(data)
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
  crearOrdenCompra,
  actualizarOrdenCompra,
  obtenerItemsOrdenCompra,
  crearItemOrdenCompra,
  actualizarItemOrdenCompra,
  eliminarItemOrdenCompra,
  enviarOrdenARevision,
  aceptarOrdenCompra,
  rechazarOrdenCompra,
}
