import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import { formatearCLP } from './moneda'
import type { FichaMantencion } from '../types/mantencion'

function fecha(fecha: string | null): string {
  if (!fecha) return ''
  const partes = fecha.slice(0, 10).split('-')
  return partes.length === 3 ? partes.reverse().join('/') : fecha
}
export function crearPdfFichaMantencion(ficha: FichaMantencion): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const w = doc.internal.pageSize.getWidth()
  const h = doc.internal.pageSize.getHeight()
  const margin = 12
  const colorTexto: [number, number, number] = [15, 23, 42]
  const colorBorde: [number, number, number] = [203, 213, 225]
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(227, 6, 19)
  doc.text('INACAP', margin, 14)
  doc.setDrawColor(227, 6, 19)
  doc.line(margin, 18, w - margin, 18)
  doc.setTextColor(...colorTexto)
  doc.setFontSize(11)
  doc.text('FICHA DE REGISTRO DE MANTENIMIENTO DE EQUIPO', w / 2, 26, { align: 'center' })
  const finalY = () => (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  const defaults = {
    theme: 'grid' as const,
    margin: { left: margin, right: margin, bottom: 22 },
    styles: { fontSize: 8, cellPadding: 2, textColor: colorTexto, lineColor: colorBorde },
  }
  autoTable(doc, {
    ...defaults, startY: 32,
    body: [
      ['NOMBRE DEL EQUIPO', ficha.nombre_equipo ?? ''],
      ['TIPO DE EQUIPO', ficha.tipo_equipo ?? ''],
      ['ÁREA', ficha.area ?? ''],
      ['FECHA SOLICITUD MANTENIMIENTO', fecha(ficha.fecha_solicitud_mantenimiento)],
    ],
    columnStyles: { 0: { fillColor: [243, 244, 246], fontStyle: 'bold', cellWidth: 70 } },
  })
  autoTable(doc, {
    ...defaults, startY: finalY() + 3,
    body: [
      ['MARCA', ficha.marca ?? '', 'MODELO', ficha.modelo ?? ''],
      ['UBICACIÓN', ficha.ubicacion ?? '', 'SERIE', ficha.serie ?? ''],
      ['CÓDIGO INVENTARIO', ficha.codigo_inventario ?? '', 'CÓDIGO PROYECTO', ficha.codigo_proyecto ?? ''],
      ['PERÍODO CALIBRACIÓN', ficha.periodo_calibracion ?? '', 'CÓDIGO PEOPLESOFT', ficha.codigo_peoplesoft ?? ''],
    ],
    columnStyles: {
      0: { fillColor: [243, 244, 246], fontStyle: 'bold', cellWidth: 40 },
      2: { fillColor: [243, 244, 246], fontStyle: 'bold', cellWidth: 40 },
      1: { cellWidth: (w - 2 * margin - 80) / 2 },
      3: { cellWidth: (w - 2 * margin - 80) / 2 },
    },
  })
  const rows = ficha.registros.map(r => [
    fecha(r.fecha_realizacion), r.descripcion, r.empresa, r.orden_compra ?? '', formatearCLP(r.costo),
    r.tipo === 'PREVENTIVO' ? 'X' : '', r.tipo === 'CORRECTIVO' ? 'X' : '',
  ])
  while (rows.length < 12) rows.push(['', '', '', '', '', '', ''])
  autoTable(doc, {
    ...defaults, startY: finalY() + 5,
    head: [['FECHA DE REALIZACIÓN (DÍA/MES/AÑO)', 'DESCRIPCIÓN DE LA ACTIVIDAD', 'NOMBRE EMPRESA',
      'ORDEN DE COMPRA', 'COSTO', 'MANTENIMIENTO PREVENTIVO', 'MANTENIMIENTO CORRECTIVO']],
    body: rows,
    styles: { ...defaults.styles, fontSize: 6.5, minCellHeight: 7, overflow: 'linebreak' },
    headStyles: { fillColor: [227, 6, 19], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6 },
    columnStyles: {
      0: { cellWidth: 25 }, 1: { cellWidth: 48 }, 2: { cellWidth: 26 }, 3: { cellWidth: 22 },
      4: { cellWidth: 23, halign: 'right' }, 5: { halign: 'center' }, 6: { halign: 'center' },
    },
  })
  let y = finalY() + 14
  if (y + 20 > h - 22) { doc.addPage(); y = 30 }
  const ultimo = [...ficha.registros].sort((a, b) => a.fecha_realizacion.localeCompare(b.fecha_realizacion)).at(-1)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  if (ultimo?.realizado_por) {
    const lines = doc.splitTextToSize(ultimo.realizado_por, 100) as string[]
    const alto = lines.length * 4
    if (y + alto + 20 > h - 22) { doc.addPage(); y = 30 }
    doc.text(lines, w / 2, y, { align: 'center' })
    y += alto
  }
  doc.text('___________________________', w / 2, y + 4, { align: 'center' })
  doc.text('Nombre - Firma Colaborador', w / 2, y + 10, { align: 'center' })
  const generado = new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'short' }).format(new Date())
  const total = doc.getNumberOfPages()
  for (let n = 1; n <= total; n++) {
    doc.setPage(n)
    doc.setFontSize(7)
    doc.setTextColor(71, 85, 105)
    doc.setDrawColor(...colorBorde)
    doc.line(margin, h - 17, w - margin, h - 17)
    doc.text(`Sede ${ficha.sede ?? ''} · Generado el ${generado}`, margin, h - 11)
    doc.text(`Página ${n} de ${total}`, w - margin, h - 11, { align: 'right' })
  }
  return doc
}
export function generarPdfFichaMantencion(ficha: FichaMantencion, unidadId: number): void {
  const codigo = (ficha.codigo_inventario || String(unidadId)).replace(/[\\/:*?"<>|]/g, '-')
  crearPdfFichaMantencion(ficha).save(`Ficha_Mantencion_${codigo}.pdf`)
}
