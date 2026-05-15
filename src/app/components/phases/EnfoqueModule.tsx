/**
 * EnfoqueModule — Fase 6: Enfoque para Guía Metodológica
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  Loader2, Brain, Target, BookOpen,
  Lightbulb, ListChecks, ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../../context/AppContext';
import { useSoundManager } from '../../hooks/useSoundManager';
import PhaseHeader from './_shared/PhaseHeader';
import NextPhaseButton from './_shared/NextPhaseButton';
import { supabase } from '../../lib/supabase';
import EnfoqueDiagnosisView from './enfoque/EnfoqueDiagnosisView';
import { LoadingRouteState, MissingProjectState } from '../layout/RouteState';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type PmoType = 'Ágil' | 'Híbrida' | 'Predictiva';
type Criticidad = 'Alta' | 'Media' | 'Baja';
type DiagnosisVersion = 'original' | 'reprocesado';
type ModuleView = 'auto-trigger' | 'processing' | 'results' | 'approved';

function hasObjectContent(value: unknown): boolean {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value as Record<string, unknown>).length > 0
  );
}

function hasUsablePhase6Data(datos: any): boolean {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) return false;
  if (datos._processing || datos._error) return false;

  const d = datos.diagnosis ?? datos;
  if (!d || typeof d !== 'object' || Array.isArray(d)) return false;
  if (d._processing || d._error) return false;

  // v5 structure
  const ga = d.guide_approach ?? {};
  const pc = d.parametros_construccion ?? {};
  const experto = d.diagnostico_experto ?? {};

  // v6 structure — new top-level blocks
  const hasV6Blocks =
    hasObjectContent(d.gobernanza_documental) ||
    hasObjectContent(d.fases_ciclo_vida) ||
    hasObjectContent(d.repositorio_organizacional) ||
    hasObjectContent(d.enfoque_guia) ||
    hasObjectContent(d.insumos_por_seccion) ||
    hasObjectContent(d.resumen_insumos_utilizados);

  return Boolean(
    hasV6Blocks ||
    ga.type ||
    ga.primary_framework ||
    ga.secondary_framework ||
    ga.framework_balance ||
    ga.justification ||
    ga.strategic_orientation ||
    pc.tone ||
    pc.recommended_length ||
    experto.resumen_diagnostico ||
    (Array.isArray(experto.brechas_priorizadas) && experto.brechas_priorizadas.length > 0) ||
    (Array.isArray(d.critical_weaknesses) && d.critical_weaknesses.length > 0) ||
    (Array.isArray(d.secciones) && d.secciones.length > 0) ||
    hasObjectContent(d.insumos_por_subagente) ||
    d.summary
  );
}

function formatJsonScalar(value: any): string {
  if (value === null || value === undefined || value === '') return 'N/A';
  if (typeof value === 'boolean') return value ? 'Si' : 'No';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
  if (Array.isArray(value)) return value.length ? `${value.length} elemento(s)` : 'Sin datos';
  if (typeof value === 'object') return `${Object.keys(value).length} campo(s)`;
  return String(value);
}

function labelFromKey(key: string) {
  return key
    .replace(/^subagente_(\d+)/, 'Subagente $1')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

interface PuntoDebil {
  area: string;
  criticidad: Criticidad;
  descripcion: string;
  impacto: string;
}

interface InstruccionAgente7 {
  categoria: string;
  icon: React.ElementType;
  directrices: string[];
}

interface EnfoqueResult {
  enfoque: {
    tipo: string;
    orientacion: string;
    principios: { titulo: string; descripcion: string }[];
  };
  puntosDebiles: PuntoDebil[];
  instrucciones: InstruccionAgente7[];
  timestamp: string;
  version: DiagnosisVersion;
  rawData?: any;
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------
function parsePmoType(input?: any): any {
  const diag = input?.diagnosis ?? input;
  const raw = typeof diag === 'object'
    ? diag?.pmo_type ?? diag?.pmoType ?? diag?.summary
    : diag;
  if (raw) {
    const token = String(raw).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (token.includes('agil')) return 'Ágil';
    if (token.includes('predictiv')) return 'Predictiva';
  }
  if (typeof diag !== 'string') return 'Híbrida';
  if (!diag) return 'Híbrida';
  if (diag.includes('Ágil')) return 'Ágil';
  if (diag.includes('Predictiva')) return 'Predictiva';
  return 'Híbrida';
}

function parseMaturityLevel(diag?: string): number {
  if (!diag) return 2;
  const m = diag.match(/Nivel\s+(\d)/i);
  if (m) return parseInt(m[1]);
  const s = diag.match(/Score\s+(\d+)/i);
  if (s) return Math.max(1, Math.min(5, Math.round(parseInt(s[1]) / 20)));
  return 2;
}

// ---------------------------------------------------------------------------
// PMO config
// ---------------------------------------------------------------------------
const PMO_COLOR: Record<PmoType, string> = { Ágil: '#4cb979', Híbrida: '#865cf0', Predictiva: '#5454e9' };

// ---------------------------------------------------------------------------
// Section Mapping (Phase 6 identifiers -> Human names)
// ---------------------------------------------------------------------------
const SECTION_MAP: Record<string, string> = {
  S01: 'Introducción, objetivo y alcance',
  S02: 'Marco conceptual y de referencia',
  S03: 'Políticas, roles y comités',
  S04: 'Flujos de proceso por fase',
  S05: 'Indicadores de gestión',
  S06: 'Artefactos y documentos del proceso',
  S07: 'Ceremonias ágiles y mejora continua',
  S08: 'Criterios de selección de enfoque por proyecto',
  S09: 'Modelo de gobernanza y estructura de decisión',
  S10: 'Hoja de ruta de implementación',
};

function formatSectionLabel(id: string): string {
  if (!id) return '';
  const cleanId = id.trim().toUpperCase();
  return SECTION_MAP[cleanId] ? `${cleanId}: ${SECTION_MAP[cleanId]}` : id;
}

// ---------------------------------------------------------------------------
// Agent result adapter: maps real pmo-agent output → EnfoqueResult for the UI
// Handles both v5 (guide_approach/insumos_por_subagente) and v6 (gobernanza_documental / enfoque_guia) structures
// ---------------------------------------------------------------------------
function mapAgentResultV2(datos: any): EnfoqueResult | null {
  if (!hasUsablePhase6Data(datos)) return null;
  const d = datos.diagnosis ?? datos;

  // ── v5 fields (backward compat) ──
  const ga = d.guide_approach ?? {};
  const pc = d.parametros_construccion ?? {};
  const experto = d.diagnostico_experto ?? {};

  // ── v6 fields ──
  const enfoque_guia = d.enfoque_guia ?? {};
  const gov = d.gobernanza_documental ?? {};
  const fases_ciclo = d.fases_ciclo_vida ?? {};
  const params = d.parametros_construccion ?? {};
  const seccionesActivadas: Record<string, boolean> = params.secciones_adicionales_activadas ?? {};
  const resumen = d.resumen_insumos_utilizados ?? {};

  const severityMap: Record<string, Criticidad> = {
    critical: 'Alta', high: 'Alta', medium: 'Media', low: 'Baja',
  };

  // ── Derive enfoque tipo (v6 > v5 fallback) ──
  const enfoqueType = enfoque_guia.tipo ?? ga.type ?? ga.primary_framework ?? 'Enfoque metodologico';
  const enfoqueOrientacion = enfoque_guia.justificacion ?? ga.strategic_orientation ?? d.summary ?? experto.resumen_diagnostico ?? '';

  // ── Principios: unify v5 guide_approach + v6 enfoque_guia ──
  const principios: { titulo: string; descripcion: string }[] = [
    enfoqueType ? { titulo: 'Tipo de enfoque', descripcion: enfoqueType } : null,
    enfoque_guia.marco_primario || ga.primary_framework ? { titulo: 'Marco primario', descripcion: enfoque_guia.marco_primario ?? ga.primary_framework } : null,
    enfoque_guia.marco_secundario || ga.secondary_framework ? { titulo: 'Marco secundario', descripcion: enfoque_guia.marco_secundario ?? ga.secondary_framework } : null,
    enfoque_guia.balance_marcos || ga.framework_balance ? { titulo: 'Balance metodologico', descripcion: enfoque_guia.balance_marcos ?? ga.framework_balance } : null,
    (enfoque_guia.agile_weight != null) ? { titulo: 'Peso agil', descripcion: `${enfoque_guia.agile_weight}%` } : null,
    (enfoque_guia.predictive_weight != null) ? { titulo: 'Peso predictivo', descripcion: `${enfoque_guia.predictive_weight}%` } : null,
    ga.justification ? { titulo: 'Justificacion (v5)', descripcion: ga.justification } : null,
    // Fases opcionales
    fases_ciclo.tiene_preproyecto === true ? { titulo: 'Pre-proyecto', descripcion: fases_ciclo.evidencia_preproyecto ?? 'Aplica' } : null,
    fases_ciclo.tiene_postcierre === true ? { titulo: 'Post-cierre', descripcion: fases_ciclo.evidencia_postcierre ?? 'Aplica' } : null,
    // Gobernanza documental destacada
    gov.tiene_sgc === true ? { titulo: 'Sistema de Gestion de Calidad', descripcion: gov.evidencia_sgc ?? 'SGC identificado' } : null,
    gov.tiene_repositorio_digital ? { titulo: 'Repositorio digital', descripcion: gov.repositorio_herramienta ?? gov.evidencia_repositorio ?? 'Identificado' } : null,
    pc.tone ? { titulo: 'Tono de la guia', descripcion: `${pc.tone}. ${pc.tone_justification ?? ''}`.trim() } : null,
    pc.recommended_length ? { titulo: 'Extension recomendada', descripcion: `${pc.recommended_length}. ${pc.length_justification ?? ''}`.trim() } : null,
  ].filter(Boolean) as { titulo: string; descripcion: string }[];

  // ── Puntos débiles: prefer v6 brechas_priorizadas ──
  const puntosDebilesSource = experto.brechas_priorizadas ?? d.critical_weaknesses ?? [];
  const puntosDebiles: PuntoDebil[] = puntosDebilesSource.map((w: any) => ({
    area: w.brecha ?? w.weakness ?? w.tipo ?? '',
    criticidad: severityMap[w.severity] ?? 'Media',
    descripcion: w.impacto_en_proyectos ?? w.content_type_needed ?? w.que_debe_hacer_la_guia ?? '',
    impacto: [
      w.que_debe_hacer_la_guia ? `Guia: ${w.que_debe_hacer_la_guia}` : '',
      (w.secciones_que_la_abordan ?? w.guide_sections_recommended ?? []).length > 0
        ? `Secciones: ${(w.secciones_que_la_abordan ?? w.guide_sections_recommended ?? []).map(formatSectionLabel).join(', ')}`
        : '',
      w.es_brecha_raiz === true ? '[Brecha raiz]' : '',
    ].filter(Boolean).join(' - '),
  }));

  // ── Instrucciones: v6 secciones_adicionales_activadas + v5 fallback ──
  const adicionales = Object.entries(seccionesActivadas)
    .filter(([, active]) => active === true)
    .map(([key]) => key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));

  const adicionalesLegacy = (d.insumos_base_utilizados?.secciones_adicionales_activadas ?? []) as string[];

  // Build gobernanza block for instructions
  const govDirectrices: string[] = [
    gov.tiene_sgc != null ? `SGC: ${gov.tiene_sgc ? 'Si' : 'No'}${gov.evidencia_sgc ? ` — ${gov.evidencia_sgc}` : ''}` : '',
    gov.usa_codificacion_documental != null ? `Codificacion documental: ${gov.usa_codificacion_documental ? gov.estructura_codificacion || 'Si' : 'No'}` : '',
    gov.practicas_gestion_cambios?.existe_proceso != null ? `Gestion de cambios: ${gov.practicas_gestion_cambios.nivel_formalidad ?? (gov.practicas_gestion_cambios.existe_proceso ? 'Existe' : 'No existe')}` : '',
    gov.practicas_lecciones_aprendidas?.existe_proceso != null ? `Lecciones aprendidas: ${gov.practicas_lecciones_aprendidas.nivel_formalidad ?? (gov.practicas_lecciones_aprendidas.existe_proceso ? 'Existe' : 'No existe')}` : '',
    gov.tiene_auditoria_proyectos != null ? `Auditoria de proyectos: ${gov.tiene_auditoria_proyectos ? 'Si' : 'No'}` : '',
    gov.requiere_plan_contingencia != null ? `Plan de contingencia requerido: ${gov.requiere_plan_contingencia ? 'Si' : 'No'}` : '',
    Array.isArray(gov.categorias_indicadores) && gov.categorias_indicadores.length > 0 ? `Categorias de indicadores: ${gov.categorias_indicadores.join(', ')}` : '',
    Array.isArray(gov.gap_to_solution_mapping) && gov.gap_to_solution_mapping.length > 0 ? `Gap-to-solution: ${gov.gap_to_solution_mapping.length} mapeos definidos` : '',
  ].filter(Boolean);

  // Build resumen block
  const resumenDirectrices: string[] = [
    resumen.pmo_type ? `Tipo PMO: ${resumen.pmo_type}` : '',
    resumen.overall_maturity_score != null ? `Score madurez: ${resumen.overall_maturity_score} — ${resumen.overall_maturity_label ?? ''}` : '',
    resumen.total_actividades_existentes != null ? `Actividades existentes: ${resumen.total_actividades_existentes}` : '',
    resumen.total_actividades_sugeridas_por_brecha != null ? `Actividades sugeridas: ${resumen.total_actividades_sugeridas_por_brecha}` : '',
    resumen.total_indicadores_sugeridos != null ? `Indicadores sugeridos: ${resumen.total_indicadores_sugeridos}` : '',
    resumen.secciones_adicionales_count != null ? `Secciones adicionales activas: ${resumen.secciones_adicionales_count}` : '',
    Array.isArray(resumen.fases_adicionales_incluidas) && resumen.fases_adicionales_incluidas.length > 0 ? `Fases adicionales: ${resumen.fases_adicionales_incluidas.join(', ')}` : '',
  ].filter(Boolean);

  const subagents = d.insumos_por_subagente ?? {};
  const instrucciones: InstruccionAgente7[] = [
    {
      categoria: 'Alcance y estructura de la guia',
      icon: Target,
      directrices: [
        adicionales.length > 0
          ? `Secciones adicionales activadas: ${adicionales.join(', ')}`
          : adicionalesLegacy.length > 0
            ? `Secciones adicionales: ${adicionalesLegacy.map(formatSectionLabel).join(', ')}`
            : 'No se activaron secciones adicionales.',
        ...(d.secciones ?? []).map((s: any) => `${formatSectionLabel(s.id ?? '')}: ${s.enfasis ?? s.condicion_inclusion ?? ''}`),
        fases_ciclo.tiene_preproyecto === true ? `Pre-proyecto activo: ${fases_ciclo.nombre_preproyecto_en_organizacion || fases_ciclo.evidencia_preproyecto || 'Si'}` : '',
        fases_ciclo.tiene_postcierre === true ? `Post-cierre activo: ${fases_ciclo.nombre_postcierre_en_organizacion || fases_ciclo.evidencia_postcierre || 'Si'}` : '',
      ].filter(Boolean),
    },
    govDirectrices.length > 0 ? {
      categoria: 'Gobernanza documental',
      icon: BookOpen,
      directrices: govDirectrices,
    } : null,
    resumenDirectrices.length > 0 ? {
      categoria: 'Resumen de insumos',
      icon: ListChecks,
      directrices: resumenDirectrices,
    } : null,
    {
      categoria: 'Audiencia, tono y longitud',
      icon: Lightbulb,
      directrices: [
        `Audiencia objetivo: ${(pc.target_audience ?? params.audiencia_primaria ?? []).join(', ') || 'No especificada'}`,
        pc.tone ? `Tono: ${pc.tone}` : null,
        pc.tone_justification ?? null,
        pc.recommended_length ? `Extension: ${pc.recommended_length}` : null,
        pc.length_justification ?? null,
        params.nivel_madurez_para_tono ? `Nivel madurez tono: ${params.nivel_madurez_para_tono}` : null,
      ].filter(Boolean) as string[],
    },
    {
      categoria: 'Advertencias del diagnostico',
      icon: ShieldAlert,
      directrices: (d.advertencias_de_entrada ?? []).length > 0
        ? d.advertencias_de_entrada
        : ['No se detectaron advertencias en los datos de entrada.'],
    },
    ...Object.entries(subagents).map(([key, value]: [string, any]) => ({
      categoria: `${labelFromKey(key)} - ${value?.descripcion_rol ?? 'Insumos especificos'}`,
      icon: Brain,
      directrices: Object.entries(value ?? {})
        .filter(([field]) => field !== 'descripcion_rol')
        .map(([field, fieldValue]) => `${labelFromKey(field)}: ${formatJsonScalar(fieldValue)}`),
    })),
  ].filter(Boolean).filter(instr => (instr as any).directrices.length > 0) as InstruccionAgente7[];

  return {
    enfoque: {
      tipo: enfoqueType,
      orientacion: enfoqueOrientacion,
      principios,
    },
    puntosDebiles,
    instrucciones,
    timestamp: datos.metadata?.timestamp ?? new Date().toISOString(),
    version: (datos.metadata?.iteration ?? 1) > 1 ? 'reprocesado' : 'original',
    rawData: datos,
  };
}

// ---------------------------------------------------------------------------
// Approve modal
// ---------------------------------------------------------------------------
function ApproveModal({ open, onCancel, onConfirm, isLoading }: {
  open: boolean; onCancel: () => void; onConfirm: () => void; isLoading: boolean;
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onCancel} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10 p-6"
          >
            <div className="mb-5">
              <h3 className="text-neutral-900 mb-1.5" style={{ fontWeight: 500, fontSize: '1.0625rem', letterSpacing: '-0.01em' }}>¿Aprobar estas instrucciones?</h3>
              <p className="text-neutral-500 text-[13px] leading-relaxed">
                La Fase 6 quedará completada y las instrucciones se enviarán al Agente 7 para construir la Guía Metodológica. Esta acción no puede deshacerse.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={onCancel}
                className="flex-1 py-2.5 border border-neutral-200/80 rounded-full text-neutral-600 text-[13px] hover:bg-neutral-50 transition-colors"
                style={{ fontWeight: 500 }}>
                Cancelar
              </button>
              <button onClick={onConfirm} disabled={isLoading}
                className="flex-1 py-2.5 rounded-full text-white text-[13px] flex items-center justify-center gap-2 disabled:opacity-70 transition-all"
                style={{ background: '#5454e9', fontWeight: 500, boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 8px 24px -8px rgba(0,0,0,0.18)' }}>
                {isLoading
                  ? <><Loader2 size={13} className="animate-spin" /> Aprobando…</>
                  : 'Aprobar instrucciones'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}


// ---------------------------------------------------------------------------
// Main module
// ---------------------------------------------------------------------------
export default function EnfoqueModule() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getProject, updatePhaseStatus, reprocessPhase, isLoading } = useApp();

  const { playAgentSuccess, playPhaseComplete } = useSoundManager();

  const project = getProject(projectId!);
  const phase = project?.phases.find(p => p.number === 6);
  const phase4 = project?.phases.find(p => p.number === 4);
  const phase5 = project?.phases.find(p => p.number === 5);

  const pmoType: PmoType = parsePmoType(phase4?.agentData ?? phase4?.agentDiagnosis);
  const maturityLevel: number = parseMaturityLevel(phase5?.agentDiagnosis);
  const pmoColor = PMO_COLOR[pmoType];

  const deriveView = (): ModuleView => {
    if (!project || !phase) return 'processing';
    const mapped = mapAgentResultV2(phase.agentData);
    if (phase.status === 'completado' && mapped) return 'approved';
    if (phase.status === 'procesando') return 'processing';
    if (mapped) return 'results';
    return 'auto-trigger';
  };

  const [view, setView] = useState<ModuleView>(deriveView);
  const [result, setResult] = useState<EnfoqueResult | null>(
    phase?.agentData ? mapAgentResultV2(phase.agentData) : null
  );
  const [comment, setComment] = useState('');
  const [savedComment, setSavedComment] = useState('');
  const [isSavingComment, setIsSavingComment] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [hasCheckedExistingResult, setHasCheckedExistingResult] = useState(false);
  const autoTriggered = useRef(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartTimeRef = useRef<number>(0);

  const applyAgentResult = useCallback((rawData: any, status: string = 'disponible') => {
    const mapped = mapAgentResultV2(rawData);
    if (!mapped) return false;

    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = null;
    setResult(mapped);
    setView(status === 'completado' ? 'approved' : 'results');
    updatePhaseStatus(projectId!, 6, status === 'completado' ? 'completado' : 'disponible');
    playAgentSuccess();
    toast.success('Agente 6 definio el enfoque metodologico', { description: mapped.enfoque.tipo });
    return true;
  }, [playAgentSuccess, projectId, updatePhaseStatus]);

  // Start polling fases_estado for agent result
  const startPolling = useCallback((afterTimestamp?: number) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    const minTime = 0;
    pollIntervalRef.current = setInterval(async () => {
      if (!projectId) return;
      const { data } = await supabase
        .from('fases_estado')
        .select('datos_consolidados, estado_visual, updated_at')
        .eq('proyecto_id', projectId)
        .eq('numero_fase', 6)
        .single();
      if (data?.estado_visual === 'error') {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
        updatePhaseStatus(projectId!, 6, 'disponible');
        setView('auto-trigger');
        const message = (data?.datos_consolidados as any)?.message ?? 'El agente no pudo generar el enfoque.';
        toast.error('Error en el Agente 6', { description: message, duration: 9000 });
        return;
      }
      if (data?.datos_consolidados) {
        // Skip stale data from before this poll session started
        if (minTime > 0 && new Date(data.updated_at).getTime() < minTime) return;
        const mapped = mapAgentResultV2(data.datos_consolidados);
        if (mapped) {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          setResult(mapped);
          setView(data.estado_visual === 'completado' ? 'approved' : 'results');
          updatePhaseStatus(projectId!, 6, data.estado_visual === 'completado' ? 'completado' : 'disponible');
          playAgentSuccess();
          toast.success('Agente 6 definió el enfoque metodológico', { description: mapped.enfoque.tipo });
        }
      }
      if (data?.estado_visual === 'disponible' && !hasUsablePhase6Data(data?.datos_consolidados)) {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
        setResult(null);
        autoTriggered.current = false;
        setView('auto-trigger');
      }
    }, 4000);
  }, [projectId, playAgentSuccess, updatePhaseStatus]);

  // On mount: load existing result if any, resume polling if procesando.
  // RF-F6-01: Auto-trigger only after existing DB state has been checked.
  useEffect(() => {
    if (!projectId) return;
    let isActive = true;
    setHasCheckedExistingResult(false);
    (async () => {
      try {
        const { data } = await supabase
          .from('fases_estado')
          .select('datos_consolidados, estado_visual')
          .eq('proyecto_id', projectId)
          .eq('numero_fase', 6)
          .single();
        if (!isActive) return;
        if (data?.datos_consolidados) {
          const mapped = mapAgentResultV2(data.datos_consolidados);
          if (mapped) {
            setResult(mapped);
            setView(data.estado_visual === 'completado' ? 'approved' : 'results');
          }
        }
      } finally {
        if (isActive) setHasCheckedExistingResult(true);
      }
    })();
    if (phase?.status === 'procesando') startPolling();
    return () => {
      isActive = false;
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the screen aligned with the loaded phase before deciding to invoke the agent.
  useEffect(() => {
    if (!project || !phase) return;

    if (phase.status === 'procesando') {
      setView('processing');
      startPolling();
      return;
    }

    const mapped = phase.agentData ? mapAgentResultV2(phase.agentData) : null;
    if (mapped) {
      setResult(mapped);
      setView(phase.status === 'completado' ? 'approved' : 'results');
      return;
    }

    if (phase.status === 'completado') {
      if (result) {
        setView('approved');
      } else {
        setResult(null);
        setView('auto-trigger');
      }
      return;
    }

    if (phase.status === 'disponible') {
      setView('auto-trigger');
    }
  }, [phase, project, startPolling]);

  useEffect(() => {
    if (!project || !phase || !projectId) return;
    if (!hasCheckedExistingResult) return;
    if (phase.status !== 'disponible') return;
    if (mapAgentResultV2(phase.agentData)) return;
    if (result) return;
    if (project.phases.some(p => p.number > 6 && p.status === 'completado')) return;
    if (autoTriggered.current) return;
    if (view === 'auto-trigger') {
      autoTriggered.current = true;
      (async () => {
        updatePhaseStatus(projectId!, 6, 'procesando');
        setView('processing');
        try {
          const response = await supabase.functions.invoke('pmo-agent', {
            body: { projectId, phaseNumber: 6, iteration: 1 }
          });
          if (response.error) throw new Error((response.data as any)?.error || response.error.message);
          if ((response.data as any)?.data && applyAgentResult((response.data as any).data)) return;
          startPolling();
        } catch (err: any) {
          toast.error('Error iniciando Agente 6', { description: err.message });
          updatePhaseStatus(projectId!, 6, 'disponible');
          setView('auto-trigger');
          autoTriggered.current = false;
        }
      })();
    }
  }, [applyAgentResult, hasCheckedExistingResult, phase, project, projectId, result, startPolling, updatePhaseStatus, view]);

  if (!project || !phase) {
    return isLoading
      ? <LoadingRouteState message="Cargando el proyecto y el enfoque metodologico..." />
      : <MissingProjectState title="Fase no disponible" description="No pudimos encontrar el proyecto o la fase de enfoque." />;
  }

  // ── Handlers ──
  const handleSaveComment = async () => {
    if (!comment.trim()) { toast.error('Escriba un comentario antes de guardar.'); return; }
    setIsSavingComment(true);
    await new Promise(r => setTimeout(r, 500));
    setSavedComment(comment);
    setIsSavingComment(false);
    toast.success('Comentario guardado');
  };

  const handleReprocess = async () => {
    if (!comment.trim()) { toast.error('Escriba un comentario para re-procesar.'); return; }
    autoTriggered.current = true;
    setView('processing');
    try {
      // Bloquear fases posteriores
      await reprocessPhase(projectId!, 6);

      const ts = Date.now();
      pollStartTimeRef.current = ts;

      const response = await supabase.functions.invoke('pmo-agent', {
        body: { projectId, phaseNumber: 6, iteration: 2, comments: comment }
      });
      if (response.error) throw new Error((response.data as any)?.error || response.error.message);
      setSavedComment(comment);
      setComment('');
      if ((response.data as any)?.data && applyAgentResult((response.data as any).data)) return;
      startPolling(ts);
    } catch (err: any) {
      toast.error('Error re-procesando Agente 6', { description: (err as Error).message });
      setView('results');
    }
  };

  const handleApprove = async () => {
    setIsApproving(true);
    setIsApproving(false);
    setShowApproveModal(false);
    updatePhaseStatus(projectId!, 6, 'completado',
      `Enfoque aprobado: ${result?.enfoque.tipo} · ${result?.puntosDebiles.length} puntos débiles · ${result?.instrucciones.length} categorías de instrucciones para Agente 7.`
    );
    playPhaseComplete(); 
    setView('approved');
    toast.success('¡Fase 6 aprobada!', { description: 'La Fase 7 se ha desbloqueado automáticamente.' });
  };

  // ── Full results renderer (shared between 'results' and 'approved') ──
  const renderContent = (r: EnfoqueResult, readonly = false) => (
    <EnfoqueDiagnosisView
      result={r}
      pmoType={pmoType}
      pmoColor={pmoColor}
      maturityLevel={maturityLevel}
      approved={readonly}
      completedAt={phase.completedAt}
      comment={comment}
      savedComment={savedComment}
      isSavingComment={isSavingComment}
      onCommentChange={setComment}
      onSaveComment={handleSaveComment}
      onReprocess={handleReprocess}
      onApprove={() => setShowApproveModal(true)}
    />
  );

  return (
    <div className="min-h-screen bg-[#f7f8ff]">
      <PhaseHeader
        projectId={projectId!}
        companyName={project.companyName}
        phaseNumber={6}
        phaseName="Enfoque para Guía Metodológica"
        eyebrow={view === 'approved' ? 'Aprobada' : 'Activa'}
        onReprocessed={async () => {
          await reprocessPhase(projectId!, 6);
          setResult(null);
          setComment('');
          setSavedComment('');
          if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
          autoTriggered.current = false;
          setView('auto-trigger');
        }}
      />

      <div className="max-w-[1100px] mx-auto px-10 py-10">
        <AnimatePresence mode="wait">

          {(view === 'auto-trigger' || view === 'processing') && (
            <motion.div 
              key="processing-overlay"
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-[#f7f8ff]/85 backdrop-blur-md flex flex-col items-center justify-center"
            >
              <div 
                className="w-16 h-16 rounded-full border border-neutral-200 bg-white flex items-center justify-center mb-5" 
                style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
              >
                <Loader2 size={22} className="text-neutral-700 animate-spin" strokeWidth={1.75} />
              </div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#5454e9] mb-2" style={{ fontWeight: 500 }}>
                Procesando
              </p>
              <h2 className="text-neutral-900 tracking-tight mb-3" style={{ fontWeight: 500, fontSize: '1.5rem', letterSpacing: '-0.02em' }}>
                Agente definiendo enfoque
              </h2>
              <p className="text-[#5454e9] text-[13px] max-w-md text-center leading-relaxed">
                Analizando el consolidado de <span className="text-neutral-900" style={{ fontWeight: 500 }}>PMO {pmoType}</span> · <span className="text-neutral-900" style={{ fontWeight: 500 }}>Nivel {maturityLevel}</span> para determinar el tipo de guía, identificar puntos débiles y generar instrucciones para el Agente.
              </p>
            </motion.div>
          )}

          {view === 'results' && result && (
            renderContent(result, false)
          )}

          {view === 'approved' && result && (
            renderContent(result, true)
          )}

        </AnimatePresence>
      </div>

      <ApproveModal open={showApproveModal} onCancel={() => setShowApproveModal(false)} onConfirm={handleApprove} isLoading={isApproving} />

      <NextPhaseButton projectId={projectId!} nextPhase={7} prevPhase={5} show={view === 'approved'} />
    </div>
  );
}
