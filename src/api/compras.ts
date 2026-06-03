import { client } from './client'
import type { ListParams, Paginated } from '../types/api'
import type { EstadoOrdenCompra, OrdenCompra } from '../types/compras'

export type ComprasFiltros = {
  busqueda?: string
  estado?: EstadoOrdenCompra | ''
}

type RespuestaListaOrdenesCompra = Paginated<OrdenCompra> | OrdenCompra[]

function esRespuestaPaginada<T>(response: Paginated<T> | T[]): response is Paginated<T> {
  return !Array.isArray(response) && Array.isArray(response.results)
}

function obtenerResultadosOrdenesCompra(response: RespuestaListaOrdenesCompra): OrdenCompra[] {
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

  return obtenerResultadosOrdenesCompra(data)
}

export const comprasApi = {
  obtenerOrdenesCompra,
}
