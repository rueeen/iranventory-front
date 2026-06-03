import { client } from './client'
import { obtenerListaDesdeRespuesta, type RespuestaListaCatalogo } from './catalogo'
import type { ListParams } from '../types/api'
import type { Proveedor, ProveedorInput } from '../types/compras'

export type ProveedoresFiltros = {
  search?: string
  activo?: boolean | ''
}

type RespuestaListaProveedores = RespuestaListaCatalogo<Proveedor>

function construirParams(filtros?: ProveedoresFiltros): ListParams {
  const params: ListParams = {}
  const search = filtros?.search?.trim()

  if (search) params.search = search
  if (typeof filtros?.activo === 'boolean') params.activo = filtros.activo

  return params
}

export async function obtenerProveedores(filtros?: ProveedoresFiltros): Promise<Proveedor[]> {
  const { data } = await client.get<RespuestaListaProveedores>('/api/proveedores/', {
    params: construirParams(filtros),
  })
  return obtenerListaDesdeRespuesta(data)
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
