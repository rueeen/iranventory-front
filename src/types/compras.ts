import type { TipoEquipo, Ubicacion } from './catalogo'

export type EstadoOrdenCompra = 'BORRADOR' | 'EN_REVISION' | 'ACEPTADA' | 'RECHAZADA'

export type Proveedor = {
  id: number
  razon_social: string
  rut: string
  direccion: string
  ciudad: string
  contacto_nombre: string
  contacto_telefono: string
  email: string
  activo: boolean
  created_at: string
  updated_at: string
}

export type ProveedorInput = {
  razon_social: string
  rut: string
  direccion?: string
  ciudad?: string
  contacto_nombre?: string
  contacto_telefono?: string
  email?: string
  activo?: boolean
}

export type ItemOrdenCompra = {
  id: number
  tipo_equipo: TipoEquipo
  codigo_material: string
  unidad_medida: string
  precio_unitario: string
  cantidad_solicitada: number
  cantidad_recibida: number
  pendiente: number
  total_linea: string
  codigos_activo: string[]
  ubicacion: Ubicacion | null
  observaciones: string
}

export type ItemOrdenCompraInput = {
  tipo_equipo_id: number
  codigo_material?: string
  unidad_medida?: string
  precio_unitario: string
  cantidad_solicitada: number
  cantidad_recibida?: number
  codigos_activo?: string[]
  ubicacion_id?: number | null
  observaciones?: string
}

export type ItemOrdenCompraCreateInput = ItemOrdenCompraInput & {
  orden_compra_id: number
  orden_compra?: number
}

export type ItemOrdenCompraUpdateInput = Partial<ItemOrdenCompraInput>

export type OrdenCompra = {
  id: number
  numero: string
  proveedor: Proveedor | null
  numero_inacap: string
  numero_documento: string
  fecha_documento: string | null
  fecha_publicacion: string | null
  fecha_emision: string | null
  sede_destino: string
  direccion_despacho: string
  recibido_por_nombre: string
  comprador_nombre: string
  referencia_pedido: string
  codigo_inversion: string
  tasa_iva: string
  descuentos: string
  subtotal_neto: string
  monto_afecto: string
  iva: string
  total_general: string
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
  proveedor_id?: number | null
  numero_inacap?: string
  numero_documento?: string
  fecha_documento?: string | null
  fecha_publicacion?: string | null
  fecha_emision?: string | null
  sede_destino?: string
  direccion_despacho?: string
  recibido_por_nombre?: string
  comprador_nombre?: string
  referencia_pedido?: string
  codigo_inversion?: string
  tasa_iva?: string
  descuentos?: string
  observaciones?: string
  items?: ItemOrdenCompraInput[]
}

export type AccionRechazarOrdenCompraInput = {
  observacion?: string
  observaciones?: string
  motivo?: string
}
