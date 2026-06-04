import type { TipoEquipo, Ubicacion } from './catalogo'

export type EstadoUnidad = 'BUENO' | 'REPARABLE' | 'MALO'

export type SituacionUnidad = 'DISPONIBLE' | 'RESERVADA' | 'PRESTADA' | 'REPARACION' | 'BAJA'

export type Unidad = {
  id: number
  tipo_equipo: TipoEquipo
  codigo_activo: string | null
  estado: EstadoUnidad
  situacion: SituacionUnidad
  ubicacion: Ubicacion | null
  requiere_revision: boolean
}

export type UnidadInput = {
  tipo_equipo_id: number
  codigo_activo?: string | null
  estado?: EstadoUnidad
  situacion?: SituacionUnidad
  ubicacion_id?: number | null
  requiere_revision?: boolean
}
