import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, X, Download, Archive,
  Loader2, AlertTriangle, CheckCircle2, Send, RotateCcw,
  FileSpreadsheet, FileText, File,
} from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import NextPhaseButton from './_shared/NextPhaseButton';
import PhaseHeader from './_shared/PhaseHeader';
import { LoadingRouteState, MissingProjectState } from '../layout/RouteState';

interface Artifact {
  id: string;
  name: string;
  description: string;
  format: 'xlsx' | 'docx' | 'pdf';
  size: string;
  category: 'recommended' | 'other';
  downloadUrl?: string; // URL completa de descarga (firmada o pública)
}

const ARTIFACT_ALIASES: Record<string, string[]> = {
  'Acta de constitución': ['acta de constitucion', 'acta de constitución', 'project charter', 'charter'],
  'Enunciado de alcance': ['enunciado de alcance', 'declaracion del alcance', 'declaración del alcance', 'scope statement'],
  'Matriz de riesgos': ['matriz de riesgos', 'registro de riesgos'],
  'Formato de presupuesto': ['formato de presupuesto', 'presupuesto'],
  'Matriz de interesados': ['matriz de interesados', 'registro de interesados', 'matriz de stakeholders'],
  'Informe de avance e indicadores': ['informe de avance e indicadores', 'informe de avance', 'indicadores', 'status report'],
  'Formato de comunicaciones': ['formato de comunicaciones', 'plan de comunicaciones', 'matriz de comunicaciones'],
  'Formato de incidencias': ['formato de incidencias', 'registro de incidencias', 'issue log'],
  'Formato de entregables y validación': ['formato de entregables y validacion', 'formato de entregables y validación', 'validacion de entregables', 'validación de entregables'],
  'Encuesta de satisfacción': ['encuesta de satisfaccion', 'encuesta de satisfacción'],
  'Matriz de lecciones aprendidas': ['matriz de lecciones aprendidas', 'lecciones aprendidas'],
};

