import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { mantencionApi } from '../../api/mantencion'
import { inventarioApi } from '../../api/inventario'
import { buscarProveedores } from '../../api/proveedores'
import { AsyncCombobox } from '../AsyncCombobox'
import { queryKeys } from '../../lib/queryKeys'
import { etiquetasFrecuencia, etiquetasPrioridad, etiquetasTipoMantencion, fechaHoy } from '../../lib/mantencion'
import { extractFieldErrors } from '../../types/api'
import type { Unidad } from '../../types/inventario'
import type { Proveedor } from '../../types/compras'
import type { PlanMantencion, PlanMantencionInput, RegistroMantencion, RegistroMantencionInput, UnidadPlan } from '../../types/mantencion'
import { Modal, Field, ErrorPanel, inputClass, primaryClass } from './Shared'

const buscarUnidades = (search: string) => inventarioApi.obtenerUnidades({ search })
const etiquetaUnidad = (u: Unidad) => `${u.codigo_activo || '#' + u.id} · ${u.codigo_peoplesoft || ''} · ${u.tipo_equipo.nombre}`

export function PlanForm({ plan, onClose }: { plan?: PlanMantencion; onClose: () => void }) {
  const qc = useQueryClient()
  const [unidad, setUnidad] = useState<Unidad | null>(null)
  const [form, setForm] = useState<PlanMantencionInput>(() => ({
    unidad_id: plan?.unidad.id ?? 0, actividad: plan?.actividad ?? '', frecuencia: plan?.frecuencia ?? 'ANUAL',
    prioridad: plan?.prioridad ?? 'MEDIA', responsable: plan?.responsable ?? '',
    fecha_ultima_mantencion: plan?.fecha_ultima_mantencion ?? null, activo: plan?.activo ?? true,
    observaciones: plan?.observaciones ?? '',
  }))
  const mutation = useMutation({
    mutationFn: () => plan ? mantencionApi.actualizarPlanMantencion(plan.id, form) : mantencionApi.crearPlanMantencion(form),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: queryKeys.planesMantencion.all }); onClose() },
  })
  const errors = extractFieldErrors(mutation.error) ?? {}
  function submit(e: FormEvent) { e.preventDefault(); if (form.unidad_id) mutation.mutate() }
  return <Modal title={plan ? 'Editar plan' : 'Nuevo plan'} onClose={onClose}>
    <form onSubmit={submit} className="space-y-4">
      <ErrorPanel error={mutation.error} />
      <div><span className="text-sm font-medium">Unidad</span>
        {plan ? <p>{plan.unidad.codigo_activo} · {plan.unidad.tipo_equipo_nombre}</p> :
          <AsyncCombobox<Unidad> value={form.unidad_id || null} selectedItem={unidad} placeholder="Buscar unidad por código o nombre" fetchOptions={buscarUnidades} getOptionId={u => u.id} getOptionLabel={etiquetaUnidad} onChange={(id, u) => { setUnidad(u); setForm(prev => ({ ...prev, unidad_id: id ?? 0 })) }} />}
        {errors.unidad_id ? <p className="text-sm text-red-600">{errors.unidad_id.join(' ')}</p> : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Actividad" error={errors.actividad}><textarea required className={inputClass} value={form.actividad} onChange={e => setForm(prev => ({ ...prev, actividad: e.target.value }))} /></Field>
        <Field label="Responsable" error={errors.responsable}><input className={inputClass} value={form.responsable} onChange={e => setForm(prev => ({ ...prev, responsable: e.target.value }))} /></Field>
        <Field label="Frecuencia" error={errors.frecuencia}><select className={inputClass} value={form.frecuencia} onChange={e => setForm(prev => ({ ...prev, frecuencia: e.target.value as PlanMantencionInput['frecuencia'] }))}>{Object.entries(etiquetasFrecuencia).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Prioridad" error={errors.prioridad}><select className={inputClass} value={form.prioridad} onChange={e => setForm(prev => ({ ...prev, prioridad: e.target.value as PlanMantencionInput['prioridad'] }))}>{Object.entries(etiquetasPrioridad).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Última mantención" error={errors.fecha_ultima_mantencion}><input type="date" className={inputClass} value={form.fecha_ultima_mantencion ?? ''} onChange={e => setForm(prev => ({ ...prev, fecha_ultima_mantencion: e.target.value || null }))} /></Field>
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.activo} onChange={e => setForm(prev => ({ ...prev, activo: e.target.checked }))} />Activo</label>
      </div>
      <Field label="Observaciones" error={errors.observaciones}><textarea className={inputClass} value={form.observaciones} onChange={e => setForm(prev => ({ ...prev, observaciones: e.target.value }))} /></Field>
      <button className={primaryClass} disabled={mutation.isPending || !form.unidad_id}>{mutation.isPending ? 'Guardando...' : 'Guardar plan'}</button>
    </form>
  </Modal>
}

