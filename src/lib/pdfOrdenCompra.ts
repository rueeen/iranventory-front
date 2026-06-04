import { jsPDF } from 'jspdf'
import { autoTable, type CellHookData } from 'jspdf-autotable'

import { formatearCLP } from './moneda'
import type { OrdenCompra } from '../types/compras'

const margenX = 14
const anchoEtiqueta = 44
const colorMarca: [number, number, number] = [227, 6, 19]
const colorTexto: [number, number, number] = [15, 23, 42]
const colorTextoSuave: [number, number, number] = [71, 85, 105]
const colorBorde: [number, number, number] = [203, 213, 225]

type JsPdfConAutoTable = jsPDF & {
  lastAutoTable?: {
    finalY?: number
  }
}

function textoSeguro(valor: string | number | null | undefined, reemplazo = 'Sin información'): string {
  if (valor === null || typeof valor === 'undefined') return reemplazo
  const texto = String(valor).trim()
  return texto || reemplazo
}

function textoOpcional(valor: string | number | null | undefined): string | null {
  if (valor === null || typeof valor === 'undefined') return null
  const texto = String(valor).trim()
  return texto || null
}

function formatearFecha(fecha: string | null | undefined): string | null {
  if (!fecha) return null
  const date = new Date(fecha)
  if (Number.isNaN(date.getTime())) return fecha
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium' }).format(date)
}

function formatearFechaHora(fecha: Date): string {
  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(fecha)
}

function nombreArchivoSeguro(valor: string): string {
  return valor.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').trim() || 'orden-compra'
}

function agregarLineaDato(doc: jsPDF, etiqueta: string, valor: string, x: number, y: number, anchoValor: number): number {
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...colorTexto)
  doc.text(`${etiqueta}:`, x, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...colorTextoSuave)
  const lineas = doc.splitTextToSize(valor, anchoValor)
  doc.text(lineas, x + anchoEtiqueta, y)
  return y + Math.max(lineas.length, 1) * 5.2
}

function agregarSeccionDatos(
  doc: jsPDF,
  titulo: string,
  datos: Array<[string, string | null]>,
  x: number,
  y: number,
  ancho: number,
): number {
  const anchoValor = ancho - anchoEtiqueta - 8
  const datosVisibles = datos
    .filter(([, valor]) => valor)
    .map(([etiqueta, valor]) => ({
      etiqueta,
      lineas: doc.splitTextToSize(valor ?? '', anchoValor) as string[],
      valor: valor ?? '',
    }))
  if (datosVisibles.length === 0) return y

  const altoContenido = datosVisibles.reduce((total, dato) => total + Math.max(dato.lineas.length, 1) * 5.2, 0)
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(...colorBorde)
  doc.roundedRect(x, y, ancho, 18 + altoContenido, 2, 2, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...colorTexto)
  doc.text(titulo, x + 4, y + 7)

  let cursorY = y + 14
  datosVisibles.forEach(({ etiqueta, valor }) => {
    cursorY = agregarLineaDato(doc, etiqueta, valor, x + 4, cursorY, anchoValor)
  })

  return cursorY + 4
}

function agregarTotales(doc: jsPDF, orden: OrdenCompra, yInicial: number): number {
  const anchoPagina = doc.internal.pageSize.getWidth()
  const altoPagina = doc.internal.pageSize.getHeight()
  const anchoCaja = 76
  const x = anchoPagina - margenX - anchoCaja
  const filas: Array<[string, string, boolean]> = [
    ['Subtotal neto', formatearCLP(orden.subtotal_neto), false],
    ['Descuentos', formatearCLP(orden.descuentos), false],
    ['Monto afecto', formatearCLP(orden.monto_afecto), false],
    [`IVA (${textoSeguro(orden.tasa_iva, '0')}%)`, formatearCLP(orden.iva), false],
    ['Total general', formatearCLP(orden.total_general), true],
  ]
  const altoCaja = 10 + filas.length * 8

  let y = yInicial
  if (y + altoCaja > altoPagina - 24) {
    doc.addPage()
    y = 22
  }

  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(...colorBorde)
  doc.roundedRect(x, y, anchoCaja, altoCaja, 2, 2, 'FD')
  doc.setFontSize(10)

  let cursorY = y + 10
  filas.forEach(([etiqueta, valor, destacado]) => {
    if (destacado) {
      doc.setDrawColor(...colorBorde)
      doc.line(x + 4, cursorY - 4, x + anchoCaja - 4, cursorY - 4)
      doc.setFontSize(11)
      doc.setTextColor(...colorTexto)
    } else {
      doc.setFontSize(10)
      doc.setTextColor(...colorTextoSuave)
    }

    doc.setFont('helvetica', destacado ? 'bold' : 'normal')
    doc.text(etiqueta, x + 4, cursorY)
    doc.text(valor, x + anchoCaja - 4, cursorY, { align: 'right' })
    cursorY += 8
  })

  return y + altoCaja
}

function agregarPiePaginas(doc: jsPDF, orden: OrdenCompra, generadoEn: Date): void {
  const totalPaginas = doc.getNumberOfPages()
  const anchoPagina = doc.internal.pageSize.getWidth()
  const altoPagina = doc.internal.pageSize.getHeight()
  const textoGeneracion = formatearFechaHora(generadoEn)

  for (let pagina = 1; pagina <= totalPaginas; pagina += 1) {
    doc.setPage(pagina)
    doc.setDrawColor(...colorBorde)
    doc.line(margenX, altoPagina - 15, anchoPagina - margenX, altoPagina - 15)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...colorTextoSuave)
    doc.text(`Estado: ${orden.estado} · Generado: ${textoGeneracion}`, margenX, altoPagina - 9)
    doc.text(`Página ${pagina} de ${totalPaginas}`, anchoPagina - margenX, altoPagina - 9, { align: 'right' })
  }
}

