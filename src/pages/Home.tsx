export function Home() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <section className="mx-auto flex max-w-4xl flex-col items-start gap-6 rounded-3xl border border-sky-400/30 bg-slate-900/80 p-8 shadow-2xl shadow-sky-950/40">
        <span className="rounded-full bg-sky-400 px-4 py-1 text-sm font-semibold uppercase tracking-wide text-slate-950">
          Taller IRA
        </span>
        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">Inventario IRA</h1>
          <p className="max-w-2xl text-lg text-slate-300">
            Frontend base con Vite, React 18, TypeScript, React Router, React Query y
            Tailwind CSS listo para las siguientes etapas.
          </p>
        </div>
      </section>
    </main>
  )
}