const MASTER_ARTIFACTS: Artifact[] = [
  {
    id: 'caso-negocio',
    name: 'Caso de negocio',
    description: 'Justificación estratégica, beneficios esperados y viabilidad de la iniciativa.',
    format: 'docx',
    size: 'Pendiente',
    category: 'other',
  },
  {
    id: 'acta-constitucion',
    name: 'Acta de constitución',
    description: 'Documento formal que autoriza la existencia del proyecto.',
    format: 'xlsx',
    size: '85 KB',
    category: 'other',
    downloadUrl: 'https://iubexbqhmlerfkjrkoro.supabase.co/storage/v1/object/sign/plantillas_artefactos_pmo/F&I%20-%20PLANTILLA-%20ACTA%20DE%20CONSTITUCION.xlsx?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV85ZjE5MmVlNC1hY2Q4LTRlZDAtYmIyMy1jYjNkMDIwODFkODIiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJwbGFudGlsbGFzX2FydGVmYWN0b3NfcG1vL0YmSSAtIFBMQU5USUxMQS0gQUNUQSBERSBDT05TVElUVUNJT04ueGxzeCIsImlhdCI6MTc3ODEzNjYwOCwiZXhwIjoyMDkzNDk2NjA4fQ.6dW7xgLxuNSMCUZT1uUCTIc4kHxXU4LZi3jYjM3N1rU'
  },
  {
    id: 'matriz-interesados',
    name: 'Matriz de interesados',
    description: 'Registro de personas u organizaciones afectadas por el proyecto.',
    format: 'xlsx',
    size: '64 KB',
    category: 'other',
    downloadUrl: 'https://iubexbqhmlerfkjrkoro.supabase.co/storage/v1/object/sign/plantillas_artefactos_pmo/F&I%20-%20PLANTILLA%20-%20MATRIZ%20DE%20INTERESADOS.xlsx?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV85ZjE5MmVlNC1hY2Q4LTRlZDAtYmIyMy1jYjNkMDIwODFkODIiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJwbGFudGlsbGFzX2FydGVmYWN0b3NfcG1vL0YmSSAtIFBMQU5USUxMQSAtIE1BVFJJWiBERSBJTlRFUkVTQURPUy54bHN4IiwiaWF0IjoxNzc4MTM2NDY5LCJleHAiOjIwOTM0OTY0Njl9.fys42HxXmRafJZeWlbDTgPx4hdgrOpYhvO1D-8_xExM'
  },
  {
    id: 'enunciado-alcance',
    name: 'Enunciado de alcance',
    description: 'Descripción detallada de los entregables y límites del proyecto.',
    format: 'xlsx',
    size: '95 KB',
    category: 'other',
    downloadUrl: 'https://iubexbqhmlerfkjrkoro.supabase.co/storage/v1/object/sign/plantillas_artefactos_pmo/F&I-%20PLANTILLA%20-%20DECLARACION%20DEL%20ALCANCE.xlsx?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV85ZjE5MmVlNC1hY2Q4LTRlZDAtYmIyMy1jYjNkMDIwODFkODIiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJwbGFudGlsbGFzX2FydGVmYWN0b3NfcG1vL0YmSS0gUExBTlRJTExBIC0gREVDTEFSQUNJT04gREVMIEFMQ0FOQ0UueGxzeCIsImlhdCI6MTc3ODEzNjY0OCwiZXhwIjoyMDkzNDk2NjQ4fQ.tlYp4SQ6FAe3X8h3wwh8xRZx76AWsqa1hmUneleTGzY'
  },
  {
    id: 'cronograma',
    name: 'Cronograma (Sin formato)',
    description: 'Estructura para planificar actividades, hitos, duraciones y dependencias.',
    format: 'xlsx',
    size: 'Pendiente',
    category: 'other',
  },
  {
    id: 'presupuesto',
    name: 'Formato de presupuesto',
    description: 'Control de costos, egresos y proyecciones financieras.',
    format: 'xlsx',
    size: '98 KB',
    category: 'other',
    downloadUrl: 'https://iubexbqhmlerfkjrkoro.supabase.co/storage/v1/object/sign/plantillas_artefactos_pmo/F&I-%20PLANTILLA%20PRESUPUESTO.xlsx?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV85ZjE5MmVlNC1hY2Q4LTRlZDAtYmIyMy1jYjNkMDIwODFkODIiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJwbGFudGlsbGFzX2FydGVmYWN0b3NfcG1vL0YmSS0gUExBTlRJTExBIFBSRVNVUFVFU1RPLnhsc3giLCJpYXQiOjE3NzgxMzY2NjEsImV4cCI6MjA5MzQ5NjY2MX0.sAmYPCnkCmKy_0_NhiQMYwDi_UqENlc-bKsOF1dBbqw'
  },
  {
    id: 'matriz-riesgos',
    name: 'Matriz de riesgos',
    description: 'Identificación, análisis y plan de respuesta a riesgos.',
    format: 'xlsx',
    size: '76 KB',
    category: 'other',
    downloadUrl: 'https://iubexbqhmlerfkjrkoro.supabase.co/storage/v1/object/sign/plantillas_artefactos_pmo/F&I%20-%20PLANTILLA%20-%20MATRIZ%20DE%20RIESGOS.xlsx?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV85ZjE5MmVlNC1hY2Q4LTRlZDAtYmIyMy1jYjNkMDIwODFkODIiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJwbGFudGlsbGFzX2FydGVmYWN0b3NfcG1vL0YmSSAtIFBMQU5USUxMQSAtIE1BVFJJWiBERSBSSUVTR09TLnhsc3giLCJpYXQiOjE3NzgxMzY1MDUsImV4cCI6MjA5MzQ5NjUwNX0.aVHeApBTwNd2ukx7dgsxdJv1yvwTbxuDlPPx-O0Smvo'
  },
  {
    id: 'comunicaciones',
    name: 'Formato de comunicaciones',
    description: 'Plan para definir audiencias, mensajes, canales, frecuencia y responsables.',
    format: 'xlsx',
    size: 'Pendiente',
    category: 'other',
  },
  {
    id: 'incidencias',
    name: 'Formato de incidencias',
    description: 'Registro y seguimiento de problemas, impedimentos y acciones correctivas.',
    format: 'xlsx',
    size: 'Pendiente',
    category: 'other',
  },
  {
    id: 'entregables-validacion',
    name: 'Formato de entregables y validación',
    description: 'Control de entregables, criterios de aceptación y validación formal.',
    format: 'xlsx',
    size: 'Pendiente',
    category: 'other',
  },
  {
    id: 'informe-avance-indicadores',
    name: 'Informe de avance e indicadores',
    description: 'Reporte de estado, desempeño, KPIs, avances, alertas y decisiones.',
    format: 'xlsx',
    size: 'Pendiente',
    category: 'other',
  },
  {
    id: 'acta-cierre',
    name: 'Acta de cierre',
    description: 'Documento de cierre formal, aceptación final y liberación administrativa.',
    format: 'docx',
    size: 'Pendiente',
    category: 'other',
  },
  {
    id: 'encuesta-satisfaccion',
    name: 'Encuesta de satisfacción',
    description: 'Instrumento para recoger retroalimentación del cliente y usuarios clave.',
    format: 'xlsx',
    size: 'Pendiente',
    category: 'other',
  },
  {
    id: 'lecciones-aprendidas',
    name: 'Matriz de lecciones aprendidas',
    description: 'Registro de aprendizajes, causas, recomendaciones y acciones de mejora.',
    format: 'xlsx',
    size: 'Pendiente',
    category: 'other',
  },
];

