export type DocCategory = 'D01' | 'D02' | 'D03' | 'D04' | 'D05' | 'D06' | 'D07' | 'D08' | 'D09' | 'D10' | 'D11' | 'D12' | 'D13' | 'D14' | 'D15' | 'D16';

export const DOCUMENT_CATEGORIES: { value: DocCategory; label: string }[] = [
  { value: 'D01', label: 'Organigrama' },
  { value: 'D02', label: 'Artefactos de Gestión de proyectos' },
  { value: 'D03', label: 'Plataformas y Sistemas' },
  { value: 'D04', label: 'Listado de Proyectos' },
  { value: 'D05', label: 'Listado de lideres del proyecto' },
  { value: 'D06', label: 'Proyecto mejor documentado' },
  { value: 'D07', label: 'Resultados Estratégicos' },
  { value: 'D08', label: 'Resultados financieros' },
  { value: 'D09', label: 'Mapa de Procesos' },
  { value: 'D10', label: 'Filosofia organizacional' },
  { value: 'D11', label: 'Modelo de Negocio' },
  { value: 'D12', label: 'Arquitectura Organizacional/TI' },
  { value: 'D13', label: 'Metodología de Gestión de Proyectos' },
  { value: 'D14', label: 'Portafolio de Productos/Servicios' },
  { value: 'D15', label: 'Segmentos de clientes' },
  { value: 'D16', label: 'Otros' },
];
