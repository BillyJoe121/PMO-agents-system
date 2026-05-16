import type { ElementType } from 'react';
import { BookOpen, Shield, BarChart2, Users, Lightbulb, GitCommitHorizontal } from 'lucide-react';
import type { DocVersion, GuideChapter, GuideSubsection } from './types';

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

function hasUsableGuidePayload(raw: any) {
  return normalizeChapters(unwrapGuidePayload(raw)).length > 0;
}

function versionsFromPayload(raw: any): DocVersion[] {
  if (Array.isArray(raw?._versions) && raw._versions.length > 0) {
    return raw._versions
      .filter((version: any) => hasUsableGuidePayload(version.data))
      .map((version: any, index: number) => ({
        number: Number(version.number ?? index + 1),
        generatedAt: String(version.generatedAt ?? version.generated_at ?? raw?._generated_at ?? new Date().toISOString()),
        comment: version.comment ?? undefined,
        status: version.status === 'revisado' ? 'revisado' : 'generado',
        data: version.data,
      }));
  }

  if (!raw) return [];
  if (!hasUsableGuidePayload(raw)) return [];
  return [{
    number: Number(raw?._latest_version ?? 1),
    generatedAt: String(raw?._generated_at ?? new Date().toISOString()),
    comment: raw?._last_comment ?? undefined,
    status: Number(raw?._latest_version ?? 1) > 1 ? 'revisado' : 'generado',
    data: unwrapGuidePayload(raw),
  }];
}

export { hasUsableGuidePayload, normalizeChapters, unwrapGuidePayload, versionsFromPayload };