const ACTIVE_ARTIFACT_ALIASES: Record<string, string[]> = {
  'Acta de constitucion': ['acta de constitucion', 'acta de constitución', 'project charter', 'charter'],
  'Acta de reunion': ['acta de reunion', 'acta de reunión', 'minuta', 'minutes', 'meeting minutes'],
  'Declaracion de alcance': ['declaracion de alcance', 'declaración de alcance', 'declaracion del alcance', 'scope statement'],
  'Enunciado del alcance': ['enunciado de alcance', 'enunciado del alcance', 'scope statement'],
  'Registro de riesgos': ['matriz de riesgos', 'registro de riesgos', 'risk register'],
  'Presupuesto general': ['formato de presupuesto', 'presupuesto', 'budget', 'control de costos'],
  'Presupuesto por hito': ['presupuesto por hito', 'presupuesto por hitos', 'costos por hito'],
  'Matriz de interesados': ['matriz de interesados', 'registro de interesados', 'matriz de stakeholders'],
  'Informe de avance': ['informe de avance e indicadores', 'informe de avance', 'indicadores', 'status report'],
  'Registro de incidencias': ['formato de incidencias', 'registro de incidencias', 'issue log'],
  'Control de entregables': ['formato de entregables y validacion', 'control de entregables', 'validacion de entregables', 'validación de entregables'],
  'Lecciones aprendidas': ['matriz de lecciones aprendidas', 'lecciones aprendidas', 'lessons learned'],
  'Registro de cambios': ['registro de cambios', 'control de cambios', 'change log'],
  'Matriz de requisitos': ['matriz de requisitos', 'requirements matrix', 'requisitos'],
  'Plan de direccion de proyectos': ['plan de direccion de proyectos', 'plan de dirección de proyectos', 'project management plan'],
};

