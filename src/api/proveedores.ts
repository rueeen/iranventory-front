import { client } from './client'
import { fetchAllPages } from './pagination'
import type { ListParams } from '../types/api'
import type { Proveedor, ProveedorInput } from '../types/compras'

export type ProveedoresFiltros = {
  search?: string
  activo?: boolean | ''
}

function construirParams(filtros?: ProveedoresFiltros): ListParams {
  const params: ListParams = {}
  const search = filtros?.search?.trim()

  if (search) params.search = search
  if (typeof filtros?.activo === 'boolean') params.activo = filtros.activo

  return params
}

export function obtenerProveedores(filtros?: ProveedoresFiltros): Promise<Proveedor[]> {
  return fetchAllPages<Proveedor>('/api/proveedores/', construirParams(filtros))
}

export function buscarProveedores(search: string): Promise<Proveedor[]> {
  return obtenerProveedores({ search, activo: true })
}

export async function obtenerProveedor(id: number): Promise<Proveedor> {
  const { data } = await client.get<Proveedor>(`/api/proveedores/${id}/`)
  return data
}

export async function crearProveedor(input: ProveedorInput): Promise<Proveedor> {
  const { data } = await client.post<Proveedor>('/api/proveedores/', input)
  return data
}

export async function actualizarProveedor(id: number, input: ProveedorInput): Promise<Proveedor> {
  const { data } = await client.patch<Proveedor>(`/api/proveedores/${id}/`, input)
  return data
}

export async function eliminarProveedor(id: number): Promise<void> {
  await client.delete(`/api/proveedores/${id}/`)
}

export const proveedoresApi = {
  obtenerProveedores,
  buscarProveedores,
  obtenerProveedor,
  crearProveedor,
  actualizarProveedor,
  eliminarProveedor,
}
