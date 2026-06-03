import { client } from './client'
import type {
  Asignatura,
  Carrera,
  Categoria,
  TipoEquipo,
  TipoEquipoInput,
  Ubicacion,
} from '../types/catalogo'
import type {
  ItemOrdenCompra,
  ItemOrdenCompraInput,
  OrdenCompra,
  OrdenCompraInput,
} from '../types/compras'
import type { Unidad, UnidadInput } from '../types/inventario'
import type { Paginated, ListParams } from '../types/api'
import type { Prestamo, PrestamoInput } from '../types/prestamos'
import type { Usuario } from '../types/auth'
import type { UsuarioInput } from '../types/usuarios'

export type ResourceApi<TRead, TInput> = {
  list: (params?: ListParams) => Promise<Paginated<TRead>>
  retrieve: (id: number) => Promise<TRead>
  create: (payload: TInput) => Promise<TRead>
  update: (id: number, payload: Partial<TInput>) => Promise<TRead>
  remove: (id: number) => Promise<void>
}

export type ReadUpdateResourceApi<TRead, TInput> = Pick<
  ResourceApi<TRead, TInput>,
  'list' | 'retrieve' | 'update'
>

function normalizeBasePath(basePath: string): string {
  const trimmed = basePath.replace(/^\/+|\/+$/g, '')
  return `/api/${trimmed}/`
}

export function createResource<TRead, TInput>(basePath: string): ResourceApi<TRead, TInput> {
  const path = normalizeBasePath(basePath)

  return {
    async list(params?: ListParams): Promise<Paginated<TRead>> {
      const { data } = await client.get<Paginated<TRead>>(path, { params })
      return data
    },

    async retrieve(id: number): Promise<TRead> {
      const { data } = await client.get<TRead>(`${path}${id}/`)
      return data
    },

    async create(payload: TInput): Promise<TRead> {
      const { data } = await client.post<TRead>(path, payload)
      return data
    },

    async update(id: number, payload: Partial<TInput>): Promise<TRead> {
      const { data } = await client.patch<TRead>(`${path}${id}/`, payload)
      return data
    },

    async remove(id: number): Promise<void> {
      await client.delete(`${path}${id}/`)
    },
  }
}

export const categoriasApi = createResource<Categoria, Omit<Categoria, 'id'>>('categorias/')
export const carrerasApi = createResource<Carrera, Omit<Carrera, 'id'>>('carreras/')
export const asignaturasApi = createResource<Asignatura, Omit<Asignatura, 'id'>>('asignaturas/')
export const ubicacionesApi = createResource<Ubicacion, Omit<Ubicacion, 'id'>>('ubicaciones/')
export const tiposEquipoApi = createResource<TipoEquipo, TipoEquipoInput>('tipos-equipo/')
export const unidadesApi = createResource<Unidad, UnidadInput>('unidades/')
export const ordenesCompraApi = createResource<OrdenCompra, OrdenCompraInput>('ordenes-compra/')
export const itemsOrdenCompraApi = createResource<ItemOrdenCompra, ItemOrdenCompraInput>(
  'items-orden-compra/',
)
export const prestamosApi = createResource<Prestamo, PrestamoInput>('prestamos/')
const usuariosResource = createResource<Usuario, UsuarioInput>('usuarios/')

export const usuariosApi: ReadUpdateResourceApi<Usuario, UsuarioInput> = {
  list: usuariosResource.list,
  retrieve: usuariosResource.retrieve,
  update: usuariosResource.update,
}
