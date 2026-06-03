import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { catalogoApi } from '../api/catalogo'
import { comprasApi, type ComprasFiltros } from '../api/compras'
import { proveedoresApi } from '../api/proveedores'
import { AsyncCombobox } from '../components/AsyncCombobox'
import { tieneRol, useAuth } from '../features/auth/AuthContext'
import { calcularTotalesOrdenCompra, formatearCLP } from '../lib/moneda'
import { queryKeys } from '../lib/queryKeys'
import { clasesInacap } from '../lib/theme'
import { extractApiErrorMessage } from '../types/api'
import type { TipoEquipo, Ubicacion } from '../types/catalogo'
import type {
  EstadoOrdenCompra,
  ItemOrdenCompra,
  ItemOrdenCompraCreateInput,
  ItemOrdenCompraInput,
  ItemOrdenCompraUpdateInput,
  OrdenCompra,
  OrdenCompraInput,
  Proveedor,
  ProveedorInput,
} from '../types/compras'

const estadosOrdenCompra: EstadoOrdenCompra[] = ['BORRADOR', 'EN_REVISION', 'ACEPTADA', 'RECHAZADA']

type OrdenFormMode = { mode: 'create' } | { mode: 'edit'; orden: OrdenCompra }
type ItemFormMode = { mode: 'create'; orden: OrdenCompra } | { mode: 'edit'; orden: OrdenCompra; item: ItemOrdenCompra }
type AccionFlujo = 'enviar-revision' | 'aceptar' | 'rechazar'

type OrdenFormState = {
  proveedorId: string
  proveedor: Proveedor | null
  numeroInacap: string
  numeroDocumento: string
  fechaDocumento: string
  fechaPublicacion: string
  fechaEmision: string
  sedeDestino: string
  direccionDespacho: string
  recibidoPorNombre: string
  compradorNombre: string
  referenciaPedido: string
  codigoInversion: string
  tasaIva: string
  descuentos: string
  observaciones: string
}

type ItemFormState = {
  tipoEquipoId: string
  tipoEquipo: TipoEquipo | null
  codigoMaterial: string
  unidadMedida: string
  precioUnitario: string
  cantidadSolicitada: string
  cantidadRecibida: string
  codigosActivo: string
  ubicacionId: string
  observaciones: string
}

type ProveedorFormState = {
  razon_social: string
  rut: string
  direccion: string
  ciudad: string
  contacto_nombre: string
  contacto_telefono: string
  email: string
}

type AccionPendiente = {
  orden: OrdenCompra
  accion: AccionFlujo
}

const etiquetasEstado: Record<EstadoOrdenCompra, string> = {
  BORRADOR: 'Borrador',
  EN_REVISION: 'En revisión',
  ACEPTADA: 'Aceptada',
  RECHAZADA: 'Rechazada',
}

const estilosEstado: Record<EstadoOrdenCompra, string> = {
  BORRADOR: 'bg-slate-100 text-slate-700 ring-slate-200',
  EN_REVISION: clasesInacap.chipAdvertencia,
  ACEPTADA: clasesInacap.chipExito,
  RECHAZADA: clasesInacap.chipError,
}

const emptyItemForm: ItemFormState = {
  tipoEquipoId: '',
  tipoEquipo: null,
  codigoMaterial: '',
  unidadMedida: 'UNI',
  precioUnitario: '0',
  cantidadSolicitada: '1',
  cantidadRecibida: '0',
  codigosActivo: '',
  ubicacionId: '',
  observaciones: '',
}

const emptyProveedorForm: ProveedorFormState = {
  razon_social: '',
  rut: '',
  direccion: '',
  ciudad: '',
  contacto_nombre: '',
  contacto_telefono: '',
  email: '',
}

function formatearFecha(fecha: string | null): string {
  if (!fecha) return 'Sin fecha'
  const date = new Date(fecha)
  if (Number.isNaN(date.getTime())) return fecha
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium' }).format(date)
}

function formatearTexto(valor: string | null | undefined, reemplazo = 'Sin información'): string {
  return valor?.trim() ? valor : reemplazo
}

