import { client } from './client'
import type { ListParams, Paginated } from '../types/api'
import type { EstadoPrestamo, Prestamo, PrestamoInput, ResumenAtrasos } from '../types/prestamos'

export type PrestamosFiltros = {
  page?: number
  search?: string
  estado?: EstadoPrestamo | ''
  atrasado?: boolean
  ordering?: string
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

  if (filtros?.atrasado === true) {
    params.atrasado = 'true'
  }
  if (filtros?.ordering) {
    params.ordering = filtros.ordering
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

export async function obtenerResumenAtrasos(): Promise<ResumenAtrasos> {
  const { data } = await client.get<ResumenAtrasos>('/api/prestamos/resumen-atrasos/')
  return data
}

export const prestamosApi = {
  obtenerResumenAtrasos,
  obtenerPrestamos,
  obtenerPrestamo,
  crearPrestamo,
}