export function generarPdfOrdenCompra(orden: OrdenCompra): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as JsPdfConAutoTable
  const anchoPagina = doc.internal.pageSize.getWidth()
  const generadoEn = new Date()
  const numeroDescarga = textoOpcional(orden.numero_inacap) ?? textoSeguro(orden.numero, String(orden.id))
  const fechas: Array<[string, string | null]> = [
    ['Emisión', formatearFecha(orden.fecha_emision)],
    ['Publicación', formatearFecha(orden.fecha_publicacion)],
    ['Documento', formatearFecha(orden.fecha_documento)],
  ]

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...colorMarca)
  doc.setFontSize(13)
  doc.text('INACAP', margenX, 16)
  doc.setDrawColor(...colorMarca)
  doc.setLineWidth(1.2)
  doc.line(margenX, 20, anchoPagina - margenX, 20)

  doc.setTextColor(...colorTexto)
  doc.setFontSize(19)
  doc.text('ORDEN DE COMPRA', margenX, 32)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...colorTextoSuave)
  doc.text(`Número interno: ${textoSeguro(orden.numero, 'Sin número interno')}`, margenX, 40)
  doc.text(`N° INACAP: ${textoSeguro(orden.numero_inacap)}`, margenX, 46)

  let fechaY = 34
  fechas.forEach(([etiqueta, valor]) => {
    if (!valor) return
    doc.text(`${etiqueta}: ${valor}`, anchoPagina - margenX, fechaY, { align: 'right' })
    fechaY += 6
  })

  const proveedor = orden.proveedor
  const proveedorY = agregarSeccionDatos(
    doc,
    'Proveedor',
    [
      ['Razón social', textoSeguro(proveedor?.razon_social)],
      ['RUT', textoSeguro(proveedor?.rut)],
      ['Dirección', textoOpcional(proveedor?.direccion)],
      ['Ciudad', textoOpcional(proveedor?.ciudad)],
      ['Contacto', textoOpcional(proveedor?.contacto_nombre)],
      ['Email', textoOpcional(proveedor?.email)],
    ],
    margenX,
    56,
    86,
  )

  const cabeceraY = agregarSeccionDatos(
    doc,
    'Facturación / despacho',
    [
      ['Sede destino', textoOpcional(orden.sede_destino)],
      ['Dirección', textoOpcional(orden.direccion_despacho)],
      ['Recibido por', textoOpcional(orden.recibido_por_nombre)],
      ['Comprador', textoOpcional(orden.comprador_nombre)],
      ['Ref. pedido', textoOpcional(orden.referencia_pedido)],
      ['Cód. inversión', textoOpcional(orden.codigo_inversion)],
    ],
    108,
    56,
    anchoPagina - 108 - margenX,
  )

  let cursorY = Math.max(proveedorY, cabeceraY) + 6
  if (!orden.items?.length) {
    doc.setFillColor(255, 251, 235)
    doc.setDrawColor(253, 230, 138)
    doc.roundedRect(margenX, cursorY, anchoPagina - margenX * 2, 11, 2, 2, 'FD')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(146, 64, 14)
    doc.text('Esta orden de compra no tiene ítems informados.', margenX + 4, cursorY + 7)
    cursorY += 16
  }

  autoTable(doc, {
    body: (orden.items ?? []).map((item, index) => [
      String(index + 1),
      textoSeguro(item.codigo_material, '—'),
      textoSeguro(item.observaciones, item.tipo_equipo.nombre),
      String(item.cantidad_solicitada),
      textoSeguro(item.unidad_medida, 'UNI'),
      formatearCLP(item.precio_unitario),
      formatearCLP(item.total_linea),
    ]),
    head: [['#', 'Código material', 'Descripción', 'Cant.', 'UM', 'P. Unit. Neto', 'Total Neto']],
    margin: { left: margenX, right: margenX, bottom: 22 },
    startY: cursorY,
    styles: {
      cellPadding: 2.2,
      font: 'helvetica',
      fontSize: 8.5,
      overflow: 'linebreak',
      textColor: colorTexto,
      valign: 'top',
    },
    headStyles: {
      fillColor: colorMarca,
      fontStyle: 'bold',
      textColor: [255, 255, 255],
    },
    columnStyles: {
      0: { cellWidth: 9, halign: 'center' },
      1: { cellWidth: 28 },
      2: { cellWidth: 64 },
      3: { cellWidth: 14, halign: 'right' },
      4: { cellWidth: 13, halign: 'center' },
      5: { cellWidth: 25, halign: 'right' },
      6: { cellWidth: 29, halign: 'right' },
    },
    didParseCell: (data: CellHookData) => {
      if (data.section === 'body' && [3, 5, 6].includes(data.column.index)) {
        data.cell.styles.halign = 'right'
      }
    },
  })

  cursorY = (doc.lastAutoTable?.finalY ?? cursorY) + 8
  agregarTotales(doc, orden, cursorY)
  agregarPiePaginas(doc, orden, generadoEn)

  doc.save(`OC-${nombreArchivoSeguro(numeroDescarga)}.pdf`)
}
