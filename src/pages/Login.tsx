import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { isAxiosError } from 'axios'
import { z } from 'zod'

import { useAuth } from '../features/auth/AuthContext'
import type { LoginCredentials } from '../types/auth'

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Ingresá tu usuario'),
  password: z.string().min(1, 'Ingresá tu contraseña'),
})

type LoginFormValues = LoginCredentials

type LoginLocationState = {
  from?: {
    pathname?: string
    search?: string
    hash?: string
  }
}

function getRedirectPath(state: unknown): string {
  const locationState = state as LoginLocationState | null
  const from = locationState?.from

  if (!from?.pathname) {
    return '/'
  }

  return `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`
}

function getLoginErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const status = error.response?.status

    if (status === 400 || status === 401) {
      return 'Usuario o contraseña incorrectos'
    }

    if (status) {
      return 'Demasiados intentos fallidos. Esperá unos minutos e intentá de nuevo.'
    }
  }

  return 'No pudimos iniciar sesión. Revisá tu conexión e intentá de nuevo.'
}

export function Login() {
  const { isAuthenticated, login } = useAuth()
  const [serverError, setServerError] = useState<string | null>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const redirectPath = getRedirectPath(location.state)
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm<LoginFormValues>({
    defaultValues: {
      username: '',
      password: '',
    },
  })

  useEffect(() => {
    if (isAuthenticated) {
      navigate(redirectPath, { replace: true })
    }
  }, [isAuthenticated, navigate, redirectPath])

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)

    const parsed = loginSchema.safeParse(values)

    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0]

        if (field === 'username' || field === 'password') {
          setError(field, { message: issue.message, type: 'manual' })
        }
      })
      return
    }

    try {
      await login(parsed.data)
      navigate(redirectPath, { replace: true })
    } catch (error) {
      setServerError(getLoginErrorMessage(error))
    }
  })

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12 text-slate-100">
      <section className="w-full max-w-md rounded-3xl border border-red-500/20 bg-slate-900/90 p-8 shadow-2xl shadow-black/50">
        <div className="mb-8 space-y-3 text-center">
          <span className="inline-flex rounded-full bg-[#E30613] px-4 py-1 text-xs font-bold uppercase tracking-widest text-white">
            Inventario IRA
          </span>
          <h1 className="text-3xl font-bold tracking-tight">Iniciar sesión</h1>
          <p className="text-sm text-slate-400">
            Ingresá con tus credenciales para acceder al sistema.
          </p>
        </div>

        <form className="space-y-5" noValidate onSubmit={onSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200" htmlFor="username">
              Usuario
            </label>
            <input
              autoComplete="username"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-[#E30613] focus:ring-2 focus:ring-[#E30613]/30"
              id="username"
              type="text"
              {...register('username')}
            />
            {errors.username?.message ? (
              <p className="text-sm text-red-300">{errors.username.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200" htmlFor="password">
              Contraseña
            </label>
            <input
              autoComplete="current-password"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-[#E30613] focus:ring-2 focus:ring-[#E30613]/30"
              id="password"
              type="password"
              {...register('password')}
            />
            {errors.password?.message ? (
              <p className="text-sm text-red-300">{errors.password.message}</p>
            ) : null}
          </div>

          {serverError ? (
            <div className="rounded-xl border border-red-400/40 bg-red-950/40 px-4 py-3 text-sm text-red-100">
              {serverError}
            </div>
          ) : null}

          <button
            className="w-full rounded-xl bg-[#E30613] px-4 py-3 font-semibold text-white transition hover:bg-[#c90010] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <Link className="mt-6 block text-center text-sm text-slate-400 hover:text-red-300" to="/">
          Volver al inicio
        </Link>
      </section>
    </main>
  )
}
