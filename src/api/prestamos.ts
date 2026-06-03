import { client } from './client'
import type { ListParams, Paginated } from '../types/api'
import type { EstadoPrestamo, Prestamo, PrestamoInput } from '../types/prestamos'

export type PrestamosFiltros = {
  busqueda?: string
  estado?: EstadoPrestamo | ''
}

type RespuestaListaPrestamos = Paginated<Prestamo> | Prestamo[]

function esRespuestaPaginada<T>(response: Paginated<T> | T[]): response is Paginated<T> {
  return !Array.isArray(response) && Array.isArray(response.results)
}

function obtenerResultadosPrestamos(response: RespuestaListaPrestamos): Prestamo[] {
  return esRespuestaPaginada(response) ? response.results : response
}

function construirParams(filtros?: PrestamosFiltros): ListParams {
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

export async function obtenerPrestamos(filtros?: PrestamosFiltros): Promise<Prestamo[]> {
  const { data } = await client.get<RespuestaListaPrestamos>('/api/prestamos/', {
    params: construirParams(filtros),
  })

  return obtenerResultadosPrestamos(data)
}

export async function obtenerPrestamo(id: number): Promise<Prestamo> {
  const { data } = await client.get<Prestamo>(`/api/prestamos/${id}/`)
  return data
}

export async function crearPrestamo(input: PrestamoInput): Promise<Prestamo> {
  const { data } = await client.post<Prestamo>('/api/prestamos/', input)
  return data
}

export const prestamosApi = {
  obtenerPrestamos,
  obtenerPrestamo,
  crearPrestamo,
}
