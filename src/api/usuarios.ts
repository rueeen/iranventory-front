import { client } from './client'
import { obtenerListaDesdeRespuesta } from './catalogo'
import type { ListParams, Paginated } from '../types/api'
import type { Usuario } from '../types/auth'
import type { UsuarioInput } from '../types/usuarios'

export type UsuariosFiltros = {
  busqueda?: string
  rol?: string
}

type RespuestaListaUsuarios = Paginated<Usuario> | Usuario[]

function construirParams(filtros?: UsuariosFiltros): ListParams {
  const params: ListParams = {}
  const busqueda = filtros?.busqueda?.trim()

  if (busqueda) {
    params.search = busqueda
  }

  if (filtros?.rol) {
    params.rol = filtros.rol
  }

  return params
}

export async function obtenerUsuarios(filtros?: UsuariosFiltros): Promise<Usuario[]> {
  const { data } = await client.get<RespuestaListaUsuarios>('/api/usuarios/', {
    params: construirParams(filtros),
  })

  return obtenerListaDesdeRespuesta(data)
}

export async function actualizarUsuario(id: number, input: UsuarioInput): Promise<Usuario> {
  const { data } = await client.patch<Usuario>(`/api/usuarios/${id}/`, input)
  return data
}

export const usuariosApi = {
  obtenerUsuarios,
  actualizarUsuario,
}