const ACTIVE_ARTIFACTS: Artifact[] = [
  {
    id: 'abastecimiento',
    name: 'Abastecimiento',
    description: 'Plantilla para gestionar compras, proveedores, adquisiciones y seguimiento de abastecimiento del proyecto.',
    format: 'xlsx',
    size: 'XLSX',
    category: 'other',
    downloadUrl: 'https://iubexbqhmlerfkjrkoro.supabase.co/storage/v1/object/public/plantillas_artefactos_pmo/Abastecimiento.xlsx',
  },
  {
    id: 'acta-constitucion',
    name: 'Acta de constitucion',
    description: 'Documento formal que autoriza la existencia del proyecto.',
    format: 'xlsx',
    size: 'XLSX',
    category: 'other',
    downloadUrl: 'https://iubexbqhmlerfkjrkoro.supabase.co/storage/v1/object/public/plantillas_artefactos_pmo/Acta%20de%20constitucion.xlsx',
  },
  {
    id: 'acta-reunion',
    name: 'Acta de reunion',
    description: 'Registro de acuerdos, decisiones, compromisos y responsables definidos en sesiones de trabajo.',
    format: 'docx',
    size: 'DOCX',
    category: 'other',
    downloadUrl: 'https://iubexbqhmlerfkjrkoro.supabase.co/storage/v1/object/public/plantillas_artefactos_pmo/Acta%20de%20Reunion.docx',
  },
  {
    id: 'caso-negocio',
    name: 'Caso de negocio',
    description: 'Justificacion estrategica, beneficios esperados y viabilidad de la iniciativa.',
    format: 'xlsx',
    size: 'XLSX',
    category: 'other',
    downloadUrl: 'https://iubexbqhmlerfkjrkoro.supabase.co/storage/v1/object/public/plantillas_artefactos_pmo/Caso%20de%20negocio.xlsx',
  },
  {
    id: 'control-entregables',
    name: 'Control de entregables',
    description: 'Control de entregables, responsables, criterios de aceptacion, validacion y estado de aprobacion.',
    format: 'xlsx',
    size: 'XLSX',
    category: 'other',
    downloadUrl: 'https://iubexbqhmlerfkjrkoro.supabase.co/storage/v1/object/public/plantillas_artefactos_pmo/Control%20de%20entregables.xlsx',
  },
  {
    id: 'cronograma',
    name: 'Cronograma',
    description: 'Estructura para planificar actividades, hitos, duraciones y dependencias.',
    format: 'xlsx',
    size: 'XLSX',
    category: 'other',
    downloadUrl: 'https://iubexbqhmlerfkjrkoro.supabase.co/storage/v1/object/public/plantillas_artefactos_pmo/Cronograma.xlsx',
  },
  {
    id: 'declaracion-alcance',
    name: 'Declaracion de alcance',
    description: 'Declaracion formal del alcance, entregables, restricciones, supuestos y exclusiones del proyecto.',
    format: 'xlsx',
    size: 'XLSX',
    category: 'other',
    downloadUrl: 'https://iubexbqhmlerfkjrkoro.supabase.co/storage/v1/object/public/plantillas_artefactos_pmo/Declaracion%20de%20alcance.xlsx',
  },
  {
    id: 'enunciado-alcance',
    name: 'Enunciado del alcance',
    description: 'Descripcion detallada de entregables, limites, criterios de aceptacion y trabajo incluido.',
    format: 'xlsx',
    size: 'XLSX',
    category: 'other',
    downloadUrl: 'https://iubexbqhmlerfkjrkoro.supabase.co/storage/v1/object/public/plantillas_artefactos_pmo/Enunciado%20del%20alcance.xlsx',
  },
  {
    id: 'informe-avance',
    name: 'Informe de avance',
    description: 'Reporte de estado, desempeno, avances, indicadores, alertas y decisiones del proyecto.',
    format: 'xlsx',
    size: 'XLSX',
    category: 'other',
    downloadUrl: 'https://iubexbqhmlerfkjrkoro.supabase.co/storage/v1/object/public/plantillas_artefactos_pmo/Informe%20de%20avance.xlsx',
  },
  {
    id: 'lecciones-aprendidas',
    name: 'Lecciones aprendidas',
    description: 'Registro de aprendizajes, causas, recomendaciones y acciones de mejora continua.',
    format: 'xlsx',
    size: 'XLSX',
    category: 'other',
    downloadUrl: 'https://iubexbqhmlerfkjrkoro.supabase.co/storage/v1/object/public/plantillas_artefactos_pmo/Lecciones%20aprendidas.xlsx',
  },
  {
    id: 'matriz-interesados',
    name: 'Matriz de interesados',
    description: 'Registro de personas u organizaciones afectadas por el proyecto.',
    format: 'xlsx',
    size: 'XLSX',
    category: 'other',
    downloadUrl: 'https://iubexbqhmlerfkjrkoro.supabase.co/storage/v1/object/public/plantillas_artefactos_pmo/Matriz%20de%20Interesados.xlsx',
  },
  {
    id: 'matriz-requisitos',
    name: 'Matriz de requisitos',
    description: 'Matriz para documentar requisitos, fuente, prioridad, trazabilidad y estado de cumplimiento.',
    format: 'xlsx',
    size: 'XLSX',
    category: 'other',
    downloadUrl: 'https://iubexbqhmlerfkjrkoro.supabase.co/storage/v1/object/public/plantillas_artefactos_pmo/Matriz%20de%20requisitos.xlsx',
  },
  {
    id: 'plan-direccion-proyectos',
    name: 'Plan de direccion de proyectos',
    description: 'Documento integrador para dirigir, ejecutar, monitorear, controlar y cerrar el proyecto.',
    format: 'xlsx',
    size: 'XLSX',
    category: 'other',
    downloadUrl: 'https://iubexbqhmlerfkjrkoro.supabase.co/storage/v1/object/public/plantillas_artefactos_pmo/Plan%20de%20direccion%20de%20proyectos.xlsx',
  },
  {
    id: 'presupuesto-general',
    name: 'Presupuesto general',
    description: 'Control general de costos, rubros, egresos, estimaciones y seguimiento presupuestal.',
    format: 'xlsx',
    size: 'XLSX',
    category: 'other',
    downloadUrl: 'https://iubexbqhmlerfkjrkoro.supabase.co/storage/v1/object/public/plantillas_artefactos_pmo/Presupuesto%20general.xlsx',
  },
  {
    id: 'presupuesto-hito',
    name: 'Presupuesto por hito',
    description: 'Planificacion y control de costos asociados a hitos o entregables del proyecto.',
    format: 'xlsx',
    size: 'XLSX',
    category: 'other',
    downloadUrl: 'https://iubexbqhmlerfkjrkoro.supabase.co/storage/v1/object/public/plantillas_artefactos_pmo/Presupuesto%20por%20hito.xlsx',
  },
  {
    id: 'registro-cambios',
    name: 'Registro de cambios',
    description: 'Registro para documentar solicitudes de cambio, analisis de impacto, aprobaciones y estado.',
    format: 'xlsx',
    size: 'XLSX',
    category: 'other',
    downloadUrl: 'https://iubexbqhmlerfkjrkoro.supabase.co/storage/v1/object/public/plantillas_artefactos_pmo/Registro%20de%20Cambios.xlsx',
  },
  {
    id: 'registro-incidencias',
    name: 'Registro de incidencias',
    description: 'Registro y seguimiento de problemas, impedimentos, acciones correctivas y responsables.',
    format: 'xlsx',
    size: 'XLSX',
    category: 'other',
    downloadUrl: 'https://iubexbqhmlerfkjrkoro.supabase.co/storage/v1/object/public/plantillas_artefactos_pmo/Registro%20de%20incidencias.xlsx',
  },
  {
    id: 'registro-riesgos',
    name: 'Registro de riesgos',
    description: 'Identificacion, analisis, priorizacion, respuesta y seguimiento de riesgos del proyecto.',
    format: 'xlsx',
    size: 'XLSX',
    category: 'other',
    downloadUrl: 'https://iubexbqhmlerfkjrkoro.supabase.co/storage/v1/object/public/plantillas_artefactos_pmo/Registro%20de%20Riesgos.xlsx',
  },
];

