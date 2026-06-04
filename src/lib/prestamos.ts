import { clasesInacap } from './theme'
import type { EstadoUnidad } from '../types/inventario'
import type { EstadoPrestamo, Prestamo } from '../types/prestamos'

export const PRESTAMOS_PAGE_SIZE = 25

export const estadosPrestamo: EstadoPrestamo[] = [
  'SOLICITADA',
  'APROBADA',
  'PREPARADA',
  'ENTREGADA',
  'DEVOLUCION',
  'CERRADA',
  'RECHAZADA',
  'CANCELADA',
]

export const condicionesDevolucion: EstadoUnidad[] = ['BUENO', 'REPARABLE', 'MALO']

export const etiquetasEstado: Record<EstadoPrestamo, string> = {
  SOLICITADA: 'Solicitada',
  APROBADA: 'Aprobada',
  PREPARADA: 'Preparada',
  ENTREGADA: 'Entregada',
  DEVOLUCION: 'Devolución',
  CERRADA: 'Cerrada',
  RECHAZADA: 'Rechazada',
  CANCELADA: 'Cancelada',
}

export const etiquetasCondicion: Record<EstadoUnidad, string> = {
  BUENO: 'Bueno',
  REPARABLE: 'Reparable',
  MALO: 'Malo',
}

export const estilosEstado: Record<EstadoPrestamo, string> = {
  SOLICITADA: clasesInacap.chipInformacion,
  APROBADA: clasesInacap.chipInformacion,
  PREPARADA: clasesInacap.chipInformacion,
  ENTREGADA: clasesInacap.chipAdvertencia,
  DEVOLUCION: clasesInacap.chipAdvertencia,
  CERRADA: clasesInacap.chipExito,
  RECHAZADA: clasesInacap.chipError,
  CANCELADA: 'bg-slate-100 text-slate-700 ring-slate-300',
}

export type AccionPrestamo = 'aprobar' | 'rechazar' | 'preparar' | 'entregar' | 'iniciar-devolucion' | 'cerrar' | 'cancelar'

export function accionesDisponibles(estado: EstadoPrestamo): AccionPrestamo[] {
  switch (estado) {
    case 'SOLICITADA':
      return ['aprobar', 'rechazar']
    case 'APROBADA':
      return ['preparar', 'cancelar']
    case 'PREPARADA':
      return ['entregar', 'cancelar']
    case 'ENTREGADA':
      return ['iniciar-devolucion']
    case 'DEVOLUCION':
      return ['cerrar']
    case 'CERRADA':
    case 'RECHAZADA':
    case 'CANCELADA':
      return []
  }
}

export function formatearFecha(fecha: string | null): string {
  if (!fecha) {
    return 'Sin fecha'
  }

  const date = new Date(fecha)

  if (Number.isNaN(date.getTime())) {
    return fecha
  }

  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'medium',
    timeStyle: fecha.includes('T') ? 'short' : undefined,
  }).format(date)
}

export function formatearFechaCorta(fecha: string | null): string {
  if (!fecha) {
    return 'Sin fecha'
  }

  const date = new Date(fecha)

  if (Number.isNaN(date.getTime())) {
    return fecha
  }

  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'short',
    timeStyle: fecha.includes('T') ? 'short' : undefined,
  }).format(date)
}

export function formatearTexto(valor: string | null | undefined, fallback = 'Sin observaciones'): string {
  return valor?.trim() ? valor : fallback
}

export function obtenerNombreSolicitante(prestamo: Prestamo): string {
  if (typeof prestamo.solicitante === 'number') {
    return `Usuario #${prestamo.solicitante}`
  }

  const nombreCompleto = [prestamo.solicitante.first_name, prestamo.solicitante.last_name]
    .filter(Boolean)
    .join(' ')
    .trim()

  return nombreCompleto || prestamo.solicitante.username || `Usuario #${prestamo.solicitante.id}`
}

export function obtenerUsernameSolicitante(prestamo: Prestamo): string {
  if (typeof prestamo.solicitante === 'number') {
    return `#${prestamo.solicitante}`
  }

  return prestamo.solicitante.username || `#${prestamo.solicitante.id}`
}
