import {
  AlertCircle, AlertTriangle, BarChart3, Briefcase, CheckCircle2, ClipboardList, Clock,
  FileCheck2, FileSearch, Gauge, Globe, HardDrive, Layers3, Lightbulb, MessageSquare, ShieldAlert,
  Sparkles, Target, Users, Wrench
} from 'lucide-react';
import type { AgentDiagnosis } from '../../../hooks/useDocumentacion';
import {
  EMPTY_VALUE,
  levelTone,
  normalizeList,
  PhaseReportBadgeList,
  PhaseReportEvidenceCard,
  PhaseReportKeyValueGrid,
  PhaseReportMetric,
  PhaseReportMiniList,
  PhaseReportProgressBar,
  PhaseReportSection,
  phaseReportToneStyles,
  type PhaseReportTone,
  valueOrEmpty,
} from '../_shared/PhaseReportVisuals';

const DOC_CATEGORIES = [
  { value: 'D01', label: 'Organigrama' },
  { value: 'D02', label: 'Artefactos de Gestión de proyectos' },
  { value: 'D03', label: 'Plataformas y Sistemas' },
  { value: 'D04', label: 'Listado de Proyectos' },
  { value: 'D05', label: 'Listado de lideres del proyecto' },
  { value: 'D06', label: 'Proyecto mejor documentado' },
  { value: 'D07', label: 'Resultados Estratégicos' },
  { value: 'D08', label: 'Resultados financieros' },
  { value: 'D09', label: 'Mapa de Procesos' },
  { value: 'D10', label: 'Filosofia organizacional' },
  { value: 'D11', label: 'Modelo de Negocio' },
  { value: 'D12', label: 'Arquitectura Organizacional/TI' },
  { value: 'D13', label: 'Metodología de Gestión de Proyectos' },
  { value: 'D14', label: 'Portafolio de Productos/Servicios' },
  { value: 'D15', label: 'Segmentos de clientes' },
  { value: 'D16', label: 'Otros' },
];

function buildDocumentLookup(diagnosis: AgentDiagnosis) {
  const byId: Record<string, string> = {};
  const byCatalog: Record<string, string> = {};
  for (const doc of diagnosis.estado_documentos ?? []) {
    if (doc.document_id) byId[doc.document_id.toLowerCase()] = doc.document_name || doc.document_id;
    if (doc.document_code) {
      const code = doc.document_code.toUpperCase();
      if (!byCatalog[code]) byCatalog[code] = doc.document_name || code;
    }
  }
  return { byId, byCatalog };
}

function referenceName(value: unknown, lookup: ReturnType<typeof buildDocumentLookup>) {
  const raw = valueOrEmpty(value);
  const docId = raw.toLowerCase();
  const catalog = raw.toUpperCase();
  if (lookup.byId[docId]) return lookup.byId[docId];
  if (lookup.byCatalog[catalog]) return lookup.byCatalog[catalog];
  const category = DOC_CATEGORIES.find((item) => item.value === catalog);
  if (category) return category.label;
  return raw;
}

function textWithDocumentNames(value: unknown, lookup: ReturnType<typeof buildDocumentLookup>) {
  return valueOrEmpty(value)
    .replace(/\bdoc-\d{3}\b/gi, (match) => referenceName(match, lookup))
    .replace(/\bD\d{2}\b/gi, (match) => referenceName(match, lookup));
}

function CoverageChart({ diagnosis }: { diagnosis: AgentDiagnosis }) {
  const coverage = diagnosis.cobertura_documental;
  const expected = Number(coverage?.total_esperado ?? 0);
  const received = Number(coverage?.recibidos_completos ?? 0);
  const missing = Number(coverage?.faltantes ?? 0);
  const referenced = Number(coverage?.recibidos_referenciados ?? 0);
  const expired = Number(coverage?.documentos_vencidos ?? 0);
  const max = Math.max(expected, received, missing, referenced, expired, 1);

  return (
      <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-5">
      <div className="grid [grid-template-columns:repeat(auto-fit,minmax(132px,1fr))] gap-2.5">
        <PhaseReportMetric label="Esperados" value={expected} tone="blue" icon={<Target size={15} />} />
        <PhaseReportMetric label="Recibidos" value={received} tone="green" icon={<FileCheck2 size={15} />} />
        <PhaseReportMetric label="Referenciados" value={referenced} tone="purple" icon={<ClipboardList size={15} />} />
        <PhaseReportMetric label="Faltantes" value={missing} tone="orange" icon={<AlertTriangle size={15} />} />
        <PhaseReportMetric label="Vencidos" value={expired} tone="red" icon={<Clock size={15} />} />
      </div>
      <div className="rounded-2xl border border-neutral-100 bg-neutral-50/70 p-4 space-y-3">
        <PhaseReportProgressBar label="Documentos recibidos" value={received} max={max} tone="green" />
        <PhaseReportProgressBar label="Faltantes" value={missing} max={max} tone="orange" />
        <PhaseReportProgressBar label="Referenciados" value={referenced} max={max} tone="purple" />
      </div>
    </div>
  );
}

