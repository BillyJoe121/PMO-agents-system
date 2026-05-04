import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, X, Download, Archive,
  Loader2, AlertTriangle, CheckCircle2, Send,
  FileSpreadsheet, FileText, File,
} from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../../context/AppContext';
import NextPhaseButton from './_shared/NextPhaseButton';

interface Artifact {
  id: string;
  name: string;
  description: string;
  format: 'xlsx' | 'docx' | 'pdf';
  size: string;
}

const MOCK_ARTIFACTS: Artifact[] = [
  {
    id: 'a1',
    name: 'Matriz_Riesgos_V1.xlsx',
    description: 'Identificación, evaluación y plan de respuesta a riesgos del proyecto.',
    format: 'xlsx',
    size: '48 KB',
  },
  {
    id: 'a2',
    name: 'Acta_Constitución_PMO.docx',
    description: 'Documento formal de constitución y mandato de la PMO.',
    format: 'docx',
    size: '72 KB',
  },
  {
    id: 'a3',
    name: 'Dashboard_KPIs.xlsx',
    description: 'Plantilla de métricas e indicadores de desempeño del portafolio.',
    format: 'xlsx',
    size: '124 KB',
  },
  {
    id: 'a4',
    name: 'Plantilla_Kickoff.docx',
    description: 'Agenda y acta estándar para sesiones de inicio de proyecto.',
    format: 'docx',
    size: '36 KB',
  },
  {
    id: 'a5',
    name: 'Cronograma_Maestra.xlsx',
    description: 'Plantilla de cronograma maestro con hitos y dependencias.',
    format: 'xlsx',
    size: '89 KB',
  },
  {
    id: 'a6',
    name: 'Informe_Ejecutivo.pdf',
    description: 'Reporte ejecutivo consolidado del diagnóstico PMO para la alta dirección.',
    format: 'pdf',
    size: '215 KB',
  },
];

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
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div className="w-12 h-12 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
          <FormatIcon format={artifact.format} />
        </div>
        <FormatBadge format={artifact.format} />
      </div>
      <div className="flex-1">
        <p className="text-gray-800 text-sm leading-snug mb-1" style={{ fontWeight: 600 }}>{artifact.name}</p>
        <p className="text-gray-500 text-xs leading-relaxed">{artifact.description}</p>
        <p className="text-gray-400 text-xs mt-1">{artifact.size}</p>
      </div>
      <div className="flex gap-2 pt-1 border-t border-gray-100">
        <button
          className="flex-1 py-2 rounded-lg text-white text-xs flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity"
          style={{ background: '#030213', fontWeight: 500 }}
        >
          <Download size={12} />Descargar
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
              Esta acción cerrará el proyecto y notificará al cliente. Esta operación es irreversible.
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
                style={{ background: '#0a0a0a', fontWeight: 600 }}
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
  // useParams() extrae :id desde la URL dinámica (TODO: usar para queries a Supabase)
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getProject, updatePhaseStatus } = useApp();

  const project = getProject(projectId!);
  const phase = project?.phases.find(p => p.number === 8);

  const [showConfirm, setShowConfirm] = useState(false);
  const [isSending, setIsSending] = useState(false);

  if (!project || !phase) return null;

  const isCompleted = phase.status === 'completado';



  const handleFinalApprove = async () => {
    setIsSending(true);
    // TODO: Mutación real -> update public.proyectos set fecha_cierre = NOW()
    // Timeout eliminado por petición del usuario
    setIsSending(false);
    setShowConfirm(false);
    updatePhaseStatus(projectId!, 8, 'completado',
      'Paquete de artefactos aprobado. Proyecto cerrado exitosamente. Todos los entregables han sido entregados al cliente.');
    toast.success('¡Proyecto completado!', { description: 'Todos los artefactos fueron aprobados.' });
    navigate(`/dashboard/project/${projectId}`);
  };

  const renderProcessing = () => (
    <AnimatePresence>
      {isSending && (
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
          <h2 className="text-neutral-900 tracking-tight mb-2" style={{ fontWeight: 500, fontSize: '1.25rem', letterSpacing: '-0.01em' }}>
            Finalizando proyecto
          </h2>
          <p className="text-neutral-500 text-[13px] mt-2 max-w-sm text-center">
            El Agente 8 está consolidando el paquete final de artefactos y registrando el cierre del proyecto...
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {renderProcessing()}
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm flex-shrink-0">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/dashboard/project/${projectId}`)}
              className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm transition-colors group"
            >
              <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
              {project.companyName}
            </button>
            <span className="text-gray-300">/</span>
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs"
                style={{ background: '#030213', fontWeight: 700 }}
              >8</div>
              <span className="text-gray-700 text-sm" style={{ fontWeight: 600 }}>Artefactos y Entrega Final</span>
            </div>
          </div>
          <button
            onClick={() => navigate(`/dashboard/project/${projectId}`)}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Split Layout */}
      <div className="flex-1 grid grid-cols-12 overflow-hidden" style={{ height: 'calc(100vh - 65px)' }}>

        {/* ── Left: Artifacts Grid (col-span-8) ── */}
        <div className="col-span-8 flex flex-col border-r border-gray-200 overflow-hidden">
          {/* Section Header */}
          <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between flex-shrink-0">
            <div>
              <h2 className="text-gray-900" style={{ fontWeight: 700 }}>Paquete de Artefactos de Soporte</h2>
              <p className="text-gray-500 text-sm mt-0.5">{MOCK_ARTIFACTS.length} archivos generados por el Agente 8</p>
            </div>
            <button
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm hover:opacity-90 transition-opacity"
              style={{ background: '#030213', fontWeight: 600 }}
            >
              <Archive size={15} />
              Descargar todos (ZIP)
            </button>
          </div>

          {/* Artifacts Grid Container */}
          <div className="flex-1 overflow-y-auto p-6 relative">
            {/* RF-F8-03 */}
            <div className="grid grid-cols-3 gap-4">
              {MOCK_ARTIFACTS.map(artifact => (
                <ArtifactCard key={artifact.id} artifact={artifact} />
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: Iteration & Close (col-span-4) ── */}
        <div className="col-span-4 flex flex-col bg-white overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <div>
              <h3 className="text-gray-700 text-sm mb-1" style={{ fontWeight: 600 }}>Estado del Paquete</h3>
              <div className="flex items-center gap-2 text-sm mt-2">
                <div className="w-2 h-2 rounded-full bg-neutral-900 flex-shrink-0" />
                <span className="text-gray-600">{MOCK_ARTIFACTS.length} artefactos generados</span>
              </div>
              <div className="flex items-center gap-2 text-sm mt-1.5">
                <div className="w-2 h-2 rounded-full bg-neutral-400 flex-shrink-0" />
                <span className="text-gray-600">Agente 8 completó el procesamiento</span>
              </div>
            </div>

            <hr className="border-gray-100" />

            {/* Adjustment Panel Removed */}
            {!isCompleted && (
              <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle size={18} className="text-neutral-400 flex-shrink-0 mt-0.5" />
                <p className="text-neutral-500 text-xs leading-relaxed">
                  Revise los documentos generados. Al completar el proyecto, el paquete de artefactos se congelará y se entregará al cliente.
                </p>
              </div>
            )}
            {isCompleted && (
              <div className="bg-neutral-900 border border-neutral-900 rounded-xl p-4 flex items-center gap-3">
                <CheckCircle2 size={18} className="text-white flex-shrink-0" />
                <div>
                  <p className="text-white text-sm" style={{ fontWeight: 600 }}>Proyecto completado</p>
                  <p className="text-neutral-400 text-xs mt-0.5">Todos los artefactos fueron aprobados.</p>
                </div>
              </div>
            )}
          </div>

          {/* Sticky Bottom: Final Approve */}
          {!isCompleted && (
            <div className="p-4 border-t border-gray-100 bg-white flex-shrink-0">
              <motion.button
                whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                onClick={() => setShowConfirm(true)}
                className="w-full py-4 rounded-xl text-white flex flex-col items-center justify-center shadow-lg"
                style={{ background: '#0a0a0a', fontWeight: 700 }}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={18} />
                  Aprobar Artefactos y Completar Proyecto
                </div>
                <span className="text-neutral-400 text-xs mt-0.5" style={{ fontWeight: 400 }}>
                  Esta acción es irreversible
                </span>
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