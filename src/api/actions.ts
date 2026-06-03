import { client } from './client'
import type { OrdenCompra } from '../types/compras'
import type { Prestamo, RegistrarDevolucionItem } from '../types/prestamos'

async function postAction<T>(path: string, payload?: unknown): Promise<T> {
  const { data } = await client.post<T>(path, payload)
  return data
}

export function enviarRevisionOC(id: number): Promise<OrdenCompra> {
  return postAction<OrdenCompra>(`/api/ordenes-compra/${id}/enviar-revision/`)
}

export function aceptarOC(id: number): Promise<OrdenCompra> {
  return postAction<OrdenCompra>(`/api/ordenes-compra/${id}/aceptar/`)
}

export function rechazarOC(id: number, observaciones?: string): Promise<OrdenCompra> {
  return postAction<OrdenCompra>(`/api/ordenes-compra/${id}/rechazar/`, { observaciones })
}

export function aprobarPrestamo(id: number): Promise<Prestamo> {
  return postAction<Prestamo>(`/api/prestamos/${id}/aprobar/`)
}

export function rechazarPrestamo(id: number, motivo?: string): Promise<Prestamo> {
  return postAction<Prestamo>(`/api/prestamos/${id}/rechazar/`, { motivo })
}

export function prepararPrestamo(id: number): Promise<Prestamo> {
  return postAction<Prestamo>(`/api/prestamos/${id}/preparar/`)
}

export function entregarPrestamo(id: number): Promise<Prestamo> {
  return postAction<Prestamo>(`/api/prestamos/${id}/entregar/`)
}

export function iniciarDevolucion(id: number): Promise<Prestamo> {
  return postAction<Prestamo>(`/api/prestamos/${id}/iniciar-devolucion/`)
}

export function registrarDevolucion(
  id: number,
  detalles: RegistrarDevolucionItem[],
): Promise<Prestamo> {
  return postAction<Prestamo>(`/api/prestamos/${id}/registrar-devolucion/`, { detalles })
}

export function cerrarPrestamo(id: number): Promise<Prestamo> {
  return postAction<Prestamo>(`/api/prestamos/${id}/cerrar/`)
}