function normalizeArtifactName(value: string): string {
  return value
    .replace(/\.(docx|xlsx|pdf)$/i, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function artifactMatchKeys(name: string): string[] {
  return [name, ...(ACTIVE_ARTIFACT_ALIASES[name] ?? ARTIFACT_ALIASES[name] ?? [])].map(normalizeArtifactName);
}

function mapArtifactsFromAgentData(agentData: any): Artifact[] {
  const data = agentData?._current ?? agentData?.data ?? agentData?.diagnosis ?? agentData;
  const recommended = Array.isArray(data?.artefactos_recomendados)
    ? data.artefactos_recomendados
    : [];
  const recommendedSet = new Set(recommended.map((name: string) => normalizeArtifactName(name)));

  return ACTIVE_ARTIFACTS.map(artifact => {
    const isRecommended = artifactMatchKeys(artifact.name).some(key => recommendedSet.has(key));

    return {
      ...artifact,
      category: isRecommended ? 'recommended' as const : 'other' as const,
    };
  });
}



function hasUsableAgent8Result(agentData: any): boolean {
  const data = agentData?._current ?? agentData?.data ?? agentData?.diagnosis ?? agentData;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  if (data._processing || data._error) return false;
  if (data.metadata?.status === 'processing' || data.metadata?.status === 'procesando' || data.metadata?.status === 'error') return false;
  return Array.isArray(data?.artefactos_recomendados) || Array.isArray(data?.otros_artefactos);
}

function FormatIcon({ format }: { format: Artifact['format'] }) {
  if (format === 'xlsx') return <FileSpreadsheet size={28} className="text-neutral-900" />;
  if (format === 'docx') return <FileText size={28} className="text-neutral-700" />;
  return <File size={28} className="text-neutral-500" />;
}

function FormatBadge({ format }: { format: Artifact['format'] }) {
  const styles = {
    xlsx: 'bg-neutral-900 text-white',
    docx: 'bg-neutral-200 text-neutral-800',
    pdf: 'bg-neutral-100 text-neutral-600',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full uppercase tracking-wide ${styles[format]}`} style={{ fontWeight: 600 }}>
      {format}
    </span>
  );
}

function ArtifactCard({ artifact }: { artifact: Artifact }) {
  const isRecommended = artifact.category === 'recommended';
  const buttonColor = isRecommended ? '#4cb979' : '#5454e9';

  return (
    <motion.div
      whileHover={{ y: -4, shadow: '0 12px 30px -10px rgba(0,0,0,0.08)' }}
      className="bg-white rounded-2xl border border-neutral-200/60 p-5 flex flex-col gap-4 hover:border-neutral-300 transition-all h-full"
      style={{ boxShadow: '0 2px 8px -2px rgba(0,0,0,0.02)' }}
    >
      <div className="flex items-start justify-between">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${isRecommended ? 'bg-emerald-50' : 'bg-blue-50'}`}>
          <FormatIcon format={artifact.format} />
        </div>
        <FormatBadge format={artifact.format} />
      </div>
      <div className="flex-1">
        <p className="text-neutral-900 text-[15px] leading-tight mb-1.5" style={{ fontWeight: 700 }}>{artifact.name}</p>
        <p className="text-neutral-500 text-[12px] leading-relaxed line-clamp-3 mb-2">{artifact.description}</p>
        <div className="flex items-center gap-2 mt-auto">
          <span className="text-neutral-400 text-[10px] tabular-nums" style={{ fontWeight: 500 }}>{artifact.size}</span>
        </div>
      </div>
      <div className="pt-2">
        <button
          onClick={() => {
            if (!artifact.downloadUrl) {
              toast.error('Enlace de descarga no disponible aún.');
              return;
            }
            window.open(artifact.downloadUrl, '_blank');
          }}
          className="w-full py-2.5 rounded-xl text-white text-[13px] flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition-all shadow-sm"
          style={{ background: buttonColor, fontWeight: 700 }}
        >
          <Download size={14} />
          Descargar
        </button>
      </div>
    </motion.div>
  );
}

function ConfirmFinalModal({
  open, onCancel, onConfirm, isLoading,
}: { open: boolean; onCancel: () => void; onConfirm: () => void; isLoading: boolean }) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onCancel} className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10 p-6"
          >
            <div className="flex items-start gap-4 mb-5">
              <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-neutral-600" />
              </div>
              <div>
                <h3 className="text-gray-900 mb-2" style={{ fontWeight: 600 }}>Cierre definitivo del proyecto</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Está a punto de aprobar los artefactos y cerrar definitivamente el proyecto.
                  <strong className="text-gray-700"> No se permitirán más modificaciones.</strong> ¿Desea proceder?
                </p>
              </div>
            </div>
            <div className="bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 mb-5 text-xs text-neutral-600 leading-relaxed">
              Esta acción cerrará el proyecto.
            </div>
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-gray-600 text-sm hover:bg-gray-50 transition-colors"
                style={{ fontWeight: 500 }}
              >
                Cancelar
              </button>
              <button
                onClick={onConfirm}
                disabled={isLoading}
                className="flex-1 py-2.5 rounded-xl text-white text-sm flex items-center justify-center gap-2 disabled:opacity-70"
                style={{ background: '#5454e9', fontWeight: 600 }}
              >
                {isLoading
                  ? <><Loader2 size={14} className="animate-spin" /> Cerrando...</>
                  : <><Send size={14} /> Sí, completar proyecto</>}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default function ArtefactosView() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getProject, updatePhaseStatus, isLoading } = useApp();

  const project = getProject(projectId!);
  const phase = project?.phases.find(p => p.number === 8);

  const [showConfirm, setShowConfirm] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [hasLoadedArtifacts, setHasLoadedArtifacts] = useState(false);
  const [realArtifacts, setRealArtifacts] = useState<Artifact[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startPolling = useCallback(() => {
    setHasLoadedArtifacts(false);
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const { data } = await supabase
        .from('fases_estado')
        .select('datos_consolidados, estado_visual')
        .eq('proyecto_id', projectId)
        .eq('numero_fase', 8)
        .single();

      if (data?.estado_visual === 'disponible' && data.datos_consolidados) {
        if (!hasUsableAgent8Result(data.datos_consolidados)) return;
        clearInterval(pollRef.current!);
        pollRef.current = null;
        const res = data.datos_consolidados as any;
        setRealArtifacts(mapArtifactsFromAgentData(res));
        setHasLoadedArtifacts(true);
        setIsReprocessing(false);
        updatePhaseStatus(projectId!, 8, 'disponible');
        toast.success('¡Catálogo de artefactos listo!', { description: 'El Agente 8 ha finalizado las recomendaciones.' });
      } else if (data?.estado_visual === 'error') {
        clearInterval(pollRef.current!);
        pollRef.current = null;
        setHasLoadedArtifacts(true);
        setIsReprocessing(false);
        updatePhaseStatus(projectId!, 8, 'disponible');
        toast.error('Error en el Agente 8', { description: 'No se pudo generar el catálogo. Intente aprobar la fase 7 nuevamente.' });
      }
    }, 4000);
  }, [projectId, updatePhaseStatus]);

  const loadPhase8State = useCallback(async () => {
    if (!projectId) return;

    const { data } = await supabase
      .from('fases_estado')
      .select('datos_consolidados, estado_visual')
      .eq('proyecto_id', projectId)
      .eq('numero_fase', 8)
      .single();

    if (data?.estado_visual === 'procesando') {
      updatePhaseStatus(projectId, 8, 'procesando');
      setHasLoadedArtifacts(false);
      setRealArtifacts([]);
      startPolling();
      return;
    }

    if (data?.datos_consolidados && data.estado_visual !== 'error' && hasUsableAgent8Result(data.datos_consolidados)) {
      setRealArtifacts(mapArtifactsFromAgentData(data.datos_consolidados));
      setHasLoadedArtifacts(true);
      updatePhaseStatus(projectId, 8, data.estado_visual === 'completado' ? 'completado' : 'disponible');
      return;
    }

    setRealArtifacts(ACTIVE_ARTIFACTS.map(a => ({ ...a, category: 'other' })));
    setHasLoadedArtifacts(true);
  }, [projectId, startPolling, updatePhaseStatus]);

  const handleReprocessAgent8 = useCallback(async () => {
    if (!projectId) return;

    setIsReprocessing(true);
    setHasLoadedArtifacts(false);
    setRealArtifacts([]);
    updatePhaseStatus(projectId, 8, 'procesando');
    startPolling();

    try {
      const { data, error } = await supabase.functions.invoke('pmo-agent-artefactos', {
        body: { projectId },
      });

      if (error) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setIsReprocessing(false);
        updatePhaseStatus(projectId, 8, 'disponible');
        toast.error('No se pudo iniciar el Agente 8', { description: error.message });
        return;
      }

      if ((data as any)?.data) {
        if (!hasUsableAgent8Result((data as any).data)) return;
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setRealArtifacts(mapArtifactsFromAgentData((data as any).data));
        setIsReprocessing(false);
        setHasLoadedArtifacts(true);
        updatePhaseStatus(projectId, 8, 'disponible');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      setIsReprocessing(false);
      updatePhaseStatus(projectId, 8, 'disponible');
      toast.error('No se pudo iniciar el Agente 8', { description: message });
    }
  }, [projectId, startPolling, updatePhaseStatus]);

  useEffect(() => {
    if (phase?.status === 'procesando') {
      setHasLoadedArtifacts(false);
      setRealArtifacts([]);
      startPolling();
    } else if (phase?.agentData && hasUsableAgent8Result(phase.agentData)) {
      const res = phase.agentData as any;
      setRealArtifacts(mapArtifactsFromAgentData(res));
      setHasLoadedArtifacts(true);
    } else if (!hasLoadedArtifacts) {
      loadPhase8State();
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [phase?.status, phase?.agentData, hasLoadedArtifacts, startPolling, loadPhase8State]);

  if (!project || !phase) {
    return isLoading
      ? <LoadingRouteState message="Cargando el proyecto y el catalogo de artefactos..." />
      : <MissingProjectState title="Fase no disponible" description="No pudimos encontrar el proyecto o la fase de artefactos." />;
  }

  const isCompleted = phase.status === 'completado';

  const handleFinalApprove = async () => {
    setIsSending(true);
    // TODO: Mutación real -> update public.proyectos set fecha_cierre = NOW()
    setIsSending(false);
    setShowConfirm(false);
    updatePhaseStatus(projectId!, 8, 'completado',
      'Paquete de artefactos aprobado. Proyecto cerrado exitosamente. Todos los entregables han sido entregados al cliente.');
    toast.success('¡Proyecto completado!', { description: 'Todos los artefactos fueron aprobados.' });
    navigate(`/dashboard/project/${projectId}`);
  };

  const isProcessing = phase.status === 'procesando' || isSending || isReprocessing;

  const renderProcessing = () => (
    <AnimatePresence>
      {isProcessing && (
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
            {isSending ? 'Finalizando' : 'Fase 8 · Agente'}
          </p>
          <h2 className="text-neutral-900 tracking-tight mb-2" style={{ fontWeight: 500, fontSize: '1.25rem', letterSpacing: '-0.01em' }}>
            {isSending ? 'Cerrando proyecto' : 'Generando catálogo de artefactos'}
          </h2>
          <p className="text-[#5454e9] text-[13px] mt-2 max-w-sm text-center">
            {isSending
              ? 'Consolidando el paquete final y registrando el cierre...'
              : 'El Agente está analizando la Guía Metodológica para recomendar los mejores artefactos para su PMO...'}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const recommendedArtifacts = realArtifacts.filter(a => a.category === 'recommended');
  const otherArtifacts = realArtifacts.filter(a => a.category === 'other');
  const hasEmptyRecommendations = hasLoadedArtifacts && !isProcessing && recommendedArtifacts.length === 0;

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {renderProcessing()}

      <PhaseHeader
        projectId={projectId!}
        companyName={project.companyName}
        phaseNumber={8}
        phaseName="Consolidación de artefactos"
        eyebrow={isCompleted ? 'Completada' : undefined}
        onReprocessed={handleReprocessAgent8}
      />

      {/* Split Layout */}
      <div className="flex-1 min-h-0 grid grid-cols-12 overflow-hidden">

        {/* ── Left: Artifacts Grid (col-span-8) ── */}
        <div className="col-span-8 flex flex-col border-r border-gray-200 overflow-hidden">
          <div className="bg-white border-b border-neutral-100 px-8 py-5 flex items-center justify-between flex-shrink-0">
            <div>
              <h2 className="text-neutral-900 text-2xl tracking-tight" style={{ fontWeight: 850 }}>Catálogo de Entregables</h2>
              <p className="text-neutral-500 text-[13px] mt-1">Se han generado {ACTIVE_ARTIFACTS.length} plantillas personalizadas para su gestión operativa.</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                className="flex items-center gap-2.5 px-6 py-3 rounded-2xl text-white text-sm hover:brightness-110 active:scale-[0.98] transition-all shadow-md shadow-blue-500/10"
                style={{ background: '#5454e9', fontWeight: 800 }}
              >
                <Archive size={16} />
                Paquete Completo (ZIP)
              </button>
            </div>
          </div>

          {/* Artifacts Grid Container */}
          <div className="flex-1 min-h-0 overflow-y-auto p-8 relative [&::-webkit-scrollbar]:w-[8px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-primary [&::-webkit-scrollbar-thumb]:rounded-full">
            {!hasLoadedArtifacts && (
              <div className="h-full min-h-[420px] flex flex-col items-center justify-center text-center">
                <Loader2 size={22} className="text-neutral-700 animate-spin mb-4" strokeWidth={1.75} />
                <h3 className="text-neutral-900 text-sm" style={{ fontWeight: 600 }}>Clasificando artefactos</h3>
                <p className="text-neutral-500 text-[13px] mt-2 max-w-sm">
                  El Agente 8 está terminando de cruzar la guía metodológica con la lista maestra de entregables.
                </p>
              </div>
            )}

            {hasLoadedArtifacts && (
              <div className="max-w-5xl mx-auto space-y-10">

                {/* Recommended Section */}
                <section>
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
                        <CheckCircle2 size={18} strokeWidth={2.5} />
                      </div>
                      <div>
                        <h3 className="text-neutral-900 text-[20px] tracking-tight" style={{ fontWeight: 850 }}>Artefactos Recomendados</h3>
                        <p className="text-neutral-500 text-[13px]">El Agente 8 sugiere priorizar estos entregables según su diagnóstico.</p>
                      </div>
                    </div>
                    <div className="h-[2px] flex-1 mx-8 bg-neutral-100/60 hidden md:block" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {recommendedArtifacts.map(artifact => (
                      <ArtifactCard key={artifact.id} artifact={artifact} />
                    ))}
                  </div>
                  {hasEmptyRecommendations && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 leading-relaxed">
                      El Agente 8 no dejó recomendaciones utilizables para esta guía. Puede reprocesar el análisis desde el panel derecho para volver a clasificar los artefactos con la guía metodológica aprobada.
                    </div>
                  )}
                </section>

                {/* Others Section */}
                <section className="pb-16">
                  <div className="flex items-center justify-between mb-8 pt-8 border-t border-neutral-100">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-neutral-900 text-white flex items-center justify-center shadow-lg shadow-neutral-900/10">
                        <Archive size={18} strokeWidth={2.5} />
                      </div>
                      <div>
                        <h3 className="text-neutral-900 text-[20px] tracking-tight" style={{ fontWeight: 850 }}>Otros Artefactos</h3>
                        <p className="text-neutral-500 text-[13px]">Biblioteca complementaria de soporte operativo y metodológico.</p>
                      </div>
                    </div>
                    <div className="h-[2px] flex-1 mx-8 bg-neutral-100/60 hidden md:block" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {otherArtifacts.map(artifact => (
                      <ArtifactCard key={artifact.id} artifact={artifact} />
                    ))}
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Iteration & Close (col-span-4) ── */}
        <div className="col-span-4 flex flex-col bg-neutral-50/50 border-l border-neutral-200 overflow-hidden">
          <div className="flex-1 min-h-0 p-6 space-y-5">
            <div className="bg-white rounded-2xl border border-neutral-200/60 p-5 shadow-sm">
              <h3 className="text-neutral-900 text-[13px] mb-3 uppercase tracking-wider" style={{ fontWeight: 800 }}>Resumen del Paquete</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 border border-emerald-100/50">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-neutral-700 text-sm font-semibold">Recomendados</span>
                  </div>
                  <span className="text-emerald-700 font-bold tabular-nums">{recommendedArtifacts.length}</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-100 border border-neutral-200/50">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-neutral-400" />
                    <span className="text-neutral-600 text-sm">Complementarios</span>
                  </div>
                  <span className="text-neutral-500 font-bold tabular-nums">{otherArtifacts.length}</span>
                </div>
              </div>
            </div>

            <hr className="border-neutral-200/60" />

            {!isCompleted && (
              <div className="bg-amber-50 border border-amber-200/50 rounded-2xl p-5 flex items-start gap-3 shadow-sm shadow-amber-900/5">
                <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center flex-shrink-0 border border-amber-200/60 shadow-sm">
                  <AlertTriangle size={18} className="text-amber-500" />
                </div>
                <div>
                  <p className="text-amber-950 text-sm mb-1.5" style={{ fontWeight: 700 }}>Revisión Final de Entrega</p>
                  <p className="text-amber-800/80 text-[12px] leading-relaxed font-medium">
                    Al proceder con la aprobación, el sistema consolidará la documentación final y registrará el cierre administrativo del proyecto de implementación de la PMO.
                  </p>
                </div>
              </div>
            )}

            {isCompleted && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex items-center gap-5 shadow-2xl shadow-neutral-900/40">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/20">
                  <CheckCircle2 size={24} strokeWidth={2.5} />
                </div>
                <div>
                  <p className="text-white text-base tracking-tight" style={{ fontWeight: 800 }}>Proyecto Finalizado</p>
                  <p className="text-neutral-400 text-xs mt-0.5">Cierre registrado el {new Date().toLocaleDateString()}</p>
                </div>
              </div>
            )}
          </div>

          {!isCompleted && (
            <div className="px-6 pb-6 pt-4 bg-white flex-shrink-0">
              <motion.button
                whileHover={{ scale: 1.01, brightness: 1.1 }} whileTap={{ scale: 0.98 }}
                onClick={() => setShowConfirm(true)}
                className="w-full max-w-sm mx-auto py-3.5 rounded-xl text-white flex items-center justify-center gap-2.5 shadow-lg shadow-blue-600/15 group relative overflow-hidden"
                style={{ background: '#5454e9', fontWeight: 850 }}
              >
                <div className="flex items-center gap-2.5 text-[14px] relative z-10">
                  <Send size={16} />
                  Aprobar y Cerrar Proyecto
                </div>
                <span className="hidden">
                  Acción definitiva e irreversible
                </span>
                <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.button>
            </div>
          )}
        </div>
      </div>

      <ConfirmFinalModal
        open={showConfirm}
        onCancel={() => setShowConfirm(false)}
        onConfirm={handleFinalApprove}
        isLoading={isSending}
      />

      <NextPhaseButton projectId={projectId!} prevPhase={7} show={isCompleted} />
    </div>
  );
}
