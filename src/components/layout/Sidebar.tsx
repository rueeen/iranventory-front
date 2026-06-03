import { NavLink } from 'react-router-dom'

import { useAuth } from '../../features/auth/AuthContext'
import { clasesInacap } from '../../lib/theme'
import type { Rol } from '../../types/auth'

type MenuItem = {
  label: string
  to: string
  roles: Rol[]
}

const menuItems: MenuItem[] = [
  {
    label: 'Dashboard',
    to: '/',
    roles: ['ALUMNO', 'DOCENTE', 'PANOLERO', 'DIRECTOR'],
  },
  {
    label: 'Inventario',
    to: '/inventario',
    roles: ['PANOLERO', 'DIRECTOR'],
  },
  {
    label: 'Préstamos',
    to: '/prestamos',
    roles: ['ALUMNO', 'DOCENTE', 'PANOLERO', 'DIRECTOR'],
  },
  {
    label: 'Compras',
    to: '/compras',
    roles: ['PANOLERO', 'DIRECTOR'],
  },
  {
    label: 'Usuarios',
    to: '/usuarios',
    roles: ['DIRECTOR'],
  },
]

export function Sidebar() {
  const { usuario } = useAuth()
  const visibleItems = menuItems.filter((item) => usuario && item.roles.includes(usuario.rol))

  return (
    <aside className="flex w-full flex-col border-b border-slate-900 bg-[#111827] text-white md:min-h-screen md:w-64 md:border-b-0 md:border-r md:border-slate-900">
      <div className="border-b border-slate-800 px-6 py-6">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-red-200">Sistema institucional</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Inventario IRA</h1>
        <div className="mt-4 h-1 w-16 rounded-full bg-[#E30613]" />
      </div>

      <nav className="flex gap-2 overflow-x-auto px-4 py-4 md:flex-1 md:flex-col md:overflow-visible">
        {visibleItems.map((item) => (
          <NavLink
            className={({ isActive }) =>
              [
                'whitespace-nowrap rounded-xl px-4 py-3 text-sm font-medium transition',
                isActive
                  ? `${clasesInacap.fondoMarca} text-white shadow-lg shadow-[#E30613]/25`
                  : 'text-slate-300 hover:bg-[#374151] hover:text-white',
              ].join(' ')
            }
            end={item.to === '/'}
            key={item.to}
            to={item.to}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
