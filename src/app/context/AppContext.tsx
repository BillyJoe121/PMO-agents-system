import React, { createContext, useContext, useState, ReactNode } from 'react';

export type PhaseStatus = 'bloqueado' | 'disponible' | 'procesando' | 'completado' | 'error';

export interface Auditor {
  id: string;
  name: string;
  initials: string;
  color: string;
}

export interface Phase {
  number: number;
  name: string;
  status: PhaseStatus;
  completedAt?: string;
  agentDiagnosis?: string;
}

export interface Project {
  id: string;
  companyName: string;
  projectName: string;
  startDate: string;
  auditors: Auditor[];
  phases: Phase[];
  status: 'en_ejecucion' | 'completado';
}

const PHASE_NAMES = [
  'Diagnóstico de Idoneidad',
  'Registro de Entrevistas',
  'Gestión Documental',
  'Análisis Estratégico',
  'Diagnóstico Organizacional',
  'Plan de Mejora',
  'Implementación',
  'Cierre y Entrega',
];

function computePhaseAvailability(phases: Phase[]): Phase[] {
  return phases.map((phase, idx) => {
    if (phase.status === 'completado' || phase.status === 'procesando') return phase;
    // Phases 1, 2, 3 (index 0,1,2) are available from start
    if (idx < 3) {
      return phase.status === 'bloqueado' ? { ...phase, status: 'disponible' } : phase;
    }
    // Phase 4 (index 3) unlocks when 0,1,2 are all completado
    if (idx === 3) {
      const allFirstThreeDone = phases.slice(0, 3).every(p => p.status === 'completado');
      return { ...phase, status: allFirstThreeDone ? 'disponible' : 'bloqueado' };
    }
    // Phases 5-8 (index 4-7): sequential
    const previousDone = phases[idx - 1]?.status === 'completado';
    return { ...phase, status: previousDone ? 'disponible' : 'bloqueado' };
  });
}

function createInitialPhases(): Phase[] {
  return computePhaseAvailability(
    PHASE_NAMES.map((name, i) => ({
      number: i + 1,
      name,
      status: 'bloqueado' as PhaseStatus,
    }))
  );
}

const MOCK_AUDITORS: Auditor[] = [
  { id: 'c1', name: 'Ana García', initials: 'AG', color: '#030213' },
  { id: 'c2', name: 'Carlos Mejía', initials: 'CM', color: '#059669' },
  { id: 'c3', name: 'Laura Torres', initials: 'LT', color: '#7c3aed' },
  { id: 'c4', name: 'Pedro Ruiz', initials: 'PR', color: '#dc2626' },
  { id: 'c5', name: 'María López', initials: 'ML', color: '#d97706' },
];

