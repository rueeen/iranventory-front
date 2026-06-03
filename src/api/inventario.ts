import { fetchAllPages, obtenerPagina, type ListResponse } from './pagination'
import type { ListParams, Paginated } from '../types/api'
import type { EstadoUnidad, SituacionUnidad, Unidad, UnidadInput } from '../types/inventario'
import { client } from './client'

export type RespuestaListaInventario<T> = ListResponse<T>

export type UnidadesFiltros = {
  busqueda?: string
  estado?: EstadoUnidad | 'TODOS'
  situacion?: SituacionUnidad | 'TODAS'
  requiereRevision?: 'TODAS' | 'SI' | 'NO'
  page?: number
}

function construirParams(filtros?: UnidadesFiltros | ListParams): ListParams {
  const params: ListParams = {}
  const busqueda = typeof filtros?.busqueda === 'string' ? filtros.busqueda.trim() : undefined

  if (busqueda) {
    params.search = busqueda
  }

  if (filtros?.estado && filtros.estado !== 'TODOS') {
    params.estado = filtros.estado
  }

  if (filtros?.situacion && filtros.situacion !== 'TODAS') {
    params.situacion = filtros.situacion
  }

  if (filtros?.requiereRevision === 'SI') {
    params.requiere_revision = true
  }

  if (filtros?.requiereRevision === 'NO') {
    params.requiere_revision = false
  }

  if (filtros?.page) {
    params.page = filtros.page
  }

  Object.entries(filtros ?? {}).forEach(([key, value]) => {
    if (!(key in params) && !['busqueda', 'estado', 'situacion', 'requiereRevision'].includes(key) && value !== undefined) {
      params[key] = value as string | number | boolean
    }
  })

  return params
}

export function obtenerUnidades(params?: UnidadesFiltros | ListParams): Promise<Unidad[]> {
  return fetchAllPages<Unidad>('/api/unidades/', construirParams(params))
}

export function obtenerUnidadesPaginadas(filtros?: UnidadesFiltros): Promise<Paginated<Unidad>> {
  return obtenerPagina<Unidad>('/api/unidades/', construirParams(filtros))
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
  obtenerUnidadesPaginadas,
  crearUnidad,
  actualizarUnidad,
}
