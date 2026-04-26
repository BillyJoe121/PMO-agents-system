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

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, X, Loader2, CheckCircle2, Brain, MessageSquare, Save,
  RefreshCw, ThumbsUp, Send, Clock, Sparkles, ChevronRight,
  Zap, BarChart2, GitMerge, Target, AlertTriangle, BookOpen,
  Lightbulb, ListChecks, ShieldAlert, Code2, Copy, Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../../context/AppContext';
import { useSoundManager } from '../../hooks/useSoundManager';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type PmoType = 'Ágil' | 'Híbrida' | 'Predictiva';
type Criticidad = 'Alta' | 'Media' | 'Baja';
type DiagnosisVersion = 'original' | 'reprocesado';
type ModuleView = 'auto-trigger' | 'processing' | 'results' | 'approved';

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
const PMO_COLOR: Record<PmoType, string> = { Ágil: '#059669', Híbrida: '#4f46e5', Predictiva: '#7c3aed' };

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
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10 p-6">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                <ThumbsUp size={20} className="text-green-600" />
              </div>
              <div>
                <h3 className="text-gray-900 mb-1" style={{ fontWeight: 600 }}>Aprobar enfoque metodológico</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  La Fase 6 quedará <strong>completada</strong>. El enfoque aprobado se enviará al Agente 7 para construir la Guía Metodológica. Esta acción no puede deshacerse.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={onCancel} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-gray-600 text-sm hover:bg-gray-50" style={{ fontWeight: 500 }}>Cancelar</button>
              <button onClick={onConfirm} disabled={isLoading}
                className="flex-1 py-2.5 rounded-xl text-white text-sm flex items-center justify-center gap-2 disabled:opacity-70"
                style={{ background: '#030213', fontWeight: 600 }}>
                {isLoading ? <><Loader2 size={14} className="animate-spin" />Aprobando…</> : <><ThumbsUp size={14} />Aprobar enfoque</>}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// JSON preview modal (for the approved JSON export — RF-F6-04)