const INITIAL_PROJECTS: Project[] = [
  {
    id: 'p1',
    companyName: 'TechCorp Colombia',
    projectName: 'Diagnóstico PMO 2024',
    startDate: '2024-03-01',
    auditors: [MOCK_AUDITORS[0], MOCK_AUDITORS[1]],
    status: 'en_ejecucion',
    phases: (() => {
      const phases = createInitialPhases();
      phases[0] = { ...phases[0], status: 'completado', completedAt: '2024-03-15', agentDiagnosis: 'Score de idoneidad: 78/100. La organización presenta condiciones favorables para la implementación de una PMO. Se recomienda iniciar con estructura básica de gobierno.' };
      phases[1] = { ...phases[1], status: 'completado', completedAt: '2024-03-22', agentDiagnosis: 'Análisis consolidado de 5 entrevistas. Temas recurrentes: falta de estandarización de procesos, comunicación deficiente entre áreas y ausencia de métricas claras.' };
      phases[2] = { ...phases[2], status: 'procesando' };
      return computePhaseAvailability(phases);
    })(),
  },
  {
    id: 'p2',
    companyName: 'Bancolombia S.A.',
    projectName: 'Transformación Digital PMO',
    startDate: '2024-02-15',
    auditors: [MOCK_AUDITORS[2], MOCK_AUDITORS[3], MOCK_AUDITORS[4]],
    status: 'en_ejecucion',
    phases: (() => {
      const phases = createInitialPhases();
      phases[0] = { ...phases[0], status: 'completado', completedAt: '2024-02-28', agentDiagnosis: 'Score de idoneidad: 91/100. Organización altamente madura con infraestructura robusta.' };
      phases[1] = { ...phases[1], status: 'completado', completedAt: '2024-03-05', agentDiagnosis: 'Análisis de 8 entrevistas ejecutivas. Alineación estratégica clara, necesidad de estándares metodológicos unificados.' };
      phases[2] = { ...phases[2], status: 'completado', completedAt: '2024-03-10', agentDiagnosis: 'Documentación evaluada: 15 artefactos. Completitud del 87%. Se identificaron brechas en actas de constitución.' };
      phases[3] = { ...phases[3], status: 'disponible' };
      return computePhaseAvailability(phases);
    })(),
  },
  {
    id: 'p3',
    companyName: 'Grupo Empresarial SURA',
    projectName: 'Auditoría Estratégica Q1',
    startDate: '2024-01-10',
    auditors: [MOCK_AUDITORS[0], MOCK_AUDITORS[4]],
    status: 'completado',
    phases: PHASE_NAMES.map((name, i) => ({
      number: i + 1,
      name,
      status: 'completado' as PhaseStatus,
      completedAt: `2024-0${i + 1}-${10 + i}`,
    })),
  },
  {
    id: 'p4',
    companyName: 'Demo — Maestro Detalle',
    projectName: 'Fase 2 en Estado Activo',
    startDate: '2024-04-01',
    auditors: [MOCK_AUDITORS[0]],
    status: 'en_ejecucion',
    phases: (() => {
      const phases = createInitialPhases();
      phases[0] = {
        ...phases[0],
        status: 'completado',
        completedAt: '2024-04-10',
        agentDiagnosis: 'Score de idoneidad: 83/100. Condiciones favorables para la PMO.',
      };
      return computePhaseAvailability(phases);
    })(),
  },
  {
    id: 'p5',
    companyName: 'Demo — Fase 1',
    projectName: 'Diagnóstico de Idoneidad (desarrollo)',
    startDate: '2026-04-26',
    auditors: [MOCK_AUDITORS[0]],
    status: 'en_ejecucion',
    // Fase 1 en 'disponible', fases 2–8 bloqueadas (punto de partida cero)
    phases: createInitialPhases(),
  },
  {
    id: 'p6',
    companyName: 'Demo — Fase 4',
    projectName: 'Clasificación de Proyectos (desarrollo)',
    startDate: '2026-04-26',
    auditors: [MOCK_AUDITORS[0]],
    status: 'en_ejecucion',
    // Fases 1, 2 y 3 completadas → Fase 4 se desbloquea automáticamente
    phases: (() => {
      const phases = createInitialPhases();
      phases[0] = { ...phases[0], status: 'completado', completedAt: '26/04/2026', agentDiagnosis: 'Score de idoneidad: 82/100.' };
      phases[1] = { ...phases[1], status: 'completado', completedAt: '26/04/2026', agentDiagnosis: 'Análisis de 6 entrevistas consolidado.' };
      phases[2] = { ...phases[2], status: 'completado', completedAt: '26/04/2026', agentDiagnosis: 'Documentación evaluada: 12 artefactos.' };
      return computePhaseAvailability(phases);
    })(),
  },
  {
    id: 'p7',
    companyName: 'Demo — Fase 5',
    projectName: 'Madurez de la PMO (desarrollo)',
    startDate: '2026-04-26',
    auditors: [MOCK_AUDITORS[0]],
    status: 'en_ejecucion',
    // Fases 1–4 completadas → Fase 5 disponible; Fase 4 con PMO Híbrida para probar ambas encuestas
    phases: (() => {
      const phases = createInitialPhases();
      phases[0] = { ...phases[0], status: 'completado', completedAt: '26/04/2026', agentDiagnosis: 'Score de idoneidad: 82/100.' };
      phases[1] = { ...phases[1], status: 'completado', completedAt: '26/04/2026', agentDiagnosis: 'Análisis de 6 entrevistas consolidado.' };
      phases[2] = { ...phases[2], status: 'completado', completedAt: '26/04/2026', agentDiagnosis: 'Documentación evaluada: 12 artefactos.' };
      phases[3] = { ...phases[3], status: 'completado', completedAt: '26/04/2026', agentDiagnosis: 'PMO Híbrida · Confianza 87% · Diagnóstico original. Implementar una PMO Híbrida en tres fases.' };
      return computePhaseAvailability(phases);
    })(),
  },
  {
    id: 'p8',
    companyName: 'Demo — Fase 6',
    projectName: 'Enfoque para Guía Metodológica (desarrollo)',
    startDate: '2026-04-26',
    auditors: [MOCK_AUDITORS[0]],
    status: 'en_ejecucion',
    // Fases 1–5 completadas → Fase 6 disponible; Fase 4 con PMO Híbrida y Fase 5 con Nivel 2
    phases: (() => {
      const phases = createInitialPhases();
      phases[0] = { ...phases[0], status: 'completado', completedAt: '26/04/2026', agentDiagnosis: 'Score de idoneidad: 82/100.' };
      phases[1] = { ...phases[1], status: 'completado', completedAt: '26/04/2026', agentDiagnosis: 'Análisis de 6 entrevistas consolidado.' };
      phases[2] = { ...phases[2], status: 'completado', completedAt: '26/04/2026', agentDiagnosis: 'Documentación evaluada: 12 artefactos.' };
      phases[3] = { ...phases[3], status: 'completado', completedAt: '26/04/2026', agentDiagnosis: 'PMO Híbrida · Confianza 87% · Diagnóstico original. Implementar una PMO Híbrida en tres fases.' };
      phases[4] = { ...phases[4], status: 'completado', completedAt: '26/04/2026', agentDiagnosis: 'Madurez PMO Híbrida · Nivel 2 (En Desarrollo) · Score 56/100.' };
      return computePhaseAvailability(phases);
    })(),
  },
  {
    id: 'p9',
    companyName: 'Demo — Fase 7',
    projectName: 'Guía Metodológica (desarrollo)',
    startDate: '2026-04-27',
    auditors: [MOCK_AUDITORS[0]],
    status: 'en_ejecucion',
    // Fases 1–6 completadas → Fase 7 disponible (auto-trigger al abrir el módulo)
    phases: (() => {
      const phases = createInitialPhases();
      phases[0] = { ...phases[0], status: 'completado', completedAt: '27/04/2026', agentDiagnosis: 'Score de idoneidad: 82/100.' };
      phases[1] = { ...phases[1], status: 'completado', completedAt: '27/04/2026', agentDiagnosis: 'Análisis de 6 entrevistas consolidado.' };
      phases[2] = { ...phases[2], status: 'completado', completedAt: '27/04/2026', agentDiagnosis: 'Documentación evaluada: 12 artefactos.' };
      phases[3] = { ...phases[3], status: 'completado', completedAt: '27/04/2026', agentDiagnosis: 'PMO Híbrida · Confianza 87% · Diagnóstico original. Implementar una PMO Híbrida en tres fases.' };
      phases[4] = { ...phases[4], status: 'completado', completedAt: '27/04/2026', agentDiagnosis: 'Madurez PMO Híbrida · Nivel 2 (En Desarrollo) · Score 56/100.' };
      phases[5] = { ...phases[5], status: 'completado', completedAt: '27/04/2026', agentDiagnosis: 'Enfoque aprobado: Guía Metodológica Híbrida — Marco de Transición Adaptativa · 5 puntos débiles · 5 categorías de instrucciones para Agente 7.' };
      return computePhaseAvailability(phases);
    })(),
  },
];

