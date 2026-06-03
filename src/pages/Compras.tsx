import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { catalogoApi } from '../api/catalogo'
import { tieneRol, useAuth } from '../features/auth/AuthContext'
import { AsyncCombobox } from '../components/AsyncCombobox'
import { comprasApi, type ComprasFiltros } from '../api/compras'
import { clasesInacap } from '../lib/theme'
import { queryKeys } from '../lib/queryKeys'
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
} from '../types/compras'

const estadosOrdenCompra: EstadoOrdenCompra[] = ['BORRADOR', 'EN_REVISION', 'ACEPTADA', 'RECHAZADA']

type OrdenFormMode = { mode: 'create' } | { mode: 'edit'; orden: OrdenCompra }
type ItemFormMode = { mode: 'create'; orden: OrdenCompra } | { mode: 'edit'; orden: OrdenCompra; item: ItemOrdenCompra }
type AccionFlujo = 'enviar-revision' | 'aceptar' | 'rechazar'

type OrdenFormState = {
  numero: string
  proveedor: string
  numeroDocumento: string
  fechaDocumento: string
  observaciones: string
}

type ItemFormState = {
  tipoEquipoId: string
  tipoEquipo: TipoEquipo | null
  cantidadSolicitada: string
  cantidadRecibida: string
  codigosActivo: string
  ubicacionId: string
  observaciones: string
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
  cantidadSolicitada: '1',
  cantidadRecibida: '0',
  codigosActivo: '',
  ubicacionId: '',
  observaciones: '',
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

function ordenCoincideConBusqueda(orden: OrdenCompra, busqueda: string): boolean {
  const termino = normalizarTexto(busqueda.trim())
  if (!termino) return true

  const valores = [
    String(orden.id),
    orden.numero,
    orden.proveedor,
    orden.numero_documento,
    orden.estado,
    orden.fecha_documento ?? '',
    orden.observaciones,
    orden.items?.map((item) => item.tipo_equipo.nombre).join(' ') ?? '',
  ]

  return valores.some((valor) => normalizarTexto(valor).includes(termino))
}

function crearOrdenFormState(orden?: OrdenCompra): OrdenFormState {
  return {
    numero: orden?.numero ?? '',
    proveedor: orden?.proveedor ?? '',
    numeroDocumento: orden?.numero_documento ?? '',
    fechaDocumento: orden?.fecha_documento ?? '',
    observaciones: orden?.observaciones ?? '',
  }
}

function crearItemFormState(item?: ItemOrdenCompra): ItemFormState {
  return item
    ? {
        tipoEquipoId: String(item.tipo_equipo.id),
        tipoEquipo: item.tipo_equipo,
        cantidadSolicitada: String(item.cantidad_solicitada),
        cantidadRecibida: String(item.cantidad_recibida),
        codigosActivo: item.codigos_activo.join('\n'),
        ubicacionId: item.ubicacion ? String(item.ubicacion.id) : '',
        observaciones: item.observaciones ?? '',
      }
    : { ...emptyItemForm }
}

function construirOrdenInput(form: OrdenFormState): OrdenCompraInput {
  const numero = form.numero.trim()

  return {
    ...(numero ? { numero } : {}),
    proveedor: form.proveedor.trim(),
    numero_documento: form.numeroDocumento.trim(),
    fecha_documento: form.fechaDocumento || null,
    observaciones: form.observaciones.trim(),
  }
}

function construirItemInput(form: ItemFormState): ItemOrdenCompraInput {
  return {
    tipo_equipo_id: Number(form.tipoEquipoId),
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

function validarItem(form: ItemFormState): string | null {
  if (!form.tipoEquipoId || !form.tipoEquipo) return 'Selecciona un tipo de equipo.'
  const tipo = form.tipoEquipo
  const solicitada = Number(form.cantidadSolicitada)
  const recibida = Number(form.cantidadRecibida)
  if (!Number.isFinite(solicitada) || solicitada < 1) return 'La cantidad solicitada debe ser mayor a cero.'
  if (!Number.isFinite(recibida) || recibida < 0) return 'La cantidad recibida no puede ser negativa.'
  if (recibida > solicitada) return 'La cantidad recibida no puede superar la solicitada.'

  const codigos = construirItemInput(form).codigos_activo ?? []
  if (tipo.tipo_seguimiento === 'SERIE' && recibida > 0 && codigos.length !== recibida) {
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
      <p className="font-semibold text-red-950">Error del backend</p>
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
      <td className="px-4 py-3 text-slate-600">{item.cantidad_solicitada}</td>
      <td className="px-4 py-3 text-slate-600">{item.cantidad_recibida}</td>
      <td className="px-4 py-3 text-slate-600">{item.pendiente}</td>
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
  onAdd,
  onDelete,
  onEdit,
}: {
  orden: OrdenCompra
  onAdd: (orden: OrdenCompra) => void
  onDelete: (item: ItemOrdenCompra) => void
  onEdit: (orden: OrdenCompra, item: ItemOrdenCompra) => void
}) {
  const editable = puedeEditarOrden(orden)

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
                <th className="px-4 py-3 font-semibold">Solicitada</th>
                <th className="px-4 py-3 font-semibold">Recibida</th>
                <th className="px-4 py-3 font-semibold">Pendiente</th>
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
  puedeResolverOrden,
}: {
  orden: OrdenCompra
  tiposEquipo: TipoEquipo[]
  onAction: (orden: OrdenCompra, accion: AccionFlujo) => void
  onAddItem: (orden: OrdenCompra) => void
  onDeleteItem: (item: ItemOrdenCompra) => void
  onEditItem: (orden: OrdenCompra, item: ItemOrdenCompra) => void
  onEditOrder: (orden: OrdenCompra) => void
  puedeResolverOrden: boolean
}) {
  const editable = puedeEditarOrden(orden)
  const puedeEnviar = editable && (orden.items?.length ?? 0) > 0
  const estaEnRevision = orden.estado === 'EN_REVISION'
  const puedeResolver = estaEnRevision && puedeResolverOrden

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className={`text-sm font-semibold uppercase tracking-widest ${clasesInacap.textoMarca}`}>Orden de compra #{orden.id}</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{formatearTexto(orden.numero, 'Sin número')}</h2>
          <p className="mt-2 text-sm font-medium text-slate-600">Proveedor: {formatearTexto(orden.proveedor, 'Sin proveedor')}</p>
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

      <dl className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-4">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Documento</dt>
          <dd className="mt-1 font-medium text-slate-950">{formatearTexto(orden.numero_documento, 'Sin documento')}</dd>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fecha documento</dt>
          <dd className="mt-1 font-medium text-slate-950">{formatearFecha(orden.fecha_documento)}</dd>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Items</dt>
          <dd className="mt-1 font-medium text-slate-950">{orden.items?.length ?? 0}</dd>
        </div>
      </dl>

      <div className="mt-6 rounded-2xl bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Observaciones</p>
        <p className="mt-2 text-sm leading-6 text-slate-700">{formatearTexto(orden.observaciones, 'Sin observaciones')}</p>
      </div>

      <div className="mt-6">
        <ItemsOrdenCompra orden={orden} onAdd={onAddItem} onDelete={onDeleteItem} onEdit={onEditItem} />
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
  const [accionPendiente, setAccionPendiente] = useState<AccionPendiente | null>(null)
  const [observacionRechazo, setObservacionRechazo] = useState('')
  const [clientError, setClientError] = useState<string | null>(null)

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
              Alpha funcional para crear órdenes en borrador, gestionar recepción de items y ejecutar revisión,
              aceptación o rechazo contra el backend.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600">
              {ordenesFiltradas.length} resultado{ordenesFiltradas.length === 1 ? '' : 's'}
            </p>
            <PrimaryButton onClick={abrirCrearOrden}>Nueva orden</PrimaryButton>
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
              placeholder="Buscar por proveedor, número o documento"
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
              puedeResolverOrden={puedeResolverOrdenes}
            />
          ))}
        </div>
      ) : null}

      {ordenFormMode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <form className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl" onSubmit={guardarOrden}>
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-950">{ordenFormMode.mode === 'edit' ? 'Editar orden en borrador' : 'Nueva orden en borrador'}</h2>
                <p className="mt-1 text-sm text-slate-500">Campos reales de /api/ordenes-compra/.</p>
              </div>
              <SecondaryButton onClick={() => setOrdenFormMode(null)}>Cerrar</SecondaryButton>
            </div>
            {guardarOrdenMutation.isError ? <div className="mt-4"><ErrorPanel message={extractApiErrorMessage(guardarOrdenMutation.error)} /></div> : null}
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="space-y-2"><FieldLabel>Número OC</FieldLabel><input className={`w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={ordenForm.numero} onChange={(event) => setOrdenForm((prev) => ({ ...prev, numero: event.target.value }))} placeholder="Opcional si backend autonumera" /></label>
              <label className="space-y-2"><FieldLabel>Proveedor</FieldLabel><input required className={`w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={ordenForm.proveedor} onChange={(event) => setOrdenForm((prev) => ({ ...prev, proveedor: event.target.value }))} /></label>
              <label className="space-y-2"><FieldLabel>Número documento</FieldLabel><input className={`w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={ordenForm.numeroDocumento} onChange={(event) => setOrdenForm((prev) => ({ ...prev, numeroDocumento: event.target.value }))} /></label>
              <label className="space-y-2"><FieldLabel>Fecha documento</FieldLabel><input type="date" className={`w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={ordenForm.fechaDocumento} onChange={(event) => setOrdenForm((prev) => ({ ...prev, fechaDocumento: event.target.value }))} /></label>
              <label className="space-y-2 md:col-span-2"><FieldLabel>Observaciones</FieldLabel><textarea className={`min-h-24 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={ordenForm.observaciones} onChange={(event) => setOrdenForm((prev) => ({ ...prev, observaciones: event.target.value }))} /></label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <SecondaryButton onClick={() => setOrdenFormMode(null)}>Cancelar</SecondaryButton>
              <PrimaryButton disabled={guardarOrdenMutation.isPending} type="submit">{guardarOrdenMutation.isPending ? 'Guardando...' : 'Guardar orden'}</PrimaryButton>
            </div>
          </form>
        </div>
      ) : null}

      {itemFormMode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <form className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl" onSubmit={guardarItem}>
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-950">{itemFormMode.mode === 'edit' ? 'Editar item en borrador' : 'Agregar item'}</h2>
                <p className="mt-1 text-sm text-slate-500">Orden #{itemFormMode.orden.id}. Carga la recepción antes de enviar a revisión.</p>
              </div>
              <SecondaryButton onClick={() => setItemFormMode(null)}>Cerrar</SecondaryButton>
            </div>
            {clientError ? <div className="mt-4"><ErrorPanel message={clientError} /></div> : null}
            {guardarItemMutation.isError ? <div className="mt-4"><ErrorPanel message={extractApiErrorMessage(guardarItemMutation.error)} /></div> : null}
            <div className="mt-5 grid gap-4 md:grid-cols-2">
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
              <label className="space-y-2"><FieldLabel>Cantidad solicitada</FieldLabel><input min="1" required type="number" className={`w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={itemForm.cantidadSolicitada} onChange={(event) => setItemForm((prev) => ({ ...prev, cantidadSolicitada: event.target.value }))} /></label>
              <label className="space-y-2"><FieldLabel>Cantidad recibida</FieldLabel><input min="0" required type="number" className={`w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={itemForm.cantidadRecibida} onChange={(event) => setItemForm((prev) => ({ ...prev, cantidadRecibida: event.target.value }))} /></label>
              <label className="space-y-2 md:col-span-2"><FieldLabel>Ubicación</FieldLabel><select className={`w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={itemForm.ubicacionId} onChange={(event) => setItemForm((prev) => ({ ...prev, ubicacionId: event.target.value }))}><option value="">Sin ubicación</option>{(ubicacionesQuery.data ?? []).map((ubicacion) => <option key={ubicacion.id} value={ubicacion.id}>{ubicacionLabel(ubicacion)}</option>)}</select></label>
              <label className="space-y-2 md:col-span-2"><FieldLabel>Códigos activo</FieldLabel><textarea className={`min-h-24 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={itemForm.codigosActivo} onChange={(event) => setItemForm((prev) => ({ ...prev, codigosActivo: event.target.value }))} placeholder="Un código por línea o separados por coma para SERIE" /></label>
              <label className="space-y-2 md:col-span-2"><FieldLabel>Observaciones</FieldLabel><textarea className={`min-h-20 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ${clasesInacap.focoMarca}`} value={itemForm.observaciones} onChange={(event) => setItemForm((prev) => ({ ...prev, observaciones: event.target.value }))} /></label>
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
                  : 'La orden pasará a EN_REVISION y quedará bloqueada para edición alpha.'}
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
