import type { EstadoUnidad } from './inventario'

export type FrecuenciaMantencion = 'MENSUAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL'
export type PrioridadMantencion = 'BAJA' | 'MEDIA' | 'ALTA'
export type EstadoPlan = 'VENCIDO' | 'PROXIMO' | 'AL_DIA' | 'INACTIVO'
export type TipoMantencion = 'PREVENTIVO' | 'CORRECTIVO'

export type UnidadPlan = {
  id: number
  codigo_activo: string | null
  codigo_peoplesoft: string | null
  tipo_equipo_nombre: string
  especificacion: string
  ubicacion: string | null
}
export type PlanMantencion = {
  id: number
  unidad: UnidadPlan
  actividad: string
  frecuencia: FrecuenciaMantencion
  prioridad: PrioridadMantencion
  responsable: string
  fecha_ultima_mantencion: string | null
  fecha_proxima_mantencion: string | null
  estado_plan: EstadoPlan
  activo: boolean
  observaciones: string
}
export type PlanMantencionInput = {
  unidad_id: number
  actividad: string
  frecuencia: FrecuenciaMantencion
  prioridad: PrioridadMantencion
  responsable: string
  fecha_ultima_mantencion?: string | null
  activo: boolean
  observaciones: string
}
export type UnidadRegistro = {
  id: number
  codigo_activo: string | null
  codigo_peoplesoft: string | null
  tipo_equipo_nombre: string
}

export type RegistroMantencion = {
  id: number
  unidad: number
  unidad_detalle: UnidadRegistro
  plan: number | null
  tipo: TipoMantencion
  fecha_solicitud: string | null
  fecha_realizacion: string
  descripcion: string
  empresa: string
  proveedor: { id: number; nombre: string } | null
  orden_compra: { id: number; numero: string } | null
  numero_orden_compra: string
  costo: string
  realizado_por: string
  estado_resultante: EstadoUnidad | ''
  registrado_por: number | null
  created_at: string
}
export type RegistroMantencionInput = Pick<RegistroMantencion,
  'unidad' | 'plan' | 'tipo' | 'fecha_solicitud' | 'fecha_realizacion' | 'descripcion' |
  'empresa' | 'numero_orden_compra' | 'costo' | 'realizado_por' | 'estado_resultante'
> & { proveedor_id?: number | null; orden_compra_id?: number | null }
export type ResumenMantencion = {
  vencidos: number
  proximos_30_dias: number
  al_dia: number
  total_activos: number
}
export type ResumenImportacionPlan = {
  planes_creados: number
  planes_actualizados: number
  unidades_creadas: number
  tipos_creados: number
  codigos_peoplesoft_completados: number
  no_encontrados: { fila: number; codigo_activo: string; codigo_peoplesoft: string; equipo: string }[]
  advertencias: string[]
  simulado: boolean
}
export type FichaMantencion = {
  area: string
  sede: string
  nombre_equipo: string
  tipo_equipo: string
  fecha_solicitud_mantenimiento: string | null
  marca: string
  modelo: string
  ubicacion: string
  serie: string
  codigo_inventario: string
  codigo_peoplesoft: string | null
  codigo_proyecto: string
  periodo_calibracion: string
  registros: (Pick<RegistroMantencion, 'fecha_realizacion' | 'descripcion' | 'empresa' |
    'costo' | 'tipo' | 'realizado_por'> & { orden_compra: string })[]
}
