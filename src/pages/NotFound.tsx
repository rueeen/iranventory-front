import { Link } from 'react-router-dom'

import { clasesInacap } from '../lib/theme'

export function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F3F4F6] px-6 text-center text-slate-900">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className={`text-sm font-semibold uppercase tracking-widest ${clasesInacap.textoMarca}`}>404</p>
        <h1 className="mt-3 text-3xl font-bold">Página no encontrada</h1>
        <p className="mt-3 max-w-md text-slate-600">
          La ruta solicitada no existe o fue movida.
        </p>
        <Link className={`mt-6 inline-flex rounded-lg px-4 py-2 font-medium transition ${clasesInacap.botonPrimario}`} to="/">
          Volver al inicio
        </Link>
      </div>
    </main>
  )
}
