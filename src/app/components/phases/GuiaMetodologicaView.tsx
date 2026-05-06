/**
 * GuiaMetodologicaView — Fase 7: Guía Metodológica
 *
 * RF-F7-01  Al desbloquearse la Fase 7, envía automáticamente al Agente 7 el JSON
 *           aprobado de la Fase 6. No requiere acción inicial del consultor.
 * RF-F7-02  Estado de procesamiento extendido con pasos animados y mensaje claro de
 *           duración ("esto puede tomar unos minutos").
 * RF-F7-03  Vista de resultado: visor de documento A4, botones "Ver" y "Descargar".
 * RF-F7-04  Comentarios y regeneración: "Solicitar ajustes" envía guía + comentario
 *           al Agente 7 y reemplaza la versión anterior.
 * RF-F7-05  Indicador de versión: "Versión 1 — generada el [fecha]", "Versión 2 —
 *           revisada el [fecha] con comentarios del consultor".
 * RF-F7-06  "Aprobar Guía Metodológica" → Fase 7 completada + desbloquea Fase 8.
 *
 * TODO: RF-F7-01 → axios.post(N8N_WEBHOOK_AGENTE_7, { json_fase6_aprobado })
 * TODO: RF-F7-04 → axios.post(N8N_WEBHOOK_AGENTE_7, { version_actual, comentario })
 * TODO: RF-F7-03 → iframe apuntando a signedUrl de Supabase Storage (PDF/DOCX real)
 * TODO: RF-F7-06 → supabase.from('fases_resultado').upsert({ fase: 7, json: { version } })
 */

