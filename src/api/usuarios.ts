import { client } from './client'
import { fetchAllPages, obtenerPagina } from './pagination'
import type { ListParams, Paginated } from '../types/api'
import type { Usuario } from '../types/auth'
import type { UsuarioInput } from '../types/usuarios'

export type UsuariosFiltros = {
  busqueda?: string
  rol?: string
  page?: number
}

function construirParams(filtros?: UsuariosFiltros): ListParams {
  const params: ListParams = {}
  const busqueda = filtros?.busqueda?.trim()

  if (busqueda) {
    params.search = busqueda
  }

  if (filtros?.rol) {
    params.rol = filtros.rol
  }

  if (filtros?.page) {
    params.page = filtros.page
  }

  return params
}

export function obtenerUsuarios(filtros?: UsuariosFiltros): Promise<Usuario[]> {
  return fetchAllPages<Usuario>('/api/usuarios/', construirParams(filtros))
}

export function obtenerUsuariosPaginados(filtros?: UsuariosFiltros): Promise<Paginated<Usuario>> {
  return obtenerPagina<Usuario>('/api/usuarios/', construirParams(filtros))
}

export async function actualizarUsuario(id: number, input: UsuarioInput): Promise<Usuario> {
  const { data } = await client.patch<Usuario>(`/api/usuarios/${id}/`, input)
  return data
}

export const usuariosApi = {
  obtenerUsuarios,
  obtenerUsuariosPaginados,
  actualizarUsuario,
}
