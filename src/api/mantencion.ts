import { client } from './client'
import type { ListParams, Paginated } from '../types/api'
import type {
  EstadoPlan, FrecuenciaMantencion, PrioridadMantencion, TipoMantencion,
  PlanMantencion, PlanMantencionInput, RegistroMantencion, RegistroMantencionInput,
  ResumenMantencion, ResumenImportacionPlan, FichaMantencion,
} from '../types/mantencion'

export type PlanesMantencionFiltros = ListParams & {
  estado_plan?: EstadoPlan | ''
  prioridad?: PrioridadMantencion | ''
  frecuencia?: FrecuenciaMantencion | ''
  activo?: boolean
  unidad?: number
  ordering?: string
}
export type RegistrosMantencionFiltros = ListParams & {
  unidad?: number
  plan?: number
  tipo?: TipoMantencion | ''
  fecha_desde?: string
  fecha_hasta?: string
}
function params(filtros?: ListParams) {
  return Object.fromEntries(Object.entries(filtros ?? {}).filter(([, v]) => v !== '' && v !== undefined))
}
export async function obtenerPlanesMantencion(filtros?: PlanesMantencionFiltros): Promise<Paginated<PlanMantencion>> {
  return (await client.get('/api/planes-mantencion/', { params: params(filtros) })).data
}
export async function obtenerPlanMantencion(id: number): Promise<PlanMantencion> {
  return (await client.get(`/api/planes-mantencion/${id}/`)).data
}
export async function crearPlanMantencion(input: PlanMantencionInput): Promise<PlanMantencion> {
  return (await client.post('/api/planes-mantencion/', input)).data
}
export async function actualizarPlanMantencion(id: number, input: Partial<PlanMantencionInput>): Promise<PlanMantencion> {
  return (await client.patch(`/api/planes-mantencion/${id}/`, input)).data
}
export async function eliminarPlanMantencion(id: number): Promise<void> {
  await client.delete(`/api/planes-mantencion/${id}/`)
}
export async function obtenerResumenMantencion(): Promise<ResumenMantencion> {
  return (await client.get('/api/planes-mantencion/resumen/')).data
}
export async function exportarPlanMantencion(filtros?: PlanesMantencionFiltros): Promise<void> {
  const { data, headers } = await client.get<Blob>('/api/planes-mantencion/exportar/', {
    params: params(filtros), responseType: 'blob',
  })
  const disposition = String(headers['content-disposition'] ?? '')
  const utf8 = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  const plain = disposition.match(/filename="?([^";]+)"?/i)
  let nombre = plain?.[1] ?? `Plan_de_Mantencion_${new Date().toISOString().slice(0, 10)}.xlsx`
  if (utf8) {
    try { nombre = decodeURIComponent(utf8[1]) } catch { /* Usar nombre simple si está mal codificado. */ }
  }
  const url = URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre.replace(/[\\/]/g, '_')
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export async function importarPlanMantencion(archivo: File, opciones: { simular: boolean; crearFaltantes: boolean }): Promise<ResumenImportacionPlan> {
  const body = new FormData()
  body.append('archivo', archivo)
  body.append('simular', String(opciones.simular))
  body.append('crear_faltantes', String(opciones.crearFaltantes))
  return (await client.post('/api/planes-mantencion/importar/', body)).data
}
export async function obtenerRegistrosMantencion(filtros?: RegistrosMantencionFiltros): Promise<Paginated<RegistroMantencion>> {
  return (await client.get('/api/registros-mantencion/', { params: params(filtros) })).data
}
export async function obtenerRegistroMantencion(id: number): Promise<RegistroMantencion> {
  return (await client.get(`/api/registros-mantencion/${id}/`)).data
}
export async function crearRegistroMantencion(input: RegistroMantencionInput): Promise<RegistroMantencion> {
  return (await client.post('/api/registros-mantencion/', input)).data
}
export async function actualizarRegistroMantencion(id: number, input: Partial<RegistroMantencionInput>): Promise<RegistroMantencion> {
  return (await client.patch(`/api/registros-mantencion/${id}/`, input)).data
}
export async function eliminarRegistroMantencion(id: number): Promise<void> {
  await client.delete(`/api/registros-mantencion/${id}/`)
}
export async function obtenerFichaMantencion(unidadId: number): Promise<FichaMantencion> {
  return (await client.get(`/api/unidades/${unidadId}/ficha-mantencion/`)).data
}
export const mantencionApi = {
  obtenerPlanesMantencion, obtenerPlanMantencion, crearPlanMantencion, actualizarPlanMantencion,
  eliminarPlanMantencion, obtenerResumenMantencion, exportarPlanMantencion, importarPlanMantencion,
  obtenerRegistrosMantencion, obtenerRegistroMantencion, crearRegistroMantencion,
  actualizarRegistroMantencion, eliminarRegistroMantencion, obtenerFichaMantencion,
}
