import type { TipoEquipo, Ubicacion } from './catalogo'

export type EstadoUnidad = 'BUENO' | 'REPARABLE' | 'MALO'

export type SituacionUnidad = 'DISPONIBLE' | 'RESERVADA' | 'PRESTADA' | 'REPARACION' | 'BAJA'

export type DatosTecnicosUnidad = {
  codigo_peoplesoft?: string | null
  marca?: string
  modelo?: string
  numero_serie?: string
  codigo_proyecto?: string
  periodo_calibracion?: string
}

export type Unidad = DatosTecnicosUnidad & {
  id: number
  tipo_equipo: TipoEquipo
  codigo_activo: string | null
  estado: EstadoUnidad
  situacion: SituacionUnidad
  ubicacion: Ubicacion | null
  requiere_revision: boolean
}

export type UnidadInput = DatosTecnicosUnidad & {
  tipo_equipo_id: number
  codigo_activo?: string | null
  estado?: EstadoUnidad
  situacion?: SituacionUnidad
  ubicacion_id?: number | null
  requiere_revision?: boolean
}
