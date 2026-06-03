import { useAuth } from '../../features/auth/AuthContext'
import type { Usuario } from '../../types/auth'

function getUserDisplayName(usuario: Usuario | null): string {
  if (!usuario) {
    return 'Usuario'
  }

  const fullName = [usuario.first_name, usuario.last_name].filter(Boolean).join(' ').trim()

  return fullName || usuario.username
}

export function Header() {
  const { logout, usuario } = useAuth()

  return (
    <header className="border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-sky-600">Inventario IRA</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">Panel de trabajo</h2>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2">
            <p className="text-sm font-semibold text-slate-900">{getUserDisplayName(usuario)}</p>
            <p className="text-xs uppercase tracking-wider text-slate-500">Rol: {usuario?.rol}</p>
          </div>

          <button
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700"
            type="button"
            onClick={() => {
              void logout()
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </header>
  )
}
