import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { tieneRol, useAuth } from '../features/auth/AuthContext'
import type { Rol } from '../types/auth'

type ProtectedRouteProps = {
  children: ReactNode
  roles?: Rol[]
}

export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { usuario, isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-sky-300 border-t-transparent" />
          <p className="text-sm font-medium text-slate-300">Cargando sesión...</p>
        </div>
      </main>
    )
  }

  if (!isAuthenticated) {
    return <Navigate replace state={{ from: location }} to="/login" />
  }

  if (roles && !tieneRol(usuario, roles)) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-6 text-center text-slate-900">
        <p className="text-sm font-semibold uppercase tracking-widest text-red-600">403</p>
        <h1 className="text-3xl font-bold">Sin permisos</h1>
        <p className="max-w-md text-slate-600">
          Tu rol actual no tiene permisos para acceder a esta sección.
        </p>
      </main>
    )
  }

  return <>{children}</>
}
