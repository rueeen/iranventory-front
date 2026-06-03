import { client } from './client'
import type { ListParams, Paginated } from '../types/api'

export type DashboardTotal = {
  total: number
}

type ListResponse<T> = Paginated<T> | T[]

function isPaginatedResponse<T>(response: ListResponse<T>): response is Paginated<T> {
  return !Array.isArray(response) && typeof response.count === 'number'
}

async function obtenerTotalDesdeListado<T>(endpoint: string, params?: ListParams): Promise<DashboardTotal> {
  const { data } = await client.get<ListResponse<T>>(endpoint, {
    params: {
      page: 1,
      ...params,
    },
  })

  return {
    total: isPaginatedResponse(data) ? data.count : data.length,
  }
}

export function obtenerTotalTiposEquipo(): Promise<DashboardTotal> {
  return obtenerTotalDesdeListado<unknown>('/api/tipos-equipo/')
}

export function obtenerTotalUnidades(): Promise<DashboardTotal> {
  return obtenerTotalDesdeListado<unknown>('/api/unidades/')
}

export function obtenerTotalPrestamos(): Promise<DashboardTotal> {
  return obtenerTotalDesdeListado<unknown>('/api/prestamos/')
}

export function obtenerTotalOrdenesCompra(): Promise<DashboardTotal> {
  return obtenerTotalDesdeListado<unknown>('/api/ordenes-compra/')
}

export const dashboardApi = {
  obtenerTotalTiposEquipo,
  obtenerTotalUnidades,
  obtenerTotalPrestamos,
  obtenerTotalOrdenesCompra,
}
