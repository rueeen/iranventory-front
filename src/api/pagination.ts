import { client } from './client'
import type { ListParams, Paginated } from '../types/api'

export type ListResponse<T> = Paginated<T> | T[]

export function esRespuestaPaginada<T>(response: ListResponse<T>): response is Paginated<T> {
  return !Array.isArray(response) && Array.isArray(response.results)
}

export function obtenerListaDesdeRespuesta<T>(response: ListResponse<T>): T[] {
  return esRespuestaPaginada(response) ? response.results : response
}

export async function obtenerPagina<T>(endpoint: string, params?: ListParams): Promise<Paginated<T>> {
  const { data } = await client.get<Paginated<T>>(endpoint, { params })
  return data
}

export async function fetchAllPages<T>(endpoint: string, params?: ListParams): Promise<T[]> {
  const firstPageParams: ListParams = { ...params, page: params?.page ?? 1 }
  const { data: firstPageData } = await client.get<ListResponse<T>>(endpoint, { params: firstPageParams })
  const data = firstPageData as ListResponse<T>

  if (!esRespuestaPaginada(data)) {
    return data
  }

  const results: T[] = [...data.results]
  let currentPage = Number(firstPageParams.page) || 1
  let hasNextPage = Boolean(data.next)

  while (hasNextPage) {
    currentPage += 1
    const { data: nextPageData } = await client.get<ListResponse<T>>(endpoint, {
      params: {
        ...params,
        page: currentPage,
      },
    })
    const nextPage = nextPageData as ListResponse<T>

    if (!esRespuestaPaginada(nextPage)) {
      results.push(...(nextPage as T[]))
      break
    }

    results.push(...nextPage.results)
    hasNextPage = Boolean(nextPage.next)
  }

  return results
}
