import { useAuth } from '../features/auth/AuthContext'

export function Home() {
  const { usuario } = useAuth()

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-widest text-sky-600">Dashboard</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">Bienvenido al sistema</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
          Esta es la página inicial protegida de Inventario IRA. Desde el menú lateral podés acceder
          a los módulos disponibles para tu rol.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm uppercase tracking-widest text-slate-500">Usuario autenticado</p>
          <p className="mt-2 text-xl font-semibold text-slate-950">{usuario?.username}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm uppercase tracking-widest text-slate-500">Rol</p>
          <p className="mt-2 text-xl font-semibold text-sky-700">{usuario?.rol}</p>
        </article>
      </div>
    </section>
  )
}
