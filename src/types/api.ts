import { isAxiosError } from 'axios'

export type Paginated<T> = {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export type ListParams = {
  page?: number
  search?: string
  [key: string]: string | number | boolean | undefined
}

export type ApiFieldErrors = Record<string, string[]>

type ApiErrorData =
  | string[]
  | {
      detail?: unknown
      code?: unknown
      [key: string]: unknown
    }

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function getErrorData(error: unknown): ApiErrorData | null {
  if (!isAxiosError(error)) {
    return null
  }

  const data = error.response?.data

  if (isStringArray(data) || (data && typeof data === 'object' && !Array.isArray(data))) {
    return data as ApiErrorData
  }

  return null
}

export function extractFieldErrors(error: unknown): ApiFieldErrors | null {
  const data = getErrorData(error)

  if (!data || Array.isArray(data)) {
    return null
  }

  const entries = Object.entries(data).filter(
    ([field, messages]) => field !== 'detail' && field !== 'code' && isStringArray(messages),
  ) as Array<[string, string[]]>

  if (entries.length === 0) {
    return null
  }

  return Object.fromEntries(entries)
}

export function extractApiErrorMessage(error: unknown): string {
  const data = getErrorData(error)

  if (Array.isArray(data)) {
    return data.join(' ')
  }

  if (data) {
    if (typeof data.detail === 'string') {
      return data.detail
    }

    const fieldErrors = extractFieldErrors(error)

    if (fieldErrors) {
      return Object.values(fieldErrors).flat().join(' ')
    }
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return 'Ocurrió un error inesperado.'
}
