import { Layers } from 'lucide-react';
import type { DomainScore, FullResults, MaturityResult, MaturityRow, PmoType } from './types';

export const MATURITY_LEVELS = [
  { level: 1, name: 'Inicial',        color: '#64748b', bg: '#f8fafc', desc: 'Procesos ad-hoc y reactivos. Sin estandarización formal ni visibilidad.' },
  { level: 2, name: 'En Desarrollo',  color: '#e9683b', bg: '#fff1eb', desc: 'Algunos procesos definidos, pero aplicación inconsistente entre equipos.' },
  { level: 3, name: 'Definido',       color: '#9aa100', bg: '#fbfdd7', desc: 'Procesos documentados y seguidos de manera consistente en la organización.' },
  { level: 4, name: 'Gestionado',     color: '#4cb979', bg: '#ecfdf3', desc: 'Procesos medidos y controlados mediante métricas y tableros de indicadores.' },
  { level: 5, name: 'Optimizado',     color: '#5454e9', bg: '#eceeff', desc: 'Mejora continua e innovación sistemática integradas a la cultura organizacional.' },
];

// No local mock results are used in this module; all diagnostics come from fases_estado.

// ---------------------------------------------------------------------------
// PMO type config
// ---------------------------------------------------------------------------
export const PMO_CONFIG = {
  Ágil:       { color: '#4cb979', Icon: Layers,       label: 'Ágil' },
  Híbrida:    { color: '#865cf0', Icon: Layers,  label: 'Híbrida' },
  Predictiva: { color: '#5454e9', Icon: Layers, label: 'Predictiva' },
};

// ---------------------------------------------------------------------------
// Helper: parse PMO type from Phase 4 agentDiagnosis string
// ---------------------------------------------------------------------------
export function parsePmoType(agentData?: any): PmoType {
  if (!agentData) return 'Híbrida';
  
  const diag = agentData.diagnosis || agentData;
  const rawType = String(diag.pmo_type || diag.pmoType || diag.summary || 'Híbrido').toLowerCase();
  
  if (rawType.includes('agil') || rawType.includes('ágil')) return 'Ágil';
  if (rawType.includes('predictiv')) return 'Predictiva';
  
  return 'Híbrida';
}

// Legacy inline components removed

// ---------------------------------------------------------------------------
// Approve modal (shared pattern from Phase 4)

const maturityLevelPrefixMap: Record<string, number> = {
  informal: 1,
  inicial: 1,
  basico: 2,
  'bÃ¡sico': 2,
  'básico': 2,
  'en desarrollo': 2,
  estandar: 3,
  'estÃ¡ndar': 3,
  'estándar': 3,
  definido: 3,
  avanzada: 4,
  avanzado: 4,
  gestionado: 4,
  excelencia: 5,
  optimizado: 5,
};

const domainRows = [
  { key: 'gobernanza', label: 'Gobernanza' },
  { key: 'alcance', label: 'Alcance' },
  { key: 'cronograma', label: 'Cronograma' },
  { key: 'financiero', label: 'Finanzas' },
  { key: 'interesados', label: 'Interesados' },
  { key: 'recursos', label: 'Recursos' },
  { key: 'riesgos', label: 'Riesgos' },
];

const focusAreaRows = [
  { key: 'inicio', label: 'Inicio' },
  { key: 'planeacion', label: 'Planeación' },
  { key: 'ejecucion', label: 'Ejecución' },
  { key: 'monitoreo_control', label: 'Monitoreo y Control' },
  { key: 'cierre', label: 'Cierre' },
];

function normalizeKey(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'y')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function toFivePointScale(value: unknown) {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const scaled = numeric > 5 ? numeric / 20 : numeric;
  return Math.max(0, Math.min(5, Number(scaled.toFixed(1))));
}

export function formatOneDecimal(value: unknown) {
  return toFivePointScale(value).toFixed(1);
}

export function formatMaturityLabel(label: string, fallbackScore: number) {
  const raw = String(label || '').trim();
  const withoutPrefix = raw.replace(/^\d+\.\s*/, '');
  const normalized = normalizeKey(withoutPrefix).replace(/_/g, ' ');
  const prefix = maturityLevelPrefixMap[normalized] ?? maturityLevelPrefixMap[normalizeKey(withoutPrefix)] ?? Math.max(1, Math.min(5, Math.round(toFivePointScale(fallbackScore))));
  const display = withoutPrefix || MATURITY_LEVELS[prefix - 1]?.name || 'N/A';
  return `${prefix}. ${display}`;
}