function QualityPanel({ diagnosis, lookup }: { diagnosis: AgentDiagnosis; lookup: ReturnType<typeof buildDocumentLookup> }) {
  const q = diagnosis.calidad_documental;
  return (
    <div className="space-y-4">
      <PhaseReportKeyValueGrid compact rows={[
        { label: 'Resultado', value: q?.resultado_consolidado, tone: levelTone(q?.resultado_consolidado) },
        { label: 'Actualizacion', value: q?.actualizacion },
        { label: 'Aplicabilidad', value: q?.aplicabilidad },
        { label: 'Detalle', value: q?.nivel_detalle },
        { label: 'Coherencia', value: q?.coherencia_entre_documentos },
      ]} />
      <div className="rounded-2xl bg-[#f7f8ff] border border-[#5454e9]/15 p-4">
        <p className="text-[10px] uppercase tracking-[0.14em] text-[#5454e9] mb-2" style={{ fontWeight: 800 }}>Justificacion</p>
        <p className="text-neutral-700 text-[13px] leading-relaxed">{textWithDocumentNames(q?.justificacion, lookup)}</p>
      </div>
    </div>
  );
}

function LifecycleCoverage({ diagnosis, lookup }: { diagnosis: AgentDiagnosis; lookup: ReturnType<typeof buildDocumentLookup> }) {
  const ciclo = diagnosis.cobertura_ciclo_vida;
  const dimensiones = [
    ['inicio', 'Inicio'],
    ['planeacion', 'Planeacion'],
    ['ejecucion', 'Ejecucion'],
    ['monitoreo_control', 'Monitoreo y control'],
    ['cierre', 'Cierre'],
  ] as const;
  const missing = new Set((ciclo?.fases_faltantes ?? []).map((f) => String(f).toLowerCase()));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
        <div className="rounded-2xl border border-[#e4eb60]/50 bg-[#e4eb60]/25 p-4">
          <p className="text-[10px] uppercase tracking-[0.14em] text-[#7a7f1e]" style={{ fontWeight: 800 }}>Completitud</p>
          <p className="mt-2 text-[28px] tracking-tight text-[#7a7f1e]" style={{ fontWeight: 850 }}>{valueOrEmpty(ciclo?.completitud)}</p>
          <div className="mt-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-neutral-500 mb-2" style={{ fontWeight: 700 }}>Fases faltantes</p>
            <PhaseReportBadgeList items={ciclo?.fases_faltantes?.length ? ciclo.fases_faltantes : ['Sin faltantes reportados']} tone={ciclo?.fases_faltantes?.length ? 'orange' : 'green'} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          {dimensiones.map(([key, label], index) => {
            const dim = diagnosis.dimensiones_gestion_proyectos?.[key];
            const isMissing = missing.has(key);
            const tone = isMissing ? 'orange' : levelTone(dim?.confianza ?? ciclo?.completitud);
            const toneClass = phaseReportToneStyles[tone];
            return (
              <div key={key} className={`rounded-2xl border ${toneClass.border} ${toneClass.soft} px-3 py-4 min-w-0`}>
                <div className={`w-7 h-7 rounded-full ${toneClass.bg} text-white flex items-center justify-center text-[11px] mb-3`} style={{ fontWeight: 800 }}>{index + 1}</div>
                <p className="text-[12px] text-neutral-900 leading-tight" style={{ fontWeight: 750 }}>{label}</p>
                <p className={`mt-2 text-[10px] ${toneClass.text}`} style={{ fontWeight: 700 }}>{valueOrEmpty(dim?.confianza)}</p>
              </div>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-neutral-100 bg-white p-4">
          <p className="text-[10px] uppercase tracking-[0.14em] text-neutral-400 mb-2" style={{ fontWeight: 800 }}>Continuidad documental</p>
          <p className="text-neutral-700 text-[13px] leading-relaxed">{textWithDocumentNames(ciclo?.continuidad_documental, lookup)}</p>
        </div>
        <div className="rounded-2xl border border-neutral-100 bg-white p-4">
          <p className="text-[10px] uppercase tracking-[0.14em] text-neutral-400 mb-2" style={{ fontWeight: 800 }}>Desbalance identificado</p>
          <p className="text-neutral-700 text-[13px] leading-relaxed">{textWithDocumentNames(ciclo?.desbalance_identificado, lookup)}</p>
        </div>
      </div>
    </div>
  );
}

function ContextPanel({ diagnosis }: { diagnosis: AgentDiagnosis }) {
  const contextRows = [
    { label: 'Organizacion', value: diagnosis.organizacion },
    { label: 'Sector', value: diagnosis.sector },
    { label: 'Tamano aproximado', value: diagnosis.tamano_aproximado },
    { label: 'Proyecto analizado', value: diagnosis.tipo_proyecto_analizado },
  ];
  const hasContextRows = contextRows.some((row) => row.value);

  return (
    <div className="space-y-4">
      {hasContextRows && <PhaseReportKeyValueGrid compact rows={contextRows} />}

      {diagnosis.descripcion_negocio && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50/30 p-4">
          <p className="text-[10px] uppercase tracking-[0.14em] text-blue-600 mb-2" style={{ fontWeight: 800 }}>Descripcion del negocio</p>
          <p className="text-neutral-700 text-[13px] leading-relaxed">{diagnosis.descripcion_negocio}</p>
        </div>
      )}
      
      {diagnosis.tipos_de_proyecto && diagnosis.tipos_de_proyecto.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-[0.14em] text-neutral-400" style={{ fontWeight: 800 }}>Tipos de proyecto analizados</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {diagnosis.tipos_de_proyecto.map((tipo, i) => (
              <div key={i} className="rounded-2xl border border-neutral-100 bg-white p-4">
                <p className="text-neutral-950 text-[14px]" style={{ fontWeight: 800 }}>{valueOrEmpty(tipo.nombre)}</p>
                <p className="mt-2 text-neutral-600 text-[13px] leading-relaxed">{valueOrEmpty(tipo.descripcion)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {diagnosis.estructura_organizacional && (
        <div className="space-y-4 pt-2 border-t border-neutral-100 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.14em] text-neutral-400" style={{ fontWeight: 800 }}>Estructura Organizacional</p>
            <span className={`px-2.5 py-1 rounded-full text-[10px] ${diagnosis.estructura_organizacional.existe_area_pmo ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-600'}`} style={{ fontWeight: 800 }}>
              {diagnosis.estructura_organizacional.existe_area_pmo ? 'Tiene PMO' : 'Sin PMO identificada'}
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {(diagnosis.estructura_organizacional.roles_identificados ?? []).map((rol, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-neutral-100 bg-white">
                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center flex-shrink-0">
                  <Briefcase size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-neutral-900 text-[13px] truncate" style={{ fontWeight: 750 }}>{valueOrEmpty(rol.nombre_cargo)}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-neutral-500 text-[11px]">{valueOrEmpty(rol.area)}</span>
                    <span className="w-1 h-1 rounded-full bg-neutral-300"></span>
                    <span className="text-neutral-500 text-[11px] capitalize">{valueOrEmpty(rol.nivel_jerarquico)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ArtefactoCard({ artefacto, index, lookup }: { artefacto: NonNullable<AgentDiagnosis['artefactos_identificados']>[number]; index: number; lookup: ReturnType<typeof buildDocumentLookup> }) {
  const tone: PhaseReportTone = artefacto.tiene_datos_reales ? 'green' : 'blue';
  const toneClass = phaseReportToneStyles[tone];
  return (
    <article className={`rounded-2xl border ${toneClass.border} bg-white overflow-hidden flex flex-col`}>
      <div className={`h-1 ${toneClass.bar}`} />
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="text-neutral-950 text-[15px] leading-snug" style={{ fontWeight: 800 }}>{valueOrEmpty(artefacto.nombre)}</p>
            <p className={`mt-1 text-[11px] uppercase tracking-[0.08em] ${toneClass.text}`} style={{ fontWeight: 750 }}>{valueOrEmpty(artefacto.nombre_en_empresa)}</p>
          </div>
          <span className={`px-2.5 py-1 rounded-full ${toneClass.soft} ${toneClass.text} border ${toneClass.border} text-[10px] flex-shrink-0`} style={{ fontWeight: 800 }}>
            {valueOrEmpty(artefacto.nivel_madurez_artefacto)}
          </span>
        </div>
        
        <PhaseReportKeyValueGrid compact rows={[
          { label: 'Tipo', value: artefacto.tipo?.replace(/_/g, ' ') },
          { label: 'Datos reales', value: artefacto.tiene_datos_reales ? 'Si' : 'Solo plantilla', tone: artefacto.tiene_datos_reales ? 'green' : 'amber' },
          { label: 'En empresa', value: artefacto.existe_en_empresa ? 'Si' : 'No', tone: artefacto.existe_en_empresa ? 'green' : 'red' },
        ]} />
        
        {artefacto.observaciones && (
          <p className="mt-3 text-neutral-600 text-[12px] leading-relaxed italic border-l-2 border-neutral-200 pl-3">"{artefacto.observaciones}"</p>
        )}

        <div className="mt-auto pt-3 space-y-3">
          <div>
            <p className="text-[9px] uppercase tracking-[0.14em] text-neutral-400 mb-2" style={{ fontWeight: 800 }}>Fases del ciclo</p>
            <PhaseReportBadgeList items={artefacto.fase_del_ciclo} tone="slate" />
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-[0.14em] text-neutral-400 mb-2" style={{ fontWeight: 800 }}>Documento fuente</p>
            <PhaseReportBadgeList items={[artefacto.document_id_fuente]} tone={tone} mapItem={(item) => referenceName(item, lookup)} />
          </div>
        </div>
      </div>
    </article>
  );
}

function HerramientaCard({ herramienta, index, lookup }: { herramienta: NonNullable<AgentDiagnosis['herramientas_identificadas']>[number]; index: number; lookup: ReturnType<typeof buildDocumentLookup> }) {
  const tone: PhaseReportTone = herramienta.es_repositorio_digital_principal ? 'green' : 'blue';
  const toneClass = phaseReportToneStyles[tone];
  return (
    <article className={`rounded-2xl border ${toneClass.border} bg-white overflow-hidden flex flex-col`}>
      <div className={`h-1 ${toneClass.bar}`} />
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="text-neutral-950 text-[15px] leading-snug" style={{ fontWeight: 800 }}>{valueOrEmpty(herramienta.nombre)}</p>
            <p className={`mt-1 text-[11px] uppercase tracking-[0.08em] ${toneClass.text}`} style={{ fontWeight: 750 }}>Tipo: {valueOrEmpty(herramienta.tipo).replace(/_/g, ' ')}</p>
          </div>
          {herramienta.es_repositorio_digital_principal && (
            <span className={`px-2.5 py-1 rounded-full ${toneClass.soft} ${toneClass.text} border ${toneClass.border} text-[10px] flex-shrink-0`} style={{ fontWeight: 800 }}>
              Repositorio Ppal
            </span>
          )}
        </div>
        <p className="text-neutral-700 text-[13px] leading-relaxed mb-4">{valueOrEmpty(herramienta.uso_identificado)}</p>
        
        <div className="mt-auto space-y-3">
          <div className={`rounded-2xl border ${toneClass.border} ${toneClass.soft} p-3`}>
            <p className={`text-[10px] uppercase tracking-[0.12em] ${toneClass.text} mb-2`} style={{ fontWeight: 850 }}>Fases donde se usa</p>
            <PhaseReportBadgeList items={herramienta.fases_donde_se_usa} tone={tone} />
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-[0.14em] text-neutral-400 mb-2" style={{ fontWeight: 800 }}>Documento fuente</p>
            <PhaseReportBadgeList items={[herramienta.document_id_fuente]} tone="slate" mapItem={(item) => referenceName(item, lookup)} />
          </div>
        </div>
      </div>
    </article>
  );
}

function GobernanzaPanel({ diagnosis, lookup }: { diagnosis: AgentDiagnosis; lookup: ReturnType<typeof buildDocumentLookup> }) {
  const g = diagnosis.gobernanza_documental_detectada;
  if (!g) return null;
  const mapText = (value: unknown) => textWithDocumentNames(value, lookup);
  
  return (
    <div className="space-y-4">
      <PhaseReportKeyValueGrid rows={[
        { label: 'SGC Detectado', value: g.tiene_sgc ? 'Sí' : 'No', tone: g.tiene_sgc ? 'green' : 'amber' },
        { label: 'Repositorio Digital', value: g.tiene_repositorio_digital ? 'Sí' : 'No', tone: g.tiene_repositorio_digital ? 'green' : 'amber' },
        { label: 'Gestión Cambios', value: g.tiene_gestion_cambios_formal ? 'Sí' : 'No', tone: g.tiene_gestion_cambios_formal ? 'green' : 'amber' },
        { label: 'Codificación Doc.', value: g.usa_codificacion_documental ? 'Sí' : 'No', tone: g.usa_codificacion_documental ? 'green' : 'amber' },
      ]} />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-4">
        {g.evidencia_sgc && (
          <div className="rounded-2xl border border-neutral-100 bg-white p-4">
            <p className="text-[10px] uppercase tracking-[0.14em] text-neutral-400 mb-2" style={{ fontWeight: 800 }}>Evidencia SGC</p>
            <p className="text-neutral-700 text-[13px] leading-relaxed">{mapText(g.evidencia_sgc)}</p>
          </div>
        )}
        {g.herramienta_repositorio && (
          <div className="rounded-2xl border border-neutral-100 bg-white p-4">
            <p className="text-[10px] uppercase tracking-[0.14em] text-neutral-400 mb-2" style={{ fontWeight: 800 }}>Herramienta Repositorio</p>
            <p className="text-neutral-700 text-[13px] leading-relaxed">{mapText(g.herramienta_repositorio)}</p>
          </div>
        )}
        {g.evidencia_gestion_cambios && (
          <div className="rounded-2xl border border-neutral-100 bg-white p-4">
            <p className="text-[10px] uppercase tracking-[0.14em] text-neutral-400 mb-2" style={{ fontWeight: 800 }}>Evidencia Gestión Cambios</p>
            <p className="text-neutral-700 text-[13px] leading-relaxed">{mapText(g.evidencia_gestion_cambios)}</p>
          </div>
        )}
        {g.patron_codificacion && (
          <div className="rounded-2xl border border-neutral-100 bg-white p-4">
            <p className="text-[10px] uppercase tracking-[0.14em] text-neutral-400 mb-2" style={{ fontWeight: 800 }}>Patrón de Codificación</p>
            <p className="text-neutral-700 text-[13px] leading-relaxed font-mono">{mapText(g.patron_codificacion)}</p>
          </div>
        )}
        {g.evidencia_lecciones_aprendidas && (
          <div className="rounded-2xl border border-neutral-100 bg-white p-4">
            <p className="text-[10px] uppercase tracking-[0.14em] text-neutral-400 mb-2" style={{ fontWeight: 800 }}>Lecciones Aprendidas</p>
            <p className="text-neutral-700 text-[13px] leading-relaxed">{mapText(g.evidencia_lecciones_aprendidas)}</p>
          </div>
        )}
      </div>
      
      {g.fuentes_documentales && g.fuentes_documentales.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-[0.14em] text-neutral-400 mb-2" style={{ fontWeight: 800 }}>Fuentes de Gobernanza</p>
          <PhaseReportBadgeList items={g.fuentes_documentales} tone="slate" mapItem={(item) => referenceName(item, lookup)} />
        </div>
      )}
    </div>
  );
}

function InsightCard({ item, index, lookup }: { item: unknown; index: number; lookup: ReturnType<typeof buildDocumentLookup> }) {
  const tone: PhaseReportTone = (['blue', 'green', 'purple', 'orange', 'amber'] as PhaseReportTone[])[index % 5];
  const toneClass = phaseReportToneStyles[tone];
  return (
    <div className={`rounded-2xl border ${toneClass.border} ${toneClass.soft} p-4 flex gap-3`}>
      <div className={`w-7 h-7 rounded-full ${toneClass.bg} text-white flex items-center justify-center flex-shrink-0 text-[11px]`} style={{ fontWeight: 800 }}>{index + 1}</div>
      <p className="text-neutral-700 text-[13px] leading-relaxed">{textWithDocumentNames(item, lookup)}</p>
    </div>
  );
}

function DimensionCard({ label, dim, lookup, index }: { label: string; dim: any; lookup: ReturnType<typeof buildDocumentLookup>; index: number }) {
  const tones: PhaseReportTone[] = ['blue', 'purple', 'orange', 'green', 'amber'];
  const tone = tones[index % tones.length];
  const toneClass = phaseReportToneStyles[tone];
  const confidenceTone = levelTone(dim?.confianza);
  const mapItem = (item: unknown) => textWithDocumentNames(item, lookup);
  const mapReference = (item: unknown) => referenceName(item, lookup);

  return (
    <article className={`rounded-2xl border ${toneClass.border} bg-white overflow-hidden`}>
      <div className={`h-1 ${toneClass.bar}`} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-neutral-950 text-[15px]" style={{ fontWeight: 850 }}>{label}</p>
            <p className={`text-[11px] ${toneClass.text} mt-1`} style={{ fontWeight: 750 }}>{valueOrEmpty(dim?.nivel_formalidad)}</p>
          </div>
          <span className={`px-2.5 py-1 rounded-full ${phaseReportToneStyles[confidenceTone].soft} ${phaseReportToneStyles[confidenceTone].text} text-[10px]`} style={{ fontWeight: 800 }}>
            Confianza {valueOrEmpty(dim?.confianza)}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <PhaseReportMiniList title="Procesos documentados" items={dim?.procesos_documentados} tone={tone} mapItem={mapItem} />
          <PhaseReportMiniList title="Artefactos" items={dim?.artefactos} tone={tone} mapItem={mapItem} />
          <PhaseReportMiniList title="Herramientas" items={dim?.herramientas} tone={tone} mapItem={mapItem} />
          <PhaseReportMiniList title="Roles documentados" items={dim?.roles_documentados} tone={tone} mapItem={mapItem} />
        </div>
        <div className={`mt-3 rounded-2xl border ${toneClass.border} ${toneClass.soft} p-3.5`}>
          <p className={`text-[10px] uppercase tracking-[0.14em] ${toneClass.text} mb-2`} style={{ fontWeight: 850 }}>Fuentes documentales</p>
          <PhaseReportBadgeList items={dim?.fuentes_documentales} mapItem={mapReference} tone={tone} />
        </div>
      </div>
    </article>
  );
}

function InventoryTable({ diagnosis }: { diagnosis: AgentDiagnosis }) {
  const lookup = buildDocumentLookup(diagnosis);
  const estadoMap: Record<string, any> = {};
  for (const doc of diagnosis.estado_documentos ?? []) {
    const code = doc.document_code?.trim().toUpperCase();
    if (code && !estadoMap[code]) estadoMap[code] = doc;
  }

  const missingSet = new Set((diagnosis.missing_documents ?? []).map((code) => code.trim().toUpperCase()));
  const stateLabel: Record<string, string> = {
    util_para_analisis: 'Util para analisis',
    critico_para_gp: 'Critico',
    incompleto: 'Incompleto',
    no_legible: 'No legible',
    parcialmente_interpretable: 'Parcial',
    insuficiente_para_concluir: 'Insuficiente',
    desactualizado: 'Desactualizado',
    solo_referenciado: 'Solo referenciado',
    no_entregado: 'No entregado',
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-2xl border border-neutral-100">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-neutral-100 bg-[#f7f8ff]">
              <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">Codigo</th>
              <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">Documento esperado</th>
              <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">Archivo PDF / CSV</th>
              <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">Estado</th>
              <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50 bg-white">
            {DOC_CATEGORIES.map((cat) => {
              const entry = estadoMap[cat.value];
              const isMissing = missingSet.has(cat.value) || !entry || entry.estado === 'no_entregado';
              const tone: PhaseReportTone = isMissing ? 'orange' : entry?.estado === 'critico_para_gp' ? 'green' : 'blue';
              const toneClass = phaseReportToneStyles[tone];
              return (
                <tr key={cat.value} className="hover:bg-neutral-50/60 transition-colors">
                  <td className="px-4 py-3.5"><span className={`text-[11px] tabular-nums ${toneClass.text}`} style={{ fontWeight: 850 }}>{cat.value}</span></td>
                  <td className="px-4 py-3.5"><span className="text-neutral-800 text-[13px]" style={{ fontWeight: 650 }}>{cat.label}</span></td>
                  <td className="px-4 py-3.5 max-w-[320px]">
                    <span className="text-neutral-600 text-[12px] leading-relaxed">{valueOrEmpty(entry?.document_name)}</span>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {entry?.file_format && (
                        <span className="px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 text-[10px]" style={{ fontWeight: 700 }}>
                          {String(entry.file_format).toUpperCase()}
                        </span>
                      )}
                    </div>
                    {entry?.observaciones && (
                      <p className="mt-1.5 text-neutral-400 text-[11px] leading-relaxed">{entry.observaciones}</p>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] border ${toneClass.soft} ${toneClass.border} ${toneClass.text}`} style={{ fontWeight: 800 }}>
                      {entry?.estado ? stateLabel[entry.estado] ?? entry.estado : 'No entregado'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5"><span className="text-neutral-500 text-[12px]">{valueOrEmpty(entry?.valor_analitico)}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-[0.14em] text-neutral-400 mb-2" style={{ fontWeight: 800 }}>Codigos faltantes reportados por el agente</p>
        <PhaseReportBadgeList items={diagnosis.missing_documents} tone="orange" mapItem={(item) => referenceName(item, lookup)} />
      </div>
    </div>
  );
}

function Recommendations({ items, lookup }: { items?: string[]; lookup: ReturnType<typeof buildDocumentLookup> }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {normalizeList(items).map((rec, i) => (
        <div key={i} className="rounded-2xl border border-[#4cb979]/25 bg-[#4cb979]/10 p-4 flex gap-3">
          <div className="w-8 h-8 rounded-2xl bg-[#4cb979] text-white flex items-center justify-center flex-shrink-0">
            <Lightbulb size={15} />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-[#22794b] mb-1" style={{ fontWeight: 800 }}>Recomendacion {i + 1}</p>
            <p className="text-neutral-700 text-[13px] leading-relaxed">{textWithDocumentNames(rec, lookup)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function Agent4Inputs({ diagnosis, lookup }: { diagnosis: AgentDiagnosis; lookup: ReturnType<typeof buildDocumentLookup> }) {
  const inputs = diagnosis.insumos_para_agente_4;
  const mapText = (value: unknown) => textWithDocumentNames(value, lookup);
  const mapReference = (value: unknown) => referenceName(value, lookup);

  return (
    <div className="space-y-5">
      <PhaseReportKeyValueGrid rows={[
        { label: 'Nivel estandarizacion', value: inputs?.nivel_estandarizacion },
        { label: 'Nivel calidad documental', value: inputs?.nivel_calidad_documental },
        { label: 'Listo para integracion', value: diagnosis.listo_para_integracion },
        { label: 'Preproyecto', value: inputs?.tiene_preproyecto },
        { label: 'Postcierre', value: inputs?.tiene_postcierre },
      ]} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-neutral-100 bg-white p-4">
          <p className="text-[10px] uppercase tracking-[0.14em] text-neutral-400 mb-2" style={{ fontWeight: 800 }}>Justificacion preproyecto</p>
          <p className="text-neutral-700 text-[13px] leading-relaxed">{mapText(inputs?.justificacion_preproyecto)}</p>
        </div>
        <div className="rounded-2xl border border-neutral-100 bg-white p-4">
          <p className="text-[10px] uppercase tracking-[0.14em] text-neutral-400 mb-2" style={{ fontWeight: 800 }}>Justificacion postcierre</p>
          <p className="text-neutral-700 text-[13px] leading-relaxed">{mapText(inputs?.justificacion_postcierre)}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PhaseReportMiniList title="Hallazgos clave resumen" items={inputs?.hallazgos_clave_resumen} tone="blue" mapItem={mapText} />
        <PhaseReportMiniList title="Brechas criticas resumen" items={inputs?.brechas_criticas_resumen} tone="orange" mapItem={mapText} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-neutral-400 mb-3" style={{ fontWeight: 800 }}>Metodologias mencionadas</p>
          <div className="space-y-3">
            {(inputs?.metodologias_mencionadas?.length ? inputs.metodologias_mencionadas : [{ nombre: EMPTY_VALUE, documento_fuente: EMPTY_VALUE, nivel_adopcion_visible: EMPTY_VALUE }]).map((met, i) => (
              <div key={i} className="rounded-2xl border border-[#865cf0]/20 bg-[#865cf0]/10 p-4">
                <p className="text-neutral-950 text-[14px]" style={{ fontWeight: 800 }}>{valueOrEmpty(met.nombre)}</p>
                <p className="mt-1 text-[12px] text-neutral-600">Adopcion visible: <span className="text-[#5d3bbd]" style={{ fontWeight: 800 }}>{valueOrEmpty(met.nivel_adopcion_visible)}</span></p>
                <div className="mt-3"><PhaseReportBadgeList items={[met.documento_fuente]} mapItem={mapReference} tone="purple" /></div>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-[0.14em] text-neutral-400" style={{ fontWeight: 800 }}>Senales de enfoque</p>
          {(inputs?.senales_flexibilidad_agil ?? []).map((senal, i) => (
            <PhaseReportEvidenceCard key={`agil-${i}`} title="Flexibilidad agil" subtitle={senal.nivel_evidencia} description={senal.descripcion} references={senal.documentos_fuente} tone="green" mapText={mapText} mapReference={mapReference} />
          ))}
          {(inputs?.senales_estructuracion_formal ?? []).map((senal, i) => (
            <PhaseReportEvidenceCard key={`formal-${i}`} title="Estructuracion formal" subtitle={senal.nivel_evidencia} description={senal.descripcion} references={senal.documentos_fuente} tone="blue" mapText={mapText} mapReference={mapReference} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DocumentacionDiagnosisView({ diagnosis }: { diagnosis: AgentDiagnosis }) {
  const d = diagnosis;
  const lookup = buildDocumentLookup(d);
  const mapText = (value: unknown) => textWithDocumentNames(value, lookup);
  const mapReference = (value: unknown) => referenceName(value, lookup);
  const dimensiones = [
    ['inicio', 'Inicio'],
    ['planeacion', 'Planeacion'],
    ['ejecucion', 'Ejecucion'],
    ['monitoreo_control', 'Monitoreo y control'],
    ['cierre', 'Cierre'],
  ] as const;

  return (
    <div className="space-y-5">
      <section className="rounded-[1.5rem] overflow-hidden border border-[#5454e9]/20 bg-white" style={{ boxShadow: '0 20px 55px -34px rgba(84,84,233,0.5)' }}>
        <div className="bg-[#5454e9] p-6 text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-white/12 border border-white/20 flex items-center justify-center">
              <Sparkles size={18} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/70" style={{ fontWeight: 800 }}>Agente 1 - Gestion documental</p>
              <h2 className="text-[22px] tracking-tight" style={{ fontWeight: 850 }}>Diagnostico documental consolidado</h2>
            </div>
          </div>
          <p className="text-white/88 text-[14px] leading-relaxed max-w-4xl">{mapText(d.summary)}</p>
        </div>
      </section>

      <PhaseReportSection title="Cobertura documental" eyebrow="Indicadores" icon={<BarChart3 size={18} />} tone="blue">
        <CoverageChart diagnosis={d} />
      </PhaseReportSection>

      <PhaseReportSection title="Contexto y organizacion" eyebrow="Lectura base" icon={<Globe size={18} />} tone="slate">
        <ContextPanel diagnosis={d} />
      </PhaseReportSection>

      <PhaseReportSection title="Calidad documental" eyebrow="Evaluacion" icon={<Gauge size={18} />} tone="purple">
        <QualityPanel diagnosis={d} lookup={lookup} />
      </PhaseReportSection>

      <PhaseReportSection title="Cobertura ciclo de vida" eyebrow="Flujo documental" icon={<Layers3 size={18} />} tone="amber">
        <LifecycleCoverage diagnosis={d} lookup={lookup} />
      </PhaseReportSection>

      <PhaseReportSection title="Inventario y cobertura documental" eyebrow="D01 - D16" icon={<FileSearch size={18} />} tone="slate">
        <InventoryTable diagnosis={d} />
      </PhaseReportSection>

      <PhaseReportSection title="Insights clave" eyebrow="Lectura ejecutiva" icon={<Sparkles size={18} />} tone="green">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {normalizeList(d.key_insights).map((insight, i) => <InsightCard key={i} item={insight} index={i} lookup={lookup} />)}
        </div>
      </PhaseReportSection>

      <PhaseReportSection title="Hallazgos documentales" eyebrow="Patrones e incoherencias" icon={<CheckCircle2 size={18} />} tone="blue">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {(d.hallazgos_documentales?.length ? d.hallazgos_documentales : [{ tipo: EMPTY_VALUE, nombre: EMPTY_VALUE, descripcion: EMPTY_VALUE, documentos_fuente: [] }]).map((hallazgo, i) => (
            <PhaseReportEvidenceCard key={i} title={hallazgo.nombre} subtitle={hallazgo.tipo} description={hallazgo.descripcion} references={hallazgo.documentos_fuente} badge={hallazgo.tipo} tone={i % 2 === 0 ? 'blue' : 'purple'} mapText={mapText} mapReference={mapReference} />
          ))}
        </div>
      </PhaseReportSection>

      <PhaseReportSection title="Brechas documentales" eyebrow="Riesgos de informacion" icon={<ShieldAlert size={18} />} tone="orange">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {(d.brechas_documentales?.length ? d.brechas_documentales : [{ id: EMPTY_VALUE, impacto: EMPTY_VALUE, descripcion: EMPTY_VALUE, dimension_o_area: EMPTY_VALUE, evidencia_o_ausencia: EMPTY_VALUE, documentos_fuente_o_ausentes: [] }]).map((brecha, i) => (
            <PhaseReportEvidenceCard
              key={i}
              title={`${valueOrEmpty(brecha.id)} - ${valueOrEmpty(brecha.dimension_o_area)}`}
              subtitle={brecha.impacto}
              description={`${mapText(brecha.descripcion)} ${mapText(brecha.evidencia_o_ausencia)}`}
              references={brecha.documentos_fuente_o_ausentes}
              badge={brecha.impacto}
              tone={levelTone(brecha.impacto)}
              mapText={mapText}
              mapReference={mapReference}
            />
          ))}
        </div>
      </PhaseReportSection>

      <PhaseReportSection title="Dimensiones de gestion de proyectos" eyebrow="Capacidades observadas" icon={<Target size={18} />} tone="green">
        <div className="grid grid-cols-1 gap-3">
          {dimensiones.map(([key, label], i) => (
            <DimensionCard key={key} label={label} dim={d.dimensiones_gestion_proyectos?.[key]} lookup={lookup} index={i} />
          ))}
        </div>
      </PhaseReportSection>

      <PhaseReportSection title="Artefactos identificados" eyebrow="Documentos operativos" icon={<ClipboardList size={18} />} tone="amber">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {(d.artefactos_identificados?.length ? d.artefactos_identificados : []).map((artefacto, i) => (
            <ArtefactoCard key={i} artefacto={artefacto} index={i} lookup={lookup} />
          ))}
          {(!d.artefactos_identificados || d.artefactos_identificados.length === 0) && (
            <p className="text-neutral-500 text-sm italic col-span-2">No se identificaron artefactos especificos.</p>
          )}
        </div>
      </PhaseReportSection>

      <PhaseReportSection title="Herramientas identificadas" eyebrow="Ecosistema tecnologico" icon={<Wrench size={18} />} tone="blue">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {(d.herramientas_identificadas?.length ? d.herramientas_identificadas : []).map((herramienta, i) => (
            <HerramientaCard key={i} herramienta={herramienta} index={i} lookup={lookup} />
          ))}
          {(!d.herramientas_identificadas || d.herramientas_identificadas.length === 0) && (
            <p className="text-neutral-500 text-sm italic col-span-2">No se identificaron herramientas especificas.</p>
          )}
        </div>
      </PhaseReportSection>

      <PhaseReportSection title="Gobernanza documental" eyebrow="Reglas y estandares" icon={<HardDrive size={18} />} tone="slate">
        <GobernanzaPanel diagnosis={d} lookup={lookup} />
      </PhaseReportSection>

      <PhaseReportSection title="Limitaciones" eyebrow="Confiabilidad del diagnostico" icon={<AlertCircle size={18} />} tone="red">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(d.limitaciones?.length ? d.limitaciones : [{ tipo: EMPTY_VALUE, descripcion: EMPTY_VALUE, impacto_confiabilidad: EMPTY_VALUE, dimensiones_afectadas: [] }]).map((lim, i) => {
            const tone = levelTone(lim.impacto_confiabilidad);
            return (
              <div key={i} className="rounded-2xl border border-[#ef4444]/20 bg-[#ef4444]/[0.08] p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <p className="text-neutral-950 text-[15px]" style={{ fontWeight: 800 }}>{valueOrEmpty(lim.tipo).replace(/_/g, ' ')}</p>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] ${phaseReportToneStyles[tone].soft} ${phaseReportToneStyles[tone].text}`} style={{ fontWeight: 800 }}>{valueOrEmpty(lim.impacto_confiabilidad)}</span>
                </div>
                <p className="text-neutral-700 text-[13px] leading-relaxed">{mapText(lim.descripcion)}</p>
                <div className="mt-3"><PhaseReportBadgeList items={lim.dimensiones_afectadas} tone="red" /></div>
              </div>
            );
          })}
        </div>
      </PhaseReportSection>

      <PhaseReportSection title="Recomendaciones" eyebrow="Acciones sugeridas" icon={<Lightbulb size={18} />} tone="green">
        <Recommendations items={d.recommendations} lookup={lookup} />
      </PhaseReportSection>

      <PhaseReportSection title="Insumos para agente 4" eyebrow="Transferencia analitica" icon={<MessageSquare size={18} />} tone="purple">
        <Agent4Inputs diagnosis={d} lookup={lookup} />
      </PhaseReportSection>
    </div>
  );
}
