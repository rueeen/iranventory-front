export const coloresInacap = {
  rojoPrincipal: '#E30613',
  rojoPrincipalHover: '#C90010',
  negroInstitucional: '#111827',
  grisOscuro: '#374151',
  grisClaroFondo: '#F3F4F6',
  blanco: '#FFFFFF',
  azulTecnico: '#2563EB',
  verdeExito: '#16A34A',
  ambarAdvertencia: '#D97706',
  rojoError: '#DC2626',
} as const

export const clasesInacap = {
  textoMarca: 'text-[#E30613]',
  fondoMarca: 'bg-[#E30613]',
  bordeMarca: 'border-[#E30613]',
  focoMarca: 'focus:border-[#E30613] focus:ring-[#E30613]/25',
  botonPrimario:
    'bg-[#E30613] text-white hover:bg-[#C90010] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E30613]',
  botonSecundario:
    'border border-slate-300 text-slate-700 hover:border-[#E30613]/40 hover:bg-red-50 hover:text-[#E30613]',
  linkTecnico: 'text-[#2563EB] hover:text-blue-700',
  superficie: 'border border-slate-200 bg-white shadow-sm',
  acentoSuperior: 'before:absolute before:inset-x-8 before:top-0 before:h-1 before:rounded-b-full before:bg-[#E30613]',
  chipInformacion: 'bg-blue-50 text-[#2563EB] ring-blue-200',
  chipExito: 'bg-green-50 text-[#16A34A] ring-green-200',
  chipAdvertencia: 'bg-amber-50 text-[#D97706] ring-amber-200',
  chipError: 'bg-red-50 text-[#DC2626] ring-red-200',
  alertaError: 'border border-red-200 bg-red-50 text-[#DC2626]',
  alertaAdvertencia: 'border border-amber-200 bg-amber-50 text-[#D97706]',
} as const