interface AppContextType {
  projects: Project[];
  currentUser: Auditor;
  addProject: (data: Omit<Project, 'id' | 'phases' | 'status'>) => void;
  updatePhaseStatus: (projectId: string, phaseNumber: number, status: PhaseStatus, diagnosis?: string) => void;
  getProject: (id: string) => Project | undefined;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);

  const currentUser = MOCK_AUDITORS[0];

  const addProject = (data: Omit<Project, 'id' | 'phases' | 'status'>) => {
    const newProject: Project = {
      ...data,
      id: `p${Date.now()}`,
      phases: createInitialPhases(),
      status: 'en_ejecucion',
    };
    setProjects(prev => [newProject, ...prev]);
  };

  const updatePhaseStatus = (projectId: string, phaseNumber: number, status: PhaseStatus, diagnosis?: string) => {
    setProjects(prev =>
      prev.map(project => {
        if (project.id !== projectId) return project;
        const updatedPhases = project.phases.map(phase => {
          if (phase.number !== phaseNumber) return phase;
          return {
            ...phase,
            status,
            completedAt: status === 'completado' ? new Date().toLocaleDateString('es-CO') : phase.completedAt,
            agentDiagnosis: diagnosis ?? phase.agentDiagnosis,
          };
        });
        const recomputed = computePhaseAvailability(updatedPhases);
        const allDone = recomputed.every(p => p.status === 'completado');
        return {
          ...project,
          phases: recomputed,
          status: allDone ? 'completado' : 'en_ejecucion',
        };
      })
    );
  };

  const getProject = (id: string) => projects.find(p => p.id === id);

  return (
    <AppContext.Provider value={{ projects, currentUser, addProject, updatePhaseStatus, getProject }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export { MOCK_AUDITORS };