import type { ListParams } from '../types/api'

function resourceKeys(resource: string) {
  return {
    all: [resource] as const,
    lists: () => [resource, 'list'] as const,
    list: (params?: ListParams) => [resource, 'list', params ?? {}] as const,
    details: () => [resource, 'detail'] as const,
    detail: (id: number) => [resource, 'detail', id] as const,
  }
}

export const queryKeys = {
  categorias: resourceKeys('categorias'),
  carreras: resourceKeys('carreras'),
  asignaturas: resourceKeys('asignaturas'),
  ubicaciones: resourceKeys('ubicaciones'),
  tiposEquipo: resourceKeys('tiposEquipo'),
  unidades: resourceKeys('unidades'),
  ordenesCompra: resourceKeys('ordenesCompra'),
  itemsOrdenCompra: resourceKeys('itemsOrdenCompra'),
  prestamos: resourceKeys('prestamos'),
  usuarios: resourceKeys('usuarios'),
  dashboard: {
    all: ['dashboard'] as const,
    totalTiposEquipo: () => ['dashboard', 'totalTiposEquipo'] as const,
    totalUnidades: () => ['dashboard', 'totalUnidades'] as const,
    totalPrestamos: () => ['dashboard', 'totalPrestamos'] as const,
    totalOrdenesCompra: () => ['dashboard', 'totalOrdenesCompra'] as const,
  },
}
