/**
 * EnfoqueModule — Fase 6: Enfoque para Guía Metodológica
 *
 * RF-F6-01  Al desbloquearse, envía automáticamente al Agente 6 el consolidado de Fases 4 y 5.
 * RF-F6-02  Tres secciones: Definición de enfoque · Puntos débiles · Instrucciones para Agente 7.
 * RF-F6-03  Comentarios y reprocesamiento idéntico a RF-F4-05/06 (versión + timestamp).
 * RF-F6-04  "Aprobar enfoque" → Fase 6 completada + JSON aprobado persistido + Fase 7 desbloqueada.
 *
 * TODO: RF-F6-01 → axios.post(N8N_WEBHOOK_AGENTE_6, { resultado_fase4, resultado_fase5 })
 * TODO: RF-F6-03 → guardar comentario en 'consultor_comentarios' (Supabase)
 * TODO: RF-F6-04 → supabase.from('fases_resultado').upsert({ proyecto_id, fase: 6, json: resultado })
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  Loader2, CheckCircle2, Brain, MessageSquare, Save,
  RefreshCw, ThumbsUp, Send, Clock, Sparkles, ChevronRight,
  Zap, BarChart2, GitMerge, Target, AlertTriangle, BookOpen,
  Lightbulb, ListChecks, ShieldAlert, Code2, Copy, Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../../context/AppContext';
import { useSoundManager } from '../../hooks/useSoundManager';
import PhaseHeader from './_shared/PhaseHeader';
import NextPhaseButton from './_shared/NextPhaseButton';
import { supabase } from '../../lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type PmoType = 'Ágil' | 'Híbrida' | 'Predictiva';
type Criticidad = 'Alta' | 'Media' | 'Baja';
type DiagnosisVersion = 'original' | 'reprocesado';
type ModuleView = 'auto-trigger' | 'processing' | 'results' | 'approved';

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
function parsePmoType(diag?: string): PmoType {
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
const PMO_ICON: Record<PmoType, React.ElementType> = { Ágil: Zap, Híbrida: GitMerge, Predictiva: BarChart2 };
const PMO_COLOR: Record<PmoType, string> = { Ágil: '#171717', Híbrida: '#404040', Predictiva: '#525252' };

// ---------------------------------------------------------------------------
// Mock result builder
// ---------------------------------------------------------------------------
function buildResult(pmoType: PmoType, maturityLevel: number, comment?: string): EnfoqueResult {
  const isAgil = pmoType === 'Ágil';
  const isHybrid = pmoType === 'Híbrida';
  const isPredictive = pmoType === 'Predictiva';
  const isLowMaturity = maturityLevel <= 2;

  const tipoGuia = isHybrid
    ? 'Guía Metodológica Híbrida — Marco de Transición Adaptativa'
    : isAgil
      ? 'Guía Metodológica Ágil — Escalado de Prácticas Iterativas'
      : 'Guía Metodológica Predictiva — Optimización y Gobernanza Avanzada';

  const orientacion = isHybrid
    ? `El Agente 6 determina que la organización requiere una Guía Metodológica de carácter híbrido que reconozca la coexistencia de proyectos con distintos perfiles de incertidumbre. La guía debe proveer marcos de decisión claros para que cada equipo seleccione el enfoque metodológico más adecuado según la naturaleza de su iniciativa. Dado el nivel de madurez actual (${maturityLevel}/5), la orientación estratégica prioriza la ${isLowMaturity ? 'estandarización básica de procesos y la institucionalización de prácticas mínimas antes de avanzar hacia prácticas más sofisticadas' : 'optimización de los procesos existentes e integración de capacidades ágiles en los ámbitos donde el valor lo justifique'}.`
    : isAgil
      ? `La guía se orienta hacia el escalado sostenible de prácticas ágiles en toda la organización, desde equipos individuales hacia niveles de portafolio. Con un nivel de madurez ${maturityLevel}/5, el foco debe ser ${isLowMaturity ? 'la instalación de ceremonias ágiles fundamentales y la formación de equipos autónomos' : 'la sincronización entre múltiples equipos ágiles y la alineación con la estrategia organizacional'}.`
      : `La guía se enfoca en la optimización y formalización de procesos de gestión de proyectos predictivos, elevando el nivel de control, visibilidad y gobierno. Con madurez ${maturityLevel}/5, la prioridad es ${isLowMaturity ? 'establecer procesos básicos documentados, repetibles y con gobernanza mínima' : 'implementar métricas avanzadas (EVM), gestión cuantitativa del rendimiento y procesos de mejora continua'}.`;

  const principios = isHybrid
    ? [
        { titulo: 'Decisión metodológica basada en evidencia', descripcion: 'Cada proyecto selecciona su marco según perfil de riesgo, regulación y velocidad requerida.' },
        { titulo: 'Estandarización progresiva', descripcion: 'Establecer un piso mínimo de prácticas antes de avanzar hacia mayor sofisticación.' },
        { titulo: 'Adaptabilidad institucional', descripcion: 'Los procesos deben poder ajustarse sin perder trazabilidad ni control de gobernanza.' },
        { titulo: 'Medición dual', descripcion: 'Métricas de desempeño para marcos ágiles (velocity, lead time) y predictivos (CPI, SPI) en un tablero unificado.' },
      ]
    : isAgil
      ? [
          { titulo: 'Autonomía con alineación', descripcion: 'Los equipos deciden el "cómo" mientras la organización define el "qué" y el "por qué".' },
          { titulo: 'Entrega continua de valor', descripcion: 'Cada iteración debe producir un incremento validado y potencialmente entregable.' },
          { titulo: 'Mejora continua sistémica', descripcion: 'Las retrospectivas generan compromisos de mejora con seguimiento formal y medición de impacto.' },
          { titulo: 'Transparencia radical', descripcion: 'El estado del trabajo, los impedimentos y el progreso deben ser visibles para todos los stakeholders.' },
        ]
      : [
          { titulo: 'Planificación robusta', descripcion: 'El éxito se construye en la fase de planificación; los cambios tardíos tienen costo exponencial.' },
          { titulo: 'Control integrado de cambios', descripcion: 'Todo cambio pasa por un proceso formal de evaluación de impacto antes de ser aprobado.' },
          { titulo: 'Gobernanza con escalamiento claro', descripcion: 'Comités de seguimiento con frecuencia, quórum y criterios de escalamiento definidos.' },
          { titulo: 'Gestión proactiva de riesgos', descripcion: 'Los riesgos se identifican, califican y planifican al inicio; se revisan periódicamente.' },
        ];

  const puntosDebiles: PuntoDebil[] = isHybrid
    ? [
        { area: 'Priorización de backlog', criticidad: 'Alta', descripcion: 'El backlog no tiene criterios formales de priorización ni estimaciones actualizadas.', impacto: 'Los equipos ágiles trabajan sin claridad de prioridades, generando desperdicio de esfuerzo.' },
        { area: 'Control de cambios', criticidad: 'Alta', descripcion: 'El proceso de control de cambios no se aplica de forma consistente en los proyectos predictivos.', impacto: 'Scope creep recurrente que afecta presupuesto y cronograma en proyectos de alta regulación.' },
        { area: 'Métricas de desempeño', criticidad: 'Media', descripcion: 'Ausencia de indicadores unificados para comparar el rendimiento entre proyectos ágiles y predictivos.', impacto: 'La alta dirección no tiene visibilidad homogénea del portafolio para tomar decisiones informadas.' },
        { area: 'Retrospectivas y mejora', criticidad: 'Media', descripcion: 'Las retrospectivas se realizan ocasionalmente y sus compromisos de mejora no tienen seguimiento.', impacto: 'Los problemas recurrentes no se resuelven, erosionando la moral y la eficiencia de los equipos.' },
        { area: 'Lecciones aprendidas', criticidad: 'Baja', descripcion: 'La documentación de lecciones aprendidas es esporádica y no está integrada al inicio de nuevos proyectos.', impacto: 'La organización repite errores ya conocidos, incurriendo en costos evitables.' },
      ]
    : isAgil
      ? [
          { area: 'Autonomía de equipos', criticidad: 'Alta', descripcion: 'Los equipos requieren aprobación gerencial para decisiones técnicas y operativas básicas.', impacto: 'Cuellos de botella en la toma de decisiones que reducen la velocidad de entrega.' },
          { area: 'Sincronización de equipos', criticidad: 'Alta', descripcion: 'No existe un mecanismo formal de coordinación entre múltiples equipos ágiles.', impacto: 'Dependencias no gestionadas generan bloqueos y retrasos en las entregas integradas.' },
          { area: 'Métricas de flujo', criticidad: 'Media', descripcion: 'No se mide velocity, lead time ni cycle time de forma sistemática.', impacto: 'La planificación de sprints es imprecisa y las estimaciones fallan consistentemente.' },
          { area: 'Definición de Done', criticidad: 'Baja', descripcion: 'Los criterios de "terminado" no están formalmente definidos ni acordados entre equipos y stakeholders.', impacto: 'Retrabajos frecuentes al descubrir en producción que los entregables no cumplían expectativas.' },
        ]
      : [
          { area: 'Gestión de riesgos formal', criticidad: 'Alta', descripcion: 'No existe un registro de riesgos actualizado ni planes de respuesta documentados.', impacto: 'Los proyectos se ven sorprendidos por eventos que pudieron haberse anticipado y mitigado.' },
          { area: 'Valor ganado (EVM)', criticidad: 'Alta', descripcion: 'Las métricas de valor ganado no se calculan ni reportan en los proyectos.', impacto: 'Imposible detectar desviaciones de costo y cronograma antes de que se vuelvan críticas.' },
          { area: 'Actas de constitución', criticidad: 'Media', descripcion: 'Los proyectos inician sin documento de constitución formal aprobado por patrocinadores.', impacto: 'Alcance difuso y falta de autoridad formal del director de proyecto para gestionar recursos.' },
          { area: 'Cierre formal de proyectos', criticidad: 'Baja', descripcion: 'Los proyectos se "abandonan" sin un proceso formal de cierre y entrega.', impacto: 'Lecciones aprendidas perdidas y entregables sin transferencia formal al cliente/operaciones.' },
        ];

  const instrucciones: InstruccionAgente7[] = [
    {
      categoria: 'Alcance y cobertura de la guía',
      icon: Target,
      directrices: isHybrid
        ? [
            'La guía debe cubrir los dos marcos metodológicos (ágil y predictivo) con una sección introductoria de criterios de selección.',
            'Incluir un árbol de decisión que permita al gestor de proyecto determinar el enfoque adecuado según: nivel de incertidumbre, requisitos regulatorios, tamaño del equipo y frecuencia de cambio.',
            'El alcance abarca desde el inicio del proyecto hasta el cierre formal, sin excluir ninguna fase del ciclo de vida.',
          ]
        : isAgil
          ? [
              'La guía debe cubrir el ciclo ágil completo: desde la formación del equipo y el backlog inicial hasta la entrega y retrospectiva final.',
              'Incluir una sección dedicada al escalado para organizaciones con múltiples equipos simultáneos.',
              'El alcance incluye tanto proyectos de producto interno como proyectos de servicio orientados al cliente.',
            ]
          : [
              'La guía debe cubrir las 5 fases del ciclo de vida predictivo: Inicio, Planificación, Ejecución, Monitoreo & Control, y Cierre.',
              'Incluir un capítulo específico de gobernanza y comités con roles, frecuencias y criterios de escalamiento.',
              'Documentar los procesos de control de cambios, gestión de riesgos y comunicación con stakeholders.',
            ],
    },
    {
      categoria: 'Estructura de capítulos recomendada',
      icon: BookOpen,
      directrices: isHybrid
        ? [
            'Cap. 1: Principios y valores del marco híbrido (por qué y para qué).',
            'Cap. 2: Modelo de decisión metodológica (árbol de decisión + criterios de selección).',
            'Cap. 3: Ciclo de vida ágil — ceremonias, roles, artefactos y métricas.',
            'Cap. 4: Ciclo de vida predictivo — fases, entregables, aprobaciones y control.',
            'Cap. 5: Gobierno unificado del portafolio — tableros, KPIs y reporting.',
            'Cap. 6: Plan de adopción y hoja de ruta de madurez.',
          ]
        : isAgil
          ? [
              'Cap. 1: Manifiesto y principios ágiles aplicados al contexto organizacional.',
              'Cap. 2: Roles y responsabilidades (Product Owner, Scrum Master, Development Team).',
              'Cap. 3: Ceremonias ágiles — propósito, duración, participantes y facilitación.',
              'Cap. 4: Gestión del backlog — escritura de historias, estimación y priorización.',
              'Cap. 5: Métricas de equipo y reporting ágil para stakeholders ejecutivos.',
              'Cap. 6: Escalado ágil — coordinación entre múltiples equipos.',
            ]
          : [
              'Cap. 1: Marco de gobierno de proyectos — estructura, autoridad y decisiones.',
              'Cap. 2: Inicio de proyectos — acta de constitución, stakeholders y objetivos SMART.',
              'Cap. 3: Planificación integrada — WBS, cronograma, presupuesto y riesgos.',
              'Cap. 4: Ejecución y control — reuniones de seguimiento, control de cambios y EVM.',
              'Cap. 5: Gestión de riesgos e issues — registro, clasificación y planes de respuesta.',
              'Cap. 6: Cierre formal — entregables, lecciones aprendidas y acta de cierre.',
            ],
    },
    {
      categoria: 'Plantillas y artefactos prioritarios',
      icon: ListChecks,
      directrices: isHybrid
        ? [
            'Plantilla de árbol de decisión metodológica (formato tabla + diagrama de flujo).',
            'Acta de constitución de proyecto (versión simplificada para proyectos ágiles, completa para predictivos).',
            'Product backlog template con campos de prioridad, estimación y criterios de aceptación.',
            'Tablero de portafolio unificado con columnas de estado por tipo de proyecto.',
            'Template de retrospectiva con secciones: qué salió bien, qué mejorar, compromisos concretos.',
          ]
        : isAgil
          ? [
              'Product backlog template con historia de usuario, criterios de aceptación y definición de Done.',
              'Sprint backlog y tablero Kanban (To Do / In Progress / Done / Blocked).',
              'Burn-down chart y velocity tracker (últimos 6 sprints).',
              'Plantilla de retrospectiva estructurada (4Ls: Liked, Learned, Lacked, Longed for).',
              'Definition of Done checklist por tipo de entregable.',
            ]
          : [
              'Acta de constitución de proyecto con campos obligatorios y firma del patrocinador.',
              'Work Breakdown Structure (WBS) template por tipo de proyecto.',
              'Registro de riesgos con matriz de probabilidad-impacto y semáforo de criticidad.',
              'Informe de estado semanal con indicadores EVM (CV, SV, CPI, SPI).',
              'Acta de control de cambios con análisis de impacto en alcance, tiempo y costo.',
            ],
    },
    {
      categoria: 'Métricas de éxito a documentar',
      icon: Target,
      directrices: isHybrid
        ? [
            'Tasa de adopción de la guía: % de proyectos nuevos que siguen el marco definido (meta: >80% en 6 meses).',
            'Reducción de scope creep: % de proyectos con cambios no controlados (meta: <20%).',
            'Satisfacción de stakeholders: NPS trimestral de directores de proyecto y patrocinadores.',
            'Tiempo de ciclo promedio: reducción de lead time en proyectos comparables.',
          ]
        : isAgil
          ? [
              'Velocity del equipo: puntos de historia completados por sprint (evolución en 6 sprints).',
              'Predictibilidad de sprint: % de compromisos cumplidos al 100% (meta: >85%).',
              'Lead time y cycle time: tiempo promedio desde que un ítem entra al backlog hasta que se entrega.',
              'NPS de equipo: medición de bienestar y satisfacción del equipo (encuesta trimestral).',
            ]
          : [
              'CPI (Cost Performance Index): índice de desempeño de costo (meta: CPI ≥ 0.95).',
              'SPI (Schedule Performance Index): índice de desempeño de cronograma (meta: SPI ≥ 0.90).',
              'Tasa de cambios aprobados vs. solicitados: efectividad del control de cambios.',
              'Porcentaje de riesgos materializados vs. identificados: efectividad de la gestión de riesgos.',
            ],
    },
    {
      categoria: 'Consideraciones de adopción',
      icon: Lightbulb,
      directrices: [
        `Diseñar un plan de change management que incluya: comunicación del cambio, formación de campeones internos y reconocimiento de equipos que adopten la guía.`,
        `Establecer una hoja de ruta de implementación en tres horizontes: 30 días (piloto con 1-2 proyectos), 90 días (expansión a todos los proyectos activos), 180 días (evaluación de madurez y ajuste de la guía).`,
        comment
          ? `Consideración adicional del consultor: "${comment.trim()}" — Incorporar este contexto en el capítulo de adopción para reflejar las particularidades identificadas en campo.`
          : `Incluir una sección de preguntas frecuentes (FAQ) y un glosario de términos para facilitar la comprensión de usuarios con distinto nivel de experiencia metodológica.`,
        `La guía debe versionarse (v1.0, v1.1…) y contar con un proceso de revisión anual o ante cambios organizacionales significativos.`,
      ],
    },
  ];

  return {
    enfoque: { tipo: tipoGuia, orientacion, principios },
    puntosDebiles,
    instrucciones,
    timestamp: new Date().toISOString(),
    version: comment ? 'reprocesado' : 'original',
    rawData: null,
  };
}

// ---------------------------------------------------------------------------
// Agent result adapter: maps real pmo-agent output → EnfoqueResult for the UI
// ---------------------------------------------------------------------------
function mapAgentResult(datos: any): EnfoqueResult | null {
  if (!datos) return null;
  const d = datos.diagnosis ?? datos;
  if (!d) return null;

  const ga = d.guide_approach ?? {};
  const pc = d.parametros_construccion ?? {};
  const severityMap: Record<string, Criticidad> = {
    critical: 'Alta', high: 'Alta', medium: 'Media', low: 'Baja',
  };

  // Principios: frameworks + tono + extensión
  const principios: { titulo: string; descripcion: string }[] = [
    ga.primary_framework   ? { titulo: 'Marco primario',   descripcion: ga.primary_framework } : null,
    ga.secondary_framework ? { titulo: 'Marco secundario', descripcion: ga.secondary_framework } : null,
    pc.tone                ? { titulo: 'Tono de la guía',  descripcion: `${pc.tone}. ${pc.tone_justification ?? ''}`.trim() } : null,
    pc.recommended_length  ? { titulo: 'Extensión recomendada', descripcion: `${pc.recommended_length}. ${pc.length_justification ?? ''}`.trim() } : null,
  ].filter(Boolean) as { titulo: string; descripcion: string }[];

  // Puntos débiles from critical_weaknesses
  const puntosDebiles: PuntoDebil[] = (d.critical_weaknesses ?? []).map((w: any) => ({
    area: w.weakness ?? '',
    criticidad: severityMap[w.severity] ?? 'Media',
    descripcion: w.content_type_needed ? `Tipo de contenido necesario: ${w.content_type_needed}` : '',
    impacto: (w.guide_sections_recommended ?? []).length > 0
      ? `Abordar en secciones: ${(w.guide_sections_recommended ?? []).join(', ')}`
      : '',
  }));

  // Instrucciones: groupings from secciones + parametros
  const adicionales = (d.insumos_base_utilizados?.secciones_adicionales_activadas ?? []) as string[];
  const instrucciones: InstruccionAgente7[] = [
    {
      categoria: 'Alcance y estructura de la guía',
      icon: Target,
      directrices: [
        'Secciones base incluidas (S01–S10): siempre presentes.',
        adicionales.length > 0
          ? `Secciones adicionales activadas: ${adicionales.join(', ')}`
          : 'No se activaron secciones adicionales.',
        ...(d.secciones ?? [])
          .filter((s: any) => s.tipo === 'adicional')
          .map((s: any) => `${s.id} — ${s.titulo}: ${s.condicion_inclusion}`),
      ].filter(Boolean),
    },
    {
      categoria: 'Audiencia y tono',
      icon: Lightbulb,
      directrices: [
        `Audiencia objetivo: ${(pc.target_audience ?? []).join(', ') || 'No especificada'}`,
        pc.tone ? `Tono: ${pc.tone}` : null,
        pc.tone_justification ?? null,
        pc.recommended_length ? `Extensión: ${pc.recommended_length}` : null,
        pc.length_justification ?? null,
      ].filter(Boolean) as string[],
    },
    {
      categoria: 'Énfasis especiales para el Agente 7',
      icon: ListChecks,
      directrices: (pc.special_emphasis ?? []).length > 0
        ? pc.special_emphasis
        : ['Sin énfasis especiales adicionales.'],
    },
    {
      categoria: 'Secciones con nivel de detalle Alto',
      icon: BookOpen,
      directrices: (d.secciones ?? [])
        .filter((s: any) => s.nivel_detalle_recomendado === 'Alto')
        .map((s: any) => `${s.id} — ${s.titulo}: ${s.enfasis}`)
        .concat(
          (d.secciones ?? []).filter((s: any) => s.nivel_detalle_recomendado === 'Alto').length === 0
            ? ['Ninguna sección marcada con detalle Alto.']
            : []
        ),
    },
    {
      categoria: 'Advertencias del diagnóstico',
      icon: ShieldAlert,
      directrices: (d.advertencias_de_entrada ?? []).length > 0
        ? d.advertencias_de_entrada
        : ['No se detectaron advertencias en los datos de entrada.'],
    },
  ].filter(instr => instr.directrices.length > 0);

  return {
    enfoque: { tipo: ga.type ?? '', orientacion: ga.strategic_orientation ?? '', principios },
    puntosDebiles,
    instrucciones,
    timestamp: new Date().toISOString(),
    version: (datos.metadata?.iteration ?? 1) > 1 ? 'reprocesado' : 'original',
  };
}

function mapAgentResultV2(datos: any): EnfoqueResult | null {
  if (!datos) return null;
  const d = datos.diagnosis ?? datos;
  if (!d) return null;

  const ga = d.guide_approach ?? {};
  const pc = d.parametros_construccion ?? {};
  const experto = d.diagnostico_experto ?? {};
  const severityMap: Record<string, Criticidad> = {
    critical: 'Alta', high: 'Alta', medium: 'Media', low: 'Baja',
  };

  const principios: { titulo: string; descripcion: string }[] = [
    ga.type ? { titulo: 'Tipo de enfoque', descripcion: ga.type } : null,
    ga.primary_framework ? { titulo: 'Marco primario', descripcion: ga.primary_framework } : null,
    ga.secondary_framework ? { titulo: 'Marco secundario', descripcion: ga.secondary_framework } : null,
    ga.framework_balance ? { titulo: 'Balance metodologico', descripcion: ga.framework_balance } : null,
    ga.justification ? { titulo: 'Justificacion', descripcion: ga.justification } : null,
    pc.tone ? { titulo: 'Tono de la guia', descripcion: `${pc.tone}. ${pc.tone_justification ?? ''}`.trim() } : null,
    pc.recommended_length ? { titulo: 'Extension recomendada', descripcion: `${pc.recommended_length}. ${pc.length_justification ?? ''}`.trim() } : null,
  ].filter(Boolean) as { titulo: string; descripcion: string }[];

  const puntosDebilesSource = experto.brechas_priorizadas ?? d.critical_weaknesses ?? [];
  const puntosDebiles: PuntoDebil[] = puntosDebilesSource.map((w: any) => ({
    area: w.brecha ?? w.weakness ?? w.tipo ?? '',
    criticidad: severityMap[w.severity] ?? 'Media',
    descripcion: w.impacto_en_proyectos ?? w.content_type_needed ?? w.que_debe_hacer_la_guia ?? '',
    impacto: [
      w.que_debe_hacer_la_guia ? `Guia: ${w.que_debe_hacer_la_guia}` : '',
      (w.secciones_que_la_abordan ?? w.guide_sections_recommended ?? []).length > 0
        ? `Secciones: ${(w.secciones_que_la_abordan ?? w.guide_sections_recommended ?? []).join(', ')}`
        : '',
    ].filter(Boolean).join(' - '),
  }));

  const adicionales = (d.insumos_base_utilizados?.secciones_adicionales_activadas ?? []) as string[];
  const subagents = d.insumos_por_subagente ?? {};
  const instrucciones: InstruccionAgente7[] = [
    {
      categoria: 'Alcance y estructura de la guia',
      icon: Target,
      directrices: [
        adicionales.length > 0
          ? `Secciones adicionales activadas: ${adicionales.join(', ')}`
          : 'No se activaron secciones adicionales.',
        ...(d.secciones ?? []).map((s: any) => `${s.id ?? ''} - ${s.titulo ?? ''}: ${s.enfasis ?? s.condicion_inclusion ?? ''}`),
      ].filter(Boolean),
    },
    {
      categoria: 'Audiencia, tono y longitud',
      icon: Lightbulb,
      directrices: [
        `Audiencia objetivo: ${(pc.target_audience ?? []).join(', ') || 'No especificada'}`,
        pc.tone ? `Tono: ${pc.tone}` : null,
        pc.tone_justification ?? null,
        pc.recommended_length ? `Extension: ${pc.recommended_length}` : null,
        pc.length_justification ?? null,
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
  ].filter(instr => instr.directrices.length > 0);

  return {
    enfoque: {
      tipo: ga.type ?? ga.primary_framework ?? 'Enfoque metodologico',
      orientacion: ga.strategic_orientation ?? d.summary ?? experto.resumen_diagnostico ?? '',
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
// Shared: Version badge
// ---------------------------------------------------------------------------
function VersionBadge({ version, timestamp }: { version: DiagnosisVersion; timestamp: string }) {
  const ts = new Date(timestamp);
  const fmt = ts.toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border ${version === 'reprocesado' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-gray-100 border-gray-200 text-gray-500'}`}
      style={{ fontWeight: 500 }}>
      {version === 'reprocesado' ? <RefreshCw size={10} /> : <Sparkles size={10} />}
      Resultado {version}
      <span className="opacity-50">·</span>
      <Clock size={10} />{fmt}
    </div>
  );
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
                style={{ background: '#0a0a0a', fontWeight: 500, boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 8px 24px -8px rgba(0,0,0,0.18)' }}>
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
// Section: Definición de enfoque
// ---------------------------------------------------------------------------
function EnfoqueSection({ result, pmoType }: { result: EnfoqueResult; pmoType: PmoType }) {
  const color = PMO_COLOR[pmoType];
  const Icon = PMO_ICON[pmoType];

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-5 h-5 rounded flex items-center justify-center bg-neutral-100">
          <Target size={11} className="text-neutral-600" />
        </div>
        <h2 className="text-gray-700 text-sm uppercase tracking-wide" style={{ fontWeight: 700 }}>
          1 — Definición de enfoque
        </h2>
      </div>

      {/* Type hero */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-neutral-200 bg-white p-6 mb-4 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-neutral-900 shadow-sm">
            <Icon size={22} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-widest text-neutral-400 mb-1" style={{ fontWeight: 700 }}>Tipo de guía recomendado</p>
            <h3 className="text-neutral-900 mb-2" style={{ fontWeight: 700, fontSize: '1.1rem', lineHeight: 1.3 }}>
              {result.enfoque.tipo}
            </h3>
            <p className="text-gray-500 text-sm leading-relaxed">{result.enfoque.orientacion}</p>
          </div>
        </div>
      </motion.div>

      {/* Principles */}
      <div className="bg-white rounded-2xl border border-neutral-200/70 p-5">
        <p className="text-xs uppercase tracking-wide text-gray-400 mb-4" style={{ fontWeight: 700 }}>
          Principios rectores
        </p>
        <div className="flex flex-col gap-2.5">
          {result.enfoque.principios.map((p, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
              className="flex items-start gap-4 p-4 rounded-xl border border-gray-100 bg-neutral-50/30 hover:border-gray-200 transition-colors">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 bg-neutral-900 text-white"
                style={{ fontSize: '0.65rem', fontWeight: 800 }}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-neutral-800 text-sm mb-1" style={{ fontWeight: 600 }}>{p.titulo}</p>
                <p className="text-neutral-500 text-sm leading-relaxed">{p.descripcion}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Puntos débiles
// ---------------------------------------------------------------------------
const CRIT_CONFIG: Record<Criticidad, { color: string; bg: string; border: string; Icon: React.ElementType }> = {
  Alta:  { color: '#171717', bg: '#f5f5f5', border: '#e5e5e5', Icon: ShieldAlert },
  Media: { color: '#525252', bg: '#fafafa', border: '#f4f4f5', Icon: AlertTriangle },
  Baja:  { color: '#737373', bg: '#ffffff', border: '#f4f4f5', Icon: AlertTriangle },
};

function PuntosDebilesSection({ result }: { result: EnfoqueResult }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-5 h-5 rounded flex items-center justify-center bg-neutral-100">
          <ShieldAlert size={11} className="text-neutral-600" />
        </div>
        <h2 className="text-gray-700 text-sm uppercase tracking-wide" style={{ fontWeight: 700 }}>
          2 — Puntos débiles identificados
        </h2>
        <span className="ml-auto px-2 py-0.5 rounded-full text-xs bg-neutral-100 text-neutral-600 border border-neutral-200" style={{ fontWeight: 600 }}>
          {result.puntosDebiles.filter(p => p.criticidad === 'Alta').length} críticos
        </span>
      </div>

      <div className="space-y-2.5">
        {result.puntosDebiles.map((punto, i) => {
          const cfg = CRIT_CONFIG[punto.criticidad];
          const { Icon: CritIcon } = cfg;
          return (
            <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
              className="bg-white rounded-xl border shadow-sm p-4 flex items-start gap-4"
              style={{ borderColor: cfg.border }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: cfg.bg }}>
                <CritIcon size={15} style={{ color: cfg.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <p className="text-gray-800 text-sm" style={{ fontWeight: 600 }}>{punto.area}</p>
                  <span className="px-2 py-0.5 rounded-full text-xs border" style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border, fontWeight: 600 }}>
                    {punto.criticidad}
                  </span>
                </div>
                <p className="text-gray-600 text-xs leading-relaxed mb-1">{punto.descripcion}</p>
                <p className="text-xs" style={{ color: cfg.color, fontWeight: 500 }}>
                  <span className="opacity-70">Impacto: </span>{punto.impacto}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Instrucciones para Agente 7
// ---------------------------------------------------------------------------
function InstruccionesSection({ result }: { result: EnfoqueResult }) {
  const [expanded, setExpanded] = useState<number | null>(0);

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-5 h-5 rounded flex items-center justify-center bg-neutral-100">
          <Brain size={11} className="text-neutral-600" />
        </div>
        <h2 className="text-gray-700 text-sm uppercase tracking-wide" style={{ fontWeight: 700 }}>
          3 — Instrucciones para el Agente 7
        </h2>
        <span className="ml-auto px-2 py-0.5 rounded-full text-xs bg-neutral-100 text-neutral-600 border border-neutral-200" style={{ fontWeight: 600 }}>
          {result.instrucciones.reduce((a, i) => a + i.directrices.length, 0)} directrices
        </span>
      </div>

      {/* Brief-style container */}
      <div className="rounded-2xl border-2 overflow-hidden" style={{ borderColor: '#0a0a0a' }}>
        {/* Header bar */}
        <div className="px-5 py-3 flex items-center gap-2" style={{ background: '#0a0a0a' }}>
          <Code2 size={14} className="text-gray-400" />
          <span className="text-gray-200 text-xs" style={{ fontWeight: 600 }}>BRIEF TÉCNICO — AGENTE 7</span>
          <span className="ml-auto text-gray-500 text-xs">Generado automáticamente por Agente 6</span>
        </div>

        {/* Accordion items */}
        <div className="divide-y divide-gray-100 bg-white">
          {result.instrucciones.map((instr, i) => {
            const { icon: CatIcon } = { icon: instr.icon };
            const isOpen = expanded === i;
            return (
              <div key={i}>
                <button onClick={() => setExpanded(isOpen ? null : i)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: isOpen ? '#0a0a0a' : '#f3f4f6' }}>
                    <CatIcon size={13} style={{ color: isOpen ? '#fff' : '#6b7280' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-800 text-sm" style={{ fontWeight: 600 }}>{instr.categoria}</p>
                    <p className="text-gray-400 text-xs">{instr.directrices.length} directrices</p>
                  </div>
                  <ChevronRight size={15} className="text-gray-400 flex-shrink-0 transition-transform"
                    style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }} />
                </button>

                <motion.div 
                  initial={false}
                  animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
                  transition={{ duration: 0.22 }} 
                  className="overflow-hidden print:!h-auto print:!opacity-100"
                >
                  <ul className="px-5 pb-4 space-y-2 bg-gray-50 border-t border-gray-100 print:bg-white print:border-none">
                    {instr.directrices.map((d, j) => (
                      <li key={j} className="flex items-start gap-2.5 pt-2">
                        <span className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center mt-0.5 text-white text-xs"
                          style={{ background: '#0a0a0a', fontSize: '0.6rem', fontWeight: 700 }}>{j + 1}</span>
                        <p className="text-gray-600 text-sm leading-relaxed">{d}</p>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Complete JSON detail
// ---------------------------------------------------------------------------
function JsonScalar({ value }: { value: any }) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-neutral-400">N/A</span>;
  }
  if (typeof value === 'boolean') {
    return <span className="text-neutral-700">{value ? 'Si' : 'No'}</span>;
  }
  if (typeof value === 'number') {
    return <span className="text-neutral-900 tabular-nums">{Number.isInteger(value) ? value : Number(value.toFixed(2))}</span>;
  }
  return <span className="text-neutral-700 break-words">{String(value)}</span>;
}

function JsonNode({ label, value, depth = 0 }: { label: string; value: any; depth?: number }) {
  const isArray = Array.isArray(value);
  const isObject = value && typeof value === 'object' && !isArray;
  const title = labelFromKey(label);

  if (!isArray && !isObject) {
    return (
      <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
        <p className="text-[10px] uppercase tracking-[0.12em] text-neutral-400 mb-1" style={{ fontWeight: 600 }}>{title}</p>
        <p className="text-[13px] leading-relaxed"><JsonScalar value={value} /></p>
      </div>
    );
  }

  if (isArray) {
    return (
      <div className="rounded-xl border border-neutral-200/70 bg-white p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-500" style={{ fontWeight: 700 }}>{title}</p>
          <span className="text-[11px] text-neutral-400 tabular-nums">{value.length} elemento(s)</span>
        </div>
        {value.length === 0 ? (
          <p className="text-neutral-400 text-[13px]">Sin datos</p>
        ) : (
          <div className="space-y-3">
            {value.map((item: any, index: number) => (
              <div key={`${label}-${index}`} className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-3">
                <p className="text-[10px] uppercase tracking-[0.12em] text-neutral-400 mb-2" style={{ fontWeight: 700 }}>Item {index + 1}</p>
                <JsonNode label={`${label}_${index + 1}`} value={item} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const entries = Object.entries(value ?? {});
  return (
    <div className="rounded-xl border border-neutral-200/70 bg-white p-4">
      <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-500 mb-3" style={{ fontWeight: 700 }}>{title}</p>
      {entries.length === 0 ? (
        <p className="text-neutral-400 text-[13px]">Sin datos</p>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map(([key, child]) => (
            <JsonNode key={key} label={key} value={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function DiagnosticSummarySection({ result }: { result: EnfoqueResult }) {
  if (!result.rawData) return null;

  const raw = result.rawData;

  // 1. summary from diagnosis
  const summary: string = raw?.diagnosis?.summary || raw?.summary || '';

  // 2. roles pills from roles_identificados
  const roles: { nombre_cargo?: string; cargo?: string; nombre?: string }[] =
    Array.isArray(raw?.roles_identificados) ? raw.roles_identificados :
    Array.isArray(raw?.diagnostico_experto?.roles_identificados) ? raw.diagnostico_experto.roles_identificados :
    Array.isArray(raw?.estado_actual_gestion_proyectos?.roles_identificados) ? raw.estado_actual_gestion_proyectos.roles_identificados :
    [];

  // 3. guide_approach.type + guide_approach.justification
  const ga = raw?.guide_approach ?? {};
  const gaType: string = ga.type ?? ga.tipo ?? '';
  const gaJustification: string = ga.justification ?? ga.justificacion ?? '';

  // 4. resumen_diagnostico
  const resumen: string =
    raw?.resumen_diagnostico ||
    raw?.diagnostico_experto?.resumen_diagnostico ||
    raw?.estado_actual_gestion_proyectos?.resumen_diagnostico || '';

  // 5. descripcion_general
  const descripcion: string =
    raw?.descripcion_general ||
    raw?.diagnostico_experto?.descripcion_general ||
    raw?.estado_actual_gestion_proyectos?.descripcion_general || '';

  const hasContent = summary || roles.length > 0 || gaType || resumen || descripcion;
  if (!hasContent) return null;

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-5 h-5 rounded flex items-center justify-center bg-neutral-100">
          <BarChart2 size={11} className="text-neutral-600" />
        </div>
        <h2 className="text-gray-700 text-sm uppercase tracking-wide" style={{ fontWeight: 700 }}>
          4 — Resumen diagnóstico
        </h2>
      </div>

      <div className="space-y-3">
        {/* Descripción general */}
        {descripcion && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-neutral-200/70 p-5">
            <p className="text-[10px] uppercase tracking-widest text-neutral-400 mb-2" style={{ fontWeight: 700 }}>Descripción general</p>
            <p className="text-neutral-700 text-sm leading-relaxed">{descripcion}</p>
          </motion.div>
        )}

        {/* Summary */}
        {summary && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="bg-white rounded-2xl border border-neutral-200/70 p-5">
            <p className="text-[10px] uppercase tracking-widest text-neutral-400 mb-2" style={{ fontWeight: 700 }}>Resumen ejecutivo</p>
            <p className="text-neutral-700 text-sm leading-relaxed">{summary}</p>
          </motion.div>
        )}

        {/* Resumen diagnóstico */}
        {resumen && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
            className="bg-white rounded-2xl border border-neutral-200/70 p-5">
            <p className="text-[10px] uppercase tracking-widest text-neutral-400 mb-2" style={{ fontWeight: 700 }}>Resumen de diagnóstico</p>
            <p className="text-neutral-700 text-sm leading-relaxed">{resumen}</p>
          </motion.div>
        )}

        {/* Guide Approach: type + justification */}
        {(gaType || gaJustification) && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl border border-neutral-200/70 p-5">
            <p className="text-[10px] uppercase tracking-widest text-neutral-400 mb-3" style={{ fontWeight: 700 }}>Enfoque de la guía</p>
            {gaType && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-900 text-white text-xs mb-3" style={{ fontWeight: 600 }}>
                <Zap size={11} />
                {gaType}
              </div>
            )}
            {gaJustification && (
              <p className="text-neutral-600 text-sm leading-relaxed">{gaJustification}</p>
            )}
          </motion.div>
        )}

        {/* Roles pills */}
        {roles.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
            className="bg-white rounded-2xl border border-neutral-200/70 p-5">
            <p className="text-[10px] uppercase tracking-widest text-neutral-400 mb-3" style={{ fontWeight: 700 }}>
              Roles identificados · {roles.length}
            </p>
            <div className="flex flex-wrap gap-2">
              {roles.map((r, i) => {
                const label = r.nombre_cargo || r.cargo || r.nombre || `Rol ${i + 1}`;
                return (
                  <span key={i}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-neutral-200 bg-neutral-50 text-neutral-700 text-xs"
                    style={{ fontWeight: 500 }}>
                    {label}
                  </span>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Comments section (same pattern as RF-F4-05)
// ---------------------------------------------------------------------------
function CommentsSection({
  comment, savedComment, pmoColor, isSaving, onCommentChange, onSave, onReprocess, onApprove,
}: {
  comment: string; savedComment: string; pmoColor: string; isSaving: boolean;
  onCommentChange: (v: string) => void; onSave: () => void;
  onReprocess: () => void; onApprove: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200/70 p-5">
      <div className="flex items-center gap-2 mb-1">
        <MessageSquare size={15} className="text-gray-500" />
        <h3 className="text-gray-800 text-sm" style={{ fontWeight: 600 }}>Ajustes a las instrucciones</h3>
      </div>
      <p className="text-gray-400 text-xs mb-3">
        Indique cambios, matices o contexto adicional que deba incorporarse en las instrucciones enviadas al Agente 7. Puede guardar el ajuste o re-procesar para actualizar las instrucciones.
      </p>
      {savedComment && (
        <div className="mb-3 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-600">
          <p className="text-gray-400 text-xs mb-1" style={{ fontWeight: 600 }}>Último ajuste guardado</p>
          <p className="leading-relaxed">{savedComment}</p>
        </div>
      )}
      <textarea value={comment} onChange={e => onCommentChange(e.target.value)}
        placeholder="Ej: Las instrucciones deben incluir una sección específica de gobernanza para proyectos regulados bajo SOX. El árbol de decisión metodológica debe contemplar también proyectos de transformación digital..."
        rows={4}
        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition-all resize-y leading-relaxed bg-white mb-3" />
      <div className="flex items-center gap-3">
        <button onClick={onSave} disabled={isSaving || !comment.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          style={{ fontWeight: 500 }}>
          {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Guardar ajuste
        </button>
        <button onClick={onReprocess} disabled={!comment.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:opacity-80"
          style={{ borderColor: pmoColor, color: pmoColor, background: `${pmoColor}10`, fontWeight: 500 }}>
          <RefreshCw size={13} /> Re-procesar instrucciones
        </button>
        <div className="flex-1" />
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={onApprove}
          className="flex items-center gap-2 px-5 py-2 rounded-xl text-white text-sm shadow-sm hover:shadow-md transition-all"
          style={{ background: '#0a0a0a', fontWeight: 500, boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 8px 24px -8px rgba(0,0,0,0.18)' }}>
          <ThumbsUp size={14} /> Aprobar instrucciones
        </motion.button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main module
// ---------------------------------------------------------------------------
export default function EnfoqueModule() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getProject, updatePhaseStatus, reprocessPhase } = useApp();

  const { playAgentSuccess, playPhaseComplete } = useSoundManager();

  const project = getProject(projectId!);
  const phase = project?.phases.find(p => p.number === 6);
  const phase4 = project?.phases.find(p => p.number === 4);
  const phase5 = project?.phases.find(p => p.number === 5);

  const pmoType: PmoType = parsePmoType(phase4?.agentDiagnosis);
  const maturityLevel: number = parseMaturityLevel(phase5?.agentDiagnosis);
  const pmoColor = PMO_COLOR[pmoType];

  const deriveView = (): ModuleView => {
    if (!phase) return 'auto-trigger';
    if (phase.status === 'completado') return 'approved';
    if (phase.status === 'procesando') return 'processing';
    if (phase.agentData && Object.keys(phase.agentData).length > 0) return 'results';
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
  const autoTriggered = useRef(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartTimeRef = useRef<number>(0);

  // Start polling fases_estado for agent result
  const startPolling = useCallback((afterTimestamp?: number) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    const minTime = afterTimestamp ?? pollStartTimeRef.current;
    pollIntervalRef.current = setInterval(async () => {
      if (!projectId) return;
      const { data } = await supabase
        .from('fases_estado')
        .select('datos_consolidados, updated_at')
        .eq('proyecto_id', projectId)
        .eq('numero_fase', 6)
        .single();
      if (data?.datos_consolidados) {
        // Skip stale data from before this poll session started
        if (minTime > 0 && new Date(data.updated_at).getTime() < minTime) return;
        const mapped = mapAgentResultV2(data.datos_consolidados);
        if (mapped) {
          clearInterval(pollIntervalRef.current!);
          pollIntervalRef.current = null;
          setResult(mapped);
          setView('results');
          playAgentSuccess();
          toast.success('Agente 6 definió el enfoque metodológico', { description: mapped.enfoque.tipo });
        }
      }
    }, 4000);
  }, [projectId, playAgentSuccess]);

  // On mount: load existing result if any, resume polling if procesando
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const { data } = await supabase
        .from('fases_estado')
        .select('datos_consolidados')
        .eq('proyecto_id', projectId)
        .eq('numero_fase', 6)
        .single();
      if (data?.datos_consolidados) {
        const mapped = mapAgentResultV2(data.datos_consolidados);
        if (mapped) setResult(mapped);
      }
    })();
    if (phase?.status === 'procesando') startPolling();
    return () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); };
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // RF-F6-01: Auto-trigger — call real API when phase becomes disponible
  useEffect(() => {
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
          if (response.error) throw new Error(response.error.message);
          startPolling();
        } catch (err: any) {
          toast.error('Error iniciando Agente 6', { description: err.message });
          updatePhaseStatus(projectId!, 6, 'disponible');
          setView('auto-trigger');
          autoTriggered.current = false;
        }
      })();
    }
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!project || !phase) return null;

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
      if (response.error) throw new Error(response.error.message);
      setSavedComment(comment);
      setComment('');
      startPolling(ts);
    } catch (err: any) {
      toast.error('Error re-procesando Agente 6', { description: (err as Error).message });
      setView('results');
    }
  };

  const handleApprove = async () => {
    setIsApproving(true);
    // Timeout eliminado por petición del usuario
    setIsApproving(false);
    setShowApproveModal(false);
    // RF-F6-04: persiste resultado + desbloquea Fase 7
    // TODO: supabase.from('fases_resultado').upsert({ proyecto_id, fase: 6, json: JSON.stringify(result) })
    updatePhaseStatus(projectId!, 6, 'completado',
      `Enfoque aprobado: ${result?.enfoque.tipo} · ${result?.puntosDebiles.length} puntos débiles · ${result?.instrucciones.length} categorías de instrucciones para Agente 7.`
    );
    playPhaseComplete(); // Phase_Complete: consultor aprobó definitivamente
    setView('approved');
    toast.success('¡Fase 6 aprobada!', { description: 'La Fase 7 se ha desbloqueado automáticamente.' });
  };

  // ── Full results renderer (shared between 'results' and 'approved') ──
  const renderContent = (r: EnfoqueResult, readonly = false) => (
    <>
      <EnfoqueSection result={r} pmoType={pmoType} />
      <PuntosDebilesSection result={r} />
      <InstruccionesSection result={r} />
      <DiagnosticSummarySection result={r} />
      {!readonly && (
        <CommentsSection
          comment={comment} savedComment={savedComment} pmoColor={pmoColor}
          isSaving={isSavingComment}
          onCommentChange={setComment} onSave={handleSaveComment}
          onReprocess={handleReprocess} onApprove={() => setShowApproveModal(true)}
        />
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-[#fafaf9]">
      <PhaseHeader
        projectId={projectId!}
        companyName={project.companyName}
        phaseNumber={6}
        phaseName="Enfoque para Guía Metodológica"
        eyebrow={view === 'approved' ? 'Aprobada' : 'Activa'}
        onReprocessed={async () => {
          // 1. Block downstream phases (7, 8…)
          await reprocessPhase(projectId!, 6);
          // 2. Clear local state
          setResult(null);
          setComment('');
          setSavedComment('');
          if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
          autoTriggered.current = false;
          // 3. Reset view to auto-trigger — it will re-fire the agent
          setView('auto-trigger');
        }}
      />

      <div className="max-w-[1100px] mx-auto px-10 py-10">
        <AnimatePresence mode="wait">

          {/* Auto-trigger */}
          {view === 'auto-trigger' && (
            <motion.div key="auto-trigger" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400 mb-3" style={{ fontWeight: 500 }}>Fase 6 · Enfoque metodológico</p>
              <motion.div animate={{ scale: [1, 1.04, 1] }} transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{ background: '#0a0a0a', boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 12px 32px -12px rgba(0,0,0,0.25)' }}>
                <Send size={22} className="text-white" strokeWidth={1.75} />
              </motion.div>
              <h2 className="text-neutral-900 tracking-tight mb-3" style={{ fontWeight: 500, fontSize: '1.5rem', letterSpacing: '-0.02em' }}>Enviando al Agente 6</h2>
              <p className="text-neutral-500 text-[13px] max-w-md leading-relaxed mb-6">
                Las Fases 4 y 5 están completadas. El sistema está consolidando los resultados de tipo de PMO y madurez para definir el enfoque de la guía metodológica.
              </p>
              <div className="flex items-center gap-2 mb-8">
                {[
                  { num: 4, label: `PMO ${pmoType}`, Icon: PMO_ICON[pmoType] },
                  { num: 5, label: `Madurez Niv. ${maturityLevel}`, Icon: BarChart2 },
                ].map(({ num, label, Icon: SrcIcon }, i) => (
                  <div key={num} className="flex items-center gap-2">
                    <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.25 }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-[12px]" style={{ background: '#0a0a0a', fontWeight: 500 }}>
                      <CheckCircle2 size={11} strokeWidth={1.75} /><SrcIcon size={11} strokeWidth={1.75} />{label}
                    </motion.div>
                    <ChevronRight size={13} className="text-neutral-300" strokeWidth={1.75} />
                  </div>
                ))}
                <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.6 }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] border border-dashed"
                  style={{ borderColor: pmoColor, color: pmoColor, fontWeight: 500 }}>
                  <Brain size={11} strokeWidth={1.75} /> Agente 6
                </motion.div>
              </div>
              <div className="flex items-center gap-2 text-neutral-400 text-[12px]">
                <Loader2 size={12} className="animate-spin" strokeWidth={1.75} />Iniciando procesamiento…
              </div>
            </motion.div>
          )}

          {/* Processing */}
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
              <h2 className="text-neutral-900 tracking-tight mb-3" style={{ fontWeight: 500, fontSize: '1.5rem', letterSpacing: '-0.02em' }}>
                Agente 6 definiendo enfoque
              </h2>
              <p className="text-neutral-500 text-[13px] max-w-md text-center leading-relaxed">
                Analizando el consolidado de <span className="text-neutral-900" style={{ fontWeight: 500 }}>PMO {pmoType}</span> · <span className="text-neutral-900" style={{ fontWeight: 500 }}>Nivel {maturityLevel}</span> para determinar el tipo de guía, identificar puntos débiles y generar instrucciones para el Agente 7.
              </p>
            </motion.div>
          )}

          {/* Results */}
          {view === 'results' && result && (
            <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="mb-10 flex items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400 mb-3" style={{ fontWeight: 500 }}>Fase 6 · PMO {pmoType} · Nivel {maturityLevel}</p>
                  <h1 className="text-neutral-900 tracking-tight" style={{ fontWeight: 500, fontSize: '2.25rem', lineHeight: 1.05, letterSpacing: '-0.025em' }}>
                    Enfoque metodológico
                  </h1>
                  <p className="text-neutral-500 text-[14px] mt-3 max-w-2xl leading-relaxed">
                    El Agente 6 consolidó tipo de PMO y madurez para definir el enfoque, identificar puntos débiles y emitir instrucciones para el Agente 7.
                  </p>
                </div>
                <VersionBadge version={result.version} timestamp={result.timestamp} />
              </div>
              {renderContent(result, false)}
            </motion.div>
          )}

          {/* Approved */}
          {view === 'approved' && result && (
            <motion.div key="approved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="mb-10 flex items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400 mb-3" style={{ fontWeight: 500 }}>Fase 6 · PMO {pmoType} · Nivel {maturityLevel}</p>
                  <h1 className="text-neutral-900 tracking-tight" style={{ fontWeight: 500, fontSize: '2.25rem', lineHeight: 1.05, letterSpacing: '-0.025em' }}>
                    Enfoque aprobado
                  </h1>
                  <p className="text-neutral-500 text-[14px] mt-3 max-w-2xl leading-relaxed">
                    El enfoque metodológico ha sido validado y será la base que el Agente 7 usará para construir la guía.
                  </p>
                  <div className="flex items-center gap-3 mt-4 text-[12px]">
                    <span className="inline-flex items-center gap-1.5 text-emerald-700" style={{ fontWeight: 500 }}>
                      <CheckCircle2 size={13} /> Fase completada y aprobada
                    </span>
                    {phase.completedAt && (
                      <>
                        <span className="text-neutral-300">·</span>
                        <span className="text-neutral-400">Aprobado el {phase.completedAt}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              {renderContent(result, true)}
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      <ApproveModal open={showApproveModal} onCancel={() => setShowApproveModal(false)} onConfirm={handleApprove} isLoading={isApproving} />

      <NextPhaseButton projectId={projectId!} nextPhase={7} prevPhase={5} show={view === 'approved'} />
    </div>
  );
}
