type ModulePlaceholderProps = {
  title: string
  description: string
}

export function ModulePlaceholder({ description, title }: ModulePlaceholderProps) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-widest text-sky-600">Módulo</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{title}</h1>
      <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">{description}</p>
    </section>
  )
}
