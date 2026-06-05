import { useCallback, useState, type ChangeEvent, type DragEvent, type FormEvent, type ReactNode } from 'react'
import { isAxiosError } from 'axios'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { catalogoApi } from '../api/catalogo'
import { queryKeys } from '../lib/queryKeys'
import { clasesInacap } from '../lib/theme'
import { extractApiErrorMessage } from '../types/api'
import type { ResumenImportacion } from '../types/catalogo'

const MAX_FILE_SIZE_MB = 10
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

function validarArchivo(file: File): string | null {
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    return 'El archivo debe tener extensión .xlsx.'
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `El archivo no puede superar los ${MAX_FILE_SIZE_MB} MB.`
  }

  return null
}

function getImportErrorMessage(error: unknown): string {
  const message = extractApiErrorMessage(error)

  if (!isAxiosError(error)) {
    return message
  }

  if (error.response?.status === 400) {
    return message === 'Request failed with status code 400'
      ? 'El archivo no es un .xlsx válido o está corrupto. Revisa el Excel e inténtalo nuevamente.'
      : message
  }

  if (error.response?.status === 403) {
    return message === 'Request failed with status code 403'
      ? 'No tienes permisos para importar el estándar. Esta acción está disponible solo para pañoleros y directores.'
      : message
  }

  return message
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function PageCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-3xl ${clasesInacap.superficie} ${clasesInacap.acentoSuperior} ${className}`}>
      {children}
    </div>
  )
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="text-sm font-semibold text-slate-700">{children}</span>
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-[#DC2626]">
      <p className="font-semibold text-red-950">No se pudo importar el estándar</p>
      <p className="mt-1 leading-6">{message}</p>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-3xl font-bold text-slate-950">{value}</p>
      <p className="mt-1 text-sm font-medium text-slate-600">{label}</p>
    </div>
  )
}

function ResultPanel({ resumen }: { resumen: ResumenImportacion }) {
  const advertencias = resumen.advertencias ?? []

  return (
    <PageCard className="p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className={`text-sm font-semibold uppercase tracking-widest ${clasesInacap.textoMarca}`}>Resultado</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-950">Importación completada</h2>
          <p className="mt-2 text-sm text-slate-500">El catálogo fue actualizado y las vistas relacionadas se refrescarán automáticamente.</p>
        </div>
        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${clasesInacap.chipExito}`}>
          ✓ Procesado
        </span>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tipos de equipo creados" value={resumen.tipos_equipo_creados} />
        <StatCard label="Tipos de equipo actualizados" value={resumen.tipos_equipo_actualizados} />
        <StatCard label="Asignaturas creadas" value={resumen.asignaturas_creadas} />
        <StatCard label="Vínculos creados" value={resumen.vinculos_creados} />
      </div>

      {advertencias.length > 0 ? (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Advertencias para revisar</p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            {advertencias.map((advertencia, index) => (
              <li key={`${advertencia}-${index}`}>{advertencia}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-[#16A34A]">
          ✓ Importación sin advertencias.
        </div>
      )}
    </PageCard>
  )
}

export function ImportarEstandar() {
  const queryClient = useQueryClient()
  const [archivo, setArchivo] = useState<File | null>(null)
  const [clientError, setClientError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [ultimoResumen, setUltimoResumen] = useState<ResumenImportacion | null>(null)

  const importarMutation = useMutation({
    mutationFn: catalogoApi.importarEstandar,
    onSuccess: async (resumen) => {
      setUltimoResumen(resumen)
      setArchivo(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.tiposEquipo.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.asignaturas.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
      ])
    },
  })

  const seleccionarArchivo = useCallback((file: File | null) => {
    importarMutation.reset()
    setUltimoResumen(null)

    if (!file) {
      setArchivo(null)
      setClientError(null)
      return
    }

    const error = validarArchivo(file)

    if (error) {
      setArchivo(null)
      setClientError(error)
      return
    }

    setArchivo(file)
    setClientError(null)
  }, [importarMutation])

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    seleccionarArchivo(event.target.files?.[0] ?? null)
    event.target.value = ''
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragActive(true)
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragActive(false)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragActive(false)
    seleccionarArchivo(event.dataTransfer.files?.[0] ?? null)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!archivo) {
      setClientError('Selecciona un archivo .xlsx antes de importar.')
      return
    }

    const error = validarArchivo(archivo)

    if (error) {
      setClientError(error)
      return
    }

    setClientError(null)
    importarMutation.mutate(archivo)
  }

  const isProcessing = importarMutation.isPending
  const serverError = importarMutation.isError ? getImportErrorMessage(importarMutation.error) : null

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={`text-sm font-semibold uppercase tracking-widest ${clasesInacap.textoMarca}`}>Catálogo</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Importar estándar</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Sube el Excel del Estándar de Equipamiento INACAP para crear o actualizar tipos de equipo, asignaturas y vínculos del catálogo.
          </p>
        </div>
      </div>

      <PageCard className="p-6">
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
          <p className="font-semibold">Importante</p>
          <p className="mt-1">
            Esta importación carga el estándar (cantidades objetivo). El stock real se gestiona aparte; los equipos se crearán con stock en cero hasta que registres las unidades existentes.
          </p>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <FieldLabel>Archivo Excel (.xlsx)</FieldLabel>
            <div
              className={[
                'rounded-2xl border-2 border-dashed bg-slate-50 px-6 py-8 text-center transition',
                dragActive ? 'border-[#E30613] bg-red-50' : 'border-slate-300 hover:border-[#E30613]/50',
              ].join(' ')}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <label className="flex cursor-pointer flex-col items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-2xl shadow-sm">📄</span>
                <span className="text-base font-semibold text-slate-900">Arrastra el archivo aquí o selecciónalo desde tu equipo</span>
                <span className="text-sm text-slate-500">Solo archivos .xlsx de hasta {MAX_FILE_SIZE_MB} MB.</span>
                <input
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="sr-only"
                  disabled={isProcessing}
                  type="file"
                  onChange={handleFileChange}
                />
              </label>
            </div>
          </div>

          {archivo ? (
            <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-slate-900">{archivo.name}</p>
                <p className="text-slate-500">{formatBytes(archivo.size)}</p>
              </div>
              <button
                className={`self-start rounded-xl px-3 py-2 text-sm font-semibold transition ${clasesInacap.botonSecundario}`}
                disabled={isProcessing}
                type="button"
                onClick={() => seleccionarArchivo(null)}
              >
                Quitar
              </button>
            </div>
          ) : null}

          {clientError ? <ErrorPanel message={clientError} /> : null}
          {serverError ? <ErrorPanel message={serverError} /> : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">La importación puede tardar varios segundos según el tamaño del archivo.</p>
            <button
              className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${clasesInacap.botonPrimario}`}
              disabled={isProcessing || !archivo}
              type="submit"
            >
              {isProcessing ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Procesando...
                </>
              ) : (
                'Importar'
              )}
            </button>
          </div>
        </form>
      </PageCard>

      {ultimoResumen ? <ResultPanel resumen={ultimoResumen} /> : null}
    </section>
  )
}
