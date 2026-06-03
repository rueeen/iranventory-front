import type { Asignatura, TipoEquipo } from './catalogo'
import type { EstadoUnidad, Unidad } from './inventario'

export type EstadoPrestamo =
  | 'SOLICITADA'
  | 'APROBADA'
  | 'PREPARADA'
  | 'ENTREGADA'
  | 'DEVOLUCION'
  | 'CERRADA'
  | 'RECHAZADA'

export type DetallePrestamo = {
  id: number
  tipo_equipo: TipoEquipo
  unidad: Unidad | null
  cantidad: number
  cantidad_devuelta: number
  cantidad_no_devuelta: number
  condicion_devolucion: EstadoUnidad
  observaciones: string
}

export type DetallePrestamoInput = {
  tipo_equipo_id: number
  unidad_id?: number | null
  cantidad?: number
  observaciones?: string
}

export type Prestamo = {
  id: number
  solicitante: number
  asignatura: Asignatura | null
  estado: EstadoPrestamo
  fecha_solicitud: string
  fecha_requerida: string | null
  fecha_devolucion_comprometida: string | null
  aprobado_por: number | null
  preparado_por: number | null
  entregado_por: number | null
  cerrado_por: number | null
  motivo_rechazo: string
  observaciones: string
  detalles: DetallePrestamo[]
}

export type PrestamoInput = {
  asignatura_id?: number | null
  fecha_requerida?: string | null
  fecha_devolucion_comprometida?: string | null
  observaciones?: string
  detalles?: DetallePrestamoInput[]
}

export type RegistrarDevolucionItem = {
  id: number
  cantidad_devuelta: number
  cantidad_no_devuelta: number
  condicion?: EstadoUnidad
}