// ---------------------------------------------------------------------------
function JsonModal({ open, result, onClose }: { open: boolean; result: EnfoqueResult | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  if (!result) return null;
  const snippet = JSON.stringify({
    version: result.version,
    timestamp: result.timestamp,
    enfoque_tipo: result.enfoque.tipo,
    puntos_debiles: result.puntosDebiles.map(p => ({ area: p.area, criticidad: p.criticidad })),
    instrucciones_agente7: result.instrucciones.map(i => ({ categoria: i.categoria, num_directrices: i.directrices.length })),
  }, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(snippet).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); });
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="relative bg-gray-950 rounded-2xl shadow-2xl w-full max-w-lg z-10 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <Code2 size={14} className="text-gray-400" />
                <span className="text-gray-200 text-sm" style={{ fontWeight: 600 }}>JSON aprobado — Fase 6</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleCopy} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs transition-all" style={{ fontWeight: 500 }}>
                  {copied ? <><Check size={11} className="text-green-400" />Copiado</> : <><Copy size={11} />Copiar</>}
                </button>
                <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-gray-800 flex items-center justify-center text-gray-500 transition-colors"><X size={14} /></button>
              </div>
            </div>
            <pre className="p-5 text-xs text-green-400 overflow-auto max-h-96 leading-relaxed font-mono">{snippet}</pre>
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
        <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: `${color}20` }}>
          <Target size={11} style={{ color }} />
        </div>
        <h2 className="text-gray-700 text-sm uppercase tracking-wide" style={{ fontWeight: 700 }}>
          1 — Definición de enfoque
        </h2>
      </div>

      {/* Type hero */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border-2 p-5 mb-4"
        style={{ borderColor: `${color}40`, background: `linear-gradient(135deg, ${color}08 0%, ${color}04 100%)` }}>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm" style={{ background: color }}>
            <Icon size={22} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-xs uppercase tracking-widest mb-1" style={{ color, fontWeight: 700 }}>Tipo de guía recomendado</p>
            <h3 className="text-gray-900 mb-2" style={{ fontWeight: 700, fontSize: '1.1rem', lineHeight: 1.3 }}>
              {result.enfoque.tipo}
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed">{result.enfoque.orientacion}</p>
          </div>
        </div>
      </motion.div>

      {/* Principles */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <p className="text-xs uppercase tracking-wide text-gray-400 mb-4" style={{ fontWeight: 700 }}>
          Principios rectores
        </p>
        <div className="grid grid-cols-2 gap-3">
          {result.enfoque.principios.map((p, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
              className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: `${color}15`, color, fontSize: '0.6rem', fontWeight: 800 }}>
                {i + 1}
              </div>
              <div>
                <p className="text-gray-800 text-xs mb-0.5" style={{ fontWeight: 600 }}>{p.titulo}</p>
                <p className="text-gray-500 text-xs leading-relaxed">{p.descripcion}</p>
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
  Alta:  { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', Icon: ShieldAlert },
  Media: { color: '#d97706', bg: '#fffbeb', border: '#fde68a', Icon: AlertTriangle },
  Baja:  { color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb', Icon: AlertTriangle },
};

function PuntosDebilesSection({ result }: { result: EnfoqueResult }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-5 h-5 rounded flex items-center justify-center bg-red-50">
          <ShieldAlert size={11} className="text-red-500" />
        </div>
        <h2 className="text-gray-700 text-sm uppercase tracking-wide" style={{ fontWeight: 700 }}>
          2 — Puntos débiles identificados
        </h2>
        <span className="ml-auto px-2 py-0.5 rounded-full text-xs bg-red-50 text-red-600 border border-red-200" style={{ fontWeight: 600 }}>
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
        <div className="w-5 h-5 rounded flex items-center justify-center bg-indigo-50">
          <Brain size={11} className="text-indigo-500" />
        </div>
        <h2 className="text-gray-700 text-sm uppercase tracking-wide" style={{ fontWeight: 700 }}>
          3 — Instrucciones para el Agente 7
        </h2>
        <span className="ml-auto px-2 py-0.5 rounded-full text-xs bg-indigo-50 text-indigo-600 border border-indigo-200" style={{ fontWeight: 600 }}>
          {result.instrucciones.reduce((a, i) => a + i.directrices.length, 0)} directrices
        </span>
      </div>

      {/* Brief-style container */}
      <div className="rounded-2xl border-2 overflow-hidden" style={{ borderColor: '#030213' }}>
        {/* Header bar */}
        <div className="px-5 py-3 flex items-center gap-2" style={{ background: '#030213' }}>
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
                    style={{ background: isOpen ? '#030213' : '#f3f4f6' }}>
                    <CatIcon size={13} style={{ color: isOpen ? '#fff' : '#6b7280' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-800 text-sm" style={{ fontWeight: 600 }}>{instr.categoria}</p>
                    <p className="text-gray-400 text-xs">{instr.directrices.length} directrices</p>
                  </div>
                  <ChevronRight size={15} className="text-gray-400 flex-shrink-0 transition-transform"
                    style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }} />
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22 }} className="overflow-hidden">
                      <ul className="px-5 pb-4 space-y-2 bg-gray-50 border-t border-gray-100">
                        {instr.directrices.map((d, j) => (
                          <li key={j} className="flex items-start gap-2.5 pt-2">
                            <span className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center mt-0.5 text-white text-xs"
                              style={{ background: '#030213', fontSize: '0.6rem', fontWeight: 700 }}>{j + 1}</span>
                            <p className="text-gray-600 text-sm leading-relaxed">{d}</p>
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
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
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-1">
        <MessageSquare size={15} className="text-gray-500" />
        <h3 className="text-gray-800 text-sm" style={{ fontWeight: 600 }}>Comentarios del consultor</h3>
      </div>
      <p className="text-gray-400 text-xs mb-3">
        Agregue contexto, matices o ajustes al enfoque propuesto. Puede guardar el comentario o re-procesar con el Agente 6.
      </p>
      {savedComment && (
        <div className="mb-3 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-600">
          <p className="text-gray-400 text-xs mb-1" style={{ fontWeight: 600 }}>Último comentario guardado</p>
          <p className="leading-relaxed">{savedComment}</p>
        </div>
      )}
      <textarea value={comment} onChange={e => onCommentChange(e.target.value)}
        placeholder="Ej: Considerar que el área legal opera bajo normativa SOX, lo que implica que sus proyectos deben seguir estrictamente el marco predictivo independiente del perfil general del proyecto..."
        rows={4}
        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition-all resize-y leading-relaxed bg-white mb-3" />
      <div className="flex items-center gap-3">
        <button onClick={onSave} disabled={isSaving || !comment.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          style={{ fontWeight: 500 }}>
          {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Guardar comentario
        </button>
        <button onClick={onReprocess} disabled={!comment.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:opacity-80"
          style={{ borderColor: pmoColor, color: pmoColor, background: `${pmoColor}10`, fontWeight: 500 }}>
          <RefreshCw size={13} /> Re-procesar con comentario
        </button>
        <div className="flex-1" />
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={onApprove}
          className="flex items-center gap-2 px-5 py-2 rounded-xl text-white text-sm shadow-sm hover:shadow-md transition-all"
          style={{ background: '#030213', fontWeight: 600 }}>
          <ThumbsUp size={14} /> Aprobar enfoque
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
  const { getProject, updatePhaseStatus } = useApp();

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
    return 'auto-trigger';
  };

  const [view, setView] = useState<ModuleView>(deriveView);
  const [result, setResult] = useState<EnfoqueResult | null>(
    phase?.status === 'completado' ? buildResult(pmoType, maturityLevel) : null
  );
  const [comment, setComment] = useState('');
  const [savedComment, setSavedComment] = useState('');
  const [isSavingComment, setIsSavingComment] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const autoTriggered = useRef(false);

  // RF-F6-01: Auto-trigger on mount when disponible
  useEffect(() => {
    if (autoTriggered.current) return;
    if (view === 'auto-trigger') {
      autoTriggered.current = true;
      const t1 = setTimeout(() => { updatePhaseStatus(projectId!, 6, 'procesando'); setView('processing'); }, 2400);
      return () => clearTimeout(t1);
    }
  }, [view]);

  // Processing → results after delay
  useEffect(() => {
    if (view !== 'processing') return;
    const t = setTimeout(() => {
      const r = buildResult(pmoType, maturityLevel);
      setResult(r);
      setView('results');
      playAgentSuccess(); // Agent_Success: Agente 6 terminó, enfoque listo para revisión
      toast.success('Agente 6 definió el enfoque metodológico', { description: r.enfoque.tipo });
    }, 5000);
    return () => clearTimeout(t);
  }, [view]);

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
    await new Promise(r => setTimeout(r, 4000));
    const updated = buildResult(pmoType, maturityLevel, comment);
    setResult(updated);
    setSavedComment(comment);
    setComment('');
    setView('results');
    playAgentSuccess(); // Agent_Success: reprocesado listo para revisión
    toast.success('Enfoque reprocesado con su comentario');
  };

  const handleApprove = async () => {
    setIsApproving(true);
    await new Promise(r => setTimeout(r, 700));
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(`/dashboard/project/${projectId}`)}
              className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm transition-colors group">
              <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />{project.companyName}
            </button>
            <span className="text-gray-300">/</span>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs" style={{ background: '#030213', fontWeight: 700 }}>6</div>
              <span className="text-gray-700 text-sm" style={{ fontWeight: 600 }}>Enfoque para Guía Metodológica</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {view === 'approved' && result && (
              <button onClick={() => setShowJson(true)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 text-xs transition-all"
                style={{ fontWeight: 500 }}>
                <Code2 size={11} /> Ver JSON
              </button>
            )}
            <button onClick={() => navigate(`/dashboard/project/${projectId}`)}
              className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8">
        <AnimatePresence mode="wait">

          {/* Auto-trigger */}
          {view === 'auto-trigger' && (
            <motion.div key="auto-trigger" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
              <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6 shadow-lg" style={{ background: '#030213' }}>
                <Send size={34} className="text-white" />
              </motion.div>
              <h2 className="text-gray-900 mb-3" style={{ fontWeight: 700, fontSize: '1.375rem' }}>Enviando al Agente 6</h2>
              <p className="text-gray-500 text-sm max-w-sm leading-relaxed mb-6">
                Las Fases 4 y 5 están completadas. El sistema está consolidando los resultados de tipo de PMO y madurez para definir el enfoque de la Guía Metodológica.
              </p>
              <div className="flex items-center gap-2 mb-8">
                {[
                  { num: 4, label: `PMO ${pmoType}`, Icon: PMO_ICON[pmoType] },
                  { num: 5, label: `Madurez Niv. ${maturityLevel}`, Icon: BarChart2 },
                ].map(({ num, label, Icon: SrcIcon }, i) => (
                  <div key={num} className="flex items-center gap-2">
                    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.25 }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-xs" style={{ background: '#030213', fontWeight: 600 }}>
                      <CheckCircle2 size={12} /><SrcIcon size={11} />{label}
                    </motion.div>
                    <ChevronRight size={14} className="text-gray-300" />
                  </div>
                ))}
                <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.5 }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs border-2 border-dashed"
                  style={{ borderColor: pmoColor, color: pmoColor, fontWeight: 600 }}>
                  <Brain size={12} /> Agente 6
                </motion.div>
              </div>
              <div className="flex items-center gap-2 text-gray-400 text-xs">
                <Loader2 size={13} className="animate-spin" />Iniciando procesamiento…
              </div>
            </motion.div>
          )}

          {/* Processing */}
          {view === 'processing' && (
            <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
              <div className="relative mb-8">
                <div className="w-24 h-24 rounded-full border-4 flex items-center justify-center" style={{ borderColor: `${pmoColor}30` }}>
                  <Loader2 size={40} className="animate-spin" style={{ color: pmoColor }} />
                </div>
                <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute inset-0 rounded-full border-4 opacity-20" style={{ borderColor: pmoColor }} />
              </div>
              <h2 className="text-gray-900 mb-3" style={{ fontWeight: 700, fontSize: '1.375rem' }}>
                Agente 6 definiendo enfoque metodológico
              </h2>
              <p className="text-gray-500 text-sm max-w-sm leading-relaxed mb-4">
                Analizando el consolidado de PMO {pmoType} (Nivel {maturityLevel}) para determinar el tipo de guía, identificar puntos débiles y generar instrucciones para el Agente 7…
              </p>
              <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-4 py-2 rounded-xl">
                <Loader2 size={13} className="animate-spin" />
                <span className="text-xs" style={{ fontWeight: 500 }}>Esto puede tomar unos momentos</span>
              </div>
            </motion.div>
          )}

          {/* Results */}
          {view === 'results' && result && (
            <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex items-start justify-between mb-7">
                <div>
                  <h1 className="text-gray-900" style={{ fontWeight: 700, fontSize: '1.5rem' }}>Enfoque para Guía Metodológica</h1>
                  <p className="text-gray-500 text-sm mt-0.5">PMO {pmoType} · Madurez Nivel {maturityLevel} · Agente 6</p>
                </div>
                <VersionBadge version={result.version} timestamp={result.timestamp} />
              </div>
              {renderContent(result, false)}
            </motion.div>
          )}

          {/* Approved */}
          {view === 'approved' && result && (
            <motion.div key="approved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 size={18} className="text-green-500" />
                <span className="text-green-600 text-sm" style={{ fontWeight: 600 }}>Fase 6 completada y aprobada</span>
              </div>
              <div className="flex items-start justify-between mb-7">
                <div>
                  <h1 className="text-gray-900" style={{ fontWeight: 700, fontSize: '1.5rem' }}>Enfoque para Guía Metodológica</h1>
                  {phase.completedAt && (
                    <p className="text-gray-400 text-xs mt-0.5 flex items-center gap-1">
                      <CheckCircle2 size={10} className="text-green-500" /> Aprobado el {phase.completedAt}
                    </p>
                  )}
                </div>
                <button onClick={() => setShowJson(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 text-xs transition-all"
                  style={{ fontWeight: 500 }}>
                  <Code2 size={11} /> Ver JSON aprobado
                </button>
              </div>
              {renderContent(result, true)}
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      <ApproveModal open={showApproveModal} onCancel={() => setShowApproveModal(false)} onConfirm={handleApprove} isLoading={isApproving} />
      <JsonModal open={showJson} result={result} onClose={() => setShowJson(false)} />
    </div>
  );
}
