import { client } from './client'
import type { ListParams, Paginated } from '../types/api'
import type { Asignatura, Carrera, Categoria, TipoEquipo, TipoEquipoInput, Ubicacion } from '../types/catalogo'

export type RespuestaListaCatalogo<T> = Paginated<T> | T[]

export function esRespuestaPaginada<T>(
  response: RespuestaListaCatalogo<T>,
): response is Paginated<T> {
  return !Array.isArray(response) && Array.isArray(response.results)
}

export function obtenerListaDesdeRespuesta<T>(response: RespuestaListaCatalogo<T>): T[] {
  return esRespuestaPaginada(response) ? response.results : response
}

async function obtenerListaCatalogo<T>(
  endpoint: string,
  params?: ListParams,
): Promise<RespuestaListaCatalogo<T>> {
  const { data } = await client.get<RespuestaListaCatalogo<T>>(endpoint, { params })
  return data
}

async function obtenerResultadosCatalogo<T>(endpoint: string, params?: ListParams): Promise<T[]> {
  const response = await obtenerListaCatalogo<T>(endpoint, params)
  return obtenerListaDesdeRespuesta(response)
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

export async function crearTipoEquipo(input: TipoEquipoInput): Promise<TipoEquipo> {
  const { data } = await client.post<TipoEquipo>('/api/tipos-equipo/', input)
  return data
}

export async function actualizarTipoEquipo(id: number, input: TipoEquipoInput): Promise<TipoEquipo> {
  const { data } = await client.put<TipoEquipo>(`/api/tipos-equipo/${id}/`, input)
  return data
}

export const catalogoApi = {
  obtenerCategorias,
  obtenerCarreras,
  obtenerAsignaturas,
  obtenerUbicaciones,
  obtenerTiposEquipo,
  crearTipoEquipo,
  actualizarTipoEquipo,
}
