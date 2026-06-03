import type { TokenPair } from '../types/auth'

const ACCESS_KEY = 'ira.access'
const REFRESH_KEY = 'ira.refresh'

function getStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage
}

export function getAccess(): string | null {
  return getStorage()?.getItem(ACCESS_KEY) ?? null
}

export function getRefresh(): string | null {
  return getStorage()?.getItem(REFRESH_KEY) ?? null
}

export function setTokens({ access, refresh }: TokenPair): void {
  const storage = getStorage()

  if (!storage) {
    return
  }

  storage.setItem(ACCESS_KEY, access)
  storage.setItem(REFRESH_KEY, refresh)
}

export function clearTokens(): void {
  const storage = getStorage()

  if (!storage) {
    return
  }

  storage.removeItem(ACCESS_KEY)
  storage.removeItem(REFRESH_KEY)
}