// @refresh reset
import { useState, useEffect, useRef, useCallback } from 'react';
import type { ElementType } from 'react';
import { useParams, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  Download, FileText, Clock, RotateCcw, Loader2,
  CheckCircle2, Send, Brain, ChevronRight, Sparkles, MessageSquare,
  BookOpen, Shield, BarChart2, Users, Lightbulb,
  ExternalLink, AlertCircle, GitCommitHorizontal, Circle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../../context/AppContext';
import { useSoundManager } from '../../hooks/useSoundManager';
import NextPhaseButton from './_shared/NextPhaseButton';
import PhaseHeader from './_shared/PhaseHeader';
import { supabase } from '../../lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type PmoType = 'Ágil' | 'Híbrida' | 'Predictiva';
type ModuleView = 'auto-trigger' | 'processing' | 'results' | 'approved';

interface ProcessingStep {
  id: number;
  label: string;
  detail: string;
  durationMs: number;
}

interface DocVersion {
  number: number;
  generatedAt: string; // ISO string
  comment?: string;    // comentario que disparó esta versión (null = original)
  status: 'generado' | 'revisado';
  data?: any;
}

interface GuideChapter {
  number: number;
  icon: ElementType;
  title: string;
  intro: string;
  subsections: {
    title: string;
    content: string;
    items?: string[];
    table?: { headers: string[]; rows: string[][] };
  }[];
}

type GuideSubsection = GuideChapter['subsections'][number];

// ---------------------------------------------------------------------------
// Processing steps config (RF-F7-02)
// ---------------------------------------------------------------------------
const PROCESSING_STEPS: ProcessingStep[] = [
  { id: 1, label: 'Recibiendo JSON aprobado de la Fase 6', detail: 'Enfoque metodológico + puntos débiles + instrucciones...', durationMs: 1400 },
  { id: 2, label: 'Analizando estructura de la guía', detail: 'Determinando capítulos, secciones y plantillas requeridas...', durationMs: 1600 },
  { id: 3, label: 'Generando contenido especializado', detail: 'Redactando marcos, procesos y directrices por capítulo...', durationMs: 2800 },
  { id: 4, label: 'Compilando plantillas y artefactos', detail: 'Integrando actas, tableros de métricas y árbol de decisión...', durationMs: 2200 },
  { id: 5, label: 'Verificando coherencia metodológica', detail: 'Validando consistencia entre capítulos y métricas...', durationMs: 1400 },
  { id: 6, label: 'Formateando documento final', detail: 'Aplicando estilos, índice de contenidos y portada...', durationMs: 1200 },
];

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------
function parsePmoType(diag?: string): PmoType {
  if (!diag) return 'Híbrida';
  if (diag.includes('Ágil')) return 'Ágil';
  if (diag.includes('Predictiva')) return 'Predictiva';
  return 'Híbrida';
}
// ---------------------------------------------------------------------------
// Document builder
// ---------------------------------------------------------------------------
function buildChapters(pmoType: PmoType, org: string): GuideChapter[] {
  const isHybrid = pmoType === 'Híbrida';
  const isAgil = pmoType === 'Ágil';

  return [
    {
      number: 1, icon: BookOpen,
      title: isHybrid ? 'Marco de Referencia Híbrido' : isAgil ? 'Principios y Valores Ágiles' : 'Marco de Gobierno Predictivo',
      intro: isHybrid
        ? `La PMO de ${org} opera bajo un marco híbrido que reconoce la coexistencia de proyectos con distintos perfiles de incertidumbre, velocidad requerida y nivel de regulación. Este capítulo establece los fundamentos filosóficos y estratégicos de la guía.`
        : isAgil
          ? `La PMO de ${org} adopta los principios del Manifiesto Ágil como fundamento filosófico, adaptados al contexto organizacional. El foco es en equipos autónomos, entrega continua de valor y mejora sistémica.`
          : `La PMO de ${org} se rige por un modelo de gobierno formal basado en procesos documentados, aprobaciones explícitas y trazabilidad completa de decisiones, alineado con estándares PMI y PRINCE2.`,
      subsections: [
        {
          title: isHybrid ? 'Por qué una PMO Híbrida' : isAgil ? 'Por qué Ágil a escala' : 'Por qué Gobierno Predictivo',
          content: isHybrid
            ? 'El diagnóstico organizacional evidenció proyectos de producto (alta incertidumbre) coexistiendo con proyectos de infraestructura y regulatorios (alta previsibilidad). Una PMO Híbrida permite aplicar el marco más adecuado a cada iniciativa sin imponer una única metodología.'
            : isAgil
              ? 'El diagnóstico reveló equipos con alta capacidad de auto-organización y proyectos de producto digital donde los requisitos evolucionan frecuentemente. Una PMO Ágil escalada permite maximizar la velocidad de entrega manteniendo alineación estratégica.'
              : 'Los proyectos de la organización presentan requisitos estables, regulación sectorial estricta y necesidad de trazabilidad documental completa. Un marco predictivo garantiza previsibilidad, control de cambios y gobernanza robusta.',
          items: isHybrid
            ? ['Marco de decisión metodológica por perfil de proyecto', 'Gobierno unificado del portafolio con métricas duales', 'Capacidades ágiles para proyectos de producto e innovación', 'Control predictivo para proyectos regulatorios y de infraestructura']
            : isAgil
              ? ['Autonomía de equipos con alineación estratégica', 'Entrega de valor en ciclos iterativos de 2 semanas', 'Escalado mediante sincronización estructurada entre equipos', 'Métricas de flujo: velocity, lead time, cycle time']
              : ['Planificación integrada de alcance, tiempo y costo', 'Control formal de cambios con análisis de impacto', 'Reporting ejecutivo con indicadores EVM (CPI, SPI)', 'Gestión proactiva de riesgos e issues'],
        },
        {
          title: 'Niveles de madurez objetivo',
          content: 'La guía define una hoja de ruta de madurez en tres horizontes temporales, con criterios de evaluación claros para cada nivel y métricas de transición verificables.',
          table: {
            headers: ['Horizonte', 'Meta de madurez', 'Criterio de éxito'],
            rows: [
              ['30 días', 'Nivel 2 — Definido', 'Procesos documentados y aplicados en piloto'],
              ['90 días', 'Nivel 3 — Gestionado', '>80% de proyectos siguen el marco definido'],
              ['180 días', 'Nivel 4 — Optimizando', 'Métricas de desempeño activas y en mejora'],
            ],
          },
        },
      ],
    },
    {
      number: 2, icon: Shield,
      title: isHybrid ? 'Modelo de Decisión Metodológica' : isAgil ? 'Roles y Estructura de Equipos' : 'Estructura de Gobierno y Autoridad',
      intro: isHybrid
        ? 'El modelo de decisión es el artefacto central de la PMO Híbrida. Provee un árbol de decisión estructurado que permite al gestor de proyecto seleccionar el marco metodológico más adecuado para cada iniciativa antes de iniciar la planificación.'
        : isAgil
          ? 'Los equipos ágiles de la organización operan con roles claramente definidos, responsabilidades explícitas y mecanismos de coordinación tanto intra como inter-equipo.'
          : 'La estructura de gobierno establece los niveles de autoridad, los comités de decisión y los criterios de escalamiento para garantizar un control centralizado y una rendición de cuentas clara.',
      subsections: [
        {
          title: isHybrid ? 'Árbol de decisión metodológica' : isAgil ? 'Roles del equipo ágil' : 'Comités de gobierno',
          content: isHybrid
            ? 'El árbol de decisión evalúa cuatro dimensiones del proyecto: nivel de incertidumbre en los requisitos, grado de regulación sectorial, tamaño del equipo ejecutor y frecuencia esperada de cambios. La combinación de estas dimensiones determina el cuadrante metodológico.'
            : isAgil
              ? 'Cada equipo ágil opera con tres roles fundamentales: Product Owner (responsable del qué y la priorización), Scrum Master (facilitador de procesos y removedor de impedimentos) y Development Team (responsable del cómo y la calidad técnica).'
              : 'El gobierno se estructura en tres niveles: Comité Directivo de Proyectos (CDP) con frecuencia mensual para decisiones estratégicas, PMO Central con frecuencia semanal para control operativo, y Project Reviews quincenales por equipo de proyecto.',
          items: isHybrid
            ? ['Cuadrante A (Ágil): Alta incertidumbre + baja regulación + equipo pequeño', 'Cuadrante B (Predictivo): Baja incertidumbre + alta regulación + equipo grande', 'Cuadrante C (Híbrido Ágil): Alta incertidumbre + alta regulación', 'Cuadrante D (Híbrido Predictivo): Baja incertidumbre + media regulación']
            : isAgil
              ? ['Product Owner: backlog, priorización y criterios de aceptación', 'Scrum Master: facilitación, coaching y gestión de impedimentos', 'Development Team: diseño, desarrollo, pruebas y despliegue', 'PMO Ágil: sincronización entre equipos y reporte ejecutivo']
              : ['CDP: aprobación de proyectos >$100K, cambios de alcance críticos', 'PMO Central: seguimiento de portafolio, control de cambios menores', 'Project Manager: autoridad operativa dentro del alcance aprobado', 'Auditoría interna: revisión trimestral de cumplimiento metodológico'],
        },
        {
          title: isHybrid ? 'Perfiles de proyecto por cuadrante' : isAgil ? 'Escalado entre equipos' : 'Matriz de autoridad y delegación',
          content: isHybrid
            ? 'A continuación se ejemplifican los tipos de proyectos típicos de la organización y su cuadrante metodológico recomendado, basado en el análisis de la cartera actual.'
            : isAgil
              ? 'Para organizaciones con múltiples equipos ágiles activos simultáneamente, se requiere un mecanismo de sincronización que resuelva dependencias y alinee las entregas con los objetivos de portafolio.'
              : 'La matriz de autoridad define qué nivel organizacional puede tomar cada tipo de decisión, reduciendo la ambigüedad y los retrasos por consultas innecesarias.',
          table: {
            headers: isHybrid
              ? ['Tipo de proyecto', 'Cuadrante', 'Marco recomendado']
              : isAgil
                ? ['Mecanismo', 'Frecuencia', 'Participantes']
                : ['Tipo de decisión', 'Autoridad', 'Escalamiento a'],
            rows: isHybrid
              ? [
                  ['Desarrollo de software', 'A', 'Scrum / Kanban'],
                  ['Implementación ERP', 'B', 'PMI / PRINCE2'],
                  ['Transformación digital', 'C', 'SAFe / Híbrido'],
                  ['Renovación de infraestructura', 'D', 'Híbrido Predictivo'],
                ]
              : isAgil
                ? [
                    ['Scrum of Scrums', 'Semanal', 'Scrum Masters + PMO'],
                    ['Big Room Planning', 'Trimestral', 'Todo el portafolio ágil'],
                    ['Product Council', 'Mensual', 'Product Owners + Negocio'],
                    ['Release Planning', 'Por release', 'POs + Tech Leads'],
                  ]
                : [
                    ['Cambio de alcance menor', 'Project Manager', 'PMO Central'],
                    ['Cambio de alcance mayor', 'PMO Central', 'CDP'],
                    ['Incorporación de recursos', 'PMO Central', 'CDP'],
                    ['Cierre anticipado de proyecto', 'CDP', 'Dirección General'],
                  ],
          },
        },
      ],
    },
    {
      number: 3, icon: GitCommitHorizontal,
      title: isHybrid ? 'Ciclos de Vida Metodológicos' : isAgil ? 'Ceremonias y Ritmo de Trabajo' : 'Fases del Ciclo de Vida Predictivo',
      intro: isHybrid
        ? 'Este capítulo detalla ambos ciclos de vida —ágil y predictivo— con sus respectivas fases, hitos y artefactos. El consultor metodológico aplica el ciclo correcto según el cuadrante determinado en el Capítulo 2.'
        : isAgil
          ? 'Las ceremonias ágiles estructuran el ritmo de trabajo del equipo, garantizando inspección y adaptación continua. Este capítulo define el propósito, duración, facilitador y output de cada ceremonia.'
          : 'El ciclo de vida predictivo se organiza en cinco fases secuenciales con hitos formales de aprobación, entregables definidos y criterios de salida verificables.',
      subsections: [
        {
          title: isHybrid ? 'Ciclo de vida ágil (Scrum)' : isAgil ? 'Sprint Planning' : 'Fase 1: Iniciación',
          content: isHybrid
            ? 'El ciclo ágil se organiza en sprints de 2 semanas con ceremonias estructuradas. Es aplicable a proyectos en los cuadrantes A y C del modelo de decisión.'
            : isAgil
              ? 'El Sprint Planning se realiza el primer día de cada sprint. El equipo selecciona los ítems del backlog con mayor valor y define el Sprint Goal, descomponiendo el trabajo en tareas de máximo 1 día.'
              : 'La fase de iniciación establece la viabilidad del proyecto, define el alcance a alto nivel y obtiene la autorización formal del patrocinador mediante el Acta de Constitución.',
          items: isHybrid
            ? ['Sprint Planning (4h al inicio de cada sprint de 2 semanas)', 'Daily Standup (15 min diarios, equipo completo)', 'Sprint Review (2h al final del sprint, con stakeholders)', 'Sprint Retrospective (1.5h al final del sprint, solo equipo)', 'Backlog Refinement (2h/semana durante el sprint)']
            : isAgil
              ? ['Duración: 4 horas para sprint de 2 semanas', 'Participantes: Todo el equipo ágil + Product Owner', 'Output: Sprint Backlog comprometido + Sprint Goal definido', 'Criterio de éxito: El equipo puede responder "¿Cómo lograremos el Sprint Goal?"']
              : ['Acta de Constitución aprobada por el patrocinador', 'Identificación inicial de stakeholders', 'Registro de riesgos inicial (top-10)', 'Definición del director del proyecto y su nivel de autoridad'],
        },
        {
          title: isHybrid ? 'Ciclo de vida predictivo (PMI)' : isAgil ? 'Daily Standup, Review y Retrospective' : 'Fases 2–5: Planificación a Cierre',
          content: isHybrid
            ? 'El ciclo predictivo se estructura en 5 fases con hitos formales de aprobación. Es aplicable a proyectos en los cuadrantes B y D.'
            : isAgil
              ? 'Estas tres ceremonias garantizan el funcionamiento diario del equipo (Daily), la validación del valor entregado con stakeholders (Review) y la mejora continua del equipo (Retrospective).'
              : 'Las cuatro fases posteriores a la iniciación siguen un flujo de planificación detallada, ejecución controlada, monitoreo permanente y cierre formal con transferencia al cliente.',
          table: {
            headers: isHybrid
              ? ['Fase predictiva', 'Duración típica', 'Entregable clave']
              : isAgil
                ? ['Ceremonia', 'Duración', 'Output clave']
                : ['Fase', 'Actividad central', 'Criterio de salida'],
            rows: isHybrid
              ? [
                  ['Inicio', '1–2 semanas', 'Acta de constitución'],
                  ['Planificación', '2–4 semanas', 'Plan de gestión del proyecto'],
                  ['Ejecución', 'Variable (70% del tiempo)', 'Entregables del alcance'],
                  ['Monitoreo y Control', 'Continuo con ejecución', 'Informes de estado semanales'],
                  ['Cierre', '1 semana', 'Acta de cierre + lecciones aprendidas'],
                ]
              : isAgil
                ? [
                    ['Daily Standup', '15 min diarios', 'Impedimentos identificados'],
                    ['Sprint Review', '2h por sprint', 'Incremento validado por stakeholders'],
                    ['Retrospective', '1.5h por sprint', '≥3 compromisos de mejora con dueño'],
                    ['Backlog Refinement', '2h por semana', 'Backlog priorizado con estimaciones'],
                  ]
                : [
                    ['Planificación', 'Plan integrado del proyecto', 'Líneas base aprobadas por CDP'],
                    ['Ejecución', 'Desarrollo de entregables', 'Avance ≥ SPI 0.90 semanal'],
                    ['Monitoreo', 'Control integrado de cambios', '0 cambios no aprobados'],
                    ['Cierre', 'Transferencia y lecciones', 'Acta de cierre firmada'],
                  ],
          },
        },
      ],
    },
    {
      number: 4, icon: BarChart2,
      title: 'Métricas e Indicadores de Desempeño',
      intro: 'Las métricas son el sistema nervioso de la PMO. Este capítulo define los indicadores clave de desempeño (KPIs) para cada marco metodológico, sus fórmulas de cálculo, frecuencias de medición y umbrales de alerta.',
      subsections: [
        {
          title: isAgil ? 'KPIs del marco ágil' : isHybrid ? 'KPIs ágiles y predictivos' : 'KPIs del marco predictivo (EVM)',
          content: isAgil
            ? 'Los indicadores ágiles miden la capacidad del equipo de entregar valor consistentemente, la previsibilidad de sus compromisos y la salud del flujo de trabajo.'
            : isHybrid
              ? 'El portafolio unificado requiere métricas adaptadas a cada marco. Los proyectos ágiles se miden con indicadores de flujo; los predictivos con EVM. El tablero de portafolio consolida ambos.'
              : 'El Earned Value Management (EVM) provee una vista integrada del desempeño de costo y cronograma, permitiendo proyecciones tempranas y decisiones basadas en datos.',
          table: {
            headers: ['Indicador', 'Fórmula / Definición', 'Meta', 'Alerta'],
            rows: isAgil
              ? [
                  ['Velocity', 'Story Points completados/sprint', '≥ promedio 6 sprints', '< -20% del promedio'],
                  ['Predictabilidad', 'Compromisos cumplidos/total', '≥ 85%', '< 70%'],
                  ['Lead Time', 'Tiempo ítem: backlog → done', 'Tendencia decreciente', '> P75 histórico'],
                  ['Cycle Time', 'Tiempo ítem: WIP → done', '< 3 días promedio', '> 5 días promedio'],
                  ['Deuda técnica', '% de capacidad dedicada a deuda', '≤ 20% por sprint', '> 30%'],
                ]
              : isHybrid
                ? [
                    ['Velocity (ágil)', 'Story Points completados/sprint', '≥ promedio histórico', '< -20%'],
                    ['CPI (predictivo)', 'EV / AC', '≥ 0.95', '< 0.85'],
                    ['SPI (predictivo)', 'EV / PV', '≥ 0.90', '< 0.80'],
                    ['Tasa de adopción', '% proyectos siguiendo el marco', '≥ 80%', '< 60%'],
                    ['NPS de stakeholders', 'Net Promoter Score trimestral', '≥ 30', '< 0'],
                  ]
                : [
                    ['CPI', 'EV / AC (Earned Value / Actual Cost)', '≥ 0.95', '< 0.85'],
                    ['SPI', 'EV / PV (Earned Value / Planned Value)', '≥ 0.90', '< 0.80'],
                    ['EAC', 'BAC / CPI (presupuesto a la conclusión)', 'Tendencia convergente', 'Desviación > 15%'],
                    ['TCPI', '(BAC – EV) / (BAC – AC)', '≤ 1.10', '> 1.20'],
                    ['Tasa cambios aprobados', 'Aprobados / Solicitados', '≥ 90%', '< 70%'],
                  ],
          },
        },
        {
          title: 'Tablero de portafolio y frecuencia de reporte',
          content: 'El tablero de portafolio unificado provee visibilidad en tiempo real del estado de todas las iniciativas activas. Se actualiza semanalmente por los gestores de proyecto y se presenta al Comité Directivo mensualmente.',
          items: [
            'Semáforo de estado: Verde (on-track) / Ámbar (en riesgo) / Rojo (en crisis) por proyecto',
            'Vista ejecutiva: 1 página por proyecto con KPIs clave y hitos próximos',
            'Heatmap de riesgos: Matriz probabilidad × impacto del portafolio consolidado',
            'Tendencia de madurez: Evolución de los indicadores de adopción metodológica',
          ],
        },
      ],
    },
    {
      number: 5, icon: Users,
      title: 'Herramientas, Plantillas y Artefactos',
      intro: 'Este capítulo cataloga las plantillas estandarizadas, herramientas recomendadas y artefactos de gestión que la PMO pone a disposición de todos los equipos de proyecto. Su uso es obligatorio para los proyectos bajo el ámbito de la PMO.',
      subsections: [
        {
          title: 'Plantillas obligatorias',
          content: 'Las siguientes plantillas son de uso obligatorio para todos los proyectos registrados en la PMO. Están disponibles en el repositorio corporativo y deben usarse sin modificar la estructura base.',
          table: {
            headers: ['Plantilla', 'Propósito', 'Marco aplicable'],
            rows: [
              ['Acta de Constitución', 'Autorización formal del proyecto', 'Predictivo / Híbrido'],
              ['Product Backlog', 'Gestión de requisitos iterativos', 'Ágil / Híbrido'],
              ['Plan de Gestión', 'Líneas base de alcance, tiempo y costo', 'Predictivo'],
              ['Registro de Riesgos', 'Identificación y seguimiento de riesgos', 'Todos'],
              ['Informe de Estado', 'Reporte semanal de avance (1 página)', 'Todos'],
              ['Acta de Control de Cambios', 'Solicitud y aprobación de cambios', 'Predictivo / Híbrido'],
              ['Acta de Cierre', 'Cierre formal y lecciones aprendidas', 'Todos'],
            ],
          },
        },
        {
          title: 'Herramientas recomendadas',
          content: 'La PMO recomienda el siguiente ecosistema de herramientas digitales, alineado con la infraestructura tecnológica actual de la organización.',
          items: [
            'Gestión de proyectos: Jira Software (ágil) / MS Project (predictivo)',
            'Documentación colaborativa: Confluence / SharePoint',
            'Comunicación: Microsoft Teams con canales por proyecto',
            'Repositorio de artefactos: SharePoint / Supabase Storage',
            'Tablero ejecutivo: Power BI conectado a Jira y MS Project',
            'Versionamiento de código (proyectos TI): GitHub / Azure DevOps',
          ],
        },
      ],
    },
    {
      number: 6, icon: Lightbulb,
      title: 'Plan de Adopción y Hoja de Ruta',
      intro: 'La adopción exitosa de esta guía requiere una gestión del cambio deliberada y secuenciada. Este capítulo define la hoja de ruta de implementación en tres horizontes, los roles de change agents y los mecanismos de soporte para los equipos.',
      subsections: [
        {
          title: 'Hoja de ruta: 30 / 90 / 180 días',
          content: 'La implementación se estructura en tres horizontes con objetivos claros, responsables definidos y métricas de éxito verificables al cierre de cada etapa.',
          table: {
            headers: ['Horizonte', 'Objetivo', 'Actividades clave', 'Meta de éxito'],
            rows: [
              ['30 días', 'Piloto con 2 proyectos', 'Formación de líderes, aplicación de plantillas, retrospectiva de piloto', 'Guía aplicada en 2 proyectos activos'],
              ['90 días', 'Expansión al portafolio activo', 'Certificación de PMs, tablero de portafolio activo, comités operativos', '>80% de proyectos siguen el marco'],
              ['180 días', 'Evaluación y optimización', 'Auditoría de madurez, revisión y ajuste de la guía (v1.1), plan de madurez avanzado', 'Nivel de madurez 3 validado'],
            ],
          },
        },
        {
          title: 'Gestión del cambio y soporte',
          content: 'El cambio metodológico requiere liderazgo visible, campeones internos y mecanismos de soporte para los equipos durante la transición.',
          items: [
            'PMO Champion: Designar 1 líder metodológico por unidad de negocio como embajador de la guía',
            'Comunidad de práctica: Sesión mensual de 1 hora para compartir experiencias, resolver dudas y proponer mejoras',
            'Oficina de ayuda PMO: Canal Teams dedicado con respuesta garantizada en 24 horas hábiles',
            'Reconocimiento: Programa trimestral de reconocimiento a equipos con mayor adopción y mejores KPIs',
            'Revisión anual: La guía se revisará anualmente o ante cambios organizacionales significativos',
          ],
        },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// Standalone HTML generator for download (RF-F7-03)
// ---------------------------------------------------------------------------
function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function htmlParagraphs(value?: string): string {
  const lines = String(value ?? '').split(/\n+/).map(line => line.trim()).filter(Boolean);
  return lines.map(line => `<p>${escapeHtml(line)}</p>`).join('');
}

function htmlList(items?: string[]): string {
  if (!items?.length) return '';
  return `<ul>${items.map(item => `<li>${escapeHtml(item).replace(/\n/g, '<br>')}</li>`).join('')}</ul>`;
}

function generateDownloadHTML(
  chapters: GuideChapter[], org: string, pmoType: PmoType, version: DocVersion
): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });

  const chapHtml = chapters.map(ch => {
    const secHtml = ch.subsections.map(s => {
      const listHtml = htmlList(s.items);
      const tblHtml = s.table
        ? `<table><thead><tr>${s.table.headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
           <tbody>${s.table.rows.map(r => `<tr>${r.map(c => `<td>${escapeHtml(c).replace(/\n/g, '<br>')}</td>`).join('')}</tr>`).join('')}</tbody></table>`
        : '';
      return `<h3>${escapeHtml(s.title)}</h3>${htmlParagraphs(s.content)}${listHtml}${tblHtml}`;
    }).join('');
    return `<div class="chapter"><h2>${ch.number}. ${escapeHtml(ch.title)}</h2><div class="intro">${htmlParagraphs(ch.intro)}</div>${secHtml}</div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"><title>Guía Metodológica — ${org}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Georgia, serif; font-size: 13px; color: #1f2937; line-height: 1.7; }
  .cover { background: #030213; color: #fff; padding: 80px 60px; min-height: 200px; }
  .cover h1 { font-size: 2.2em; font-weight: 700; margin-bottom: 12px; }
  .cover p { opacity: 0.7; font-size: 1em; margin-bottom: 6px; }
  .cover .badge { display: inline-block; margin-top: 20px; padding: 6px 16px; border: 1px solid rgba(255,255,255,0.3); border-radius: 999px; font-size: 0.8em; }
  .content { max-width: 800px; margin: 0 auto; padding: 40px 60px 80px; }
  .toc { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; margin-bottom: 40px; }
  .toc h2 { font-size: 1em; text-transform: uppercase; letter-spacing: 0.1em; color: #6b7280; margin-bottom: 12px; }
  .toc-item { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dotted #d1d5db; color: #374151; }
  .chapter { margin-bottom: 48px; }
  h2 { font-size: 1.25em; color: #030213; font-weight: 700; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 2px solid #030213; }
  h3 { font-size: 1em; color: #374151; font-weight: 700; margin: 20px 0 8px; }
  p { margin-bottom: 12px; color: #374151; }
  .intro p { color: #4b5563; font-style: italic; }
  ul { margin: 8px 0 16px 20px; }
  li { margin-bottom: 5px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 0.9em; }
  th { background: #030213; color: #fff; padding: 8px 12px; text-align: left; }
  td { border: 1px solid #e5e7eb; padding: 7px 12px; }
  tr:nth-child(even) td { background: #f9fafb; }
  .footer { text-align: center; color: #9ca3af; font-size: 0.8em; margin-top: 60px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
  @media print { body { font-size: 11px; } .cover { min-height: auto; } }
  @media screen { .print-btn { position: fixed; top: 20px; right: 20px; background: #030213; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 13px; } }
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">Imprimir / Guardar PDF</button>
<div class="cover">
  <h1>Guía Metodológica<br>para la PMO</h1>
  <p><strong>${escapeHtml(org)}</strong></p>
  <p>PMO Tipo: ${escapeHtml(pmoType)}</p>
  <p>Generada por PMO Intelligence Platform · Agente 7</p>
  <div class="badge">Versión ${version.number} — ${fmt(version.generatedAt)}</div>
</div>
<div class="content">
<div class="toc">
  <h2>Tabla de contenidos</h2>
  ${chapters.map((c, i) => `<div class="toc-item"><span>${c.number}. ${escapeHtml(c.title)}</span><span>${i + 3}</span></div>`).join('')}
</div>
${chapHtml}
<div class="footer">
  Guía Metodológica · ${org} · Versión ${version.number} · ${fmt(version.generatedAt)}<br>
  Generado automáticamente por PMO Intelligence Platform — Agente 7
</div>
</div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** RF-F7-02 — Multi-step processing indicator */
function ProcessingView({
  steps, currentStep, isAdjustment,
}: {
  steps: ProcessingStep[]; currentStep: number; isAdjustment: boolean;
}) {
  const pct = Math.min(100, Math.round((currentStep / steps.length) * 100));
  return (
    <AnimatePresence>
      <motion.div 
        key="processing-overlay"
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-[#fafaf9]/85 backdrop-blur-md flex flex-col items-center justify-center"
      >
        <div className="w-16 h-16 rounded-full border border-neutral-200 bg-white flex items-center justify-center mb-5 shadow-sm">
          <Loader2 size={22} className="text-neutral-700 animate-spin" strokeWidth={1.75} />
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
            className="hidden"
            style={{ borderTopColor: '#0a0a0a' }}
          />
        </div>

        <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400 mb-2" style={{ fontWeight: 500 }}>Procesando</p>
        <h2 className="text-neutral-900 tracking-tight mb-2" style={{ fontWeight: 500, fontSize: '1.5rem', letterSpacing: '-0.02em' }}>
          {isAdjustment ? 'Revisando la guía' : 'Generando la guía metodológica'}
        </h2>
        <p className="text-neutral-500 text-[13px] max-w-md text-center leading-relaxed mb-6">
          {isAdjustment
            ? 'El Agente 7 está incorporando los ajustes del consultor y generando una nueva versión.'
            : 'La guía se está construyendo de acuerdo al enfoque aprobado en la Fase 6.'}
        </p>

        <div className="hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] uppercase tracking-[0.14em] text-neutral-400" style={{ fontWeight: 500 }}>Progreso</span>
            <span className="text-neutral-900 text-[12px] tabular-nums" style={{ fontWeight: 500 }}>{pct}%</span>
          </div>
          <div className="h-1 bg-neutral-200/70 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: '#0a0a0a' }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Step list */}
        <div className="hidden">
          {steps.map((step, idx) => {
            const done = idx < currentStep;
            const active = idx === currentStep;
            if (!done && !active) return null; // Solo mostrar lo completado y lo actual para no saturar el overlay
            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${active ? 'bg-white border-neutral-200 shadow-sm' : 'bg-transparent border-transparent opacity-60'}`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {done
                    ? <CheckCircle2 size={14} className="text-neutral-900" strokeWidth={1.75} />
                    : <Loader2 size={14} className="animate-spin text-neutral-700" strokeWidth={1.75} />}
                </div>
                <div>
                  <p className="text-[13px]" style={{ fontWeight: active ? 600 : 500, color: '#0a0a0a' }}>
                    {step.label}
                  </p>
                  {active && (
                    <p className="text-neutral-500 text-[12px] mt-0.5 leading-snug">
                      {step.detail}
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
        
        <p className="text-neutral-400 text-[10px] mt-8 flex items-center gap-1.5 justify-center uppercase tracking-widest">
          <AlertCircle size={10} strokeWidth={1.75} />
          No cierre esta pantalla
        </p>
      </motion.div>
    </AnimatePresence>
  );
}

/** RF-F7-05 — Version indicator badge */
function VersionBadge({ version }: { version: DocVersion }) {
  const fmt = new Date(version.generatedAt).toLocaleString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border ${version.status === 'revisado' ? 'bg-neutral-800 border-neutral-800 text-white' : 'bg-gray-100 border-gray-200 text-gray-500'}`}
      style={{ fontWeight: 500 }}>
      {version.status === 'revisado' ? <RotateCcw size={10} /> : <Sparkles size={10} />}
      Versión {version.number} — {version.status === 'revisado' ? `revisada el ${fmt}` : `generada el ${fmt}`}
      {version.comment && <span className="opacity-60">· con comentarios del consultor</span>}
    </div>
  );
}

/** Document renderer — A4 style within the viewer canvas */
function TextBlock({ text, className = '' }: { text?: string; className?: string }) {
  const lines = String(text ?? '').split(/\n+/).map(line => line.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      {lines.map((line, index) => (
        <p key={index} className="text-gray-600 text-sm leading-relaxed">
          {line}
        </p>
      ))}
    </div>
  );
}

function DocumentRenderer({ chapters, org, pmoType, version }: {
  chapters: GuideChapter[]; org: string; pmoType: PmoType; version: DocVersion;
}) {
  const fmt = new Date(version.generatedAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });
  const accent = '#0a0a0a';

  return (
    <div className="bg-white shadow-2xl mx-auto" style={{ width: 'min(794px, 100%)' }}>
      {/* Cover */}
      <div className="p-12 pb-10" style={{ background: '#030213', color: '#fff' }}>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <FileText size={20} className="text-white" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest opacity-60">PMO Intelligence Platform · Agente 7</p>
          </div>
        </div>
        <h1 className="mb-2" style={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1.2 }}>
          Guía Metodológica
        </h1>
        <p className="opacity-70 text-sm mb-1" style={{ fontWeight: 500 }}>{org}</p>
        <p className="opacity-50 text-xs">PMO {pmoType} · Generada por IA · {fmt}</p>
        <div className="mt-6 flex items-center gap-3">
          <span className="px-3 py-1.5 rounded-full text-xs" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', fontWeight: 600 }}>
            Versión {version.number}.0
          </span>
          <span className="px-3 py-1.5 rounded-full text-xs border border-white/20 text-white/70">
            {version.status === 'revisado' ? 'Documento revisado' : 'Borrador para revisión'}
          </span>
        </div>
      </div>

      {/* TOC */}
      <div className="px-12 py-8 border-b border-gray-100">
        <h2 className="text-xs uppercase tracking-widest text-gray-400 mb-4" style={{ fontWeight: 700 }}>Tabla de Contenidos</h2>
        <div className="space-y-1.5">
          {chapters.map((ch, i) => (
            <div key={ch.number} className="flex items-center justify-between py-1.5 border-b border-dashed border-gray-100 last:border-0">
              <div className="flex items-center gap-2">
                <ch.icon size={12} className="text-gray-400 flex-shrink-0" />
                <span className="text-gray-700 text-sm" style={{ fontWeight: 500 }}>
                  {ch.number}. {ch.title}
                </span>
              </div>
              <span className="text-gray-400 text-xs">{i + 4}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Chapters */}
      <div className="px-12 py-8 space-y-10">
        {chapters.map(ch => (
          <div key={ch.number}>
            {/* Chapter heading */}
            <div className="flex items-center gap-3 mb-4 pb-3" style={{ borderBottom: `2px solid ${accent}` }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: accent }}>
                <ch.icon size={14} className="text-white" />
              </div>
              <h2 className="text-gray-900" style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                {ch.number}. {ch.title}
              </h2>
            </div>
            <p className="text-gray-500 text-sm leading-relaxed italic mb-6">{ch.intro}</p>

            {/* Subsections */}
            <div className="space-y-6">
              {ch.subsections.map((sec, si) => (
                <div key={si}>
                  <h3 className="text-gray-800 text-sm mb-2" style={{ fontWeight: 700 }}>
                    {ch.number}.{si + 1} {sec.title}
                  </h3>
                  <TextBlock text={sec.content} className="mb-3" />

                  {sec.items && (
                    <ul className="space-y-1.5 mb-3">
                      {sec.items.map((item, ii) => (
                        <li key={ii} className="flex items-start gap-2 text-sm text-gray-600">
                          <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: accent }} />
                          <span className="whitespace-pre-line leading-relaxed">{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {sec.table && (
                    <div className="overflow-x-auto rounded-xl border border-gray-200 mb-3">
                      <table className="w-full text-xs">
                        <thead>
                          <tr style={{ background: '#030213' }}>
                            {sec.table.headers.map((h, hi) => (
                              <th key={hi} className="px-4 py-2.5 text-left text-white" style={{ fontWeight: 600 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sec.table.rows.map((row, ri) => (
                            <tr key={ri} style={{ background: ri % 2 === 0 ? '#fff' : '#f9fafb' }}>
                              {row.map((cell, ci) => (
                                <td key={ci} className="px-4 py-2.5 text-gray-600 border-t border-gray-100 whitespace-pre-line">{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Footer */}
        <div className="pt-6 border-t border-gray-200 text-center">
          <p className="text-gray-400 text-xs">
            Guía Metodológica · {org} · Versión {version.number}.0 · {fmt}<br />
            Generado por PMO Intelligence Platform — Agente 7 · Documento confidencial
          </p>
        </div>
      </div>
    </div>
  );
}

/** Approve modal */
function ApproveModal({ open, onCancel, onConfirm, isLoading, versionNum }: {
  open: boolean; onCancel: () => void; onConfirm: () => void; isLoading: boolean; versionNum: number;
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onCancel} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10 p-6">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-10 h-10 rounded-xl bg-neutral-900 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 size={20} className="text-white" />
              </div>
              <div>
                <h3 className="text-gray-900 mb-1" style={{ fontWeight: 600 }}>Aprobar Guía Metodológica</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Está a punto de aprobar la <strong>Versión {versionNum}</strong> de la Guía Metodológica.
                  La Fase 7 quedará <strong>completada</strong> y la Fase 8 se desbloqueará automáticamente.
                  Esta acción no puede deshacerse.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={onCancel} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-gray-600 text-sm hover:bg-gray-50" style={{ fontWeight: 500 }}>Cancelar</button>
              <button onClick={onConfirm} disabled={isLoading}
                className="flex-1 py-2.5 rounded-xl text-white text-sm flex items-center justify-center gap-2 disabled:opacity-70"
                style={{ background: '#0a0a0a', fontWeight: 600 }}>
                {isLoading ? <><Loader2 size={14} className="animate-spin" />Aprobando…</> : <><CheckCircle2 size={14} />Aprobar guía</>}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

const CHAPTER_ICONS: ElementType[] = [BookOpen, Shield, GitCommitHorizontal, BarChart2, Users, Lightbulb];
const TECHNICAL_KEYS = new Set([
  'error',
  'metadata',
  'agent_id',
  'project_id',
  'timestamp',
  'generated_at',
  'processing_time_seconds',
  'phase',
  'status',
  'iteration',
  'section_id',
  'sections_generated',
  'generation_notes',
  'document_version',
]);
const TITLE_KEYS = new Set([
  'titulo',
  'title',
  'nombre',
  'nombre_rol',
  'rol',
  'fase',
  'dominio',
  'criterio',
  'funcion',
  'accion',
  'riesgo',
  'weakness',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function normalizeTable(table: any): { headers: string[]; rows: string[][] } | undefined {
  const headers = table?.headers ?? table?.encabezados ?? table?.columnas;
  const rows = table?.rows ?? table?.filas;
  if (!Array.isArray(headers) || !Array.isArray(rows)) return undefined;
  return {
    headers: headers.map(String),
    rows: rows.map((row: any) => Array.isArray(row) ? row.map(String) : []),
  };
}

function parseJsonIfString(raw: any): any {
  if (typeof raw !== 'string') return raw;
  try { return JSON.parse(raw); } catch { return raw; }
}

function pickFirst(...values: any[]) {
  return values.find(value => value !== undefined && value !== null);
}

function isPlainObject(value: any) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function isScalar(value: any) {
  return value === null || value === undefined || ['string', 'number', 'boolean'].includes(typeof value);
}

function isTechnicalKey(key: string) {
  return TECHNICAL_KEYS.has(key) || key.startsWith('_');
}

function meaningfulEntries(value: Record<string, any>) {
  return Object.entries(value).filter(([key, val]) => {
    if (isTechnicalKey(key)) return false;
    if (val === null || val === undefined || val === '') return false;
    if (Array.isArray(val) && val.length === 0) return false;
    return true;
  });
}

function asArray(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value);
  return [];
}

function titleFromObject(value: Record<string, any>, fallback: string) {
  for (const key of TITLE_KEYS) {
    if (value[key]) return String(value[key]);
  }
  return fallback;
}

function stringifyDeep(value: any): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value
      .map((item, index) => {
        if (isScalar(item)) return String(item);
        if (isPlainObject(item)) return `${titleFromObject(item, `Elemento ${index + 1}`)}: ${stringifyDeepObject(item)}`;
        return stringifyDeep(item);
      })
      .filter(Boolean)
      .join('\n');
  }
  if (isPlainObject(value)) return stringifyDeepObject(value);
  return String(value);
}

function stringifyDeepObject(value: Record<string, any>) {
  return meaningfulEntries(value)
    .map(([key, val]) => `${formatFieldKey(key)}: ${stringifyDeep(val)}`)
    .join('\n');
}

function stringifyContent(value: any): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  return stringifyDeep(value);
}

function normalizeSection(section: any, index: number) {
  const items = pickFirst(section?.items, section?.lista, section?.puntos, section?.actividades, section?.recomendaciones);
  return {
    title: String(pickFirst(section?.titulo, section?.title, section?.nombre, `Seccion ${index + 1}`)),
    content: stringifyContent(pickFirst(section?.contenido, section?.content, section?.descripcion, section?.detalle, section?.texto)),
    items: Array.isArray(items) ? items.map(stringifyDeep).filter(Boolean) : undefined,
    table: normalizeTable(pickFirst(section?.tabla, section?.table)),
  };
}

/** Format a snake_case/camelCase key into a human-readable title */
function formatFieldKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, l => l.toUpperCase());
}

function tableFromObjectArray(values: any[]): GuideSubsection['table'] | undefined {
  if (!values.length || !values.every(isPlainObject)) return undefined;
  const scalarKeys = Array.from(new Set(
    values.flatMap(value =>
      meaningfulEntries(value)
        .filter(([_, val]) => isScalar(val))
        .map(([key]) => key)
    )
  ));
  if (scalarKeys.length < 2) return undefined;

  return {
    headers: scalarKeys.map(formatFieldKey),
    rows: values.map(value => scalarKeys.map(key => stringifyDeep(value[key]))),
  };
}

function objectArrayToItems(values: any[]) {
  return values
    .map((item, index) => {
      if (!isPlainObject(item)) return stringifyDeep(item);
      const title = titleFromObject(item, `Elemento ${index + 1}`);
      const details = meaningfulEntries(item)
        .filter(([key]) => !TITLE_KEYS.has(key))
        .map(([key, val]) => `${formatFieldKey(key)}: ${stringifyDeep(val)}`)
        .join('\n');
      return details ? `${title}\n${details}` : title;
    })
    .filter(Boolean);
}

function objectToNestedSubsections(value: Record<string, any>, titlePrefix = ''): GuideSubsection[] {
  return meaningfulEntries(value).flatMap(([key, val]) => {
    const title = titlePrefix ? `${titlePrefix} - ${formatFieldKey(key)}` : formatFieldKey(key);

    if (Array.isArray(val)) {
      if (val.length === 0) return [];
      if (val.every(isPlainObject)) {
        return [{
          title,
          content: '',
          items: objectArrayToItems(val),
          table: tableFromObjectArray(val),
        }];
      }
      return [{ title, content: '', items: val.map(stringifyDeep).filter(Boolean) }];
    }

    if (isPlainObject(val)) {
      const scalarContent = meaningfulEntries(val)
        .filter(([_, nestedVal]) => isScalar(nestedVal))
        .map(([nestedKey, nestedVal]) => `${formatFieldKey(nestedKey)}: ${stringifyDeep(nestedVal)}`)
        .join('\n');
      const nestedObject = Object.fromEntries(meaningfulEntries(val).filter(([_, nestedVal]) => !isScalar(nestedVal)));
      return [
        ...(scalarContent ? [{ title, content: scalarContent }] : []),
        ...objectToNestedSubsections(nestedObject, title),
      ];
    }

    return [{ title, content: stringifyDeep(val) }];
  });
}

/**
 * Converts a guide_content item's "contenido" object into flat subsections.
 * Handles strings, arrays of strings, arrays of objects, and nested objects.
 */
function contenidoToSubsections(contenido: any): GuideChapter['subsections'] {
  if (!contenido || typeof contenido !== 'object') return [];

  return meaningfulEntries(contenido)
    .map(([key, val]: [string, any]) => {
      const title = formatFieldKey(key);

      if (Array.isArray(val)) {
        if (val.length === 0) return null;
        // Array of primitives
        if (!isPlainObject(val[0])) {
          return { title, content: '', items: val.map(stringifyDeep).filter(Boolean) };
        }
        // Array of objects — extract most descriptive field per item
        return {
          title,
          content: '',
          items: objectArrayToItems(val),
          table: tableFromObjectArray(val),
        };
      }

      if (isPlainObject(val)) {
        const nested = objectToNestedSubsections(val, title);
        return nested.length > 0 ? nested : { title, content: stringifyContent(val) };
      }

      return { title, content: String(val) };
    })
    .flat()
    .filter(Boolean) as GuideChapter['subsections'];
}

/**
 * Normalizes the Gemini Agent 7 guide_content format (sections S01-S16)
 * into GuideChapter objects for the DocumentRenderer.
 */
function normalizeGuideContent(guideContent: any[]): GuideChapter[] {
  // Skip S01 (Portada) — it's just document metadata, not a renderable chapter
  const sections = guideContent.filter((s: any) => s.section_id !== 'S01');
  if (sections.length === 0) return [];

  return sections.map((section: any, index: number) => {
    const contenido = section.contenido ?? {};
    const subsections = contenidoToSubsections(contenido);

    // Extract a meaningful intro from common summary fields
    const intro = stringifyContent(
      contenido?.descripcion_general ??
      contenido?.contexto_organizacional ??
      contenido?.descripcion_entorno ??
      contenido?.enfoque_propuesto ??
      contenido?.enfoque_adoptado ??
      contenido?.descripcion_del_modelo ??
      contenido?.analisis_integrado?.coherencia_entre_fuentes ??
      ''
    );

    return {
      number: index + 1,
      icon: CHAPTER_ICONS[index % CHAPTER_ICONS.length],
      title: String(section.section_title ?? `Sección ${index + 1}`),
      intro,
      subsections: subsections.length > 0
        ? subsections
        : [{ title: 'Contenido', content: 'Contenido procesado por el Agente 7.' }],
    };
  });
}



function normalizeChapters(raw: any): GuideChapter[] {
  const parsed = parseJsonIfString(raw);

  // ── Priority 1: Gemini Agent 7 native format: guide_content sections array ──
  const guideContent =
    parsed?.diagnosis?.guide_content ??
    parsed?.guide_content ??
    parsed?.diagnosis?.guideContent ??
    parsed?.guideContent;
  if (Array.isArray(guideContent) && guideContent.length > 0) {
    return normalizeGuideContent(guideContent);
  }

  // ── Priority 2: Classic chapters/capitulos format ──────────────────────────
  const deepSearch = (obj: any) => pickFirst(
    obj?.capitulos,
    obj?.chapters,
    obj?.guia?.capitulos,
    obj?.guia_metodologica?.capitulos,
    obj?.guiaMetodologica?.capitulos,
    obj?.documento?.capitulos,
    obj?.contenido?.capitulos,
    obj?.estructura?.capitulos,
    obj?.guia_metodologica?.chapters,
    obj?.guia?.chapters,
    obj?.documento?.chapters,
  );
  const candidateKeys = ['guia_metodologica', 'guia', 'documento', 'resultado', 'result', 'data'];
  const source = deepSearch(parsed)
    ?? candidateKeys.reduce((found: any, key: string) => found ?? deepSearch(parsed?.[key]), undefined);
  const chapterList = asArray(source);

  if (chapterList.length === 0) {
    // Fallback: treat secciones as a single chapter
    const sectionList = asArray(pickFirst(parsed?.secciones, parsed?.sections, parsed?.apartados, parsed?.contenido?.secciones));
    if (sectionList.length > 0) {
      return [{
        number: 1,
        icon: CHAPTER_ICONS[0],
        title: String(pickFirst(parsed?.titulo, parsed?.title, 'Guia metodologica')),
        intro: stringifyContent(pickFirst(parsed?.resumen_ejecutivo, parsed?.resumen, parsed?.introduccion, parsed?.intro)),
        subsections: sectionList.map(normalizeSection).filter(section => section.title || section.content || section.items?.length),
      }];
    }

    // Last resort: build chapter from top-level fields
    const derivedSections = [
      { titulo: 'Resumen ejecutivo', contenido: pickFirst(parsed?.resumen_ejecutivo, parsed?.resumen, parsed?.sintesis) },
      { titulo: 'Criterios de implementacion', items: pickFirst(parsed?.criterios_implementacion, parsed?.criterios, parsed?.implementation_criteria) },
      { titulo: 'Artefactos recomendados', items: pickFirst(parsed?.artefactos_recomendados, parsed?.artefactos, parsed?.artifacts) },
      { titulo: 'Riesgos de adopcion', items: pickFirst(parsed?.riesgos_adopcion, parsed?.riesgos, parsed?.adoption_risks) },
      { titulo: 'Metricas de seguimiento', items: pickFirst(parsed?.metricas_seguimiento, parsed?.metricas, parsed?.metrics) },
    ].filter(section => section.contenido || (Array.isArray(section.items) && section.items.length > 0));

    if (derivedSections.length > 0) {
      return [{
        number: 1,
        icon: CHAPTER_ICONS[0],
        title: String(pickFirst(parsed?.titulo, parsed?.title, 'Guia metodologica')),
        intro: stringifyContent(pickFirst(parsed?.introduccion, parsed?.intro, parsed?.tipo_pmo)),
        subsections: derivedSections.map(normalizeSection),
      }];
    }

    return [];
  }

  return chapterList.map((chapter: any, index: number) => {
    const sections = pickFirst(chapter.secciones, chapter.subsections, chapter.apartados, chapter.sections, chapter.contenidos, []);
    const normalizedSections = asArray(sections).map(normalizeSection).filter(section => section.title || section.content || section.items?.length);
    if (normalizedSections.length === 0) {
      const chapterContent = pickFirst(chapter.contenido, chapter.content, chapter.descripcion, chapter.detalle, chapter.texto);
      if (chapterContent) {
        normalizedSections.push(normalizeSection({ titulo: 'Contenido', contenido: chapterContent }, 0));
      }
    }
    return {
      number: Number(chapter.numero ?? chapter.number ?? index + 1),
      icon: CHAPTER_ICONS[index % CHAPTER_ICONS.length],
      title: String(pickFirst(chapter.titulo, chapter.title, chapter.nombre, `Capitulo ${index + 1}`)),
      intro: stringifyContent(pickFirst(chapter.introduccion, chapter.intro, chapter.resumen, chapter.descripcion)),
      subsections: normalizedSections,
    };
  });
}


function unwrapGuidePayload(raw: any) {
  const parsed = parseJsonIfString(raw);
  // Return _current if wrapped by the edge function versioning logic.
  // We intentionally keep the full Gemini response (including 'diagnosis' key)
  // so that normalizeChapters can find diagnosis.guide_content.
  return parsed?._current ?? parsed;
}

function versionsFromPayload(raw: any): DocVersion[] {
  if (Array.isArray(raw?._versions) && raw._versions.length > 0) {
    return raw._versions.map((version: any, index: number) => ({
      number: Number(version.number ?? index + 1),
      generatedAt: String(version.generatedAt ?? version.generated_at ?? raw?._generated_at ?? new Date().toISOString()),
      comment: version.comment ?? undefined,
      status: version.status === 'revisado' ? 'revisado' : 'generado',
      data: version.data,
    }));
  }

  if (!raw) return [];
  return [{
    number: Number(raw?._latest_version ?? 1),
    generatedAt: String(raw?._generated_at ?? new Date().toISOString()),
    comment: raw?._last_comment ?? undefined,
    status: Number(raw?._latest_version ?? 1) > 1 ? 'revisado' : 'generado',
    data: unwrapGuidePayload(raw),
  }];
}

// ---------------------------------------------------------------------------
// Main module
// ---------------------------------------------------------------------------
export default function GuiaMetodologicaView() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getProject, updatePhaseStatus, reprocessPhase, isLoading } = useApp();
  const { playAgentSuccess, playPhaseComplete } = useSoundManager();

  const project = getProject(projectId!);
  const phase    = project?.phases.find(p => p.number === 7);
  const phase4   = project?.phases.find(p => p.number === 4);

  const pmoType      = parsePmoType(phase4?.agentDiagnosis);

  const deriveView = (): ModuleView => {
    if (!project || !phase) return 'processing';
    if (phase.status === 'completado') return 'approved';
    if (phase.status === 'procesando') return 'processing';
    if (phase.agentData && normalizeChapters(unwrapGuidePayload(phase.agentData)).length > 0) return 'results';
    return 'auto-trigger';
  };

  const [view, setView]                     = useState<ModuleView>(deriveView);
  const [processingStep, setProcessingStep] = useState(1);
  const [isAdjustment, setIsAdjustment]     = useState(false);
  const [chapters, setChapters]             = useState<GuideChapter[]>(() => normalizeChapters(unwrapGuidePayload(phase?.agentData)));
  const [versions, setVersions]             = useState<DocVersion[]>(() => versionsFromPayload(phase?.agentData));
  const [currentVersionIdx, setCurrentVersionIdx] = useState(0);
  const [adjustText, setAdjustText]         = useState('');
  const [isAdjusting, setIsAdjusting]       = useState(false);
  const [showApprove, setShowApprove]       = useState(false);
  const [isApproving, setIsApproving]       = useState(false);
  const autoTriggered = useRef(false);
  const hasFailed = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef(0);
  const pollTimeoutStartRef = useRef(0);

  const currentVersion = versions[currentVersionIdx] ?? null;

  const applyGuidePayload = useCallback((raw: any) => {
    const current = unwrapGuidePayload(raw);
    const nextChapters = normalizeChapters(current);
    if (nextChapters.length === 0) {
      toast.error('El Agente 7 devolvio una guia sin capitulos renderizables.');
      return false;
    }
    const nextVersions = versionsFromPayload(raw);
    setChapters(nextChapters);
    setVersions(nextVersions);
    setCurrentVersionIdx(Math.max(0, nextVersions.length - 1));
    return true;
  }, []);

  // ── Handlers (declared before early returns to respect Rules of Hooks) ────
  // useCallback must be called unconditionally on every render
  const handleDownload = useCallback(() => {
    if (!currentVersion || !project || chapters.length === 0) return;
    const html = generateDownloadHTML(chapters, project.companyName, pmoType, currentVersion);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `Guia-Metodologica-${project.companyName.replace(/\s+/g, '-')}-v${currentVersion.number}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Descarga iniciada', {
      description: 'Abra el archivo .html en su navegador y use "Imprimir → Guardar como PDF" para generar el PDF.',
    });
    // TODO: En producción → descargar PDF desde Supabase Storage signedUrl
  }, [chapters, currentVersion, project, pmoType]);

  // ── RF-F7-01: Auto-trigger on mount ──────────────────────────────────────
  const startPolling = useCallback((startedAt = Date.now(), forceRestart = false) => {
    if (!projectId) return;
    if (pollRef.current && !forceRestart) return;
    if (pollRef.current) clearInterval(pollRef.current);
    pollStartRef.current = startedAt;
    pollTimeoutStartRef.current = Date.now();

    const poll = async () => {
      if (Date.now() - pollTimeoutStartRef.current > 180000) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setIsAdjusting(false);
        setView(chapters.length > 0 ? 'results' : 'auto-trigger');
        updatePhaseStatus(projectId, 7, 'disponible');
        toast.error('El Agente 7 tardo demasiado en responder.', {
          description: 'La fase quedo disponible para reintentar la generacion.',
          duration: 9000,
        });
        return;
      }

      const { data, error } = await supabase
        .from('fases_estado')
        .select('datos_consolidados, estado_visual, updated_at')
        .eq('proyecto_id', projectId)
        .eq('numero_fase', 7)
        .single();

      if (error) return;
      if (data?.updated_at && new Date(data.updated_at).getTime() < pollStartRef.current) return;

      const lastUpdatedAt = data?.updated_at ? new Date(data.updated_at).getTime() : 0;
      const staleProcessingMs = Date.now() - lastUpdatedAt;
      if (
        data?.estado_visual === 'procesando' &&
        !data?.datos_consolidados &&
        lastUpdatedAt > 0 &&
        staleProcessingMs > 10 * 60 * 1000
      ) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setIsAdjusting(false);
        setView('auto-trigger');
        updatePhaseStatus(projectId, 7, 'disponible');
        toast.error('La ejecucion anterior del Agente 7 quedo sin actividad.', {
          description: 'La fase quedo disponible para intentar generar la guia nuevamente.',
          duration: 9000,
        });
        return;
      }

      if (data?.datos_consolidados && (data.estado_visual === 'disponible' || data.estado_visual === 'completado')) {
        if ((data.datos_consolidados as any)?._error) {
          const message = (data.datos_consolidados as any)?.message || 'Revise el prompt del Agente 7 e intente nuevamente.';
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setIsAdjusting(false);
          setView(chapters.length > 0 ? 'results' : 'auto-trigger');
          updatePhaseStatus(projectId, 7, 'disponible');
          toast.error('El Agente 7 encontro un error.', { description: message, duration: 9000 });
          return;
        }
        const ok = applyGuidePayload(data.datos_consolidados);
        if (!ok) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setIsAdjusting(false);
          hasFailed.current = true; // Prevent auto-retrigger loop
          setView(chapters.length > 0 ? 'results' : 'auto-trigger');
          updatePhaseStatus(projectId, 7, 'disponible');
          return;
        }
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setIsAdjusting(false);
        setView(data.estado_visual === 'completado' ? 'approved' : 'results');
        playAgentSuccess();
        toast.success('Agente 7 genero la guia metodologica', {
          description: 'El documento quedo listo para revision.',
        });
        return;
      }

      if (data?.estado_visual === 'disponible' && !data?.datos_consolidados) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setIsAdjusting(false);
        setView('auto-trigger');
        toast.error('El Agente 7 no genero datos. Revisa el prompt o intenta nuevamente.');
      }

      if (data?.estado_visual === 'error') {
        const message = (data?.datos_consolidados as any)?.message || 'Revise el prompt del Agente 7 e intente nuevamente.';
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setIsAdjusting(false);
        setView(chapters.length > 0 ? 'results' : 'auto-trigger');
        updatePhaseStatus(projectId, 7, 'disponible');
        toast.error('El Agente 7 encontro un error.', { description: message, duration: 9000 });
      }
    };

    poll();
    pollRef.current = setInterval(poll, 4000);
  }, [applyGuidePayload, chapters.length, playAgentSuccess, projectId, updatePhaseStatus]);

  const invokeAgent7 = useCallback(async (iteration = 1, comments: string | null = null) => {
    if (!projectId) return;
    const startedAt = Date.now();
    pollStartRef.current = startedAt;

    // CRITICAL: Update DB directly BEFORE invoking the edge function.
    // The edge function checks DB estado_visual === 'procesando' before saving results.
    // updatePhaseStatus only updates React context; if the DB still says 'bloqueado',
    // the agent will silently discard its result.
    await supabase
      .from('fases_estado')
      .update({ estado_visual: 'procesando', updated_at: new Date().toISOString() })
      .eq('proyecto_id', projectId)
      .eq('numero_fase', 7);

    updatePhaseStatus(projectId, 7, 'procesando');
    setView('processing');
    setProcessingStep(1);
    try {
      const { error } = await supabase.functions.invoke('pmo-agent', {
        body: { projectId, phaseNumber: 7, iteration, comments },
      });
      if (error) throw new Error(error.message);
      startPolling(startedAt, true);
    } catch (err: any) {
      setIsAdjusting(false);
      setView(versions.length > 0 ? 'results' : 'auto-trigger');
      updatePhaseStatus(projectId, 7, 'disponible');
      toast.error('Error iniciando Agente 7', { description: err.message });
    }
  }, [projectId, startPolling, updatePhaseStatus, versions.length]);

  // ── Processing: advance steps then show results ───────────────────────────
  useEffect(() => {
    if (view !== 'processing') return;
    const interval = setInterval(() => {
      setProcessingStep(prev => Math.min(PROCESSING_STEPS.length, prev + 1));
    }, 3500);
    return () => clearInterval(interval);
  }, [view]);

  useEffect(() => {
    if (phase?.agentData && chapters.length === 0) applyGuidePayload(phase.agentData);
  }, [phase?.agentData, chapters.length, applyGuidePayload]);

  useEffect(() => {
    if (!project || !phase) return;

    if (phase.status === 'procesando') {
      setView('processing');
      startPolling(0);
      return;
    }

    if (phase.status === 'completado') {
      if (phase.agentData) applyGuidePayload(phase.agentData);
      setView('approved');
      return;
    }

    if (phase.agentData && normalizeChapters(unwrapGuidePayload(phase.agentData)).length > 0) {
      applyGuidePayload(phase.agentData);
      setView('results');
      return;
    }

    if (phase.status === 'disponible') {
      setView('auto-trigger');
    }
  }, [applyGuidePayload, phase, project, startPolling]);

  // hasFailed prevents re-triggering after a parse failure (would cause infinite loop)
  useEffect(() => {
    if (!project || !phase || isLoading) return;
    if (phase.status !== 'disponible') return;
    if (autoTriggered.current || hasFailed.current || view !== 'auto-trigger' || chapters.length > 0) return;
    if (phase.agentData && Object.keys(phase.agentData).length > 0) return;
    autoTriggered.current = true;
    invokeAgent7(1, null);
  }, [chapters.length, invokeAgent7, isLoading, phase, project, view]);

  useEffect(() => {
    if (phase?.status === 'procesando') {
      setView('processing');
      startPolling(0);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  if (!project || !phase) return null;

  // ── Remaining handlers (non-hook, safe after guard) ──────────────────────
  const handleRequestAdjustments = async () => {
    if (!adjustText.trim()) { toast.error('Escriba las instrucciones de ajuste antes de enviar.'); return; }
    setIsAdjusting(true);
    setIsAdjustment(true);
    const nextIteration = (currentVersion?.number ?? versions.length) + 1;
    const comment = adjustText;
    setAdjustText('');
    await invokeAgent7(nextIteration, comment);
  };

  const handleReprocess = async () => {
    if (!adjustText.trim()) { toast.error('Escriba un comentario para reprocesar.'); return; }
    const nextIteration = (currentVersion?.number ?? versions.length) + 1;
    const comment = adjustText;
    setAdjustText('');
    setIsAdjustment(true);

    try {
      // 1. Bloquear fases posteriores en AppContext + Supabase (igual que Fase 4)
      await reprocessPhase(projectId!, 7);

      // 2. Update DB to 'procesando' BEFORE invoking so cancellation check passes
      await supabase
        .from('fases_estado')
        .update({ estado_visual: 'procesando', updated_at: new Date().toISOString() })
        .eq('proyecto_id', projectId)
        .eq('numero_fase', 7);

      updatePhaseStatus(projectId!, 7, 'procesando');
      hasFailed.current = false;
      autoTriggered.current = true; // prevent auto-trigger loop during reprocess
      setView('processing');
      setProcessingStep(1);

      // 3. Fire-and-forget: polling will detect completion
      supabase.functions.invoke('pmo-agent', {
        body: { projectId, phaseNumber: 7, iteration: nextIteration, comments: comment },
      }).catch(e => console.error('[Phase7] Reprocess invoke failed:', e));

      const startedAt = Date.now();
      pollStartRef.current = startedAt;
      startPolling(startedAt, true);

      toast.info('Reprocesando guía metodológica…', {
        description: 'El Agente 7 está incorporando las instrucciones del consultor.',
      });
    } catch (e) {
      console.error('[Phase7] Reprocess error:', e);
      toast.error('Error al reprocesar');
      setIsAdjusting(false);
      setView('results');
    }
  };

  const handleApprove = async () => {
    setIsApproving(true);
    
    try {
      // Invocamos el Agente 8 para que empiece a procesar los artefactos en background
      updatePhaseStatus(projectId!, 8, 'procesando');
      supabase.functions.invoke('pmo-agent-artefactos', {
        body: { projectId }
      }).catch(e => console.error('[Phase7] Agent 8 trigger failed:', e));

      await new Promise(r => setTimeout(r, 700));
      
      setIsApproving(false);
      setShowApprove(false);

      // RF-F7-06: marca Fase 7 completada + desbloquea Fase 8
      updatePhaseStatus(
        projectId!, 7, 'completado',
        `Guía Metodológica aprobada · Versión ${currentVersion?.number} · PMO ${pmoType} · ${chapters.length} capítulos.`
      );
      
      playPhaseComplete(); // Phase_Complete: consultor aprobó definitivamente
      setView('approved');
      toast.success('¡Fase 7 aprobada!', { 
        description: 'La Guía Metodológica ha sido completada. El Agente 8 está generando las recomendaciones de artefactos.' 
      });
    } catch (e) {
      console.error('[Phase7] Approval error:', e);
      toast.error('Error al procesar la aprobación');
      setIsApproving(false);
    }
  };

  const isCompleted = view === 'approved';

  // ── Render: auto-trigger → skip straight to processing ───────────────────
  // There is no separate "sending" screen. The moment the component mounts
  // with no data it immediately invokes the agent and shows the processing overlay.
  if (view === 'auto-trigger') {
    return (
      <div className="h-screen bg-[#fafaf9] flex flex-col overflow-hidden">
        <PhaseHeader
          projectId={projectId!}
          companyName={project.companyName}
          phaseNumber={7}
          phaseName="Guía Metodológica"
        />
        <ProcessingView steps={PROCESSING_STEPS} currentStep={processingStep} isAdjustment={false} />
      </div>
    );
  }



  // ── Render: processing ────────────────────────────────────────────────────
  if (view === 'processing') {
    return (
      <div className="h-screen bg-[#fafaf9] flex flex-col overflow-hidden">
        <PhaseHeader
          projectId={projectId!}
          companyName={project.companyName}
          phaseNumber={7}
          phaseName="Guía Metodológica"
        />
        <div className="flex-1 min-h-0 overflow-hidden">
          <ProcessingView steps={PROCESSING_STEPS} currentStep={processingStep} isAdjustment={isAdjustment} />
        </div>
      </div>
    );
  }

  // ── Render: results & approved (split layout) ─────────────────────────────
  return (
    <div className="h-screen bg-[#fafaf9] flex flex-col overflow-hidden">
      <PhaseHeader
        projectId={projectId!}
        companyName={project.companyName}
        phaseNumber={7}
        phaseName="Guía Metodológica"
        eyebrow={isCompleted ? 'Completada' : undefined}
      />

      <div className="flex-1 min-h-0 grid grid-cols-12 overflow-hidden">

        {/* ── Left: Document Viewer 70% ── */}
        <div className="col-span-8 min-h-0 flex flex-col border-r border-gray-200 overflow-hidden">

          <div className="bg-white border-b border-neutral-200/60 px-5 py-3 flex items-center justify-between flex-shrink-0">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-400" style={{ fontWeight: 500 }}>Documento</p>
              <p className="text-neutral-900 text-[13px] truncate" style={{ fontWeight: 500 }}>
                Guía metodológica — {project.companyName}
              </p>
              {currentVersion && (
                <div className="mt-1">
                  <VersionBadge version={currentVersion} />
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-neutral-200/80 rounded-full text-neutral-600 text-[12px] hover:bg-neutral-50 transition-colors"
                style={{ fontWeight: 500 }}>
                <Download size={11} strokeWidth={1.75} /> Descargar
              </button>
              <button
                onClick={() => {
                  const win = window.open('', '_blank');
                  if (!win || !currentVersion) return;
                  win.document.write(generateDownloadHTML(chapters, project.companyName, pmoType, currentVersion));
                  win.document.close();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-neutral-200/80 rounded-full text-neutral-600 text-[12px] hover:bg-neutral-50 transition-colors"
                style={{ fontWeight: 500 }}>
                <ExternalLink size={11} strokeWidth={1.75} /> Abrir en pestaña
              </button>
            </div>
          </div>

          {/* Document canvas */}
          {/* RF-F7-03: Integrar iframe apuntando a la signedUrl de Supabase Storage (PDF real del Agente 7) */}
          <div className="flex-1 min-h-0 bg-neutral-100 overflow-y-auto overscroll-contain p-6 relative">

            {/* Adjustment overlay */}
            <AnimatePresence>
              {isAdjusting && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 z-10 bg-gray-900/80 backdrop-blur-sm flex flex-col items-center justify-center">
                  <Loader2 size={36} className="text-white animate-spin mb-4" />
                  <p className="text-white text-sm" style={{ fontWeight: 600 }}>Enviando ajustes al Agente 7…</p>
                  <p className="text-gray-300 text-xs mt-1">Preparando nueva versión del documento</p>
                </motion.div>
              )}
            </AnimatePresence>

            {currentVersion && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <DocumentRenderer
                  chapters={chapters}
                  org={project.companyName}
                  pmoType={pmoType}
                  version={currentVersion}
                />
              </motion.div>
            )}
          </div>
        </div>

        {/* ── Right: Control panel 30% — fully static, no internal scroll ── */}
        <div className="col-span-4 min-h-0 flex flex-col bg-white overflow-hidden">

          <div className="px-5 pt-5 pb-3 flex-shrink-0">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={12} className="text-neutral-400" strokeWidth={1.75} />
              <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-500" style={{ fontWeight: 500 }}>Historial de versiones</p>
              <span className="ml-auto text-[11px] text-neutral-400 tabular-nums">{versions.length}</span>
            </div>
            <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-0.5">
              {versions.map((v, idx) => (
                <button
                  key={v.number}
                  onClick={() => {
                    setCurrentVersionIdx(idx);
                    if (v.data) setChapters(normalizeChapters(v.data));
                  }}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                    currentVersionIdx === idx
                      ? 'border-neutral-300 bg-neutral-50'
                      : 'border-neutral-200/60 hover:border-neutral-300 hover:bg-neutral-50/60'
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] flex-shrink-0 mt-0.5 tabular-nums"
                    style={currentVersionIdx === idx
                      ? { background: '#0a0a0a', color: '#fff', fontWeight: 600 }
                      : { background: '#f5f5f5', color: '#404040', fontWeight: 600 }}>
                    {v.number}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-neutral-900 text-[12px]" style={{ fontWeight: 500 }}>
                      Versión {v.number} · {v.status === 'revisado' ? 'Revisada' : 'Original'}
                    </p>
                    <p className="text-neutral-400 text-[11px] mt-0.5 tabular-nums">
                      {new Date(v.generatedAt).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {v.comment && (
                      <p className="text-neutral-500 text-[11px] mt-1 line-clamp-2 italic">"{v.comment}"</p>
                    )}
                  </div>
                  {currentVersionIdx === idx && (
                    <CheckCircle2 size={12} className="text-neutral-900 flex-shrink-0 mt-1" strokeWidth={1.75} />
                  )}
                </button>
              ))}
              {versions.length === 0 && (
                <p className="text-neutral-400 text-[12px] text-center py-3 italic">Sin versiones aún</p>
              )}
            </div>
          </div>

          <hr className="border-neutral-200/60 flex-shrink-0" />

          {/* RF-F7-04: Adjustment panel — fills remaining height */}
          <div className="flex-1 px-5 py-4 flex flex-col overflow-hidden min-h-0">
            {!isCompleted ? (
              <>
                <div className="flex items-center gap-2 mb-1.5 flex-shrink-0">
                  <MessageSquare size={12} className="text-neutral-400" strokeWidth={1.75} />
                  <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-500" style={{ fontWeight: 500 }}>
                    Solicitar ajustes
                  </p>
                </div>
                <p className="text-neutral-500 text-[12px] mb-3 leading-relaxed flex-shrink-0">
                  Describa los cambios requeridos. El Agente 7 generará una versión revisada. La versión anterior se conserva en el historial.
                </p>
                <textarea
                  value={adjustText}
                  onChange={e => setAdjustText(e.target.value)}
                  placeholder="Ej: En el capítulo 3, amplía las ceremonias ágiles con ejemplos de la industria financiera…"
                  className="flex-1 min-h-0 w-full px-3 py-2.5 border border-neutral-200/80 rounded-xl text-[13px] outline-none focus:border-neutral-300 focus:ring-4 focus:ring-neutral-100 transition-all resize-none leading-relaxed bg-white placeholder:text-neutral-400"
                />
                <p className="text-neutral-400 text-[11px] text-right mt-1 mb-3 flex-shrink-0 tabular-nums">{adjustText.length} caracteres</p>
                <div className="flex gap-2 flex-shrink-0">
                  <motion.button
                    whileHover={{ y: -1 }} whileTap={{ y: 0 }}
                    onClick={handleRequestAdjustments}
                    disabled={isAdjusting || !adjustText.trim()}
                    className="flex-1 py-2.5 rounded-full border border-neutral-200/80 text-neutral-700 text-[12px] flex items-center justify-center gap-1.5 disabled:opacity-50 hover:bg-neutral-50 transition-all"
                    style={{ fontWeight: 500 }}
                  >
                    {isAdjusting
                      ? <><Loader2 size={12} className="animate-spin" strokeWidth={1.75} />Enviando…</>
                      : <><Send size={12} strokeWidth={1.75} />Solicitar ajuste</>}
                  </motion.button>
                  <motion.button
                    whileHover={{ y: -1 }} whileTap={{ y: 0 }}
                    onClick={handleReprocess}
                    disabled={isAdjusting || !adjustText.trim()}
                    className="flex-1 py-2.5 rounded-full border border-neutral-900 text-neutral-900 text-[12px] flex items-center justify-center gap-1.5 disabled:opacity-50 hover:bg-neutral-50 transition-all"
                    style={{ fontWeight: 500 }}
                  >
                    <RotateCcw size={12} strokeWidth={1.75} />
                    Reprocesar
                  </motion.button>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-neutral-200/70 bg-white p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-neutral-900 text-white flex items-center justify-center">
                    <CheckCircle2 size={13} strokeWidth={1.75} />
                  </div>
                  <span className="text-[11px] uppercase tracking-[0.14em] text-neutral-500" style={{ fontWeight: 500 }}>Fase completada</span>
                </div>
                <p className="text-neutral-700 text-[13px] leading-relaxed">
                  La guía fue aprobada y enviada al Agente 8 para generar los artefactos de soporte.
                </p>
                {phase.completedAt && (
                  <p className="text-neutral-400 text-[11px] mt-3 tabular-nums">Aprobado el {phase.completedAt}</p>
                )}
                <div className="mt-4 pt-4 border-t border-neutral-100">
                  <p className="text-neutral-400 text-[11px] mb-2 leading-relaxed">¿Necesitas generar una nueva versión? Escribe instrucciones y reprocesa.</p>
                  <textarea
                    value={adjustText}
                    onChange={e => setAdjustText(e.target.value)}
                    placeholder="Ej: Ajusta el capítulo de implementación para un plazo de 90 días…"
                    rows={3}
                    className="w-full px-3 py-2.5 border border-neutral-200/80 rounded-xl text-[12px] outline-none focus:border-neutral-300 focus:ring-4 focus:ring-neutral-100 transition-all resize-none leading-relaxed bg-white placeholder:text-neutral-400 mb-2"
                  />
                  <motion.button
                    whileHover={{ y: -1 }} whileTap={{ y: 0 }}
                    onClick={handleReprocess}
                    disabled={isAdjusting || !adjustText.trim()}
                    className="w-full py-2 rounded-full border border-neutral-900 text-neutral-900 text-[12px] flex items-center justify-center gap-1.5 disabled:opacity-50 hover:bg-neutral-50 transition-all"
                    style={{ fontWeight: 500 }}
                  >
                    <RotateCcw size={12} strokeWidth={1.75} />
                    Reprocesar guía metodológica
                  </motion.button>
                </div>
              </div>
            )}
          </div>

          {!isCompleted && (
            <div className="px-4 pb-4 pt-3 border-t border-neutral-200/60 bg-white flex-shrink-0">
              <p className="text-neutral-500 text-[11px] text-center mb-3 leading-relaxed">
                Al aprobar, la Fase 7 se completará y la Fase 8 se desbloqueará.
              </p>
              <motion.button
                whileHover={{ y: -1 }} whileTap={{ y: 0 }}
                onClick={() => setShowApprove(true)}
                className="w-full py-3 rounded-full text-white text-[13px] flex items-center justify-center gap-2 transition-all"
                style={{ background: '#0a0a0a', fontWeight: 500, boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 8px 24px -8px rgba(0,0,0,0.18)' }}
              >
                <CheckCircle2 size={13} strokeWidth={1.75} />
                Aprobar guía metodológica
              </motion.button>
            </div>
          )}

          {/* Navegación entre fases (flechas) */}
          {isCompleted && (
            <div className="px-4 pb-4 pt-3 border-t border-neutral-200/60 bg-white flex-shrink-0">
              <div className="flex gap-2">
                <button
                  onClick={() => navigate(`/dashboard/project/${projectId}/phase/6`)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full text-neutral-700 text-[12px] bg-white border border-neutral-200/80 hover:bg-neutral-50 transition-all"
                  style={{ fontWeight: 500, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
                >
                  ← Fase 6
                </button>
                <button
                  onClick={() => navigate(`/dashboard/project/${projectId}/phase/8`)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full text-white text-[12px] transition-all"
                  style={{ background: '#0a0a0a', fontWeight: 500, boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 8px 24px -8px rgba(0,0,0,0.18)' }}
                >
                  Fase 8 →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ApproveModal
        open={showApprove}
        onCancel={() => setShowApprove(false)}
        onConfirm={handleApprove}
        isLoading={isApproving}
        versionNum={currentVersion?.number ?? 1}
      />


    </div>
  );
}
