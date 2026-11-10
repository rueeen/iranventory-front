import { useState } from 'react'
import { isAxiosError } from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { obtenerCapacidadesDocumentos } from '../../api/documentos'
import { descargarFichaMantencion } from '../../api/mantencion'
import { leerErrorBlob } from '../../lib/descargas'
import { queryKeys } from '../../lib/queryKeys'
import { clasesInacap } from '../../lib/theme'
import { extractApiErrorMessage } from '../../types/api'
import { ErrorPanel, buttonClass } from './Shared'

type BotonFichaProps = { unidadId: number; codigo?: string | null; className?: string }

export function BotonFicha({ unidadId, codigo, className = buttonClass }: BotonFichaProps) {
  const qc = useQueryClient()
  const [pdfNoDisponible, setPdfNoDisponible] = useState(false)
  const capacidades = useQuery({
    queryKey: queryKeys.capacidadesDocumentos(),
    queryFn: obtenerCapacidadesDocumentos,
    staleTime: Infinity,
    retry: false,
  })

  async function descargar(formato: 'docx' | 'pdf') {
    try {
      await descargarFichaMantencion(unidadId, formato, codigo)
    } catch (error) {
      const body = await leerErrorBlob(error)
      if (formato === 'pdf' && isAxiosError(error) && error.response?.status === 503 && body?.code === 'pdf_no_disponible') {
        setPdfNoDisponible(true)
        qc.setQueryData(queryKeys.capacidadesDocumentos(), { pdf: false })
        await qc.invalidateQueries({ queryKey: queryKeys.capacidadesDocumentos() })
        // Una conversión fallida prevalece si el servidor sigue anunciando PDF.
        qc.setQueryData(queryKeys.capacidadesDocumentos(), { pdf: false })
        return
      }
      throw new Error(body?.detail || extractApiErrorMessage(error))
    }
  }

  const word = useMutation({ mutationFn: () => descargar('docx') })
  const pdf = useMutation({ mutationFn: () => descargar('pdf') })

  return <div>
    <div className="flex flex-wrap gap-2">
      <button type="button" className={className} disabled={word.isPending} onClick={() => word.mutate()}>
        {word.isPending ? 'Generando…' : 'Ficha Word'}
      </button>
      {capacidades.isSuccess && capacidades.data.pdf === true && !pdfNoDisponible ? (
        <button type="button" className={className} disabled={pdf.isPending} onClick={() => pdf.mutate()}>
          {pdf.isPending ? 'Generando…' : 'Ficha PDF'}
        </button>
      ) : null}
    </div>
    {pdfNoDisponible ? <div role="status" className={`mt-2 rounded-xl p-3 text-sm ${clasesInacap.alertaAdvertencia}`}>
      <p>El servidor no puede generar PDF en este momento. Descarga la ficha en Word.</p>
      <button type="button" className={`mt-2 ${className}`} disabled={word.isPending} onClick={() => word.mutate()}>
        {word.isPending ? 'Generando…' : 'Descargar Word'}
      </button>
    </div> : null}
    <ErrorPanel error={word.error} />
    <ErrorPanel error={pdf.error} />
  </div>
}