export function RegistroForm({ registro, unidadPlan, planId, onClose }: {
  registro?: RegistroMantencion; unidadPlan?: UnidadPlan; planId?: number; onClose: () => void
}) {
  const qc = useQueryClient()
  const [unidad, setUnidad] = useState<Unidad | null>(null)
  const [proveedor, setProveedor] = useState<Proveedor | null>(null)
  const [form, setForm] = useState<RegistroMantencionInput>(() => ({
    unidad: registro?.unidad ?? unidadPlan?.id ?? 0, plan: registro?.plan ?? planId ?? null,
    tipo: registro?.tipo ?? 'PREVENTIVO', fecha_solicitud: registro?.fecha_solicitud ?? null,
    fecha_realizacion: registro?.fecha_realizacion ?? fechaHoy(), descripcion: registro?.descripcion ?? '',
    empresa: registro?.empresa ?? '', proveedor_id: registro?.proveedor?.id ?? null,
    orden_compra_id: registro?.orden_compra?.id ?? null, numero_orden_compra: registro?.numero_orden_compra ?? '',
    costo: registro?.costo ?? '0', realizado_por: registro?.realizado_por ?? '', estado_resultante: registro?.estado_resultante ?? '',
  }))
  const mutation = useMutation({
    mutationFn: () => registro ? mantencionApi.actualizarRegistroMantencion(registro.id, form) : mantencionApi.crearRegistroMantencion(form),
    onSuccess: () => {
      for (const key of [queryKeys.planesMantencion.all, queryKeys.registrosMantencion.all, queryKeys.unidades.all, ['fichaMantencion']]) void qc.invalidateQueries({ queryKey: key })
      onClose()
    },
  })
  const errors = extractFieldErrors(mutation.error) ?? {}
  function textField(key: 'descripcion' | 'empresa' | 'numero_orden_compra' | 'costo' | 'realizado_por', label: string, type = 'text') {
    return <Field label={label} error={errors[key]}><input required={key === 'descripcion'} type={type} min={type === 'number' ? 0 : undefined} step={type === 'number' ? '0.01' : undefined} className={inputClass} value={form[key]} onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))} /></Field>
  }
  return <Modal title={registro ? 'Editar registro' : 'Nuevo registro'} onClose={onClose}>
    <form className="space-y-4" onSubmit={e => { e.preventDefault(); if (form.unidad) mutation.mutate() }}>
      <ErrorPanel error={mutation.error} />
      <div><span className="text-sm font-medium">Unidad</span>
        {unidadPlan ? <p>{unidadPlan.codigo_activo} · {unidadPlan.tipo_equipo_nombre}</p> : registro ? <p>Unidad #{registro.unidad}</p> :
          <AsyncCombobox<Unidad> value={form.unidad || null} selectedItem={unidad} placeholder="Buscar unidad por código o nombre" fetchOptions={buscarUnidades} getOptionId={u => u.id} getOptionLabel={etiquetaUnidad} onChange={(id, u) => { setUnidad(u); setForm(prev => ({ ...prev, unidad: id ?? 0 })) }} />}
        {errors.unidad ? <p className="text-sm text-red-600">{errors.unidad.join(' ')}</p> : null}
      </div>
      {form.plan ? <p className="text-sm text-slate-500">Plan #{form.plan}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo" error={errors.tipo}><select className={inputClass} value={form.tipo} onChange={e => setForm(prev => ({ ...prev, tipo: e.target.value as RegistroMantencionInput['tipo'] }))}>{Object.entries(etiquetasTipoMantencion).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Fecha de solicitud" error={errors.fecha_solicitud}><input type="date" className={inputClass} value={form.fecha_solicitud ?? ''} onChange={e => setForm(prev => ({ ...prev, fecha_solicitud: e.target.value || null }))} /></Field>
        <Field label="Fecha de realización" error={errors.fecha_realizacion}><input required type="date" max={fechaHoy()} className={inputClass} value={form.fecha_realizacion} onChange={e => setForm(prev => ({ ...prev, fecha_realizacion: e.target.value }))} /></Field>
        {textField('descripcion', 'Descripción')}
        {textField('empresa', 'Empresa')}
        <div><span className="text-sm font-medium">Proveedor (opcional)</span>
          {registro?.proveedor && !proveedor && form.proveedor_id ? <p className="text-xs text-slate-500">Actual: {registro.proveedor.nombre}</p> : null}
          <AsyncCombobox<Proveedor> value={form.proveedor_id ?? null} selectedItem={proveedor} placeholder="Buscar proveedor" fetchOptions={buscarProveedores} getOptionId={p => p.id} getOptionLabel={p => p.razon_social} onChange={(id, p) => {
            setProveedor(p); setForm(prev => ({ ...prev, proveedor_id: id, empresa: prev.empresa.trim() ? prev.empresa : p?.razon_social ?? '' }))
          }} />
          {errors.proveedor_id ? <p className="text-sm text-red-600">{errors.proveedor_id.join(' ')}</p> : null}
        </div>
        {textField('numero_orden_compra', 'Número de OC')}
        {textField('costo', 'Costo', 'number')}
        {textField('realizado_por', 'Realizado por')}
        <Field label="Estado resultante" error={errors.estado_resultante}><select className={inputClass} value={form.estado_resultante} onChange={e => setForm(prev => ({ ...prev, estado_resultante: e.target.value as RegistroMantencionInput['estado_resultante'] }))}>
          <option value="">Sin cambio</option><option value="BUENO">Bueno</option><option value="REPARABLE">Reparable</option><option value="MALO">Malo</option>
        </select></Field>
      </div>
      <button className={primaryClass} disabled={mutation.isPending || !form.unidad}>{mutation.isPending ? 'Guardando...' : 'Guardar registro'}</button>
    </form>
  </Modal>
}
