import { client } from './client'

export async function obtenerCapacidadesDocumentos(): Promise<{ pdf: boolean }> {
  const { data } = await client.get<{ pdf: boolean }>('/api/documentos/capacidades/')
  return data
}
