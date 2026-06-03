import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center text-slate-900">
      <p className="text-sm font-semibold uppercase tracking-widest text-sky-600">404</p>
      <h1 className="text-3xl font-bold">Página no encontrada</h1>
      <p className="max-w-md text-slate-600">
        La ruta solicitada no existe en el frontend de Inventario IRA.
      </p>
      <Link className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700" to="/">
        Volver al inicio
      </Link>
    </main>
  )
}
