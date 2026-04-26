import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, X, Download, Archive, Eye, RotateCcw,
  Loader2, AlertTriangle, CheckCircle2, Send,
  FileSpreadsheet, FileText, File,
} from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../../context/AppContext';

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
  if (format === 'xlsx') return <FileSpreadsheet size={28} className="text-green-600" />;
  if (format === 'docx') return <FileText size={28} className="text-blue-600" />;
  return <File size={28} className="text-red-500" />;
}

function FormatBadge({ format }: { format: Artifact['format'] }) {
  const styles = {
    xlsx: 'bg-green-100 text-green-700',
    docx: 'bg-blue-100 text-blue-700',
    pdf: 'bg-red-100 text-red-600',
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
        <button className="flex-1 py-2 border border-gray-200 rounded-lg text-gray-600 text-xs flex items-center justify-center gap-1.5 hover:bg-gray-50 transition-colors" style={{ fontWeight: 500 }}>
          <Eye size={12} />Visualizar
        </button>
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
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-amber-600" />
              </div>
              <div>
                <h3 className="text-gray-900 mb-2" style={{ fontWeight: 600 }}>Cierre definitivo del proyecto</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Está a punto de aprobar los artefactos y cerrar definitivamente el proyecto.
                  <strong className="text-gray-700"> No se permitirán más modificaciones.</strong> ¿Desea proceder?
                </p>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 text-xs text-amber-700 leading-relaxed">
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
                style={{ background: '#16a34a', fontWeight: 600 }}
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

  const [adjustmentText, setAdjustmentText] = useState('');
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSending, setIsSending] = useState(false);

  if (!project || !phase) return null;

  const isCompleted = phase.status === 'completado';

  const handleReprocess = async () => {
    if (!adjustmentText.trim()) {
      toast.error('Ingresa los ajustes antes de re-procesar.');
      return;
    }
    setIsReprocessing(true);
    // RF-F8-04: Implementar JSZip o llamar a endpoint de Supabase Edge Function para comprimir
    await new Promise(r => setTimeout(r, 3000));
    setIsReprocessing(false);
    setAdjustmentText('');
    toast.success('Artefactos re-procesados', { description: 'El Agente 8 actualizó el paquete.' });
  };

  const handleFinalApprove = async () => {
    setIsSending(true);
    // TODO: Mutación final -> update public.proyectos set fecha_cierre = NOW()
    await new Promise(r => setTimeout(r, 1000));
    setIsSending(false);
    setShowConfirm(false);
    updatePhaseStatus(projectId!, 8, 'completado',
      'Paquete de artefactos aprobado. Proyecto cerrado exitosamente. Todos los entregables han sido entregados al cliente.');
    toast.success('¡Proyecto completado!', { description: 'Todos los artefactos fueron aprobados.' });
    navigate(`/dashboard/project/${projectId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
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

          {/* Reprocessing Overlay */}
          <div className="flex-1 overflow-y-auto p-6 relative">
            <AnimatePresence>
              {isReprocessing && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 z-10 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center"
                >
                  <Loader2 size={36} className="text-blue-500 animate-spin mb-3" />
                  <p className="text-gray-700 text-sm" style={{ fontWeight: 600 }}>Regenerando artefactos...</p>
                  <p className="text-gray-400 text-xs mt-1">El Agente 8 está procesando los cambios</p>
                </motion.div>
              )}
            </AnimatePresence>

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
                <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                <span className="text-gray-600">{MOCK_ARTIFACTS.length} artefactos generados</span>
              </div>
              <div className="flex items-center gap-2 text-sm mt-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                <span className="text-gray-600">Agente 8 completó el procesamiento</span>
              </div>
            </div>

            <hr className="border-gray-100" />

            {/* Adjustment Panel */}
            {!isCompleted ? (
              <div>
                <label className="block text-gray-700 text-sm mb-2" style={{ fontWeight: 600 }}>
                  Solicitar ajustes al paquete de artefactos
                </label>
                <textarea
                  value={adjustmentText}
                  onChange={e => setAdjustmentText(e.target.value)}
                  placeholder="Ej: Actualiza la Matriz de Riesgos para incluir riesgos de ciberseguridad en la columna de impacto..."
                  rows={7}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition-all resize-none leading-relaxed bg-white"
                />
                <p className="text-gray-400 text-xs text-right mt-1">{adjustmentText.length} caracteres</p>
                <motion.button
                  whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                  onClick={handleReprocess}
                  disabled={isReprocessing}
                  className="w-full mt-3 py-3 rounded-xl text-white text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ background: '#d97706', fontWeight: 600 }}
                >
                  {isReprocessing
                    ? <><Loader2 size={14} className="animate-spin" /> Procesando...</>
                    : <><RotateCcw size={14} /> Re-procesar Artefactos</>}
                </motion.button>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                <CheckCircle2 size={18} className="text-green-600 flex-shrink-0" />
                <div>
                  <p className="text-green-800 text-sm" style={{ fontWeight: 600 }}>Proyecto completado</p>
                  <p className="text-green-600 text-xs mt-0.5">Todos los artefactos fueron aprobados.</p>
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
                className="w-full py-4 rounded-xl text-white flex flex-col items-center justify-center"
                style={{ background: '#16a34a', fontWeight: 700 }}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={18} />
                  Aprobar Artefactos y Completar Proyecto
                </div>
                <span className="text-green-200 text-xs mt-0.5" style={{ fontWeight: 400 }}>
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
    </div>
  );
}