function normalizarTexto(valor: string): string {
  return valor.toLocaleLowerCase('es-CL').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function proveedorLabel(proveedor: Proveedor | null | undefined): string {
  if (!proveedor) return 'Sin proveedor'
  return `${proveedor.razon_social} (${proveedor.rut})`
}

function ordenCoincideConBusqueda(orden: OrdenCompra, busqueda: string): boolean {
  const termino = normalizarTexto(busqueda.trim())
  if (!termino) return true

  const valores = [
    String(orden.id),
    orden.numero,
    proveedorLabel(orden.proveedor),
    orden.numero_inacap,
    orden.numero_documento,
    orden.sede_destino,
    orden.referencia_pedido,
    orden.estado,
    orden.fecha_documento ?? '',
    orden.observaciones,
    orden.items?.map((item) => `${item.tipo_equipo.nombre} ${item.codigo_material}`).join(' ') ?? '',
  ]

  return valores.some((valor) => normalizarTexto(valor).includes(termino))
}

function crearOrdenFormState(orden?: OrdenCompra): OrdenFormState {
  return {
    proveedorId: orden?.proveedor ? String(orden.proveedor.id) : '',
    proveedor: orden?.proveedor ?? null,
    numeroInacap: orden?.numero_inacap ?? '',
    numeroDocumento: orden?.numero_documento ?? '',
    fechaDocumento: orden?.fecha_documento ?? '',
    fechaPublicacion: orden?.fecha_publicacion ?? '',
    fechaEmision: orden?.fecha_emision ?? '',
    sedeDestino: orden?.sede_destino ?? '',
    direccionDespacho: orden?.direccion_despacho ?? '',
    recibidoPorNombre: orden?.recibido_por_nombre ?? '',
    compradorNombre: orden?.comprador_nombre ?? '',
    referenciaPedido: orden?.referencia_pedido ?? '',
    codigoInversion: orden?.codigo_inversion ?? '',
    tasaIva: orden?.tasa_iva ?? '19',
    descuentos: orden?.descuentos ?? '0',
    observaciones: orden?.observaciones ?? '',
  }
}

function crearItemFormState(item?: ItemOrdenCompra): ItemFormState {
  return item
    ? {
        tipoEquipoId: String(item.tipo_equipo.id),
        tipoEquipo: item.tipo_equipo,
        codigoMaterial: item.codigo_material ?? '',
        unidadMedida: item.unidad_medida || 'UNI',
        precioUnitario: item.precio_unitario ?? '0',
        cantidadSolicitada: String(item.cantidad_solicitada),
        cantidadRecibida: String(item.cantidad_recibida),
        codigosActivo: item.codigos_activo.join('\n'),
        ubicacionId: item.ubicacion ? String(item.ubicacion.id) : '',
        observaciones: item.observaciones ?? '',
      }
    : { ...emptyItemForm }
}

function construirOrdenInput(form: OrdenFormState): OrdenCompraInput {
  return {
    proveedor_id: form.proveedorId ? Number(form.proveedorId) : null,
    numero_inacap: form.numeroInacap.trim(),
    numero_documento: form.numeroDocumento.trim(),
    fecha_documento: form.fechaDocumento || null,
    fecha_publicacion: form.fechaPublicacion || null,
    fecha_emision: form.fechaEmision || null,
    sede_destino: form.sedeDestino.trim(),
    direccion_despacho: form.direccionDespacho.trim(),
    recibido_por_nombre: form.recibidoPorNombre.trim(),
    comprador_nombre: form.compradorNombre.trim(),
    referencia_pedido: form.referenciaPedido.trim(),
    codigo_inversion: form.codigoInversion.trim(),
    tasa_iva: form.tasaIva || '19',
    descuentos: form.descuentos || '0',
    observaciones: form.observaciones.trim(),
  }
}

function construirItemInput(form: ItemFormState): ItemOrdenCompraInput {
  return {
    tipo_equipo_id: Number(form.tipoEquipoId),
    codigo_material: form.codigoMaterial.trim(),
    unidad_medida: form.unidadMedida.trim() || 'UNI',
    precio_unitario: form.precioUnitario || '0',
    cantidad_solicitada: Number(form.cantidadSolicitada || 0),
    cantidad_recibida: Number(form.cantidadRecibida || 0),
    codigos_activo: form.codigosActivo
      .split(/[\n,]/)
      .map((codigo) => codigo.trim())
      .filter(Boolean),
    ubicacion_id: form.ubicacionId ? Number(form.ubicacionId) : null,
    observaciones: form.observaciones.trim(),
  }
}

function construirProveedorInput(form: ProveedorFormState): ProveedorInput {
  return {
    razon_social: form.razon_social.trim(),
    rut: form.rut.trim(),
    direccion: form.direccion.trim(),
    ciudad: form.ciudad.trim(),
    contacto_nombre: form.contacto_nombre.trim(),
    contacto_telefono: form.contacto_telefono.trim(),
    email: form.email.trim(),
    activo: true,
  }
}

function validarItem(form: ItemFormState): string | null {
  if (!form.tipoEquipoId || !form.tipoEquipo) return 'Selecciona un tipo de equipo.'
  const solicitada = Number(form.cantidadSolicitada)
  const recibida = Number(form.cantidadRecibida)
  const precio = Number(String(form.precioUnitario).replace(',', '.'))
  if (!Number.isFinite(solicitada) || solicitada < 1) return 'La cantidad solicitada debe ser mayor a cero.'
  if (!Number.isFinite(recibida) || recibida < 0) return 'La cantidad recibida no puede ser negativa.'
  if (recibida > solicitada) return 'La cantidad recibida no puede superar la solicitada.'
  if (!Number.isFinite(precio) || precio < 0) return 'El precio unitario no puede ser negativo.'

  const codigos = construirItemInput(form).codigos_activo ?? []
  if (form.tipoEquipo.tipo_seguimiento === 'SERIE' && recibida > 0 && codigos.length !== recibida) {
    return 'Para equipos por serie, informa un código de activo por cada unidad recibida antes de aceptar.'
  }

  return null
}

function puedeEditarOrden(orden: OrdenCompra): boolean {
  return orden.estado === 'BORRADOR' && orden.es_editable !== false
}

function ubicacionLabel(ubicacion: Ubicacion | null): string {
  return ubicacion ? `${ubicacion.nombre}${ubicacion.sede ? ` · ${ubicacion.sede}` : ''}` : 'Sin ubicación'
}

function Button({ children, className, disabled, onClick, type = 'button' }: {
  children: ReactNode
  className?: string
  disabled?: boolean
  onClick?: () => void
  type?: 'button' | 'submit'
}) {
  return (
    <button
      className={`rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${className ?? ''}`}
      disabled={disabled}
      onClick={onClick}
      type={type}
    >
      {children}
    </button>
  )
}

function PrimaryButton(props: Omit<Parameters<typeof Button>[0], 'className'>) {
  return <Button {...props} className={clasesInacap.botonPrimario} />
}

function SecondaryButton(props: Omit<Parameters<typeof Button>[0], 'className'>) {
  return <Button {...props} className={clasesInacap.botonSecundario} />
}

function DangerButton(props: Omit<Parameters<typeof Button>[0], 'className'>) {
  return <Button {...props} className="bg-[#DC2626] text-white hover:bg-red-700" />
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="text-sm font-medium text-slate-700">{children}</span>
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-[#DC2626]">
      <p className="font-semibold text-red-950">Error</p>
      <p className="mt-1 leading-6">{message}</p>
    </div>
  )
}

function EstadoBadge({ estado }: { estado: EstadoOrdenCompra }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${estilosEstado[estado]}`}>
      {etiquetasEstado[estado]}
    </span>
  )
}

function CodigosActivo({ codigos }: { codigos: string[] }) {
  if (codigos.length === 0) return <span className="text-slate-500">Sin códigos</span>
  return <span>{codigos.join(', ')}</span>
}

function TotalesPanel({
  descuentos,
  iva,
  montoAfecto,
  subtotalNeto,
  tasaIva,
  totalGeneral,
  titulo,
}: {
  descuentos: string | number
  iva: string | number
  montoAfecto: string | number
  subtotalNeto: string | number
  tasaIva: string | number
  totalGeneral: string | number
  titulo: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</p>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between gap-3"><dt className="text-slate-500">Subtotal neto</dt><dd className="font-semibold text-slate-950">{formatearCLP(subtotalNeto)}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-slate-500">Descuentos</dt><dd className="font-semibold text-slate-950">{formatearCLP(descuentos)}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-slate-500">Monto afecto</dt><dd className="font-semibold text-slate-950">{formatearCLP(montoAfecto)}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-slate-500">IVA ({tasaIva || '0'}%)</dt><dd className="font-semibold text-slate-950">{formatearCLP(iva)}</dd></div>
        <div className="border-t border-slate-200 pt-2 flex justify-between gap-3"><dt className="font-semibold text-slate-700">Total general</dt><dd className="text-lg font-bold text-slate-950">{formatearCLP(totalGeneral)}</dd></div>
      </dl>
    </div>
  )
}

function DatosCabecera({ orden }: { orden: OrdenCompra }) {
  const datos: Array<[string, string]> = [
    ['N° INACAP', orden.numero_inacap],
    ['Documento', orden.numero_documento],
    ['Fecha documento', formatearFecha(orden.fecha_documento)],
    ['Fecha publicación', formatearFecha(orden.fecha_publicacion)],
    ['Fecha emisión', formatearFecha(orden.fecha_emision)],
    ['Sede destino', orden.sede_destino],
    ['Dirección despacho', orden.direccion_despacho],
    ['Recibido por', orden.recibido_por_nombre],
    ['Comprador', orden.comprador_nombre],
    ['Referencia pedido', orden.referencia_pedido],
    ['Código inversión', orden.codigo_inversion],
  ]

  return (
    <dl className="mt-6 grid gap-4 md:grid-cols-3">
      {datos.map(([label, value]) => (
        <div className="rounded-2xl bg-slate-50 p-4" key={label}>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
          <dd className="mt-1 font-medium text-slate-950">{formatearTexto(value, label.includes('Fecha') ? 'Sin fecha' : 'Sin información')}</dd>
        </div>
      ))}
      <div className="rounded-2xl bg-slate-50 p-4">
        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Items</dt>
        <dd className="mt-1 font-medium text-slate-950">{orden.items?.length ?? 0}</dd>
      </div>
    </dl>
  )
}

function ImpactoInventario({ orden, tiposEquipo }: { orden: OrdenCompra; tiposEquipo: TipoEquipo[] }) {
  if (orden.estado !== 'ACEPTADA') return null

  const items = orden.items ?? []
  if (items.length === 0) return null

  return (
    <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#16A34A]">Impacto en inventario</p>
      <ul className="mt-2 space-y-1 text-sm text-green-900">
        {items.map((item) => {
          const tipo = tiposEquipo.find((actual) => actual.id === item.tipo_equipo.id)
          const detalleStock = tipo
            ? tipo.tipo_seguimiento === 'GRANEL'
              ? `Stock granel actual: ${tipo.stock_granel}.`
              : `Stock total actual: ${tipo.stock_total}.`
            : 'Inventario actualizado al aceptar.'

          return (
            <li key={item.id}>
              {item.tipo_equipo.nombre}: +{item.cantidad_recibida} recibido(s). {detalleStock}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function ItemRow({
  item,
  editable,
  onDelete,
  onEdit,
}: {
  item: ItemOrdenCompra
  editable: boolean
  onDelete: (item: ItemOrdenCompra) => void
  onEdit: (item: ItemOrdenCompra) => void
}) {
  return (
    <tr className="align-top">
      <td className="px-4 py-3 font-medium text-slate-950">
        {item.tipo_equipo.nombre}
        <span className="mt-1 block text-xs font-normal text-slate-500">{item.tipo_equipo.tipo_seguimiento}</span>
      </td>
      <td className="px-4 py-3 text-slate-600">{formatearTexto(item.codigo_material, '—')}</td>
      <td className="px-4 py-3 text-slate-600">{formatearTexto(item.unidad_medida, 'UNI')}</td>
      <td className="px-4 py-3 text-slate-600">{formatearCLP(item.precio_unitario)}</td>
      <td className="px-4 py-3 text-slate-600">{item.cantidad_solicitada}</td>
      <td className="px-4 py-3 text-slate-600">{item.cantidad_recibida}</td>
      <td className="px-4 py-3 text-slate-600">{item.pendiente}</td>
      <td className="px-4 py-3 font-semibold text-slate-700">{formatearCLP(item.total_linea)}</td>
      <td className="px-4 py-3 text-slate-600">{ubicacionLabel(item.ubicacion)}</td>
      <td className="px-4 py-3 text-slate-600"><CodigosActivo codigos={item.codigos_activo} /></td>
      <td className="px-4 py-3 text-slate-600">{formatearTexto(item.observaciones, 'Sin observaciones')}</td>
      {editable ? (
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-2">
            <SecondaryButton onClick={() => onEdit(item)}>Editar</SecondaryButton>
            <DangerButton onClick={() => onDelete(item)}>Eliminar</DangerButton>
          </div>
        </td>
      ) : null}
    </tr>
  )
}

function ItemsOrdenCompra({
  orden,
  puedeGestionar,
  onAdd,
  onDelete,
  onEdit,
}: {
  orden: OrdenCompra
  puedeGestionar: boolean
  onAdd: (orden: OrdenCompra) => void
  onDelete: (item: ItemOrdenCompra) => void
  onEdit: (orden: OrdenCompra, item: ItemOrdenCompra) => void
}) {
  const editable = puedeGestionar && puedeEditarOrden(orden)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Items</h3>
        {editable ? <PrimaryButton onClick={() => onAdd(orden)}>Agregar item</PrimaryButton> : null}
      </div>
      {!orden.items?.length ? <p className="text-sm text-slate-500">Sin items informados.</p> : null}
      {orden.items?.length ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Tipo de equipo</th>
                <th className="px-4 py-3 font-semibold">Código material</th>
                <th className="px-4 py-3 font-semibold">Unidad</th>
                <th className="px-4 py-3 font-semibold">Precio unit.</th>
                <th className="px-4 py-3 font-semibold">Solicitada</th>
                <th className="px-4 py-3 font-semibold">Recibida</th>
                <th className="px-4 py-3 font-semibold">Pendiente</th>
                <th className="px-4 py-3 font-semibold">Total línea</th>
                <th className="px-4 py-3 font-semibold">Ubicación</th>
                <th className="px-4 py-3 font-semibold">Códigos activo</th>
                <th className="px-4 py-3 font-semibold">Observaciones</th>
                {editable ? <th className="px-4 py-3 font-semibold">Acciones</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {orden.items.map((item) => (
                <ItemRow
                  editable={editable}
                  item={item}
                  key={item.id}
                  onDelete={onDelete}
                  onEdit={(selected) => onEdit(orden, selected)}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}

function OrdenCompraCard({
  orden,
  tiposEquipo,
  onAction,
  onAddItem,
  onDeleteItem,
  onEditItem,
  onEditOrder,
  puedeGestionar,
  puedeResolverOrden,
}: {
  orden: OrdenCompra
  tiposEquipo: TipoEquipo[]
  onAction: (orden: OrdenCompra, accion: AccionFlujo) => void
  onAddItem: (orden: OrdenCompra) => void
  onDeleteItem: (item: ItemOrdenCompra) => void
  onEditItem: (orden: OrdenCompra, item: ItemOrdenCompra) => void
  onEditOrder: (orden: OrdenCompra) => void
  puedeGestionar: boolean
  puedeResolverOrden: boolean
}) {
  const editable = puedeGestionar && puedeEditarOrden(orden)
  const puedeEnviar = editable && (orden.items?.length ?? 0) > 0
  const estaEnRevision = orden.estado === 'EN_REVISION'
  const puedeResolver = estaEnRevision && puedeResolverOrden

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className={`text-sm font-semibold uppercase tracking-widest ${clasesInacap.textoMarca}`}>Orden de compra #{orden.id}</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{formatearTexto(orden.numero, 'Sin número interno')}</h2>
          <p className="mt-2 text-sm font-medium text-slate-600">Proveedor: {proveedorLabel(orden.proveedor)}</p>
        </div>
        <div className="flex flex-col items-start gap-3 lg:items-end">
          <EstadoBadge estado={orden.estado} />
          <div className="flex flex-wrap justify-end gap-2">
            {editable ? <SecondaryButton onClick={() => onEditOrder(orden)}>Editar orden</SecondaryButton> : null}
            {editable ? <PrimaryButton disabled={!puedeEnviar} onClick={() => onAction(orden, 'enviar-revision')}>Enviar a revisión</PrimaryButton> : null}
            {puedeResolver ? <PrimaryButton onClick={() => onAction(orden, 'aceptar')}>Aceptar</PrimaryButton> : null}
            {puedeResolver ? <DangerButton onClick={() => onAction(orden, 'rechazar')}>Rechazar</DangerButton> : null}
          </div>
          {estaEnRevision && !puedeResolverOrden ? (
            <p className="max-w-xs rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 lg:text-right">
              En revisión — pendiente de aprobación del director.
            </p>
          ) : null}
        </div>
      </div>

      <DatosCabecera orden={orden} />

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Observaciones</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{formatearTexto(orden.observaciones, 'Sin observaciones')}</p>
        </div>
        <TotalesPanel
          descuentos={orden.descuentos}
          iva={orden.iva}
          montoAfecto={orden.monto_afecto}
          subtotalNeto={orden.subtotal_neto}
          tasaIva={orden.tasa_iva}
          totalGeneral={orden.total_general}
          titulo="Montos backend"
        />
      </div>

      <div className="mt-6">
        <ItemsOrdenCompra
          orden={orden}
          puedeGestionar={puedeGestionar}
          onAdd={onAddItem}
          onDelete={onDeleteItem}
          onEdit={onEditItem}
        />
      </div>
      <ImpactoInventario orden={orden} tiposEquipo={tiposEquipo} />
    </article>
  )
}

export function Compras() {
  const { usuario } = useAuth()
  const queryClient = useQueryClient()
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState<EstadoOrdenCompra | ''>('')
  const [ordenFormMode, setOrdenFormMode] = useState<OrdenFormMode | null>(null)
  const [ordenForm, setOrdenForm] = useState<OrdenFormState>(crearOrdenFormState())
  const [itemFormMode, setItemFormMode] = useState<ItemFormMode | null>(null)
  const [itemForm, setItemForm] = useState<ItemFormState>(crearItemFormState())
  const [proveedorFormOpen, setProveedorFormOpen] = useState(false)
  const [proveedorForm, setProveedorForm] = useState<ProveedorFormState>(emptyProveedorForm)
  const [accionPendiente, setAccionPendiente] = useState<AccionPendiente | null>(null)
  const [observacionRechazo, setObservacionRechazo] = useState('')
  const [clientError, setClientError] = useState<string | null>(null)

  const puedeGestionarCompras = tieneRol(usuario, ['PANOLERO', 'DIRECTOR'])
  const puedeResolverOrdenes = tieneRol(usuario, ['DIRECTOR'])

  const filtros: ComprasFiltros = useMemo(() => ({ busqueda, estado }), [busqueda, estado])

  const ordenesCompraQuery = useQuery<OrdenCompra[], Error>({
    queryKey: queryKeys.ordenesCompra.list(filtros),
    queryFn: () => comprasApi.obtenerOrdenesCompra(filtros),
  })

  const tiposEquipoQuery = useQuery<TipoEquipo[], Error>({
    queryKey: queryKeys.tiposEquipo.list(),
    queryFn: () => catalogoApi.obtenerTiposEquipo(),
  })

  const ubicacionesQuery = useQuery<Ubicacion[], Error>({
    queryKey: queryKeys.ubicaciones.list(),
    queryFn: () => catalogoApi.obtenerUbicaciones(),
  })

  const invalidateCompras = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.ordenesCompra.lists() })
    void queryClient.invalidateQueries({ queryKey: queryKeys.itemsOrdenCompra.lists() })
  }

  const invalidateInventarioDashboard = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.tiposEquipo.lists() })
    void queryClient.invalidateQueries({ queryKey: queryKeys.unidades.lists() })
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
  }

  const guardarOrdenMutation = useMutation({
    mutationFn: (input: OrdenCompraInput) =>
      ordenFormMode?.mode === 'edit'
        ? comprasApi.actualizarOrdenCompra(ordenFormMode.orden.id, input)
        : comprasApi.crearOrdenCompra(input),
    onSuccess: () => {
      setOrdenFormMode(null)
      invalidateCompras()
      invalidateInventarioDashboard()
    },
  })

  const guardarItemMutation = useMutation({
    mutationFn: (input: ItemOrdenCompraCreateInput | ItemOrdenCompraUpdateInput) =>
      itemFormMode?.mode === 'edit'
        ? comprasApi.actualizarItemOrdenCompra(itemFormMode.item.id, input)
        : comprasApi.crearItemOrdenCompra(input as ItemOrdenCompraCreateInput),
    onSuccess: () => {
      setItemFormMode(null)
      invalidateCompras()
      invalidateInventarioDashboard()
    },
  })

  const crearProveedorMutation = useMutation({
    mutationFn: (input: ProveedorInput) => proveedoresApi.crearProveedor(input),
    onSuccess: (proveedor) => {
      setOrdenForm((prev) => ({ ...prev, proveedor, proveedorId: String(proveedor.id) }))
      setProveedorForm(emptyProveedorForm)
      setProveedorFormOpen(false)
      void queryClient.invalidateQueries({ queryKey: queryKeys.proveedores.lists() })
    },
  })

  const eliminarItemMutation = useMutation({
    mutationFn: (itemId: number) => comprasApi.eliminarItemOrdenCompra(itemId),
    onSuccess: () => {
      invalidateCompras()
      invalidateInventarioDashboard()
    },
  })

  const flujoMutation = useMutation({
    mutationFn: ({ orden, accion, observacion }: AccionPendiente & { observacion?: string }) => {
      if (accion === 'enviar-revision') return comprasApi.enviarOrdenARevision(orden.id)
      if (accion === 'aceptar') return comprasApi.aceptarOrdenCompra(orden.id)
      return comprasApi.rechazarOrdenCompra(orden.id, {
        observacion: observacion?.trim(),
        observaciones: observacion?.trim(),
        motivo: observacion?.trim(),
      })
    },
    onSuccess: () => {
      setAccionPendiente(null)
      setObservacionRechazo('')
      invalidateCompras()
      invalidateInventarioDashboard()
    },
  })

  const ordenesFiltradas = useMemo(() => {
    const ordenes = ordenesCompraQuery.data ?? []
    return ordenes.filter(
      (orden) => (!estado || orden.estado === estado) && ordenCoincideConBusqueda(orden, busqueda),
    )
  }, [busqueda, estado, ordenesCompraQuery.data])

  const itemPreviewTotals = useMemo(() => {
    if (!itemFormMode) return null
    const actual = construirItemInput(itemForm)
    const itemsPrevios = (itemFormMode.orden.items ?? [])
      .filter((item) => itemFormMode.mode !== 'edit' || item.id !== itemFormMode.item.id)
      .map((item) => ({ precio_unitario: item.precio_unitario, cantidad_solicitada: item.cantidad_solicitada }))
    return calcularTotalesOrdenCompra(
      [...itemsPrevios, actual],
      itemFormMode.orden.tasa_iva,
      itemFormMode.orden.descuentos,
    )
  }, [itemForm, itemFormMode])

  const abrirCrearOrden = () => {
    setClientError(null)
    setOrdenForm(crearOrdenFormState())
    setOrdenFormMode({ mode: 'create' })
  }

  const abrirEditarOrden = (orden: OrdenCompra) => {
    setClientError(null)
    setOrdenForm(crearOrdenFormState(orden))
    setOrdenFormMode({ mode: 'edit', orden })
  }

  const abrirCrearItem = (orden: OrdenCompra) => {
    setClientError(null)
    setItemForm(crearItemFormState())
    setItemFormMode({ mode: 'create', orden })
  }

  const abrirEditarItem = (orden: OrdenCompra, item: ItemOrdenCompra) => {
    setClientError(null)
    setItemForm(crearItemFormState(item))
    setItemFormMode({ mode: 'edit', orden, item })
  }

  const guardarOrden = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setClientError(null)
    guardarOrdenMutation.mutate(construirOrdenInput(ordenForm))
  }

  const guardarItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setClientError(null)
    const error = validarItem(itemForm)
    if (error) {
      setClientError(error)
      return
    }

    const baseInput = construirItemInput(itemForm)
    const input = itemFormMode?.mode === 'create'
      ? { ...baseInput, orden_compra_id: itemFormMode.orden.id, orden_compra: itemFormMode.orden.id }
      : baseInput
    guardarItemMutation.mutate(input)
  }

  const guardarProveedor = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setClientError(null)
    if (!proveedorForm.razon_social.trim() || !proveedorForm.rut.trim()) {
      setClientError('La razón social y el RUT del proveedor son obligatorios.')
      return
    }
    crearProveedorMutation.mutate(construirProveedorInput(proveedorForm))
  }

  const eliminarItem = (item: ItemOrdenCompra) => {
    if (window.confirm(`¿Eliminar el item ${item.tipo_equipo.nombre}?`)) {
      eliminarItemMutation.mutate(item.id)
    }
  }

  const abrirAccion = (orden: OrdenCompra, accion: AccionFlujo) => {
    setClientError(null)

    if ((accion === 'aceptar' || accion === 'rechazar') && !puedeResolverOrdenes) {
      setClientError('Solo el director puede aceptar o rechazar órdenes de compra.')
      return
    }

    setObservacionRechazo('')
    setAccionPendiente({ orden, accion })
  }

  const confirmarAccion = () => {
    if (!accionPendiente) return
    if (accionPendiente.accion === 'rechazar' && !observacionRechazo.trim()) {
      setClientError('Ingresa una observación para rechazar la orden.')
      return
    }
    setClientError(null)
    flujoMutation.mutate({ ...accionPendiente, observacion: observacionRechazo })
  }

  const isLoading = ordenesCompraQuery.isLoading || tiposEquipoQuery.isLoading || ubicacionesQuery.isLoading
  const errorMessage = ordenesCompraQuery.isError
    ? extractApiErrorMessage(ordenesCompraQuery.error)
    : tiposEquipoQuery.isError
      ? extractApiErrorMessage(tiposEquipoQuery.error)
      : ubicacionesQuery.isError
        ? extractApiErrorMessage(ubicacionesQuery.error)
        : null

  return (
    <section className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="absolute left-0 top-0 h-1 w-full bg-[#E30613]" />
        <p className={`text-sm font-semibold uppercase tracking-widest ${clasesInacap.textoMarca}`}>Compras</p>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">Listado de compras</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
              Gestiona órdenes con proveedor, cabecera INACAP, recepción de items y montos calculados por el backend.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600">
              {ordenesFiltradas.length} resultado{ordenesFiltradas.length === 1 ? '' : 's'}
            </p>
            {puedeGestionarCompras ? <PrimaryButton onClick={abrirCrearOrden}>Nueva orden</PrimaryButton> : null}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
          <label className="block">
            <FieldLabel>Búsqueda por texto</FieldLabel>
            <input
              className={`mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:ring-4 ${clasesInacap.focoMarca}`}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Buscar por proveedor, número, documento o material"
              type="search"
              value={busqueda}
            />
          </label>
          <label className="block">
            <FieldLabel>Estado</FieldLabel>
            <select
              className={`mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:ring-4 ${clasesInacap.focoMarca}`}
              onChange={(event) => setEstado(event.target.value as EstadoOrdenCompra | '')}
              value={estado}
            >
              <option value="">Todos los estados</option>
              {estadosOrdenCompra.map((estadoOrdenCompra) => (
                <option key={estadoOrdenCompra} value={estadoOrdenCompra}>{etiquetasEstado[estadoOrdenCompra]}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-500">Cargando compras y catálogos...</p>
        </div>
      ) : null}

      {errorMessage ? <ErrorPanel message={errorMessage} /> : null}
      {clientError && !ordenFormMode && !itemFormMode && !accionPendiente ? <ErrorPanel message={clientError} /> : null}

      {ordenesCompraQuery.isSuccess && ordenesFiltradas.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">Sin resultados</p>
          <h2 className="mt-2 text-xl font-bold text-slate-950">No hay compras para mostrar</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Ajusta los filtros o crea una nueva orden en borrador.</p>
        </div>
      ) : null}

      {ordenesCompraQuery.isSuccess && ordenesFiltradas.length > 0 ? (
        <div className="space-y-4">
          {ordenesFiltradas.map((orden) => (
            <OrdenCompraCard
              key={orden.id}
              orden={orden}
              tiposEquipo={tiposEquipoQuery.data ?? []}
              onAction={abrirAccion}
              onAddItem={abrirCrearItem}
              onDeleteItem={eliminarItem}
              onEditItem={abrirEditarItem}
              onEditOrder={abrirEditarOrden}
              puedeGestionar={puedeGestionarCompras}
              puedeResolverOrden={puedeResolverOrdenes}
            />
          ))}
        </div>
      ) : null}

      {ordenFormMode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <form className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl" onSubmit={guardarOrden}>
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-950">{ordenFormMode.mode === 'edit' ? 'Editar orden en borrador' : 'Nueva orden en borrador'}</h2>
                <p className="mt-1 text-sm text-slate-500">El número interno y los montos son calculados por el backend.</p>
              </div>
              <SecondaryButton onClick={() => setOrdenFormMode(null)}>Cerrar</SecondaryButton>
            </div>
            {clientError ? <div className="mt-4"><ErrorPanel message={clientError} /></div> : null}
            {guardarOrdenMutation.isError ? <div className="mt-4"><ErrorPanel message={extractApiErrorMessage(guardarOrdenMutation.error)} /></div> : null}
            <section className="mt-5 rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div className="flex-1 space-y-2">
                  <label htmlFor="proveedor-compra"><FieldLabel>Proveedor</FieldLabel></label>
                  <AsyncCombobox<Proveedor>
                    fetchOptions={proveedoresApi.buscarProveedores}
                    getOptionId={(proveedor) => proveedor.id}
                    getOptionLabel={proveedorLabel}
                    id="proveedor-compra"
                    onChange={(id, proveedor) =>
                      setOrdenForm((prev) => ({
                        ...prev,
                        proveedorId: id ? String(id) : '',
                        proveedor,
                      }))
                    }
                    placeholder="Buscar proveedor por razón social o RUT"
                    selectedItem={ordenForm.proveedor}
                    value={ordenForm.proveedorId ? Number(ordenForm.proveedorId) : null}
                  />
                </div>
                <SecondaryButton onClick={() => { setClientError(null); setProveedorFormOpen(true) }}>＋ Nuevo proveedor</SecondaryButton>
              </div>
            </section>

            <details className="mt-5 rounded-2xl border border-slate-200 p-4" open>
              <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-slate-500">Datos INACAP</summary>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <label className="space-y-2"><FieldLabel>N° INACAP</FieldLabel><input className={`w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={ordenForm.numeroInacap} onChange={(event) => setOrdenForm((prev) => ({ ...prev, numeroInacap: event.target.value }))} /></label>
                <label className="space-y-2"><FieldLabel>Número documento</FieldLabel><input className={`w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={ordenForm.numeroDocumento} onChange={(event) => setOrdenForm((prev) => ({ ...prev, numeroDocumento: event.target.value }))} /></label>
                <label className="space-y-2"><FieldLabel>Fecha documento</FieldLabel><input type="date" className={`w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={ordenForm.fechaDocumento} onChange={(event) => setOrdenForm((prev) => ({ ...prev, fechaDocumento: event.target.value }))} /></label>
                <label className="space-y-2"><FieldLabel>Fecha publicación</FieldLabel><input type="date" className={`w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={ordenForm.fechaPublicacion} onChange={(event) => setOrdenForm((prev) => ({ ...prev, fechaPublicacion: event.target.value }))} /></label>
                <label className="space-y-2"><FieldLabel>Fecha emisión</FieldLabel><input type="date" className={`w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={ordenForm.fechaEmision} onChange={(event) => setOrdenForm((prev) => ({ ...prev, fechaEmision: event.target.value }))} /></label>
                <label className="space-y-2"><FieldLabel>Sede destino</FieldLabel><input className={`w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={ordenForm.sedeDestino} onChange={(event) => setOrdenForm((prev) => ({ ...prev, sedeDestino: event.target.value }))} /></label>
                <label className="space-y-2 md:col-span-2"><FieldLabel>Dirección despacho</FieldLabel><input className={`w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={ordenForm.direccionDespacho} onChange={(event) => setOrdenForm((prev) => ({ ...prev, direccionDespacho: event.target.value }))} /></label>
                <label className="space-y-2"><FieldLabel>Recibido por</FieldLabel><input className={`w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={ordenForm.recibidoPorNombre} onChange={(event) => setOrdenForm((prev) => ({ ...prev, recibidoPorNombre: event.target.value }))} /></label>
                <label className="space-y-2"><FieldLabel>Comprador</FieldLabel><input className={`w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={ordenForm.compradorNombre} onChange={(event) => setOrdenForm((prev) => ({ ...prev, compradorNombre: event.target.value }))} /></label>
                <label className="space-y-2"><FieldLabel>Referencia pedido</FieldLabel><input className={`w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={ordenForm.referenciaPedido} onChange={(event) => setOrdenForm((prev) => ({ ...prev, referenciaPedido: event.target.value }))} /></label>
                <label className="space-y-2"><FieldLabel>Código inversión</FieldLabel><input className={`w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={ordenForm.codigoInversion} onChange={(event) => setOrdenForm((prev) => ({ ...prev, codigoInversion: event.target.value }))} /></label>
              </div>
            </details>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="space-y-2"><FieldLabel>Tasa IVA (%)</FieldLabel><input min="0" step="0.01" type="number" className={`w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={ordenForm.tasaIva} onChange={(event) => setOrdenForm((prev) => ({ ...prev, tasaIva: event.target.value }))} /></label>
              <label className="space-y-2"><FieldLabel>Descuentos</FieldLabel><input min="0" step="0.01" type="number" className={`w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={ordenForm.descuentos} onChange={(event) => setOrdenForm((prev) => ({ ...prev, descuentos: event.target.value }))} /></label>
              <label className="space-y-2 md:col-span-2"><FieldLabel>Observaciones</FieldLabel><textarea className={`min-h-24 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={ordenForm.observaciones} onChange={(event) => setOrdenForm((prev) => ({ ...prev, observaciones: event.target.value }))} /></label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <SecondaryButton onClick={() => setOrdenFormMode(null)}>Cancelar</SecondaryButton>
              <PrimaryButton disabled={guardarOrdenMutation.isPending} type="submit">{guardarOrdenMutation.isPending ? 'Guardando...' : 'Guardar orden'}</PrimaryButton>
            </div>
          </form>
        </div>
      ) : null}

      {proveedorFormOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4">
          <form className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl" onSubmit={guardarProveedor}>
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-950">Nuevo proveedor</h2>
                <p className="mt-1 text-sm text-slate-500">Razón social y RUT son obligatorios; el backend valida el formato chileno del RUT.</p>
              </div>
              <SecondaryButton onClick={() => setProveedorFormOpen(false)}>Cerrar</SecondaryButton>
            </div>
            {clientError ? <div className="mt-4"><ErrorPanel message={clientError} /></div> : null}
            {crearProveedorMutation.isError ? <div className="mt-4"><ErrorPanel message={extractApiErrorMessage(crearProveedorMutation.error)} /></div> : null}
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="space-y-2"><FieldLabel>Razón social</FieldLabel><input required className={`w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={proveedorForm.razon_social} onChange={(event) => setProveedorForm((prev) => ({ ...prev, razon_social: event.target.value }))} /></label>
              <label className="space-y-2"><FieldLabel>RUT</FieldLabel><input required className={`w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={proveedorForm.rut} onChange={(event) => setProveedorForm((prev) => ({ ...prev, rut: event.target.value }))} placeholder="76.123.456-7" /></label>
              <label className="space-y-2 md:col-span-2"><FieldLabel>Dirección</FieldLabel><input className={`w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={proveedorForm.direccion} onChange={(event) => setProveedorForm((prev) => ({ ...prev, direccion: event.target.value }))} /></label>
              <label className="space-y-2"><FieldLabel>Ciudad</FieldLabel><input className={`w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={proveedorForm.ciudad} onChange={(event) => setProveedorForm((prev) => ({ ...prev, ciudad: event.target.value }))} /></label>
              <label className="space-y-2"><FieldLabel>Email</FieldLabel><input type="email" className={`w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={proveedorForm.email} onChange={(event) => setProveedorForm((prev) => ({ ...prev, email: event.target.value }))} /></label>
              <label className="space-y-2"><FieldLabel>Contacto</FieldLabel><input className={`w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={proveedorForm.contacto_nombre} onChange={(event) => setProveedorForm((prev) => ({ ...prev, contacto_nombre: event.target.value }))} /></label>
              <label className="space-y-2"><FieldLabel>Teléfono contacto</FieldLabel><input className={`w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={proveedorForm.contacto_telefono} onChange={(event) => setProveedorForm((prev) => ({ ...prev, contacto_telefono: event.target.value }))} /></label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <SecondaryButton onClick={() => setProveedorFormOpen(false)}>Cancelar</SecondaryButton>
              <PrimaryButton disabled={crearProveedorMutation.isPending} type="submit">{crearProveedorMutation.isPending ? 'Creando...' : 'Crear y seleccionar'}</PrimaryButton>
            </div>
          </form>
        </div>
      ) : null}

      {itemFormMode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <form className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl" onSubmit={guardarItem}>
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-950">{itemFormMode.mode === 'edit' ? 'Editar item en borrador' : 'Agregar item'}</h2>
                <p className="mt-1 text-sm text-slate-500">Orden #{itemFormMode.orden.id}. El panel de montos es una vista previa; al guardar, manda el backend.</p>
              </div>
              <SecondaryButton onClick={() => setItemFormMode(null)}>Cerrar</SecondaryButton>
            </div>
            {clientError ? <div className="mt-4"><ErrorPanel message={clientError} /></div> : null}
            {guardarItemMutation.isError ? <div className="mt-4"><ErrorPanel message={extractApiErrorMessage(guardarItemMutation.error)} /></div> : null}
            <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_320px]">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <label htmlFor="tipo-equipo-compra"><FieldLabel>Tipo de equipo</FieldLabel></label>
                  <AsyncCombobox<TipoEquipo>
                    fetchOptions={catalogoApi.buscarTiposEquipo}
                    getOptionId={(tipo) => tipo.id}
                    getOptionLabel={(tipo) => `${tipo.nombre} · ${tipo.tipo_seguimiento}`}
                    id="tipo-equipo-compra"
                    onChange={(id, tipoEquipo) =>
                      setItemForm((prev) => ({
                        ...prev,
                        tipoEquipoId: id ? String(id) : '',
                        tipoEquipo,
                      }))
                    }
                    placeholder="Buscar tipo de equipo"
                    selectedItem={itemForm.tipoEquipo}
                    value={itemForm.tipoEquipoId ? Number(itemForm.tipoEquipoId) : null}
                  />
                </div>
                <label className="space-y-2"><FieldLabel>Código material</FieldLabel><input className={`w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={itemForm.codigoMaterial} onChange={(event) => setItemForm((prev) => ({ ...prev, codigoMaterial: event.target.value }))} /></label>
                <label className="space-y-2"><FieldLabel>Unidad medida</FieldLabel><input className={`w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={itemForm.unidadMedida} onChange={(event) => setItemForm((prev) => ({ ...prev, unidadMedida: event.target.value }))} /></label>
                <label className="space-y-2"><FieldLabel>Precio unitario</FieldLabel><input min="0" required step="0.01" type="number" className={`w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={itemForm.precioUnitario} onChange={(event) => setItemForm((prev) => ({ ...prev, precioUnitario: event.target.value }))} /></label>
                <label className="space-y-2"><FieldLabel>Cantidad solicitada</FieldLabel><input min="1" required type="number" className={`w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={itemForm.cantidadSolicitada} onChange={(event) => setItemForm((prev) => ({ ...prev, cantidadSolicitada: event.target.value }))} /></label>
                <label className="space-y-2"><FieldLabel>Cantidad recibida</FieldLabel><input min="0" required type="number" className={`w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={itemForm.cantidadRecibida} onChange={(event) => setItemForm((prev) => ({ ...prev, cantidadRecibida: event.target.value }))} /></label>
                <label className="space-y-2"><FieldLabel>Ubicación</FieldLabel><select className={`w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={itemForm.ubicacionId} onChange={(event) => setItemForm((prev) => ({ ...prev, ubicacionId: event.target.value }))}><option value="">Sin ubicación</option>{(ubicacionesQuery.data ?? []).map((ubicacion) => <option key={ubicacion.id} value={ubicacion.id}>{ubicacionLabel(ubicacion)}</option>)}</select></label>
                <label className="space-y-2 md:col-span-2"><FieldLabel>Códigos activo</FieldLabel><textarea className={`min-h-24 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={itemForm.codigosActivo} onChange={(event) => setItemForm((prev) => ({ ...prev, codigosActivo: event.target.value }))} placeholder="Un código por línea o separados por coma para SERIE" /></label>
                <label className="space-y-2 md:col-span-2"><FieldLabel>Observaciones</FieldLabel><textarea className={`min-h-20 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={itemForm.observaciones} onChange={(event) => setItemForm((prev) => ({ ...prev, observaciones: event.target.value }))} /></label>
              </div>
              {itemPreviewTotals ? (
                <TotalesPanel
                  descuentos={itemPreviewTotals.descuentos}
                  iva={itemPreviewTotals.iva}
                  montoAfecto={itemPreviewTotals.montoAfecto}
                  subtotalNeto={itemPreviewTotals.subtotalNeto}
                  tasaIva={itemFormMode.orden.tasa_iva}
                  totalGeneral={itemPreviewTotals.totalGeneral}
                  titulo="Vista previa de montos"
                />
              ) : null}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <SecondaryButton onClick={() => setItemFormMode(null)}>Cancelar</SecondaryButton>
              <PrimaryButton disabled={guardarItemMutation.isPending} type="submit">{guardarItemMutation.isPending ? 'Guardando...' : 'Guardar item'}</PrimaryButton>
            </div>
          </form>
        </div>
      ) : null}

      {accionPendiente ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-950">Confirmar {accionPendiente.accion === 'enviar-revision' ? 'envío a revisión' : accionPendiente.accion}</h2>
                <p className="mt-1 text-sm text-slate-500">Orden #{accionPendiente.orden.id} · {formatearTexto(accionPendiente.orden.numero, 'Sin número')}</p>
              </div>
              <SecondaryButton onClick={() => setAccionPendiente(null)}>Cerrar</SecondaryButton>
            </div>
            {clientError ? <div className="mt-4"><ErrorPanel message={clientError} /></div> : null}
            {flujoMutation.isError ? <div className="mt-4"><ErrorPanel message={extractApiErrorMessage(flujoMutation.error)} /></div> : null}
            <p className="mt-5 text-sm leading-6 text-slate-700">
              {accionPendiente.accion === 'aceptar'
                ? 'Al aceptar, el backend creará unidades por SERIE y sumará stock para GRANEL según la cantidad recibida.'
                : accionPendiente.accion === 'rechazar'
                  ? 'La orden quedará rechazada y solo lectura. Ingresa la observación requerida.'
                  : 'La orden pasará a EN_REVISION y quedará bloqueada para edición.'}
            </p>
            {accionPendiente.accion === 'rechazar' ? (
              <label className="mt-4 block space-y-2"><FieldLabel>Observación de rechazo</FieldLabel><textarea className={`min-h-24 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={observacionRechazo} onChange={(event) => setObservacionRechazo(event.target.value)} /></label>
            ) : null}
            <div className="mt-6 flex justify-end gap-3">
              <SecondaryButton onClick={() => setAccionPendiente(null)}>Cancelar</SecondaryButton>
              {accionPendiente.accion === 'rechazar' ? <DangerButton disabled={flujoMutation.isPending} onClick={confirmarAccion}>Confirmar rechazo</DangerButton> : <PrimaryButton disabled={flujoMutation.isPending} onClick={confirmarAccion}>Confirmar</PrimaryButton>}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
