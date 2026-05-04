import React, {
  createContext, useContext, useState,
  useEffect, useCallback, ReactNode,
} from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────
export type PhaseStatus = 'bloqueado' | 'disponible' | 'procesando' | 'completado' | 'error';

export interface Auditor {
  id: string;
  name: string;
  initials: string;
  color: string;
  role?: string;
}

export interface Phase {
  number: number;
  name: string;
  status: PhaseStatus;
  completedAt?: string;
  agentDiagnosis?: string;
  agentData?: any;
}

export interface Project {
  id: string;
  companyName: string;
  projectName: string;
  startDate: string;
  auditors: Auditor[];
  phases: Phase[];
  status: 'en_ejecucion' | 'completado';
  isDeleted?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// NOMBRES CANÓNICOS DE LAS FASES (deben coincidir con configuracion_agentes)
// ─────────────────────────────────────────────────────────────────────────────
const PHASE_NAMES = [
  'Registro documental',
  'Registro de entrevistas',
  'Encuestas de idoneidad',
  'Diagnostico de idoneidad',
  'Encuestas de Madurez',
  'Consolidación y pasos para Guía Metodologica',
  'Diseño Metodologica del proyecto',
  'Artefactos',
];

// ─────────────────────────────────────────────────────────────────────────────
// LÓGICA DE DISPONIBILIDAD DE FASES (regla de negocio central)
// ─────────────────────────────────────────────────────────────────────────────
function computePhaseAvailability(phases: Phase[]): Phase[] {
  return phases.map((phase, idx) => {
    if (phase.status === 'completado' || phase.status === 'procesando') return phase;
    if (idx === 0) return phase.status === 'bloqueado' ? { ...phase, status: 'disponible' } : phase;
    if (idx === 1) return { ...phase, status: phases[0]?.status === 'completado' ? 'disponible' : 'bloqueado' };
    if (idx === 2) return { ...phase, status: phases[1]?.status === 'completado' ? 'disponible' : 'bloqueado' };
    if (idx === 3) {
      const allFirstThreeDone = phases.slice(0, 3).every(p => p.status === 'completado');
      return { ...phase, status: allFirstThreeDone ? 'disponible' : 'bloqueado' };
    }
    return { ...phase, status: phases[idx - 1]?.status === 'completado' ? 'disponible' : 'bloqueado' };
  });
}

function createInitialPhases(): Phase[] {
  return computePhaseAvailability(
    PHASE_NAMES.map((name, i) => ({ number: i + 1, name, status: 'bloqueado' as PhaseStatus }))
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAPEADORES: DB → Modelo Local
// ─────────────────────────────────────────────────────────────────────────────

/** Construye el array de 8 fases mezclando los registros reales de fases_estado */
function buildPhasesFromDB(fasesEstado: Record<string, unknown>[]): Phase[] {
  const base = createInitialPhases();

  for (const fe of fasesEstado) {
    const idx = (fe.numero_fase as number) - 1;
    if (idx < 0 || idx > 7) continue;
    const datos = (fe.datos_consolidados as Record<string, unknown>) ?? {};
    base[idx] = {
      ...base[idx],
      status: (fe.estado_visual as PhaseStatus) ?? 'bloqueado',
      completedAt: fe.updated_at
        ? new Date(fe.updated_at as string).toLocaleDateString('es-CO')
        : undefined,
      agentDiagnosis:
        (datos?.diagnosis as Record<string, unknown>)?.summary as string
        ?? (datos?.summary as string)
        ?? undefined,
      agentData: datos,
    };
  }

  return computePhaseAvailability(base);
}

/** Mapea una fila de `proyectos` + empresa + auditores a nuestro tipo `Project` */
function mapDBRowToProject(row: Record<string, unknown>): Project {
  const empresa = (row.empresas as Record<string, unknown>) ?? {};
  const perfil = (row.profiles as Record<string, unknown>) ?? {};
  const fasesEstado = (row.fases_estado as Record<string, unknown>[]) ?? [];

  const auditor: Auditor = {
    id: (perfil.id as string) ?? row.auditor_id as string,
    name: (perfil.full_name as string) ?? 'Sin asignar',
    initials: ((perfil.full_name as string) ?? 'SA')
      .split(' ')
      .map((w: string) => w[0])
      .join('')
      .substring(0, 2)
      .toUpperCase(),
    color: '#030213',
    role: (perfil.role as string) ?? 'auditor'
  };

  const phases = buildPhasesFromDB(fasesEstado);
  const allDone = phases.every(p => p.status === 'completado');

  return {
    id: row.id as string,
    companyName: (empresa.nombre as string) ?? 'Empresa sin nombre',
    projectName: row.nombre_proyecto as string,
    startDate: (row.fecha_inicio as string) ?? (row.created_at as string)?.split('T')[0] ?? '',
    auditors: [auditor],
    phases,
    status: allDone ? 'completado' : 'en_ejecucion',
    isDeleted: (row.is_deleted as boolean) ?? false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXTO
// ─────────────────────────────────────────────────────────────────────────────
interface AppContextType {
  projects: Project[];
  currentUser: Auditor;
  isLoading: boolean;
  addProject: (data: Omit<Project, 'id' | 'phases' | 'status'>) => Promise<void>;
  updatePhaseStatus: (projectId: string, phaseNumber: number, status: PhaseStatus, diagnosis?: string) => void;
  getProject: (id: string) => Project | undefined;
  refreshProjects: () => Promise<void>;
  moveToTrash: (id: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  restoreProject: (id: string) => Promise<void>;
  reprocessPhase: (projectId: string, phaseNumber: number) => Promise<void>;
  editProject: (id: string, data: { companyName: string; projectName: string; auditorId?: string }) => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// PROVEEDOR
// ─────────────────────────────────────────────────────────────────────────────
export function AppProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<Auditor>({
    id: '',
    name: 'Usuario',
    initials: 'US',
    color: '#030213',
  });

  // ── Cargar proyectos desde Supabase ──────────────────────────────────────
  const fetchProjects = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('proyectos')
        .select(`
          id,
          nombre_proyecto,
          fase_actual,
          created_at,
          fecha_inicio,
          fecha_cierre,
          auditor_id,
          is_deleted,
          empresas ( id, nombre, tamano ),
          profiles ( id, full_name, role ),
          fases_estado ( numero_fase, estado_visual, datos_consolidados, updated_at )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped = (data ?? []).map(row =>
        mapDBRowToProject(row as Record<string, unknown>)
      );
      setProjects(mapped);
    } catch (err) {
      console.error('[AppContext] Error cargando proyectos:', err);
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  }, []);

  // ── Cargar perfil del usuario actual ─────────────────────────────────────
  const fetchCurrentUser = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', user.id)
      .single();

    if (profile) {
      const name = profile.full_name ?? user.email ?? 'Usuario';
      setCurrentUser({
        id: profile.id,
        name,
        initials: name.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase(),
        color: '#030213',
        role: profile.role ?? 'auditor'
      });
    }
  }, []);

  useEffect(() => {
    if (session) {
      fetchProjects();
      fetchCurrentUser();
    } else {
      setProjects([]);
      setCurrentUser({ id: '', name: 'Usuario', initials: 'US', color: '#030213' });
    }
  }, [session, fetchProjects, fetchCurrentUser]);

  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel('realtime_fases_estado_global')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fases_estado',
        },
        () => {
          // fetch silente
          fetchProjects(true);
        }
      )
      .subscribe();

    // Fallback polling silencioso
    const interval = setInterval(() => {
      fetchProjects(true);
    }, 15000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchProjects, fetchCurrentUser]);

  // ── Crear nuevo proyecto ──────────────────────────────────────────────────
  const addProject = useCallback(async (data: Omit<Project, 'id' | 'phases' | 'status'>) => {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    
    if (!userId) throw new Error('Usuario no autenticado (sesión inválida)');

    let empresaId: string;
    const { data: existingEmpresa, error: searchError } = await supabase
      .from('empresas')
      .select('id')
      .ilike('nombre', data.companyName)
      .maybeSingle();

    if (searchError) throw searchError;

    if (existingEmpresa) {
      empresaId = existingEmpresa.id;
    } else {
      const { data: newEmpresa, error: empresaError } = await supabase
        .from('empresas')
        .insert({ nombre: data.companyName })
        .select('id')
        .single();
      if (empresaError) throw empresaError;
      empresaId = newEmpresa.id;
    }

    const { data: newProject, error: projectError } = await supabase
      .from('proyectos')
      .insert({
        empresa_id: empresaId,
        auditor_id: data.auditors && data.auditors.length > 0 ? data.auditors[0].id : userId,
        nombre_proyecto: data.projectName,
        fase_actual: 1,
        fecha_inicio: data.startDate || new Date().toISOString().split('T')[0],
      })
      .select('id')
      .single();

    if (projectError) throw projectError;

    const fasesInit = PHASE_NAMES.map((_, i) => ({
      proyecto_id: newProject.id,
      numero_fase: i + 1,
      estado_visual: i === 0 ? 'disponible' : 'bloqueado',
    }));

    await supabase.from('fases_estado').insert(fasesInit);
    await fetchProjects();
  }, [fetchProjects]);

  // ── Editar proyecto ────────────────────────────────────────────────────────
  const editProject = useCallback(async (id: string, data: { companyName: string; projectName: string; auditorId?: string }) => {
    let empresaId: string;
    const { data: existingEmpresa, error: searchError } = await supabase
      .from('empresas')
      .select('id')
      .ilike('nombre', data.companyName)
      .maybeSingle();

    if (searchError) throw searchError;

    if (existingEmpresa) {
      empresaId = existingEmpresa.id;
    } else {
      const { data: newEmpresa, error: empresaError } = await supabase
        .from('empresas')
        .insert({ nombre: data.companyName })
        .select('id')
        .single();
      if (empresaError) throw empresaError;
      empresaId = newEmpresa.id;
    }

    const updates: any = {
      empresa_id: empresaId,
      nombre_proyecto: data.projectName,
    };
    if (data.auditorId) {
      updates.auditor_id = data.auditorId;
    }

    const { error: projectError } = await supabase
      .from('proyectos')
      .update(updates)
      .eq('id', id);

    if (projectError) throw projectError;

    await fetchProjects();
  }, [fetchProjects]);

  // ── Actualizar estado de una fase (local + Supabase) ─────────────────────
  const updatePhaseStatus = useCallback((
    projectId: string,
    phaseNumber: number,
    status: PhaseStatus,
    diagnosis?: string
  ) => {
    setProjects(prev =>
      prev.map(project => {
        if (project.id !== projectId) return project;
        const updatedPhases = project.phases.map(phase => {
          if (phase.number !== phaseNumber) return phase;
          return {
            ...phase,
            status,
            completedAt: status === 'completado'
              ? new Date().toLocaleDateString('es-CO')
              : phase.completedAt,
            agentDiagnosis: diagnosis ?? phase.agentDiagnosis,
          };
        });
        const recomputed = computePhaseAvailability(updatedPhases);
        const allDone = recomputed.every(p => p.status === 'completado');
        return { ...project, phases: recomputed, status: allDone ? 'completado' : 'en_ejecucion' };
      })
    );

    supabase
      .from('fases_estado')
      .update({
        estado_visual: status,
        updated_at: new Date().toISOString(),
      })
      .eq('proyecto_id', projectId)
      .eq('numero_fase', phaseNumber)
      .then(({ error }) => {
        if (error) console.error('[AppContext] Error actualizando fase en DB:', error);
      });
  }, []);

  const moveToTrash = useCallback(async (id: string) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, isDeleted: true } : p));
    try {
      const { error } = await supabase.from('proyectos').update({ is_deleted: true }).eq('id', id);
      if (error && error.message) console.error('[AppContext] Error updating in DB:', error);
    } catch (err) {
      console.error('[AppContext] moveToTrash exception:', err);
    }
  }, []);

  const deleteProject = useCallback(async (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    try {
      await supabase.from('encuestas_respuestas').delete().eq('proyecto_id', id);
      await supabase.from('entrevistas').delete().eq('proyecto_id', id);
      await supabase.from('documentos').delete().eq('proyecto_id', id);
      await supabase.from('fases_estado').delete().eq('proyecto_id', id);

      const { error } = await supabase.from('proyectos').delete().eq('id', id);
      if (error && error.message) console.error('[AppContext] Error deleting from DB:', error);
    } catch (err) {
      console.error('[AppContext] deleteProject exception:', err);
    }
  }, []);

  const restoreProject = useCallback(async (id: string) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, isDeleted: false } : p));
    try {
      const { error } = await supabase.from('proyectos').update({ is_deleted: false }).eq('id', id);
      if (error && error.message) console.error('[AppContext] Error restoring in DB:', error);
    } catch (err) {
      console.error('[AppContext] restoreProject exception:', err);
    }
  }, []);

  const reprocessPhase = useCallback(async (projectId: string, phaseNumber: number) => {
    setProjects(prev =>
      prev.map(project => {
        if (project.id !== projectId) return project;
        const updatedPhases = project.phases.map(phase => {
          if (phase.number === phaseNumber) {
            return {
              ...phase,
              status: 'disponible' as PhaseStatus,
              completedAt: undefined,
              agentDiagnosis: undefined,
              agentData: undefined,
            };
          }
          if (phase.number > phaseNumber) {
            return {
              ...phase,
              status: 'bloqueado' as PhaseStatus,
              completedAt: undefined,
              agentDiagnosis: undefined,
              agentData: undefined,
            };
          }
          return phase;
        });
        const recomputed = computePhaseAvailability(updatedPhases);
        return { ...project, phases: recomputed, status: 'en_ejecucion' as const };
      })
    );

    try {
      await supabase
        .from('fases_estado')
        .update({
          estado_visual: 'disponible',
          datos_consolidados: null,
          updated_at: new Date().toISOString(),
        })
        .eq('proyecto_id', projectId)
        .eq('numero_fase', phaseNumber);

      await supabase
        .from('fases_estado')
        .update({
          estado_visual: 'bloqueado',
          datos_consolidados: null,
          updated_at: new Date().toISOString(),
        })
        .eq('proyecto_id', projectId)
        .gt('numero_fase', phaseNumber);
    } catch (err) {
      console.error('[AppContext] Error in reprocessPhase:', err);
    }
  }, []);

  return (
    <AppContext.Provider value={{
      projects,
      currentUser,
      isLoading,
      addProject,
      updatePhaseStatus,
      getProject: (id) => projects.find(p => p.id === id),
      refreshProjects: fetchProjects,
      moveToTrash,
      deleteProject,
      restoreProject,
      reprocessPhase,
      editProject,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

// Exportado para compatibilidad con componentes que lo usan
export const MOCK_AUDITORS: Auditor[] = [];