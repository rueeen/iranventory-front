import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { dashboardApi, type DashboardTotal } from '../api/dashboard'
import { tieneRol, useAuth } from '../features/auth/AuthContext'
import { queryKeys } from '../lib/queryKeys'
import { clasesInacap } from '../lib/theme'
import type { Rol } from '../types/auth'

type DashboardMetric = {
  title: string
  description: string
  query: UseQueryResult<DashboardTotal, Error>
  roles: Rol[]
}

type QuickAccess = {
  label: string
  description: string
  to: string
  roles: Rol[]
}

const rolesStaff: Rol[] = ['PANOLERO', 'DIRECTOR']
const rolesPrestamos: Rol[] = ['ALUMNO', 'DOCENTE', 'PANOLERO', 'DIRECTOR']

const quickAccesses: QuickAccess[] = [
  {
    label: 'Ver inventario',
    description: 'Consultar tipos de equipo, unidades y disponibilidad.',
    to: '/inventario',
    roles: rolesStaff,
  },
  {
    label: 'Ver préstamos',
    description: 'Revisar solicitudes, entregas y devoluciones.',
    to: '/prestamos',
    roles: rolesPrestamos,
  },
  {
    label: 'Ver compras',
    description: 'Dar seguimiento a órdenes y necesidades de compra.',
    to: '/compras',
    roles: rolesStaff,
  },
]

const roleLabels: Record<Rol, string> = {
  ALUMNO: 'Alumno',
  DOCENTE: 'Docente',
  PANOLERO: 'Pañolero',
  DIRECTOR: 'Director',
}

function formatTotal(total: number): string {
  return new Intl.NumberFormat('es-CL').format(total)
}

function MetricCard({ description, query, title }: DashboardMetric) {
  const isEmpty = query.data?.total === 0

  return (
    <article className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="absolute left-0 top-0 h-full w-1 bg-[#E30613]" />
      <p className="text-sm font-medium text-slate-500">{title}</p>

      {query.isLoading ? (
        <p className="mt-4 text-sm text-slate-500">Cargando...</p>
      ) : query.isError ? (
        <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          No se pudo cargar este dato.
        </p>
      ) : (
        <>
          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
            {formatTotal(query.data?.total ?? 0)}
          </p>
          {isEmpty ? (
            <p className="mt-2 text-sm text-slate-500">Sin registros por ahora.</p>
          ) : (
            <p className="mt-2 text-sm text-slate-500">{description}</p>
          )}
        </>
      )}
    </article>
  )
}

export function Home() {
  const { usuario } = useAuth()

  const puedeVerMetricasStaff = tieneRol(usuario, rolesStaff)
  const puedeVerMetricasPrestamos = tieneRol(usuario, rolesPrestamos)

  const totalTiposEquipoQuery = useQuery<DashboardTotal, Error>({
    queryKey: queryKeys.dashboard.totalTiposEquipo(),
    queryFn: dashboardApi.obtenerTotalTiposEquipo,
    enabled: puedeVerMetricasStaff,
  })
  const totalUnidadesQuery = useQuery<DashboardTotal, Error>({
    queryKey: queryKeys.dashboard.totalUnidades(),
    queryFn: dashboardApi.obtenerTotalUnidades,
    enabled: puedeVerMetricasStaff,
  })
  const totalPrestamosQuery = useQuery<DashboardTotal, Error>({
    queryKey: queryKeys.dashboard.totalPrestamos(),
    queryFn: dashboardApi.obtenerTotalPrestamos,
    enabled: puedeVerMetricasPrestamos,
  })
  const totalOrdenesCompraQuery = useQuery<DashboardTotal, Error>({
    queryKey: queryKeys.dashboard.totalOrdenesCompra(),
    queryFn: dashboardApi.obtenerTotalOrdenesCompra,
    enabled: puedeVerMetricasStaff,
  })

  const metrics: DashboardMetric[] = [
    {
      title: 'Tipos de equipo',
      description: 'Total de tipos registrados en el catálogo.',
      query: totalTiposEquipoQuery,
      roles: rolesStaff,
    },
    {
      title: 'Unidades',
      description: 'Total de unidades registradas en inventario.',
      query: totalUnidadesQuery,
      roles: rolesStaff,
    },
    {
      title: 'Préstamos',
      description: 'Total de préstamos registrados.',
      query: totalPrestamosQuery,
      roles: rolesPrestamos,
    },
    {
      title: 'Órdenes de compra',
      description: 'Total de órdenes de compra registradas.',
      query: totalOrdenesCompraQuery,
      roles: rolesStaff,
    },
  ]

  const visibleMetrics = metrics.filter((metric) => tieneRol(usuario, metric.roles))

  return (
    <section className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="absolute left-0 top-0 h-1 w-full bg-[#E30613]" />
        <p className={`text-sm font-semibold uppercase tracking-widest ${clasesInacap.textoMarca}`}>Dashboard</p>
        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">Inicio</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
              Vista general protegida con información real del inventario y accesos directos a los
              módulos principales.
            </p>
          </div>
        </div>
      </div>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">
          Usuario autenticado
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm text-slate-500">Username</p>
            <p className="mt-1 text-xl font-semibold text-slate-950">
              {usuario?.username ?? 'Usuario sin identificar'}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Rol</p>
            <p className={`mt-1 text-xl font-semibold ${clasesInacap.textoMarca}`}>
              {usuario ? roleLabels[usuario.rol] : 'Rol no disponible'}
            </p>
          </div>
        </div>
      </article>

      <div>
        <div className="mb-4">
          <h2 className="text-xl font-bold tracking-tight text-slate-950">Resumen de inventario</h2>
          <p className="mt-1 text-sm text-slate-500">
            Cada indicador se carga de forma independiente para que un endpoint con error no rompa
            el dashboard completo.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {visibleMetrics.map((metric) => (
            <MetricCard key={metric.title} {...metric} />
          ))}
        </div>
      </div>

      <div>
        <div className="mb-4">
          <h2 className="text-xl font-bold tracking-tight text-slate-950">Accesos rápidos</h2>
          <p className="mt-1 text-sm text-slate-500">Atajos a las vistas principales del sistema.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {quickAccesses.map((access) => {
            const canAccess = tieneRol(usuario, access.roles)

            if (!canAccess) {
              return (
                <article
                  className="rounded-2xl border border-slate-200 bg-slate-100 p-5 text-slate-400 shadow-sm"
                  key={access.to}
                >
                  <span className="text-base font-semibold">{access.label}</span>
                  <p className="mt-2 text-sm leading-6">{access.description}</p>
                  <p className="mt-4 rounded-xl bg-white px-3 py-2 text-xs font-medium text-slate-500">
                    Tu rol no tiene permiso para entrar a este módulo.
                  </p>
                </article>
              )
            }

            return (
              <Link
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#E30613]/40 hover:shadow-md"
                key={access.to}
                to={access.to}
              >
                <span className="text-base font-semibold text-slate-950">{access.label}</span>
                <p className="mt-2 text-sm leading-6 text-slate-500">{access.description}</p>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
