import { clasesInacap } from './theme'
import type { EstadoPlan, FrecuenciaMantencion, PrioridadMantencion, TipoMantencion } from '../types/mantencion'

export { formatearFechaCorta } from './prestamos'
export { formatearCLP } from './moneda'
export const etiquetasEstadoPlan: Record<EstadoPlan, string> = {
  VENCIDO: 'Vencido', PROXIMO: 'Próximo', AL_DIA: 'Al día', INACTIVO: 'Inactivo',
}
export const estilosEstadoPlan: Record<EstadoPlan, string> = {
  VENCIDO: clasesInacap.chipError, PROXIMO: clasesInacap.chipAdvertencia,
  AL_DIA: clasesInacap.chipExito, INACTIVO: 'bg-slate-100 text-slate-700 ring-slate-300',
}
export const etiquetasFrecuencia: Record<FrecuenciaMantencion, string> = {
  MENSUAL: 'Mensual', TRIMESTRAL: 'Trimestral', SEMESTRAL: 'Semestral', ANUAL: 'Anual',
}
export const etiquetasPrioridad: Record<PrioridadMantencion, string> = { ALTA: 'Alta', MEDIA: 'Media', BAJA: 'Baja' }
export const estilosPrioridad: Record<PrioridadMantencion, string> = {
  ALTA: clasesInacap.chipError, MEDIA: clasesInacap.chipAdvertencia, BAJA: clasesInacap.chipInformacion,
}
export const etiquetasTipoMantencion: Record<TipoMantencion, string> = { PREVENTIVO: 'Preventivo', CORRECTIVO: 'Correctivo' }
export const estilosTipoMantencion: Record<TipoMantencion, string> = {
  PREVENTIVO: clasesInacap.chipInformacion, CORRECTIVO: clasesInacap.chipAdvertencia,
}
export function fechaHoy(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
