import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'

import { API_BASE_URL } from '../lib/config'
import { clearTokens, getAccess, getRefresh, setTokens } from '../lib/tokenStorage'
import type { LoginCredentials, TokenPair, Usuario } from '../types/auth'

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean
}

type UnauthorizedHandler = () => void

const TOKEN_PATH = '/api/token/'
const REFRESH_PATH = '/api/token/refresh/'
const BLACKLIST_PATH = '/api/token/blacklist/'
const ME_PATH = '/api/me/'

let refreshPromise: Promise<TokenPair> | null = null
let unauthorizedHandler: UnauthorizedHandler | null = null

const rawClient = axios.create({
  baseURL: API_BASE_URL,
})

export const client = axios.create({
  baseURL: API_BASE_URL,
})

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler
}

export async function login(credentials: LoginCredentials): Promise<TokenPair> {
  const { data } = await rawClient.post<TokenPair>(TOKEN_PATH, credentials)
  return data
}

export async function refreshTokens(refresh: string): Promise<TokenPair> {
  const { data } = await rawClient.post<TokenPair>(REFRESH_PATH, { refresh })
  return data
}

export async function blacklist(refresh: string): Promise<void> {
  await rawClient.post(BLACKLIST_PATH, { refresh })
}

export async function fetchMe(): Promise<Usuario> {
  const { data } = await client.get<Usuario>(ME_PATH)
  return data
}

function isAuthEndpoint(url?: string): boolean {
  if (!url) {
    return false
  }

  return url.includes(TOKEN_PATH) || url.includes(REFRESH_PATH)
}

function getOrCreateRefreshPromise(refresh: string): Promise<TokenPair> {
  if (!refreshPromise) {
    refreshPromise = refreshTokens(refresh)
      .then((tokens) => {
        setTokens(tokens)
        return tokens
      })
      .finally(() => {
        refreshPromise = null
      })
  }

  return refreshPromise
}

client.interceptors.request.use((config) => {
  const access = getAccess()

  if (access) {
    config.headers.Authorization = `Bearer ${access}`
  }

  return config
})

client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableRequestConfig | undefined

    if (error.response?.status !== 401 || !originalRequest || originalRequest._retry) {
      return Promise.reject(error)
    }

    if (isAuthEndpoint(originalRequest.url)) {
      return Promise.reject(error)
    }

    const refresh = getRefresh()

    if (!refresh) {
      clearTokens()
      unauthorizedHandler?.()
      return Promise.reject(error)
    }

    originalRequest._retry = true

    try {
      const tokens = await getOrCreateRefreshPromise(refresh)
      originalRequest.headers.Authorization = `Bearer ${tokens.access}`
      return client(originalRequest)
    } catch (refreshError) {
      clearTokens()
      unauthorizedHandler?.()
      return Promise.reject(refreshError)
    }
  },
)
