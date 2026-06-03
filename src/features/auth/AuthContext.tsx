import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import {
  blacklist,
  fetchMe,
  login as requestLogin,
  setUnauthorizedHandler,
} from '../../api/client'
import { clearTokens, getAccess, getRefresh, setTokens } from '../../lib/tokenStorage'
import type { LoginCredentials, Rol, Usuario } from '../../types/auth'

type AuthContextValue = {
  usuario: Usuario | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: PropsWithChildren) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const clearLocalSession = useCallback(() => {
    clearTokens()
    setUsuario(null)
    void queryClient.invalidateQueries()
  }, [queryClient])

  const logout = useCallback(async () => {
    const refresh = getRefresh()

    if (refresh) {
      try {
        await blacklist(refresh)
      } catch {
        // El logout local debe continuar aunque el backend no pueda invalidar el refresh.
      }
    }

    clearLocalSession()
  }, [clearLocalSession])

  const login = useCallback(async (credentials: LoginCredentials) => {
    const tokens = await requestLogin(credentials)
    setTokens(tokens)
    const me = await fetchMe()
    setUsuario(me)
  }, [])

  useEffect(() => {
    let isMounted = true

    async function hydrateSession() {
      const access = getAccess()
      const refresh = getRefresh()

      if (!access || !refresh) {
        clearTokens()
        if (isMounted) {
          setUsuario(null)
          setIsLoading(false)
        }
        return
      }

      try {
        const me = await fetchMe()
        if (isMounted) {
          setUsuario(me)
        }
      } catch {
        clearTokens()
        if (isMounted) {
          setUsuario(null)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void hydrateSession()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearLocalSession()
      navigate('/login', { replace: true })
    })

    return () => {
      setUnauthorizedHandler(null)
    }
  }, [clearLocalSession, navigate])

  const value = useMemo<AuthContextValue>(
    () => ({
      usuario,
      isAuthenticated: Boolean(usuario),
      isLoading,
      login,
      logout,
    }),
    [isLoading, login, logout, usuario],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }

  return context
}

export function tieneRol(usuario: Usuario | null, roles: Rol[]): boolean {
  return Boolean(usuario && roles.includes(usuario.rol))
}

export function useRol(roles: Rol[]): boolean {
  const { usuario } = useAuth()
  return tieneRol(usuario, roles)
}
