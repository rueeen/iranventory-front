import { client } from './client'
import type { ListParams, Paginated } from '../types/api'
import type { EstadoPrestamo, Prestamo, PrestamoInput } from '../types/prestamos'

export type PrestamosFiltros = {
  page?: number
  search?: string
  estado?: EstadoPrestamo | ''
}

function construirParams(filtros?: PrestamosFiltros): ListParams {
  const params: ListParams = {}
  const search = filtros?.search?.trim()

  if (filtros?.page) {
    params.page = filtros.page
  }

  if (search) {
    params.search = search
  }

  if (filtros?.estado) {
    params.estado = filtros.estado
  }

  return params
}

export async function obtenerPrestamos(filtros?: PrestamosFiltros): Promise<Paginated<Prestamo>> {
  const { data } = await client.get<Paginated<Prestamo>>('/api/prestamos/', {
    params: construirParams(filtros),
  })

  return data
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
