import { useAuth } from '../features/auth/AuthContext'

export function Home() {
  const { logout, usuario } = useAuth()

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <section className="mx-auto flex max-w-4xl flex-col items-start gap-6 rounded-3xl border border-sky-400/30 bg-slate-900/80 p-8 shadow-2xl shadow-sky-950/40">
        <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="w-fit rounded-full bg-sky-400 px-4 py-1 text-sm font-semibold uppercase tracking-wide text-slate-950">
            Taller IRA
          </span>
          <button
            className="w-fit rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-sky-400 hover:text-sky-300"
            type="button"
            onClick={() => {
              void logout()
            }}
          >
            Cerrar sesión
          </button>
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">Inventario IRA</h1>
          <p className="max-w-2xl text-lg text-slate-300">
            Sesión activa contra el backend. Esta vista está protegida y confirma que la
            rehidratación del usuario funciona.
          </p>
        </div>

        <div className="grid w-full gap-4 rounded-2xl border border-slate-700 bg-slate-950/70 p-5 sm:grid-cols-2">
          <div>
            <p className="text-sm uppercase tracking-widest text-slate-500">Usuario</p>
            <p className="mt-1 text-xl font-semibold text-slate-100">{usuario?.username}</p>
          </div>
          <div>
            <p className="text-sm uppercase tracking-widest text-slate-500">Rol</p>
            <p className="mt-1 text-xl font-semibold text-sky-300">{usuario?.rol}</p>
          </div>
        </div>
      </section>
    </main>
  )
}
