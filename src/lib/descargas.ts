import { isAxiosError } from 'axios'

export function descargarBlob(data: Blob, contentDisposition: string | undefined, nombrePorDefecto: string): void {
  const disposition = contentDisposition ?? ''
  const utf8 = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  const plain = disposition.match(/filename="?([^";]+)"?/i)
  let nombre = plain?.[1] ?? nombrePorDefecto
  if (utf8) {
    try { nombre = decodeURIComponent(utf8[1]) } catch { /* Usar nombre simple si está mal codificado. */ }
  }
  const url = URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre.replace(/[\\/]/g, '_')
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function leerErrorBlob(error: unknown): Promise<{ detail?: string; code?: string } | null> {
  if (!isAxiosError(error) || !(error.response?.data instanceof Blob)) return null
  try {
    const data: unknown = JSON.parse(await error.response.data.text())
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null
    const body = data as Record<string, unknown>
    return {
      ...(typeof body.detail === 'string' ? { detail: body.detail } : {}),
      ...(typeof body.code === 'string' ? { code: body.code } : {}),
    }
  } catch {
    return null
  }
}
