import { client } from './client'
import { fetchAllPages, obtenerListaDesdeRespuesta, esRespuestaPaginada, type ListResponse } from './pagination'
import type { ListParams } from '../types/api'
import type { Asignatura, Carrera, Categoria, ResumenImportacion, TipoEquipo, TipoEquipoInput, Ubicacion } from '../types/catalogo'

export { obtenerListaDesdeRespuesta, esRespuestaPaginada }

export type RespuestaListaCatalogo<T> = ListResponse<T>

async function obtenerResultadosCatalogo<T>(endpoint: string, params?: ListParams): Promise<T[]> {
  return fetchAllPages<T>(endpoint, params)
}

export function obtenerCategorias(params?: ListParams): Promise<Categoria[]> {
  return obtenerResultadosCatalogo<Categoria>('/api/categorias/', params)
}

export function obtenerCarreras(params?: ListParams): Promise<Carrera[]> {
  return obtenerResultadosCatalogo<Carrera>('/api/carreras/', params)
}

export function obtenerAsignaturas(params?: ListParams): Promise<Asignatura[]> {
  return obtenerResultadosCatalogo<Asignatura>('/api/asignaturas/', params)
}

export function obtenerUbicaciones(params?: ListParams): Promise<Ubicacion[]> {
  return obtenerResultadosCatalogo<Ubicacion>('/api/ubicaciones/', params)
}

export function obtenerTiposEquipo(params?: ListParams): Promise<TipoEquipo[]> {
  return obtenerResultadosCatalogo<TipoEquipo>('/api/tipos-equipo/', params)
}

export function buscarTiposEquipo(search: string): Promise<TipoEquipo[]> {
  return obtenerResultadosCatalogo<TipoEquipo>('/api/tipos-equipo/', { search })
}

export async function crearTipoEquipo(input: TipoEquipoInput): Promise<TipoEquipo> {
  const { data } = await client.post<TipoEquipo>('/api/tipos-equipo/', input)
  return data
}

export async function actualizarTipoEquipo(id: number, input: TipoEquipoInput): Promise<TipoEquipo> {
  const { data } = await client.put<TipoEquipo>(`/api/tipos-equipo/${id}/`, input)
  return data
}

export async function importarEstandar(archivo: File): Promise<ResumenImportacion> {
  const formData = new FormData()
  formData.append('archivo', archivo)

  const { data } = await client.post<ResumenImportacion>('/api/catalogo/importar-estandar/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

  return data
}

export const catalogoApi = {
  obtenerCategorias,
  obtenerCarreras,
  obtenerAsignaturas,
  obtenerUbicaciones,
  obtenerTiposEquipo,
  buscarTiposEquipo,
  crearTipoEquipo,
  actualizarTipoEquipo,
  importarEstandar,
}