function findScore(map: Record<string, DomainScore> | undefined, key: string): DomainScore | undefined {
  if (!map) return undefined;
  const target = normalizeKey(key);
  const aliases: Record<string, string[]> = {
    financiero: ['finanzas', 'financiera', 'financiero', 'costos', 'presupuesto'],
    planeacion: ['planeacion', 'planificacion', 'planificación'],
    monitoreo_control: ['monitoreo_control', 'monitoreo_y_control', 'monitoreo', 'control', 'seguimiento_control'],
  };

  for (const [rawKey, value] of Object.entries(map)) {
    const normalized = normalizeKey(rawKey);
    if (normalized === target || aliases[target]?.includes(normalized)) return value;
  }
  return undefined;
}

function buildRows(definitions: { key: string; label: string }[], map: Record<string, DomainScore> | undefined): MaturityRow[] {
  return definitions.map((row) => {
    const data = findScore(map, row.key);
    const value = toFivePointScale(data?.score ?? 0);
    return {
      ...row,
      value,
      maturity: formatMaturityLabel(data?.nivel || '', value),
    };
  });
}

function averageRows(rows: MaturityRow[]) {
  if (!rows.length) return 0;
  return Number((rows.reduce((sum, row) => sum + row.value, 0) / rows.length).toFixed(1));
}

