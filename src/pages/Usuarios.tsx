import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { usuariosApi, type UsuariosFiltros } from '../api/usuarios'
import { useAuth } from '../features/auth/AuthContext'
import { clasesInacap } from '../lib/theme'
import { queryKeys } from '../lib/queryKeys'
import { extractApiErrorMessage, extractFieldErrors } from '../types/api'
import type { Rol, Usuario } from '../types/auth'
import type { UsuarioInput } from '../types/usuarios'

const roles: Rol[] = ['ALUMNO', 'DOCENTE', 'PANOLERO', 'DIRECTOR']

const etiquetasRol: Record<Rol, string> = {
  ALUMNO: 'Alumno',
  DOCENTE: 'Docente',
  PANOLERO: 'Pañolero',
  DIRECTOR: 'Director',
}

const estilosRol: Record<Rol, string> = {
  ALUMNO: 'bg-slate-100 text-slate-700 ring-slate-200',
  DOCENTE: clasesInacap.chipInformacion,
  PANOLERO: clasesInacap.chipAdvertencia,
  DIRECTOR: clasesInacap.chipError,
}

type UsuarioFormState = {
  email: string
  firstName: string
  lastName: string
  rol: Rol
  rut: string
}

function normalizarTexto(valor: string): string {
  return valor.toLocaleLowerCase('es-CL').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function formatearTexto(valor: string | null | undefined, reemplazo = 'Sin información'): string {
  return valor?.trim() ? valor : reemplazo
}

function obtenerNombreCompleto(usuario: Usuario): string {
  const nombre = [usuario.first_name, usuario.last_name].filter(Boolean).join(' ').trim()
  return nombre || 'Sin nombre registrado'
}

function crearEstadoUsuario(usuario: Usuario): UsuarioFormState {
  return {
    email: usuario.email ?? '',
    firstName: usuario.first_name ?? '',
    lastName: usuario.last_name ?? '',
    rol: usuario.rol,
    rut: usuario.rut ?? '',
  }
}

function construirUsuarioInput(state: UsuarioFormState): UsuarioInput {
  const rut = state.rut.trim()

  return {
    email: state.email.trim(),
    first_name: state.firstName.trim(),
    last_name: state.lastName.trim(),
    rol: state.rol,
    rut: rut ? rut : null,
  }
}

function usuarioCoincideConBusqueda(usuario: Usuario, busqueda: string): boolean {
  const termino = normalizarTexto(busqueda.trim())

  if (!termino) {
    return true
  }

  const valores = [
    String(usuario.id),
    usuario.username,
    usuario.email,
    usuario.first_name,
    usuario.last_name,
    usuario.rol,
    usuario.rut ?? '',
  ]

  return valores.some((valor) => normalizarTexto(valor).includes(termino))
}

function RolBadge({ rol }: { rol: Rol }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${estilosRol[rol]}`}>
      {etiquetasRol[rol]}
    </span>
  )
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null
  }

  return <p className="mt-1 text-xs font-medium text-[#DC2626]">{messages.join(' ')}</p>
}

function UsuariosTable({
  canEdit,
  onEdit,
  usuarios,
}: {
  canEdit: boolean
  onEdit: (usuario: Usuario) => void
  usuarios: Usuario[]
}) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-semibold">Usuario</th>
            <th className="px-4 py-3 font-semibold">Nombre</th>
            <th className="px-4 py-3 font-semibold">Email</th>
            <th className="px-4 py-3 font-semibold">RUT</th>
            <th className="px-4 py-3 font-semibold">Rol</th>
            {canEdit ? <th className="px-4 py-3 text-right font-semibold">Acciones</th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {usuarios.map((usuario) => (
            <tr className="align-top" key={usuario.id}>
              <td className="px-4 py-4">
                <p className="font-semibold text-slate-950">{usuario.username}</p>
                <p className="mt-1 text-xs text-slate-500">ID {usuario.id}</p>
              </td>
              <td className="px-4 py-4 text-slate-700">{obtenerNombreCompleto(usuario)}</td>
              <td className="px-4 py-4 text-slate-700">{formatearTexto(usuario.email)}</td>
              <td className="px-4 py-4 text-slate-700">{formatearTexto(usuario.rut, 'Sin RUT')}</td>
              <td className="px-4 py-4">
                <RolBadge rol={usuario.rol} />
              </td>
              {canEdit ? (
                <td className="px-4 py-4 text-right">
                  <button
                    className={`rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition ${clasesInacap.botonPrimario}`}
                    onClick={() => onEdit(usuario)}
                    type="button"
                  >
                    Editar
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Usuarios() {
  const { usuario } = useAuth()
  const queryClient = useQueryClient()
  const [busqueda, setBusqueda] = useState('')
  const [rol, setRol] = useState<Rol | ''>('')
  const [usuarioEditando, setUsuarioEditando] = useState<Usuario | null>(null)
  const [form, setForm] = useState<UsuarioFormState | null>(null)

  const canEdit = usuario?.rol === 'DIRECTOR'
  const filtros: UsuariosFiltros = { busqueda, rol }

  const usuariosQuery = useQuery<Usuario[], Error>({
    queryKey: queryKeys.usuarios.list(filtros),
    queryFn: () => usuariosApi.obtenerUsuarios(filtros),
  })

  const actualizarUsuarioMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: UsuarioInput }) => usuariosApi.actualizarUsuario(id, input),
    onSuccess: () => {
      setUsuarioEditando(null)
      setForm(null)
      void queryClient.invalidateQueries({ queryKey: queryKeys.usuarios.lists() })
    },
  })

  const usuariosFiltrados = useMemo(() => {
    const usuarios = usuariosQuery.data ?? []

    return usuarios.filter(
      (usuarioItem) => (!rol || usuarioItem.rol === rol) && usuarioCoincideConBusqueda(usuarioItem, busqueda),
    )
  }, [busqueda, rol, usuariosQuery.data])

  const abrirEdicion = (usuarioSeleccionado: Usuario) => {
    setUsuarioEditando(usuarioSeleccionado)
    setForm(crearEstadoUsuario(usuarioSeleccionado))
    actualizarUsuarioMutation.reset()
  }

  const cerrarEdicion = () => {
    if (actualizarUsuarioMutation.isPending) {
      return
    }

    setUsuarioEditando(null)
    setForm(null)
    actualizarUsuarioMutation.reset()
  }

  const guardarUsuario = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!usuarioEditando || !form) {
      return
    }

    actualizarUsuarioMutation.mutate({
      id: usuarioEditando.id,
      input: construirUsuarioInput(form),
    })
  }

  const fieldErrors = extractFieldErrors(actualizarUsuarioMutation.error)
  const mutationErrorMessage = actualizarUsuarioMutation.isError
    ? extractApiErrorMessage(actualizarUsuarioMutation.error)
    : null
  const queryErrorMessage = usuariosQuery.isError ? extractApiErrorMessage(usuariosQuery.error) : null

  return (
    <section className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="absolute left-0 top-0 h-1 w-full bg-[#E30613]" />
        <p className={`text-sm font-semibold uppercase tracking-widest ${clasesInacap.textoMarca}`}>Usuarios</p>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">Administración de usuarios</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
              Vista alpha conectada a <span className="font-semibold text-slate-800">/api/usuarios/</span> para
              consultar cuentas y permitir al Director actualizar datos básicos, rol y RUT sin modificar passwords.
            </p>
          </div>
          <p className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600">
            {usuariosFiltrados.length} resultado{usuariosFiltrados.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Búsqueda por texto</span>
            <input
              className={`mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:ring-4 ${clasesInacap.focoMarca}`}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Buscar por usuario, email, nombre, rol o RUT"
              type="search"
              value={busqueda}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Rol</span>
            <select
              className={`mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:ring-4 ${clasesInacap.focoMarca}`}
              onChange={(event) => setRol(event.target.value as Rol | '')}
              value={rol}
            >
              <option value="">Todos los roles</option>
              {roles.map((rolOption) => (
                <option key={rolOption} value={rolOption}>
                  {etiquetasRol[rolOption]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {usuariosQuery.isLoading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-500">Cargando usuarios...</p>
        </div>
      ) : null}

      {usuariosQuery.isError ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-widest text-[#DC2626]">Error</p>
          <h2 className="mt-2 text-xl font-bold text-red-950">No se pudieron cargar los usuarios</h2>
          <p className="mt-2 text-sm leading-6 text-[#DC2626]">{queryErrorMessage}</p>
        </div>
      ) : null}

      {usuariosQuery.isSuccess && usuariosFiltrados.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">Sin resultados</p>
          <h2 className="mt-2 text-xl font-bold text-slate-950">No hay usuarios para mostrar</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Ajusta los filtros o verifica que existan usuarios registrados en el backend.
          </p>
        </div>
      ) : null}

      {usuariosQuery.isSuccess && usuariosFiltrados.length > 0 ? (
        <UsuariosTable canEdit={canEdit} onEdit={abrirEdicion} usuarios={usuariosFiltrados} />
      ) : null}

      {usuarioEditando && form ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
          <div className="max-h-full w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-widest text-[#E30613]">Editar usuario</p>
                <h2 className="mt-1 text-2xl font-bold text-slate-950">{usuarioEditando.username}</h2>
                <p className="mt-1 text-sm text-slate-500">La contraseña no se muestra ni se edita desde esta vista.</p>
              </div>
              <button
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${clasesInacap.botonSecundario}`}
                disabled={actualizarUsuarioMutation.isPending}
                onClick={cerrarEdicion}
                type="button"
              >
                Cerrar
              </button>
            </div>

            <form className="mt-6 space-y-5" onSubmit={guardarUsuario}>
              {mutationErrorMessage ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-[#DC2626]">
                  {mutationErrorMessage}
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Email</span>
                  <input
                    className={`mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition focus:ring-4 ${clasesInacap.focoMarca}`}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    type="email"
                    value={form.email}
                  />
                  <FieldError messages={fieldErrors?.email} />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Rol</span>
                  <select
                    className={`mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition focus:ring-4 ${clasesInacap.focoMarca}`}
                    onChange={(event) => setForm({ ...form, rol: event.target.value as Rol })}
                    value={form.rol}
                  >
                    {roles.map((rolOption) => (
                      <option key={rolOption} value={rolOption}>
                        {etiquetasRol[rolOption]}
                      </option>
                    ))}
                  </select>
                  <FieldError messages={fieldErrors?.rol} />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Nombre</span>
                  <input
                    className={`mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition focus:ring-4 ${clasesInacap.focoMarca}`}
                    onChange={(event) => setForm({ ...form, firstName: event.target.value })}
                    type="text"
                    value={form.firstName}
                  />
                  <FieldError messages={fieldErrors?.first_name} />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Apellido</span>
                  <input
                    className={`mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition focus:ring-4 ${clasesInacap.focoMarca}`}
                    onChange={(event) => setForm({ ...form, lastName: event.target.value })}
                    type="text"
                    value={form.lastName}
                  />
                  <FieldError messages={fieldErrors?.last_name} />
                </label>

                <label className="block md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">RUT</span>
                  <input
                    className={`mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:ring-4 ${clasesInacap.focoMarca}`}
                    onChange={(event) => setForm({ ...form, rut: event.target.value })}
                    placeholder="12345678-9"
                    type="text"
                    value={form.rut}
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Puede quedar vacío. Si lo ingresas, usa formato de referencia 12345678-9; el backend realiza la
                    validación definitiva.
                  </p>
                  <FieldError messages={fieldErrors?.rut} />
                </label>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
                <button
                  className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={actualizarUsuarioMutation.isPending}
                  onClick={cerrarEdicion}
                  type="button"
                >
                  Cancelar
                </button>
                <button
                  className={`rounded-xl px-5 py-3 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-70 ${clasesInacap.botonPrimario}`}
                  disabled={actualizarUsuarioMutation.isPending}
                  type="submit"
                >
                  {actualizarUsuarioMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  )
}
