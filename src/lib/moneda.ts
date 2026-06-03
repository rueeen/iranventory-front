import type { ItemOrdenCompraInput } from '../types/compras'

export type TotalesOrdenCompra = {
  subtotalNeto: number
  descuentos: number
  montoAfecto: number
  iva: number
  totalGeneral: number
}

type ItemMonto = Pick<ItemOrdenCompraInput, 'precio_unitario' | 'cantidad_solicitada'>

function numeroSeguro(valor: string | number | null | undefined): number {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0
  if (!valor) return 0
  const normalizado = valor.replace(',', '.')
  const numero = Number(normalizado)
  return Number.isFinite(numero) ? numero : 0
}

export function redondearPeso(valor: number): number {
  return Math.floor(valor + 0.5)
}

export function calcularTotalesOrdenCompra(
  items: ItemMonto[],
  tasaIva: string | number,
  descuentos: string | number,
): TotalesOrdenCompra {
  const subtotalNeto = items.reduce(
    (total, item) => total + numeroSeguro(item.precio_unitario) * numeroSeguro(item.cantidad_solicitada),
    0,
  )
  const descuentosNormalizados = Math.max(0, numeroSeguro(descuentos))
  const montoAfecto = Math.max(0, subtotalNeto - descuentosNormalizados)
  const iva = redondearPeso(montoAfecto * (numeroSeguro(tasaIva) / 100))

  return {
    subtotalNeto,
    descuentos: descuentosNormalizados,
    montoAfecto,
    iva,
    totalGeneral: montoAfecto + iva,
  }
}

export function formatearCLP(valor: string | number | null | undefined): string {
  return new Intl.NumberFormat('es-CL', {
    currency: 'CLP',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
    style: 'currency',
  }).format(redondearPeso(numeroSeguro(valor)))
}