// ---------------------------------------------------------------------------
// Parser helper (module-level, stable reference, no hook)
// ---------------------------------------------------------------------------
export function parseAgentResults(datos: any): FullResults | null {
  if (!datos) return null;
  let obj = datos;
  if (typeof datos === 'string') {
    try { obj = JSON.parse(datos); } catch { return null; }
  }
  const d = obj.diagnosis ?? obj.data?.diagnosis ?? obj.data ?? obj;
  if (!d) return null;

  const pickFirst = (...values: any[]) => values.find(v => v !== undefined && v !== null);
  const asArray = (value: any): any[] => Array.isArray(value) ? value : [];
  const hasAnyKey = (src: any, keys: string[]) => keys.some(key => src?.[key] !== undefined && src?.[key] !== null);

  const predictiveSource = pickFirst(
    d.predictive_maturity,
    d.predictiva,
    d.madurez_predictiva,
    d.predictive,
    d.predictivo,
    d.madurezPredictiva,
    d.predictiva_maturity,
    d.maturity_surveys?.predictive,
    d.maturity_surveys?.predictiva,
    d.resultados?.predictiva,
    d.resultados_madurez?.predictiva
  );
  const agileSource = pickFirst(
    d.agile_maturity,
    d.agil,
    d.madurez_agil,
    d.agile,
    d.madurezAgil,
    d.agil_maturity,
    d.maturity_surveys?.agile,
    d.maturity_surveys?.agil,
    d.resultados?.agil,
    d.resultados_madurez?.agil
  );

  const hasMeaningfulData =
    hasAnyKey(d, ['overall_maturity_score', 'overallScore', 'overall_score', 'score_global', 'overall_maturity_level', 'nivel_global']) ||
    predictiveSource != null ||
    agileSource != null;
  if (!hasMeaningfulData) return null;

  const labelToLevel = (label: string | number | undefined): number => {
    if (typeof label === 'number') return Math.max(1, Math.min(5, Math.round(label)));
    const numeric = String(label ?? '').match(/[1-5]/)?.[0];
    if (numeric) return Number(numeric);
    const map: Record<string, number> = {
      'informal': 1, 'básico': 2, 'basico': 2, 'inicial': 1,
      'estándar': 3, 'estandar': 3, 'definido': 3,
      'avanzado': 4, 'gestionado': 4, 'excelencia': 5, 'optimizado': 5,
    };
    return map[String(label ?? '').toLowerCase().trim()] ?? 1;
  };
  const ns = (raw: number) => raw <= 5 ? Math.round(raw * 20) : Math.round(raw);
  const globalRecs: string[] = asArray(pickFirst(d.recommendations, d.recomendaciones, d.insumos_para_agente_6?.recomendaciones_generales)).map(String);

  const parseDomainMap = (map: any): Record<string, DomainScore> | undefined => {
    if (!map || typeof map !== 'object') return undefined;
    const result: Record<string, DomainScore> = {};
    for (const [k, v] of Object.entries(map)) {
      const val = v as any;
      const rawScore = typeof val === 'number' ? val : pickFirst(val?.score, val?.puntuacion, val?.valor, val?.score_global, 0);
      result[k] = { score: ns(Number(rawScore)), nivel: String(pickFirst(val?.nivel, val?.level, val?.etiqueta, '')) };
    }
    return result;
  };

  const parseGaps = (src: any[]): MaturityGap[] =>
    asArray(src).map((b: any) => typeof b === 'string'
      ? { nombre: b, tipo: '', score: 0, nivel: '', impacto_potencial: b }
      : {
        nombre: pickFirst(b.nombre, b.area, b.factor, b.dominio, b.descripcion, ''),
        tipo: pickFirst(b.tipo, b.categoria, ''),
        score: ns(Number(pickFirst(b.score, b.puntuacion, b.valor, 0))),
        nivel: pickFirst(b.nivel, b.level, ''),
        impacto_potencial: pickFirst(b.impacto_potencial, b.impacto, b.descripcion, b.recomendacion, ''),
      }
    ).filter(g => g.nombre || g.impacto_potencial);

  const parseStrengths = (src: any[]): MaturityStrength[] =>
    asArray(src).map((f: any) => typeof f === 'string'
      ? { nombre: f, tipo: '', score: 0, nivel: '' }
      : {
        nombre: pickFirst(f.nombre, f.area, f.factor, f.dominio, f.descripcion, ''),
        tipo: pickFirst(f.tipo, f.categoria, ''),
        score: ns(Number(pickFirst(f.score, f.puntuacion, f.valor, 0))),
        nivel: pickFirst(f.nivel, f.level, ''),
      }
    ).filter(f => f.nombre);

  const toMaturity = (src: any): MaturityResult | undefined => {
    if (!src || src.aplica === false) return undefined;
    const rawScore = pickFirst(src.score_global, src.overall_score, src.score, src.puntuacion, src.puntuacion_global, src.maturity_score);
    const score = ns(Number(rawScore ?? 0));
    const level = labelToLevel(pickFirst(src.nivel_global, src.overall_level, src.level, src.nivel, src.maturity_level));
    const gaps = parseGaps(pickFirst(src.brechas, src.gaps, src.brechas_identificadas, src.brechas_criticas, []));
    const fortalezas = parseStrengths(pickFirst(src.fortalezas, src.strengths, src.puntos_fuertes, []));
    const recommendations = asArray(pickFirst(src.recommendations, src.recomendaciones, src.acciones_recomendadas, globalRecs)).map(String);
    const por_dominio = parseDomainMap(pickFirst(src.por_dominio, src.dominios, src.domain_scores));
    const por_fase = parseDomainMap(pickFirst(src.por_fase, src.fases, src.phase_scores));
    const por_factor = parseDomainMap(pickFirst(src.por_factor, src.factores, src.factor_scores));
    const hasSignal = rawScore != null || gaps.length > 0 || fortalezas.length > 0 || recommendations.length > 0 || !!por_dominio || !!por_fase || !!por_factor;
    if (!hasSignal) return undefined;
    return {
      level, score,
      gaps,
      fortalezas,
      recommendations,
      por_dominio,
      por_fase,
      por_factor,
      patrones_estructurales: pickFirst(src.patrones_estructurales, src.patrones, src.observaciones),
    };
  };

  const predictiva = toMaturity(predictiveSource);
  const agil = toMaturity(agileSource);

  let overallScore = ns(Number(pickFirst(d.overall_maturity_score, d.overallScore, d.overall_score, d.score_global, d.puntuacion_global, 0)));
  if (overallScore === 0) {
    const scores = [predictiva?.score, agil?.score].filter(Boolean) as number[];
    if (scores.length > 0) overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }
  const rawOverallLevel = pickFirst(d.overall_maturity_level, d.overallLevel, d.overall_level, d.nivel_global, d.level);
  let overallLevel = rawOverallLevel
    ? labelToLevel(rawOverallLevel)
    : (overallScore >= 80 ? 5 : overallScore >= 65 ? 4 : overallScore >= 50 ? 3 : overallScore >= 35 ? 2 : 1);
  if (overallLevel === 1 && overallScore > 20)
    overallLevel = overallScore >= 80 ? 5 : overallScore >= 65 ? 4 : overallScore >= 50 ? 3 : overallScore >= 35 ? 2 : 1;
  overallLevel = Math.max(1, Math.min(5, overallLevel));

  const overallLabel = pickFirst(d.overall_maturity_label, d.overallLabel, d.etiqueta_global, MATURITY_LEVELS[overallLevel - 1]?.name, '');
  const insumos = d.insumos_para_agente_6;
  const summary = String(pickFirst(d.summary, d.resumen, d.sintesis, d.conclusion, Array.isArray(insumos?.recomendaciones_generales) ? insumos.recomendaciones_generales.join(' ') : ''));
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
    top_gaps: asArray(pickFirst(d.top_gaps, d.brechas_criticas, d.principales_brechas, [])).map((g: any) => (
      typeof g === 'string'
        ? { area: g, severity: 'medium' as const }
        : { area: pickFirst(g.area, g.nombre, g.factor, g.descripcion, ''), severity: pickFirst(g.severity, g.criticidad, g.prioridad, 'medium') }
    )),
    recommendations: globalRecs,
    analisis_cruzado,
    analisis_cualitativo,
  };
}
