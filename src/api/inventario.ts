import { client } from './client'
import type { ListParams, Paginated } from '../types/api'
import type { Unidad, UnidadInput } from '../types/inventario'
import { obtenerListaDesdeRespuesta } from './catalogo'

export type RespuestaListaInventario<T> = Paginated<T> | T[]

async function obtenerListaInventario<T>(
  endpoint: string,
  params?: ListParams,
): Promise<RespuestaListaInventario<T>> {
  const { data } = await client.get<RespuestaListaInventario<T>>(endpoint, { params })
  return data
}

async function obtenerResultadosInventario<T>(endpoint: string, params?: ListParams): Promise<T[]> {
  const response = await obtenerListaInventario<T>(endpoint, params)
  return obtenerListaDesdeRespuesta(response)
}

export function obtenerUnidades(params?: ListParams): Promise<Unidad[]> {
  return obtenerResultadosInventario<Unidad>('/api/unidades/', params)
}

export async function crearUnidad(input: UnidadInput): Promise<Unidad> {
  const { data } = await client.post<Unidad>('/api/unidades/', input)
  return data
}

export async function actualizarUnidad(id: number, input: UnidadInput): Promise<Unidad> {
  const { data } = await client.put<Unidad>(`/api/unidades/${id}/`, input)
  return data
}

export const inventarioApi = {
  obtenerUnidades,
  crearUnidad,
  actualizarUnidad,
}
