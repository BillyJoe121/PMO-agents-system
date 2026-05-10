export type DocCategory = 'D01' | 'D02' | 'D03' | 'D04' | 'D05' | 'D06' | 'D07' | 'D08' | 'D09' | 'D10' | 'D11';

export const DOCUMENT_CATEGORIES: { value: DocCategory; label: string }[] = [
  { value: 'D01', label: 'Organigrama' },
  { value: 'D02', label: 'Artefactos de Gestión de Proyectos' },
  { value: 'D03', label: 'Plataformas y Sistemas' },
  { value: 'D04', label: 'Listado de Proyectos' },
  { value: 'D05', label: 'Proyecto mejor documentado' },
  { value: 'D06', label: 'Resultados Estratégicos' },
  { value: 'D07', label: 'Mapa de Procesos' },
  { value: 'D08', label: 'Arquitectura Organizacional/TI' },
  { value: 'D09', label: 'Metodología de Proyectos' },
  { value: 'D10', label: 'Portafolio de Productos/Servicios' },
  { value: 'D11', label: 'Otros' },
];
