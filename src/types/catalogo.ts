export type Categoria = {
  id: number
  nombre: string
}

export type Carrera = {
  id: number
  nombre: string
}

export type Asignatura = {
  id: number
  codigo: string
  nombre: string
}

export type Ubicacion = {
  id: number
  nombre: string
  sede: string
}

export type TipoSeguimiento = 'SERIE' | 'GRANEL'

export type TipoEquipo = {
  id: number
  nombre: string
  especificacion: string
  categoria: Categoria | null
  carreras: Carrera[]
  asignaturas: Asignatura[]
  ubicacion_default: Ubicacion | null
  tipo_seguimiento: TipoSeguimiento
  valor_uf: string
  cantidad_necesaria: number
  stock_granel: number
  stock_total: number
  stock_disponible: number
  brecha: number
  observaciones: string
}

export type TipoEquipoInput = {
  nombre: string
  especificacion?: string
  categoria_id?: number | null
  carreras_ids?: number[]
  asignaturas_ids?: number[]
  ubicacion_default_id?: number | null
  tipo_seguimiento: TipoSeguimiento
  valor_uf?: string
  cantidad_necesaria?: number
  stock_granel?: number
  observaciones?: string
}
