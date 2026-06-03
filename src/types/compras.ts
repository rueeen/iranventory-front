import type { TipoEquipo, Ubicacion } from './catalogo'

export type EstadoOrdenCompra = 'BORRADOR' | 'EN_REVISION' | 'ACEPTADA' | 'RECHAZADA'

export type ItemOrdenCompra = {
  id: number
  tipo_equipo: TipoEquipo
  cantidad_solicitada: number
  cantidad_recibida: number
  pendiente: number
  codigos_activo: string[]
  ubicacion: Ubicacion | null
  observaciones: string
}

export type ItemOrdenCompraInput = {
  tipo_equipo_id: number
  cantidad_solicitada: number
  cantidad_recibida?: number
  codigos_activo?: string[]
  ubicacion_id?: number | null
  observaciones?: string
}

export type OrdenCompra = {
  id: number
  numero: string
  proveedor: string
  numero_documento: string
  fecha_documento: string | null
  estado: EstadoOrdenCompra
  observaciones: string
  creado_por: number | null
  revisado_por: number | null
  fecha_revision: string | null
  created_at: string
  updated_at: string
  es_editable: boolean
  tiene_items_pendientes: boolean
  items?: ItemOrdenCompra[]
}

export type OrdenCompraInput = {
  proveedor?: string
  numero_documento?: string
  fecha_documento?: string | null
  observaciones?: string
  items?: ItemOrdenCompraInput[]
}
