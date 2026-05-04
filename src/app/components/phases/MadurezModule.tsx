/**
 * MadurezModule — Fase 5: Madurez de la PMO
 *
 * RF-F5-01  Se adapta dinámicamente según el tipo de PMO aprobado en Fase 4.
 * RF-F5-02  Dos métodos de entrada por encuesta: en línea paso a paso o carga de datos.
 * RF-F5-03  Híbrida: ambas encuestas deben completarse antes de enviar al Agente 5.
 * RF-F5-04  "Marcar como completa" envía datos al Agente 5 (mismo patrón de procesamiento).
 * RF-F5-05  Vista de resultados: nivel de madurez, descripción, brechas, recomendaciones.
 * RF-F5-06  Comentarios y reprocesamiento idéntico a RF-F4-05/06.
 * RF-F5-07  "Aprobar diagnóstico de madurez" → Fase 5 completada, Fase 6 desbloqueada.
 *
 * TODO: Leer tipo PMO desde Supabase (tabla 'fases_resultado', fase_num: 4)
 * TODO: RF-F5-04 → axios.post(N8N_WEBHOOK_AGENTE_5, { tipo_pmo, respuestas_agil, respuestas_predictiva })
 * TODO: RF-F5-06 → persist comentario en 'consultor_comentarios'
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  Loader2, CheckCircle2, ChevronLeft, ChevronRight,
  RefreshCw, ThumbsUp, Send, AlertTriangle,
  Clock, Sparkles, Target, AlertCircle, Layers, ClipboardList,
  MessageSquare, Save, Download
} from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../../context/AppContext';
import PhaseHeader from './_shared/PhaseHeader';
import NextPhaseButton from './_shared/NextPhaseButton';
import { useSoundManager } from '../../hooks/useSoundManager';
import { useMadurez } from '../../hooks/useMadurez';
import MadurezSurveyPanel from './_shared/MadurezSurveyPanel';
import { supabase } from '../../lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type PmoType = 'Ágil' | 'Híbrida' | 'Predictiva';
type ModuleView = 'overview' | 'processing' | 'results' | 'approved';
type DiagnosisVersion = 'original' | 'reprocesado';

interface DomainScore { score: number; nivel: string; }

interface MaturityGap {
  nombre: string;
  tipo: string;
  score: number;
  nivel: string;
  impacto_potencial: string;
}

interface MaturityStrength {
  nombre: string;
  tipo: string;
  score: number;
  nivel: string;
}

interface MaturityResult {
  level: number;
  score: number;
  gaps: MaturityGap[];
  fortalezas: MaturityStrength[];
  recommendations: string[];
  por_dominio?: Record<string, DomainScore>;
  por_fase?: Record<string, DomainScore>;
  por_factor?: Record<string, DomainScore>;
  patrones_estructurales?: string;
}

interface TopGap { area: string; severity: 'critical' | 'high' | 'medium' | 'low'; }

interface Tension { tipo: string; descripcion: string; impacto: string; }

interface TemaRecurrente { tema: string; frecuencia: number; sintesis: string; relacion_con_brechas: string; }

interface FullResults {
  agil?: MaturityResult;
  predictiva?: MaturityResult;
  overallLevel: number;
  overallLabel: string;
  overallScore: number;
  summary: string;
  timestamp: string;
  version: DiagnosisVersion;
  advertencias_de_entrada: string[];
  top_gaps: TopGap[];
  recommendations: string[];
  analisis_cruzado?: {
    aplica: boolean;
    perfil: string;
    coherencia: string;
    tensiones: Tension[];
  };
  analisis_cualitativo?: {
    total_respuestas_abiertas: number;
    temas_recurrentes: TemaRecurrente[];
  };
}


// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MATURITY_LEVELS = [
  { level: 1, name: 'Inicial',        color: '#737373', bg: '#f5f5f5', desc: 'Procesos ad-hoc y reactivos. Sin estandarización formal ni visibilidad.' },
  { level: 2, name: 'En Desarrollo',  color: '#525252', bg: '#f5f5f5', desc: 'Algunos procesos definidos, pero aplicación inconsistente entre equipos.' },
  { level: 3, name: 'Definido',       color: '#404040', bg: '#f5f5f5', desc: 'Procesos documentados y seguidos de manera consistente en la organización.' },
  { level: 4, name: 'Gestionado',     color: '#262626', bg: '#f5f5f5', desc: 'Procesos medidos y controlados mediante métricas y tableros de indicadores.' },
  { level: 5, name: 'Optimizado',     color: '#0a0a0a', bg: '#f5f5f5', desc: 'Mejora continua e innovación sistemática integradas a la cultura organizacional.' },
];

// Constants eliminated in favor of database integration

const MOCK_RESULTS_PREDICTIVA: MaturityResult = {
  level: 3, score: 67,
  gaps: [
    'El control de cambios no está implementado de forma uniforme en todas las unidades.',
    'La gestión de riesgos se realiza de manera informal y sin registros actualizados.',
    'Las métricas de desempeño (EVM/CPI) son conocidas pero no aplicadas sistemáticamente.',
    'Las lecciones aprendidas se documentan ocasionalmente y no se reutilizan.',
  ],
  recommendations: [
    'Estandarizar la plantilla de acta de constitución y hacerla obligatoria para todos los proyectos.',
    'Implementar un registro centralizado de riesgos con revisión quincenal.',
    'Capacitar a los gerentes de proyecto en métricas de valor ganado (EVM).',
  ],
};

const MOCK_RESULTS_AGIL: MaturityResult = {
  level: 2, score: 44,
  gaps: [
    'Las retrospectivas son esporádicas y sus compromisos de mejora no tienen seguimiento.',
    'El backlog carece de priorización formal; los ítems no tienen criterios de aceptación.',
    'Los equipos dependen de la aprobación gerencial para decisiones operativas simples.',
    'No se mide la velocidad del equipo ni se usa para estimar futuros sprints.',
  ],
  recommendations: [
    'Institucionalizar retrospectivas al cierre de cada sprint con tablero de compromisos.',
    'Designar un Product Owner con dedicación real y capacitar en refinamiento de backlog.',
    'Definir un sistema de métricas ágiles: velocity, burn-down y lead time.',
  ],
};

function buildMockResults(pmoType: PmoType, comment?: string): FullResults {
  const hasAgil = pmoType === 'Ágil' || pmoType === 'Híbrida';
  const hasPredictiva = pmoType === 'Predictiva' || pmoType === 'Híbrida';
  const agil = hasAgil ? { ...MOCK_RESULTS_AGIL, score: comment ? 51 : 44 } : undefined;
  const predictiva = hasPredictiva ? { ...MOCK_RESULTS_PREDICTIVA, score: comment ? 72 : 67 } : undefined;
  const scores = [agil?.score, predictiva?.score].filter(Boolean) as number[];
  const overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const overallLevel = overallScore >= 80 ? 4 : overallScore >= 60 ? 3 : overallScore >= 40 ? 2 : 1;

  return {
    agil, predictiva, overallLevel, overallScore,
    summary: comment
      ? `[Diagnóstico reprocesado] Tras incorporar el comentario del consultor ("${comment.slice(0, 60)}..."), el Agente 5 recalibró los pesos de las dimensiones evaluadas, reflejando un incremento marginal en las puntuaciones.`
      : `El diagnóstico de madurez revela que la organización se encuentra en una etapa ${pmoType === 'Híbrida' ? 'de transición entre los niveles 2 y 3' : `Nivel ${overallLevel}`}. Se identificaron brechas críticas en la sistematización de procesos y en la medición del desempeño. Se recomienda un plan de mejora focalizado en las dimensiones con mayor brecha antes de avanzar al siguiente nivel de madurez.`,
    timestamp: new Date().toISOString(),
    version: comment ? 'reprocesado' : 'original',
  };
}

// ---------------------------------------------------------------------------
// PMO type config
// ---------------------------------------------------------------------------
const PMO_CONFIG = {
  Ágil:       { color: '#0a0a0a', Icon: Layers,       label: 'Ágil' },
  Híbrida:    { color: '#0a0a0a', Icon: Layers,  label: 'Híbrida' },
  Predictiva: { color: '#0a0a0a', Icon: Layers, label: 'Predictiva' },
};

// ---------------------------------------------------------------------------
// Helper: parse PMO type from Phase 4 agentDiagnosis string
// ---------------------------------------------------------------------------
function parsePmoType(agentData?: any): PmoType {
  if (!agentData) return 'Híbrida';
  
  const diag = agentData.diagnosis || agentData;
  const rawType = String(diag.pmo_type || diag.pmoType || diag.summary || 'Híbrido').toLowerCase();
  
  if (rawType.includes('agil') || rawType.includes('ágil')) return 'Ágil';
  if (rawType.includes('predictiv')) return 'Predictiva';
  
  return 'Híbrida';
}

// ---------------------------------------------------------------------------
// Maturity level bar
// ---------------------------------------------------------------------------
function MaturityLevelBar({ level }: { level: number }) {
  return (
    <div className="flex gap-1.5 items-center">
      {MATURITY_LEVELS.map(ml => (
        <div key={ml.level} className="flex-1 flex flex-col items-center gap-1">
          <motion.div
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ delay: ml.level * 0.08, duration: 0.3 }}
            className="w-full rounded-md"
            style={{
              height: ml.level === level ? 28 : 16,
              background: ml.level <= level ? ml.color : '#e5e7eb',
              opacity: ml.level === level ? 1 : ml.level < level ? 0.5 : 0.25,
              transformOrigin: 'bottom',
            }}
          />
          <span className="text-xs" style={{
            fontWeight: ml.level === level ? 700 : 400,
            color: ml.level === level ? ml.color : '#9ca3af',
          }}>
            {ml.level}
          </span>
        </div>
      ))}
    </div>
  );
}

// Legacy inline components removed

// ---------------------------------------------------------------------------
// Version badge + Approve modal (shared pattern from Phase 4)
// ---------------------------------------------------------------------------
function VersionBadge({ version, timestamp }: { version: DiagnosisVersion; timestamp: string }) {
  const ts = new Date(timestamp);
  const fmt = ts.toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border ${version === 'reprocesado' ? 'bg-neutral-900 border-neutral-900 text-white' : 'bg-gray-100 border-gray-200 text-gray-500'}`} style={{ fontWeight: 500 }}>
      {version === 'reprocesado' ? <RefreshCw size={10} /> : <Sparkles size={10} />}
      Diagnóstico {version === 'reprocesado' ? 'reprocesado' : 'original'}
      <span className="opacity-50">·</span>
      <Clock size={10} />{fmt}
    </div>
  );
}

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
              <h3 className="text-neutral-900 mb-1.5" style={{ fontWeight: 500, fontSize: '1.0625rem', letterSpacing: '-0.01em' }}>¿Aprobar este diagnóstico?</h3>
              <p className="text-neutral-500 text-[13px] leading-relaxed">
                La Fase 5 quedará completada y la Fase 6 se desbloqueará automáticamente. Esta acción no puede deshacerse.
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
                style={{ background: '#0a0a0a', fontWeight: 500, boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 8px 24px -8px rgba(0,0,0,0.18)' }}>
                {isLoading
                  ? <><Loader2 size={13} className="animate-spin" /> Aprobando…</>
                  : 'Aprobar diagnóstico'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Single maturity result card
// ---------------------------------------------------------------------------
function MaturityResultCard({ surveyKey, result, pmoType, manager }: { surveyKey: 'predictiva' | 'agil'; result: MaturityResult; pmoType: PmoType; manager: any }) {
  const ml = MATURITY_LEVELS[result.level - 1];
  const isAgil = surveyKey === 'agil';
  const accent = '#0a0a0a';
  const Icon = ClipboardList;

  return (
    <div className="bg-white rounded-2xl border border-neutral-200/70 shadow-sm overflow-hidden">
      {/* Level header */}
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${accent}18` }}>
              <Icon size={16} style={{ color: accent }} />
            </div>
            <p className="text-gray-700 text-sm" style={{ fontWeight: 600 }}>
              Madurez {isAgil ? 'Ágil' : 'Predictiva'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {manager.responses.length > 0 && (
              <button onClick={manager.downloadCSV} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 rounded-lg text-[11px] text-neutral-700 transition-colors" title="Descargar respuestas online (CSV)">
                <Download size={12} /> CSV
              </button>
            )}
            {manager.existingFileUrl && (
              <button onClick={() => window.open(manager.existingFileUrl, '_blank')} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-900 rounded-lg text-[11px] text-white transition-colors" title="Descargar archivo cargado manualmente">
                <Download size={12} /> Archivo original
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 mb-4">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Nivel de madurez</p>
            <div className="flex items-baseline gap-2">
              <span style={{ fontSize: '2.5rem', fontWeight: 800, color: ml.color, lineHeight: 1 }}>{result.level}</span>
              <span className="text-gray-400 text-sm">/5</span>
              <span className="ml-1 px-2 py-0.5 rounded-full text-xs" style={{ background: ml.bg, color: ml.color, fontWeight: 700 }}>{ml.name}</span>
            </div>
          </div>
          <div className="flex-1">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Puntuación</span><span style={{ fontWeight: 600, color: ml.color }}>{result.score}/100</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <motion.div className="h-full rounded-full" style={{ background: ml.color }}
                initial={{ width: 0 }} animate={{ width: `${result.score}%` }} transition={{ duration: 0.7, ease: 'easeOut', delay: 0.2 }} />
            </div>
          </div>
        </div>
        <MaturityLevelBar level={result.level} />
        <p className="text-gray-500 text-xs mt-3 leading-relaxed">{ml.desc}</p>
      </div>
      {/* Sub-scores (Domains/Factors) */}
      {(result.por_dominio || result.por_factor) && (
        <div className="p-5 border-b border-gray-100 bg-neutral-50/50">
          <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-4" style={{ fontWeight: 700 }}>
            Desglose por {isAgil ? 'Factores' : 'Dominios'}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Object.entries((isAgil ? result.por_factor : result.por_dominio) || {}).map(([key, data]) => (
              <div key={key} className="bg-white border border-neutral-200/60 rounded-xl p-3 shadow-sm">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1 truncate" title={key}>{key.replace(/_/g, ' ')}</p>
                <div className="flex items-end justify-between">
                  <span className="text-lg font-bold text-gray-800 leading-none">{data.score}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600 font-medium truncate max-w-[60px]" title={data.nivel}>{data.nivel}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Strengths */}
      {result.fortalezas && result.fortalezas.length > 0 && (
        <div className="p-5 border-b border-gray-100">
          <p className="text-[11px] uppercase tracking-wider text-neutral-500 mb-3" style={{ fontWeight: 700 }}>Fortalezas Destacadas</p>
          <ul className="space-y-2.5">
            {result.fortalezas.map((f, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[13px] text-gray-600 leading-relaxed">
                <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5 text-neutral-400" />
                <div>
                  <span className="font-medium text-gray-800">{f.nombre}</span>
                  {f.tipo && <span className="text-gray-400 text-[11px] ml-2">({f.tipo})</span>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Gaps */}
      <div className="p-5 border-b border-gray-100">
        <p className="text-[11px] uppercase tracking-wider text-neutral-500 mb-3" style={{ fontWeight: 700 }}>Brechas Identificadas</p>
        <ul className="space-y-3">
          {result.gaps.map((g, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[13px] text-gray-600 leading-relaxed bg-neutral-50/80 p-3 rounded-xl border border-neutral-200/60">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5 text-neutral-400" />
              <div className="flex-1">
                <p className="font-medium text-gray-800 mb-1">{g.nombre}</p>
                {g.impacto_potencial && <p className="text-gray-500 text-[12px]">{g.impacto_potencial}</p>}
              </div>
            </li>
          ))}
        </ul>
      </div>
      {/* Recommendations */}
      <div className="p-5 bg-neutral-50">
        <p className="text-[11px] uppercase tracking-wider text-neutral-500 mb-4" style={{ fontWeight: 700 }}>Recomendaciones</p>
        <ul className="space-y-3">
          {result.recommendations.map((r, i) => (
            <li key={i} className="flex items-start gap-3 text-[13px] text-gray-700 leading-relaxed">
              <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center bg-white border border-neutral-300 text-neutral-600 mt-0.5" style={{ fontSize: '0.65rem', fontWeight: 700 }}>{i + 1}</span>
              {r}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Parser helper (module-level, stable reference, no hook)
// ---------------------------------------------------------------------------
function parseAgentResults(datos: any): FullResults | null {
  if (!datos) return null;
  let obj = datos;
  if (typeof datos === 'string') {
    try { obj = JSON.parse(datos); } catch { return null; }
  }
  const d = obj.diagnosis ?? obj.data?.diagnosis ?? obj.data ?? obj;
  if (!d) return null;

  const hasMeaningfulData =
    d.overall_maturity_score != null || d.overallScore != null ||
    d.overall_maturity_level != null || d.predictive_maturity != null ||
    d.predictiva != null || d.madurez_predictiva != null ||
    d.agile_maturity != null || d.agil != null || d.madurez_agil != null;
  if (!hasMeaningfulData) return null;

  const labelToLevel = (label: string | number | undefined): number => {
    if (typeof label === 'number') return Math.max(1, Math.min(5, Math.round(label)));
    const map: Record<string, number> = {
      'informal': 1, 'básico': 2, 'basico': 2, 'inicial': 1,
      'estándar': 3, 'estandar': 3, 'definido': 3,
      'avanzado': 4, 'gestionado': 4, 'excelencia': 5, 'optimizado': 5,
    };
    return map[String(label ?? '').toLowerCase().trim()] ?? 1;
  };
  const ns = (raw: number) => raw <= 5 ? Math.round(raw * 20) : Math.round(raw);
  const globalRecs: string[] = Array.isArray(d.recommendations) ? d.recommendations : [];

  const parseDomainMap = (map: any): Record<string, DomainScore> | undefined => {
    if (!map || typeof map !== 'object') return undefined;
    const result: Record<string, DomainScore> = {};
    for (const [k, v] of Object.entries(map)) {
      const val = v as any;
      result[k] = { score: ns(Number(val?.score ?? 0)), nivel: String(val?.nivel ?? '') };
    }
    return result;
  };

  const parseGaps = (src: any[]): MaturityGap[] =>
    (src ?? []).map((b: any) => typeof b === 'string'
      ? { nombre: b, tipo: '', score: 0, nivel: '', impacto_potencial: b }
      : { nombre: b.nombre || '', tipo: b.tipo || '', score: ns(Number(b.score ?? 0)), nivel: b.nivel || '', impacto_potencial: b.impacto_potencial || '' }
    ).filter(g => g.nombre || g.impacto_potencial);

  const parseStrengths = (src: any[]): MaturityStrength[] =>
    (src ?? []).map((f: any) => typeof f === 'string'
      ? { nombre: f, tipo: '', score: 0, nivel: '' }
      : { nombre: f.nombre || '', tipo: f.tipo || '', score: ns(Number(f.score ?? 0)), nivel: f.nivel || '' }
    ).filter(f => f.nombre);

  const toMaturity = (src: any): MaturityResult | undefined => {
    if (!src || src.aplica === false) return undefined;
    const score = ns(Number(src.score_global ?? src.score ?? 0));
    const level = labelToLevel(src.nivel_global ?? src.overall_level ?? src.level ?? src.nivel);
    return {
      level, score,
      gaps: parseGaps(src.brechas ?? src.gaps ?? []),
      fortalezas: parseStrengths(src.fortalezas ?? []),
      recommendations: src.recommendations ?? src.recomendaciones ?? globalRecs,
      por_dominio: parseDomainMap(src.por_dominio),
      por_fase: parseDomainMap(src.por_fase),
      por_factor: parseDomainMap(src.por_factor),
      patrones_estructurales: src.patrones_estructurales,
    };
  };

  const predictiva = toMaturity(d.predictive_maturity ?? d.predictiva ?? d.madurez_predictiva);
  const agil = toMaturity(d.agile_maturity ?? d.agil ?? d.madurez_agil);

  let overallScore = ns(Number(d.overall_maturity_score ?? d.overallScore ?? 0));
  if (overallScore === 0) {
    const scores = [predictiva?.score, agil?.score].filter(Boolean) as number[];
    if (scores.length > 0) overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }
  let overallLevel = d.overall_maturity_level
    ? labelToLevel(d.overall_maturity_level)
    : (overallScore >= 80 ? 5 : overallScore >= 65 ? 4 : overallScore >= 50 ? 3 : overallScore >= 35 ? 2 : 1);
  if (overallLevel === 1 && overallScore > 20)
    overallLevel = overallScore >= 80 ? 5 : overallScore >= 65 ? 4 : overallScore >= 50 ? 3 : overallScore >= 35 ? 2 : 1;
  overallLevel = Math.max(1, Math.min(5, overallLevel));

  const overallLabel = d.overall_maturity_label ?? MATURITY_LEVELS[overallLevel - 1]?.name ?? '';
  const insumos = d.insumos_para_agente_6;
  const summary = (Array.isArray(insumos?.recomendaciones_generales) ? insumos.recomendaciones_generales.join(' ') : null) ?? d.summary ?? d.resumen ?? '';
  const iteration = obj.metadata?.iteration ?? 1;

  const analisis_cruzado = d.analisis_cruzado ? {
    aplica: d.analisis_cruzado.aplica ?? false,
    perfil: d.analisis_cruzado.perfil ?? '',
    coherencia: d.analisis_cruzado.coherencia ?? '',
    tensiones: (d.analisis_cruzado.tensiones ?? []).map((t: any) => ({ tipo: t.tipo ?? '', descripcion: t.descripcion ?? '', impacto: t.impacto ?? '' })),
  } : undefined;

  const analisis_cualitativo = d.analisis_cualitativo ? {
    total_respuestas_abiertas: d.analisis_cualitativo.total_respuestas_abiertas ?? 0,
    temas_recurrentes: (d.analisis_cualitativo.temas_recurrentes ?? []).map((t: any) => ({ tema: t.tema ?? '', frecuencia: t.frecuencia ?? 0, sintesis: t.sintesis ?? '', relacion_con_brechas: t.relacion_con_brechas ?? '' })),
  } : undefined;

  return {
    agil, predictiva, overallLevel, overallLabel, overallScore, summary,
    timestamp: obj.metadata?.timestamp ?? new Date().toISOString(),
    version: iteration > 1 ? 'reprocesado' : 'original',
    advertencias_de_entrada: (d.advertencias_de_entrada ?? []).map(String),
    top_gaps: (d.top_gaps ?? []).map((g: any) => ({ area: g.area ?? '', severity: g.severity ?? 'medium' })),
    recommendations: Array.isArray(d.recommendations) ? d.recommendations : (Array.isArray(insumos?.recomendaciones_generales) ? insumos.recomendaciones_generales : []),
    analisis_cruzado,
    analisis_cualitativo,
  };
}


// ---------------------------------------------------------------------------
// Main Module
function AnalysisDetails({ results }: { results: FullResults }) {
  if (!results.analisis_cruzado && !results.analisis_cualitativo && !results.top_gaps?.length) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
      {/* Top Gaps */}
      {results.top_gaps && results.top_gaps.length > 0 && (
        <div className="bg-white rounded-2xl border border-neutral-200/70 p-5 shadow-sm">
          <p className="text-[11px] uppercase tracking-wider text-neutral-600 mb-4" style={{ fontWeight: 700 }}>Top Brechas Críticas</p>
          <ul className="space-y-3">
            {results.top_gaps.map((g, i) => (
              <li key={i} className="flex items-center justify-between text-[13px] pb-3 border-b border-neutral-100 last:border-0 last:pb-0">
                <span className="font-medium text-gray-700">{g.area}</span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                  g.severity === 'critical' ? 'bg-neutral-800 text-neutral-100' :
                  g.severity === 'high' ? 'bg-neutral-200 text-neutral-700' :
                  'bg-neutral-100 text-neutral-500'
                }`}>
                  {g.severity}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Analisis Cualitativo */}
      {results.analisis_cualitativo && results.analisis_cualitativo.temas_recurrentes.length > 0 && (
        <div className="bg-white rounded-2xl border border-neutral-200/70 p-5 shadow-sm">
          <p className="text-[11px] uppercase tracking-wider text-neutral-600 mb-1" style={{ fontWeight: 700 }}>Análisis Cualitativo</p>
          <p className="text-[10px] text-gray-400 mb-4 uppercase tracking-wider">{results.analisis_cualitativo.total_respuestas_abiertas} respuestas procesadas</p>
          <ul className="space-y-4">
            {results.analisis_cualitativo.temas_recurrentes.map((t, i) => (
              <li key={i} className="text-[13px] border-l border-neutral-200 pl-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-gray-700">{t.tema}</span>
                  <span className="text-[10px] bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded-md font-medium">{t.frecuencia} menciones</span>
                </div>
                <p className="text-gray-500 leading-relaxed text-[12px]">{t.sintesis}</p>
                {t.relacion_con_brechas && <p className="text-neutral-400 text-[11px] mt-1 italic">Relación: {t.relacion_con_brechas}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Analisis Cruzado (Híbrido) */}
      {results.analisis_cruzado?.aplica && (
        <div className="lg:col-span-2 bg-neutral-50 rounded-2xl border border-neutral-200/70 p-6 shadow-sm text-neutral-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-neutral-500 mb-1" style={{ fontWeight: 700 }}>Análisis Cruzado Híbrido</p>
              <p className="text-lg font-bold text-neutral-900 tracking-tight">{results.analisis_cruzado.perfil}</p>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-white border border-neutral-200 shadow-sm">
              <span className="text-[10px] uppercase tracking-wider text-neutral-400 block mb-0.5">Coherencia Metodológica</span>
              <span className="font-bold text-[13px] text-neutral-700">{results.analisis_cruzado.coherencia}</span>
            </div>
          </div>
          
          {results.analisis_cruzado.tensiones && results.analisis_cruzado.tensiones.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-neutral-500 mb-3" style={{ fontWeight: 700 }}>Tensiones Identificadas</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {results.analisis_cruzado.tensiones.map((t, i) => (
                  <div key={i} className="bg-white border border-neutral-200/80 rounded-xl p-4">
                    <p className="font-medium text-neutral-800 text-[13px] mb-1.5">{t.tipo}</p>
                    <p className="text-[12px] text-neutral-500 leading-relaxed mb-2">{t.descripcion}</p>
                    <p className="text-[11px] text-neutral-400 italic">Impacto: {t.impacto}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
export default function MadurezModule() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getProject, updatePhaseStatus, reprocessPhase } = useApp();
  const { playAgentSuccess, playPhaseComplete } = useSoundManager();

  const project = getProject(projectId!);
  const phase = project?.phases.find(p => p.number === 5);
  const phase4 = project?.phases.find(p => p.number === 4);

  // Determine PMO type from Phase 4 result
  const pmoType: PmoType = parsePmoType(phase4?.agentData);
  const needsAgil = pmoType === 'Ágil' || pmoType === 'Híbrida';
  const needsPredictiva = pmoType === 'Predictiva' || pmoType === 'Híbrida';

  // State — derive initial view from phase status (same pattern as Phase 4)
  const [view, setView] = useState<ModuleView>(() => {
    if (!phase) return 'overview';
    if (phase.status === 'completado') return 'approved';
    if (phase.status === 'procesando') return 'processing';
    if (phase.status === 'bloqueado') return 'overview';
    // 'disponible' with data = pending review; without data = overview
    if (phase.agentData && Object.keys(phase.agentData).length > 0) return 'results';
    return 'overview';
  });

  // Managers
  const predictivaManager = useMadurez(projectId, 'predictiva');
  const agilManager = useMadurez(projectId, 'agil');

  const [results, setResults] = useState<FullResults | null>(() => {
    if (phase?.agentData && phase.status !== 'bloqueado') {
      return parseAgentResults(phase.agentData);
    }
    return null;
  });
  const [comment, setComment] = useState('');
  const [savedComment, setSavedComment] = useState('');
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isSavingComment, setIsSavingComment] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);

  // ── Sync with context — only when we have real results and aren't actively processing ──
  useEffect(() => {
    // Never override the processing view from context sync
    if (phase?.status === 'bloqueado' || phase?.status === 'procesando') return;
    if (phase?.agentData && !results) {
      const parsed = parseAgentResults(phase.agentData);
      if (parsed) {
        setResults(parsed);
        setView(phase.status === 'completado' ? 'approved' : 'results');
      }
    }
  }, [phase?.agentData, phase?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load from DB on mount ──
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const { data, error } = await supabase
        .from('fases_estado')
        .select('datos_consolidados, estado_visual')
        .eq('proyecto_id', projectId)
        .eq('numero_fase', 5)
        .single();

      if (error || !data) return;

      // Blocked = clean slate
      if (data.estado_visual === 'bloqueado') {
        setResults(null);
        setView('overview');
        return;
      }

      // Has data = show results or approved (same as Phase 4: disponible + data → diagnosis view)
      if (data.datos_consolidados) {
        const parsed = parseAgentResults(data.datos_consolidados);
        if (parsed) {
          setResults(parsed);
          if (data.estado_visual === 'completado') {
            setView('approved');
          } else if (data.estado_visual === 'procesando') {
            setView('processing');
          } else {
            // 'disponible' with data = agent finished, pending review
            setView('results');
          }
          return;
        }
      }

      // disponible with no data = overview (hasn't been processed yet)
      if (data.estado_visual === 'disponible' && !data.datos_consolidados) {
        setResults(null);
        setView('overview');
      }

      // procesando with no data = still running
      if (data.estado_visual === 'procesando') {
        setView('processing');
      }
    })();
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Polling — activates when view==='processing', exactly like Phase 4 ──
  useEffect(() => {
    if (view !== 'processing') return;

    let isMounted = true;

    const fetchResult = async () => {
      if (!isMounted || !projectId) return;
      const { data, error } = await supabase
        .from('fases_estado')
        .select('datos_consolidados, estado_visual')
        .eq('proyecto_id', projectId)
        .eq('numero_fase', 5)
        .single();

      if (error || !isMounted) return;

      // Agent finished successfully (completado OR disponible + data)
      if (data?.datos_consolidados && (data.estado_visual === 'completado' || data.estado_visual === 'disponible')) {
        const parsed = parseAgentResults(data.datos_consolidados);
        if (parsed) {
          setResults(parsed);
          setIsReprocessing(false);
          setView('results');
          playAgentSuccess();
          toast.success('Agente 5 completó el análisis de madurez', {
            description: `Nivel general: ${MATURITY_LEVELS[(parsed.overallLevel || 1) - 1]?.name} (${parsed.overallScore}/100)`,
          });
          return;
        }
      }

      // Agent failed (reverted to disponible with no data)
      if (data?.estado_visual === 'disponible' && !data?.datos_consolidados) {
        setIsReprocessing(false);
        updatePhaseStatus(projectId!, 5, 'disponible');
        setView('overview');
        toast.error('El Agente 5 encontró un error. Intente nuevamente.');
      }
    };

    fetchResult();
    const intervalId = setInterval(fetchResult, 4000);
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [view, projectId, playAgentSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!project || !phase) return null;

  // Survey completion check
  const hasPredictivaData = predictivaManager.responses.length > 0 || predictivaManager.existingFileName || predictivaManager.externalFile;
  const hasAgilData = agilManager.responses.length > 0 || agilManager.existingFileName || agilManager.externalFile;

  const predictivaDone = !needsPredictiva || hasPredictivaData;
  const agilDone = !needsAgil || hasAgilData;
  
  const allDone = predictivaDone && agilDone;
  const doneCount = [needsAgil && hasAgilData, needsPredictiva && hasPredictivaData].filter(Boolean).length;
  const totalCount = [needsAgil, needsPredictiva].filter(Boolean).length;

  // ── Handlers ──
  const handleSend = async () => {
    updatePhaseStatus(projectId!, 5, 'procesando');
    setView('processing');
    setResults(null);
    
    try {
      await supabase
        .from('fases_estado')
        .update({
          estado_visual: 'procesando',
          datos_consolidados: null,
          updated_at: new Date().toISOString(),
        })
        .eq('proyecto_id', projectId)
        .eq('numero_fase', 5);

      let predictivaFileUrl: string | null = null;
      let agilFileUrl: string | null = null;
      if (needsPredictiva) predictivaFileUrl = await predictivaManager.uploadFileIfAny() || null;
      if (needsAgil) agilFileUrl = await agilManager.uploadFileIfAny() || null;

      const response = await supabase.functions.invoke('pmo-agent', {
        body: {
          projectId,
          phaseNumber: 5,
          iteration: 1,
          pmoType,
          ...(predictivaFileUrl && { predictivaFileUrl }),
          ...(agilFileUrl && { agilFileUrl }),
        }
      });
      if (response.error) throw new Error(response.error.message);
      // Polling is now driven by the useEffect(view==='processing') — nothing else needed
    } catch (err: any) {
      toast.error('Error enviando datos al Agente 5', { description: err.message });
      updatePhaseStatus(projectId!, 5, 'disponible');
      setView('overview');
    }
  };

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
    setIsReprocessing(true);
    setResults(null);

    try {
      // Bloquear fases posteriores y limpiar datos
      await reprocessPhase(projectId!, 5);

      await supabase
        .from('fases_estado')
        .update({
          estado_visual: 'procesando',
          datos_consolidados: null,
          updated_at: new Date().toISOString(),
        })
        .eq('proyecto_id', projectId)
        .eq('numero_fase', 5);

      updatePhaseStatus(projectId!, 5, 'procesando');
      // Set view to processing AFTER supabase update so the polling useEffect picks it up
      setView('processing');

      const response = await supabase.functions.invoke('pmo-agent', {
        body: {
          projectId,
          phaseNumber: 5,
          iteration: 2,
          pmoType,
          comentario_consultor: comment,
        }
      });
      if (response.error) throw new Error(response.error.message);
      setSavedComment(comment);
      setComment('');
    } catch (err: any) {
      toast.error('Error re-procesando', { description: err.message });
      setIsReprocessing(false);
      setView('results');
    }
  };

  const handleApprove = async () => {
    setIsApproving(true);
    await new Promise(r => setTimeout(r, 600));
    setIsApproving(false);
    setShowApproveModal(false);
    updatePhaseStatus(projectId!, 5, 'completado',
      `Madurez PMO ${pmoType} · Nivel ${results?.overallLevel ?? 2} (${MATURITY_LEVELS[(results?.overallLevel ?? 2) - 1].name}) · Score ${results?.overallScore ?? 0}/100. ${results?.summary?.slice(0, 120)}…`
    );
    playPhaseComplete(); // Phase_Complete: consultor aprobó definitivamente
    setView('approved');
    toast.success('¡Fase 5 aprobada!', { description: 'La Fase 6 se ha desbloqueado automáticamente.' });
  };

  // ── PMO type config ──
  const pmoCfg = PMO_CONFIG[pmoType];
  const { Icon: PmoIcon } = pmoCfg;

  // ── Render ──
  return (
    <div className="min-h-screen bg-[#fafaf9]">
      <PhaseHeader
        projectId={projectId!}
        companyName={project.companyName}
        phaseNumber={5}
        phaseName="Madurez de la PMO"
        eyebrow={`PMO ${pmoType}`}
        rightSlot={(
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[12px]"
            style={{ borderColor: pmoCfg.color, color: pmoCfg.color, background: `${pmoCfg.color}10`, fontWeight: 500 }}>
            <PmoIcon size={11} /> PMO {pmoType}
          </div>
        )}
        onReprocessed={async () => {
          // 1. Block downstream phases (6, 7…)
          await reprocessPhase(projectId!, 5);
          // 2. Clear local state
          setResults(null);
          setComment('');
          setSavedComment('');
          setIsReprocessing(false);
          // 3. Reset view to survey management
          setView('overview');
        }}
      />

      <div className="max-w-[1100px] mx-auto px-10 py-10">
        <AnimatePresence mode="wait">

          {/* ── Overview ── */}
          {view === 'overview' && (
            <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="mb-10">
                <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400 mb-3" style={{ fontWeight: 500 }}>Fase 5 · Madurez de la PMO</p>
                <h1 className="text-neutral-900 tracking-tight" style={{ fontWeight: 500, fontSize: '2.25rem', lineHeight: 1.05, letterSpacing: '-0.025em' }}>
                  Evaluación de madurez {pmoType}
                </h1>
                <p className="text-neutral-500 text-[14px] mt-3 max-w-2xl leading-relaxed">
                  Según la clasificación de la Fase 4, su organización tendrá una <span className="text-neutral-900" style={{ fontWeight: 500 }}>PMO {pmoType}</span>. Gestione {totalCount === 2 ? 'ambas encuestas' : 'la encuesta'} para que el Agente 5 procese el diagnóstico de madurez.
                </p>

                <div className="grid grid-cols-3 gap-px bg-neutral-200/60 rounded-2xl overflow-hidden mt-7 border border-neutral-200/60">
                  <div className="bg-white px-5 py-4">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-400" style={{ fontWeight: 500 }}>Tipo de PMO</p>
                    <p className="mt-1.5 text-neutral-900" style={{ fontWeight: 500, fontSize: '1.375rem', letterSpacing: '-0.02em' }}>
                      {pmoType}
                    </p>
                  </div>
                  <div className="bg-white px-5 py-4">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-400" style={{ fontWeight: 500 }}>Encuestas</p>
                    <p className="mt-1.5 text-neutral-900 tabular-nums" style={{ fontWeight: 500, fontSize: '1.375rem', letterSpacing: '-0.02em' }}>
                      {doneCount}<span className="text-[12px] text-neutral-400 ml-1">/ {totalCount}</span>
                    </p>
                  </div>
                  <div className="bg-white px-5 py-4">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-400" style={{ fontWeight: 500 }}>Estado</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${allDone ? 'bg-neutral-800' : 'bg-neutral-400'}`} />
                      <p className="text-neutral-900 text-[13px]" style={{ fontWeight: 500 }}>
                        {allDone ? 'Listo para enviar' : 'En curso'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Survey Panels */}
              <div className="grid gap-8 mb-6">
                {needsPredictiva && (
                  <MadurezSurveyPanel 
                    title="Encuesta de Madurez Predictiva"
                    subtitle="Evaluación de prácticas tradicionales (Inicio, Planificación, Riesgos...)"
                    manager={predictivaManager} 
                  />
                )}
                {needsAgil && (
                  <MadurezSurveyPanel 
                    title="Encuesta de Madurez Ágil"
                    subtitle="Evaluación de prácticas ágiles (Iteraciones, Backlog, Ceremonias...)"
                    manager={agilManager} 
                  />
                )}
              </div>

              {/* Progress indicator (RF-F5-03) */}
              {pmoType === 'Híbrida' && (
                <div className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl border mb-6 ${allDone ? 'bg-neutral-900 border-neutral-900' : 'bg-neutral-50 border-neutral-200'}`}>
                  {allDone
                    ? <CheckCircle2 size={14} className="text-white flex-shrink-0" strokeWidth={1.75} />
                    : <AlertCircle size={14} className="text-neutral-400 flex-shrink-0" strokeWidth={1.75} />}
                  <p className="text-[13px]" style={{ fontWeight: 500, color: allDone ? '#ffffff' : '#737373' }}>
                    {allDone
                      ? 'Ambas encuestas tienen datos. Listo para enviar al Agente 5.'
                      : `${doneCount} de ${totalCount} encuestas con datos — ${totalCount - doneCount} pendiente${totalCount - doneCount > 1 ? 's' : ''}`}
                  </p>
                </div>
              )}

              {/* Send to Agent 5 */}
              <div className="flex justify-end">
                <motion.button
                  whileHover={allDone ? { scale: 1.02 } : {}} 
                  whileTap={allDone ? { scale: 0.97 } : {}}
                  onClick={allDone ? handleSend : undefined}
                  disabled={!allDone}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-full text-white text-[13px] transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:-translate-y-px"
                  style={{ background: '#0a0a0a', fontWeight: 500, boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 8px 24px -8px rgba(0,0,0,0.18)' }}>
                  <Send size={15} /> Confirmar encuestas y Enviar al Agente 5
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── Processing Overlay ── */}
          {view === 'processing' && (
            <motion.div 
              key="processing-overlay" 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-[#fafaf9]/85 backdrop-blur-md flex flex-col items-center justify-center"
            >
              <div 
                className="w-16 h-16 rounded-full border border-neutral-200 bg-white flex items-center justify-center mb-5" 
                style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
              >
                <Loader2 size={22} className="text-neutral-700 animate-spin" strokeWidth={1.75} />
              </div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400 mb-2" style={{ fontWeight: 500 }}>
                Procesando
              </p>
              <h2 className="text-neutral-900 tracking-tight" style={{ fontWeight: 500, fontSize: '1.25rem', letterSpacing: '-0.01em' }}>
                {isReprocessing ? 'Re-procesando diagnóstico' : 'Analizando madurez'}
              </h2>
              <p className="text-neutral-500 text-[13px] mt-2 max-w-sm text-center">
                {isReprocessing
                  ? 'El Agente 5 está incorporando el comentario del consultor y recalibrando el diagnóstico de madurez…'
                  : `Procesando las encuestas de madurez ${pmoType === 'Híbrida' ? 'Predictiva y Ágil' : pmoType} para determinar el nivel actual…`}
              </p>
            </motion.div>
          )}

          {/* ── Results ── */}
          {view === 'results' && results && (
            <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="mb-10 flex items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400 mb-3" style={{ fontWeight: 500 }}>Fase 5 · PMO {pmoType}</p>
                  <h1 className="text-neutral-900 tracking-tight" style={{ fontWeight: 500, fontSize: '2.25rem', lineHeight: 1.05, letterSpacing: '-0.025em' }}>
                    Diagnóstico de madurez
                  </h1>
                  <p className="text-neutral-500 text-[14px] mt-3 max-w-2xl leading-relaxed">
                    El Agente 5 evaluó las dimensiones de madurez y consolidó el nivel global con recomendaciones por área.
                  </p>
                </div>
                <VersionBadge version={results.version} timestamp={results.timestamp} />
              </div>

              {/* Overall score hero */}
              <div className="bg-white rounded-2xl border border-neutral-200/70 p-6 mb-5">
                <div className="flex items-center gap-6">
                  <div className="flex-shrink-0 text-center px-4">
                    <p className="text-xs text-gray-400 mb-1">Nivel general</p>
                    <div className="flex items-baseline gap-1.5">
                      <span style={{ fontSize: '3rem', fontWeight: 900, color: MATURITY_LEVELS[results.overallLevel - 1].color, lineHeight: 1 }}>
                        {results.overallLevel}
                      </span>
                      <span className="text-gray-300 text-2xl">/5</span>
                    </div>
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-xs mt-1"
                      style={{ background: MATURITY_LEVELS[results.overallLevel - 1].bg, color: MATURITY_LEVELS[results.overallLevel - 1].color, fontWeight: 700 }}>
                      {MATURITY_LEVELS[results.overallLevel - 1].name}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-gray-400">Puntuación ponderada</span>
                      <span style={{ fontWeight: 700, color: MATURITY_LEVELS[results.overallLevel - 1].color }}>{results.overallScore}/100</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-4">
                      <motion.div className="h-full rounded-full" style={{ background: MATURITY_LEVELS[results.overallLevel - 1].color }}
                        initial={{ width: 0 }} animate={{ width: `${results.overallScore}%` }} transition={{ duration: 0.7, ease: 'easeOut' }} />
                    </div>
                    <MaturityLevelBar level={results.overallLevel} />
                  </div>
                  <div className="flex-shrink-0 max-w-xs">
                    <p className="text-gray-600 text-sm leading-relaxed">{results.summary}</p>
                  </div>
                </div>
              </div>

              <div className={`grid gap-5 mb-5 ${pmoType === 'Híbrida' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {results.predictiva && (
                  <MaturityResultCard surveyKey="predictiva" result={results.predictiva} pmoType={pmoType} manager={predictivaManager} />
                )}
                {results.agil && (
                  <MaturityResultCard surveyKey="agil" result={results.agil} pmoType={pmoType} manager={agilManager} />
                )}
              </div>

              <AnalysisDetails results={results} />

              {/* Global Recommendations (for Hybrid it makes sense to show global recommendations here) */}
              {results.recommendations && results.recommendations.length > 0 && (
                <div className="bg-white rounded-2xl border border-neutral-200/70 p-6 mb-5 shadow-sm">
                  <p className="text-[11px] uppercase tracking-wider text-neutral-600 mb-4" style={{ fontWeight: 700 }}>Recomendaciones Globales</p>
                  <ul className="space-y-3">
                    {results.recommendations.map((r, i) => (
                      <li key={i} className="flex items-start gap-3 text-[13px] text-gray-700 leading-relaxed">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center bg-neutral-100 text-neutral-600 mt-0.5" style={{ fontSize: '0.65rem', fontWeight: 700 }}>{i + 1}</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* RF-F5-06: Comments */}
              <div className="bg-white rounded-2xl border border-neutral-200/70 p-6">
                <div className="flex items-center gap-2 mb-1">
                  <MessageSquare size={15} className="text-gray-500" />
                  <h3 className="text-gray-800 text-sm" style={{ fontWeight: 600 }}>Comentarios del consultor</h3>
                </div>
                <p className="text-gray-400 text-xs mb-3">
                  Agregue observaciones o contexto adicional. Puede guardar el comentario o re-procesar el diagnóstico incorporándolo.
                </p>
                {savedComment && (
                  <div className="mb-3 px-3 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200/70 text-[13px] text-neutral-600">
                    <p className="text-gray-400 text-xs mb-1" style={{ fontWeight: 600 }}>Último comentario guardado</p>
                    <p className="leading-relaxed">{savedComment}</p>
                  </div>
                )}
                <textarea value={comment} onChange={e => setComment(e.target.value)}
                  placeholder="Ej: El área de manufactura tiene un nivel de madurez distinto al resto de la organización. Sus procesos predictivos están más avanzados debido a la regulación ISO aplicable..."
                  rows={4}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition-all resize-y leading-relaxed bg-white mb-3" />
                <div className="flex items-center gap-3">
                  <button onClick={handleSaveComment} disabled={isSavingComment || !comment.trim()}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    style={{ fontWeight: 500 }}>
                    {isSavingComment ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Guardar comentario
                  </button>
                  <button onClick={handleReprocess} disabled={!comment.trim()}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:opacity-80"
                    style={{ borderColor: pmoCfg.color, color: pmoCfg.color, background: `${pmoCfg.color}10`, fontWeight: 500 }}>
                    <RefreshCw size={13} /> Re-procesar con comentario
                  </button>
                  <div className="flex-1" />
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={() => setShowApproveModal(true)}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl text-white text-sm shadow-sm hover:shadow-md transition-all"
                    style={{ background: '#0a0a0a', fontWeight: 500, boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 8px 24px -8px rgba(0,0,0,0.18)' }}>
                    <ThumbsUp size={14} /> Aprobar diagnóstico de madurez
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Approved ── */}
          {view === 'approved' && results && (
            <motion.div key="approved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="mb-10">
                <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400 mb-3" style={{ fontWeight: 500 }}>Fase 5 · PMO {pmoType}</p>
                <h1 className="text-neutral-900 tracking-tight" style={{ fontWeight: 500, fontSize: '2.25rem', lineHeight: 1.05, letterSpacing: '-0.025em' }}>
                  Diagnóstico aprobado
                </h1>
                <p className="text-neutral-500 text-[14px] mt-3 max-w-2xl leading-relaxed">
                  El nivel de madurez ha sido validado y registrado como referencia para la guía metodológica.
                </p>
                <span className="inline-flex items-center gap-1.5 mt-4 text-neutral-900 text-[12px]" style={{ fontWeight: 600 }}>
                  <CheckCircle2 size={13} /> Fase completada y aprobada
                </span>
              </div>

              {/* Overall score */}
              <div className="bg-white rounded-2xl border border-neutral-200/70 p-6 mb-5">
                <div className="flex items-center gap-6">
                  <div className="flex-shrink-0 text-center px-4">
                    <p className="text-xs text-gray-400 mb-1">Nivel aprobado</p>
                    <span style={{ fontSize: '3rem', fontWeight: 900, color: MATURITY_LEVELS[results.overallLevel - 1].color, lineHeight: 1 }}>{results.overallLevel}</span>
                    <p className="text-xs mt-1" style={{ color: MATURITY_LEVELS[results.overallLevel - 1].color, fontWeight: 700 }}>
                      {MATURITY_LEVELS[results.overallLevel - 1].name}
                    </p>
                  </div>
                  <div className="flex-1">
                    <MaturityLevelBar level={results.overallLevel} />
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-gray-400 text-xs">Score ponderado</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: 800, color: MATURITY_LEVELS[results.overallLevel - 1].color }}>{results.overallScore}/100</p>
                    {phase.completedAt && (
                      <p className="text-gray-400 text-xs mt-1 flex items-center gap-1 justify-end">
                        <CheckCircle2 size={10} className="text-neutral-900" /> Aprobado el {phase.completedAt}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className={`grid gap-5 mb-5 ${pmoType === 'Híbrida' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {results.predictiva && <MaturityResultCard surveyKey="predictiva" result={results.predictiva} pmoType={pmoType} manager={predictivaManager} />}
                {results.agil && <MaturityResultCard surveyKey="agil" result={results.agil} pmoType={pmoType} manager={agilManager} />}
              </div>

              <AnalysisDetails results={results} />

              {/* Global Recommendations */}
              {results.recommendations && results.recommendations.length > 0 && (
                <div className="bg-white rounded-2xl border border-neutral-200/70 p-6 mb-5 shadow-sm">
                  <p className="text-[11px] uppercase tracking-wider text-neutral-600 mb-4" style={{ fontWeight: 700 }}>Recomendaciones Globales</p>
                  <ul className="space-y-3">
                    {results.recommendations.map((r, i) => (
                      <li key={i} className="flex items-start gap-3 text-[13px] text-gray-700 leading-relaxed">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center bg-neutral-100 text-neutral-600 mt-0.5" style={{ fontSize: '0.65rem', fontWeight: 700 }}>{i + 1}</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Approve modal (RF-F5-07) */}
      <ApproveModal
        open={showApproveModal}
        onCancel={() => setShowApproveModal(false)}
        onConfirm={handleApprove}
        isLoading={isApproving}
      />

      <NextPhaseButton projectId={projectId!} nextPhase={6} prevPhase={4} show={view === 'approved'} />
    </div>
  );
}
