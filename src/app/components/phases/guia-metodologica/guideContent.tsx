import { BookOpen, Shield, BarChart2, Users, Lightbulb, GitCommitHorizontal } from 'lucide-react';
import type { GuideChapter, PmoType, ProcessingStep } from './types';

const PROCESSING_STEPS: ProcessingStep[] = [
  { id: 1, label: 'Recibiendo JSON aprobado de la Fase 6', detail: 'Enfoque metodológico + puntos débiles + instrucciones...', durationMs: 1400 },
  { id: 2, label: 'Analizando estructura de la guía', detail: 'Determinando capítulos, secciones y plantillas requeridas...', durationMs: 1600 },
  { id: 3, label: 'Generando contenido especializado', detail: 'Redactando marcos, procesos y directrices por capítulo...', durationMs: 2800 },
  { id: 4, label: 'Compilando plantillas y artefactos', detail: 'Integrando actas, tableros de métricas y árbol de decisión...', durationMs: 2200 },
  { id: 5, label: 'Verificando coherencia metodológica', detail: 'Validando consistencia entre capítulos y métricas...', durationMs: 1400 },
  { id: 6, label: 'Formateando documento final', detail: 'Aplicando estilos, índice de contenidos y portada...', durationMs: 1200 },
];
const MAX_TRANSIENT_GEMINI_RETRIES = 3;
const TRANSIENT_GEMINI_RETRY_DELAYS = [8000, 18000, 35000];

function isTransientGeminiError(message: string) {
  return /503|service unavailable|high demand|try again later|temporary|temporar|429|502|504/i.test(message);
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

export { PROCESSING_STEPS, MAX_TRANSIENT_GEMINI_RETRIES, TRANSIENT_GEMINI_RETRY_DELAYS, isTransientGeminiError, parsePmoType, buildChapters };