import { ReactNode, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, X, Square, Loader2, RotateCcw, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useApp } from '../../../context/AppContext';
import { useCancelAgent } from '../../../hooks/useCancelAgent';

interface PhaseHeaderProps {
  projectId: string;
  companyName: string;
  phaseNumber: number;
  phaseName: string;
  eyebrow?: string;
  rightSlot?: ReactNode;
  /** Callback opcional: se llama cuando el usuario cancela exitosamente el agente */
  onCancelled?: () => void;
  /** Callback opcional: se llama cuando el usuario reprocesa la fase desde el header */
  onReprocessed?: () => void;
}

export default function PhaseHeader({
  projectId,
  companyName,
  phaseNumber,
  phaseName,
  eyebrow,
  rightSlot,
  onCancelled,
  onReprocessed,
}: PhaseHeaderProps) {
  const navigate = useNavigate();
  const { getProject, reprocessPhase } = useApp();
  const { cancel, isCancelling } = useCancelAgent(projectId, phaseNumber);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showReprocess, setShowReprocess] = useState(false);

  const project = getProject(projectId);
  const phase = project?.phases.find(p => p.number === phaseNumber);
  const isProcessing = phase?.status === 'procesando';

  const handleCancelClick = () => {
    if (isCancelling) return;
    setShowConfirm(true);
  };

  const handleConfirmCancel = async () => {
    setShowConfirm(false);
    const ok = await cancel();
    if (ok && onCancelled) onCancelled();
  };

  const handleConfirmReprocess = async () => {
    setShowReprocess(false);
    if (onReprocessed) {
      // Let the caller own the full reprocess flow (avoids DB race conditions)
      onReprocessed();
    } else {
      await reprocessPhase(projectId, phaseNumber);
      toast.success(`Fase ${phaseNumber} reiniciada exitosamente`);
    }
  };

  return (
    <>
      <div className="sticky top-0 z-20 bg-[#fafaf9]/85 backdrop-blur-md border-b border-neutral-200/60 print:relative print:bg-transparent print:border-none print:pt-8 print:pb-4">
        <div className="max-w-[1100px] mx-auto px-10 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* Back button */}
            <button
              onClick={() => navigate(`/dashboard/project/${projectId}`)}
              className="group inline-flex items-center gap-2 pl-2 pr-3.5 py-1.5 rounded-full bg-white border border-neutral-200/80 text-neutral-700 hover:border-neutral-300 hover:text-neutral-900 text-[13px] transition-all flex-shrink-0"
              style={{ fontWeight: 500, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
            >
              <span className="w-5 h-5 rounded-full bg-neutral-100 group-hover:bg-neutral-200 flex items-center justify-center transition-colors">
                <ArrowLeft size={11} strokeWidth={2} className="transition-transform group-hover:-translate-x-px" />
              </span>
              <span className="truncate max-w-[160px]">{companyName}</span>
            </button>

            <span className="text-neutral-300">/</span>

            <div className="flex items-center gap-2 min-w-0">
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-md text-white text-[10px] tabular-nums flex-shrink-0 ${phase?.status === 'completado' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.2)]' : 'bg-neutral-900'}`} style={{ fontWeight: 600 }}>
                {phaseNumber}
              </span>
              <span className="text-neutral-900 text-[13px] truncate" style={{ fontWeight: 500 }}>
                {phaseName}
              </span>
              {eyebrow && (
                <>
                  <span className="text-neutral-300">·</span>
                  <span className="text-[11px] uppercase tracking-[0.14em] text-neutral-400" style={{ fontWeight: 500 }}>
                    {eyebrow}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 print:hidden">
            {rightSlot}

            {/* ── Botón Ver JSON (automático si hay agentData) ── */}
            <AnimatePresence>
              {phase?.agentData && Object.keys(phase.agentData).length > 0 && (
                <motion.button
                  key="json-btn"
                  initial={{ opacity: 0, scale: 0.9, width: 0 }}
                  animate={{ opacity: 1, scale: 1, width: 'auto' }}
                  exit={{ opacity: 0, scale: 0.9, width: 0 }}
                  transition={{ duration: 0.18 }}
                  onClick={() => {
                    const json = JSON.stringify(phase.agentData, null, 2);
                    const win = window.open('', '_blank');
                    if (!win) return;
                    win.document.write(`<!DOCTYPE html><html lang="es"><head>
                      <meta charset="UTF-8"/>
                      <title>Agente ${phaseNumber} \u00b7 JSON raw</title>
                      <style>
                        *{box-sizing:border-box;margin:0;padding:0}
                        body{background:#0d1117;color:#e6edf3;font-family:'SF Mono','Fira Code',monospace;font-size:13px;line-height:1.65;padding:32px}
                        h1{font-size:11px;font-weight:600;color:#7d8590;text-transform:uppercase;letter-spacing:.12em;margin-bottom:20px}
                        pre{white-space:pre-wrap;word-break:break-word}
                        .k{color:#79c0ff}.s{color:#a5d6ff}.n{color:#f2cc60}.b{color:#ff7b72}
                      </style>
                    </head><body>
                      <h1>Agente ${phaseNumber} &mdash; ${phaseName} &mdash; Respuesta JSON</h1>
                      <pre>${json
                        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                        .replace(/"([^"]+)":/g,'<span class="k">"$1"</span>:')
                        .replace(/: "([^"]*)"/g,': <span class="s">"$1"</span>')
                        .replace(/: (-?\\d+\\.?\\d*)/g,': <span class="n">$1</span>')
                        .replace(/: (true|false|null)/g,': <span class="b">$1</span>')
                      }</pre>
                    </body></html>`);
                    win.document.close();
                  }}
                  title="Ver respuesta raw del agente en JSON"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[13px] border bg-white border-neutral-200 hover:border-neutral-300 text-neutral-600 hover:text-neutral-900 transition-all flex-shrink-0 overflow-hidden font-mono"
                  style={{ fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.04)', whiteSpace: 'nowrap', letterSpacing: '-0.02em' }}
                >
                  {'{ }'}
                </motion.button>
              )}
            </AnimatePresence>

            {/* ── Botón Descargar PDF ── */}
            <AnimatePresence>
              {(phase?.status === 'completado' || (phase?.agentData && Object.keys(phase.agentData).length > 0)) && (
                <motion.button
                  key="download-btn"
                  initial={{ opacity: 0, scale: 0.9, width: 0 }}
                  animate={{ opacity: 1, scale: 1, width: 'auto' }}
                  exit={{ opacity: 0, scale: 0.9, width: 0 }}
                  transition={{ duration: 0.18 }}
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[13px] border bg-neutral-900 border-neutral-900 text-white hover:bg-neutral-800 transition-all flex-shrink-0 overflow-hidden"
                  style={{ fontWeight: 500, boxShadow: '0 1px 2px rgba(0,0,0,0.04)', whiteSpace: 'nowrap' }}
                >
                  <Download size={13} strokeWidth={2} />
                  Descargar PDF
                </motion.button>
              )}
            </AnimatePresence>

            {/* ── Botón reprocesar agente (solo visible cuando está completado o error o si se provee callback) ── */}
            <AnimatePresence>
              {(phase?.status === 'completado' || phase?.status === 'error' || onReprocessed) && phase?.status !== 'procesando' && (
                <motion.button
                  key="reprocess-btn"
                  initial={{ opacity: 0, scale: 0.9, width: 0 }}
                  animate={{ opacity: 1, scale: 1, width: 'auto' }}
                  exit={{ opacity: 0, scale: 0.9, width: 0 }}
                  transition={{ duration: 0.18 }}
                  onClick={() => setShowReprocess(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[13px] border bg-white border-neutral-200 hover:border-neutral-300 text-neutral-600 hover:text-neutral-900 transition-all flex-shrink-0 overflow-hidden"
                  style={{ fontWeight: 500, boxShadow: '0 1px 2px rgba(0,0,0,0.04)', whiteSpace: 'nowrap' }}
                >
                  <RotateCcw size={13} strokeWidth={2} />
                  Reprocesar
                </motion.button>
              )}
            </AnimatePresence>

            {/* ── Botón cancelar agente (solo visible cuando está procesando) ── */}
            <AnimatePresence>
              {isProcessing && (
                <motion.button
                  key="cancel-btn"
                  initial={{ opacity: 0, scale: 0.9, width: 0 }}
                  animate={{ opacity: 1, scale: 1, width: 'auto' }}
                  exit={{ opacity: 0, scale: 0.9, width: 0 }}
                  transition={{ duration: 0.18 }}
                  onClick={handleCancelClick}
                  disabled={isCancelling}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] border transition-all overflow-hidden"
                  style={{
                    fontWeight: 500,
                    background: isCancelling ? '#fef2f2' : '#fff',
                    borderColor: '#fecaca',
                    color: isCancelling ? '#ef4444' : '#dc2626',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isCancelling ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : (
                    <Square size={10} fill="currentColor" strokeWidth={0} />
                  )}
                  {isCancelling ? 'Cancelando…' : 'Detener agente'}
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Phase sub-navigation navbar ── */}
        {project && (
          <div className="border-t border-neutral-200/60 select-none overflow-x-auto bg-white/40 backdrop-blur-sm print:hidden">
            <div className="max-w-[1100px] mx-auto px-10 py-2 flex items-center justify-between gap-1.5 min-w-[700px]">
              {project.phases.map((p) => {
                const isCurrent = p.number === phaseNumber;
                const isCompleted = p.status === 'completado';
                const isBlocked = p.status === 'bloqueado';

                let itemClass = "";
                if (isCurrent) {
                  itemClass = "bg-neutral-900 border-neutral-900 text-white font-medium shadow-sm hover:bg-neutral-800";
                } else if (isCompleted) {
                  itemClass = "bg-neutral-100/60 border-neutral-200/60 text-neutral-900 hover:bg-neutral-100 hover:border-neutral-300";
                } else if (isBlocked) {
                  itemClass = "bg-transparent border-transparent text-neutral-400 cursor-not-allowed opacity-60";
                } else {
                  itemClass = "bg-white/50 border-neutral-200/60 text-neutral-600 hover:bg-white hover:border-neutral-300";
                }

                return (
                  <button
                    key={p.number}
                    disabled={isBlocked}
                    onClick={() => navigate(`/dashboard/project/${projectId}/phase/${p.number}`)}
                    className={`flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-[11px] text-left transition-all truncate flex-shrink-0 ${itemClass}`}
                    style={{ fontWeight: isCurrent ? 500 : 400 }}
                  >
                    <span
                      className={`flex items-center justify-center w-4 h-4 rounded text-[9px] tabular-nums font-semibold flex-shrink-0 ${
                        isCurrent
                          ? "bg-white/20 text-white"
                          : isCompleted
                          ? "bg-emerald-500 text-white shadow-[0_0_8px_rgba(16,185,129,0.2)]"
                          : "bg-neutral-100 text-neutral-600"
                      }`}
                    >
                      {p.number}
                    </span>
                    <span className="truncate flex-1 leading-tight">
                      {p.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Modal de confirmación ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showConfirm && (
          <>
            {/* Backdrop */}
            <motion.div
              key="cancel-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
              onClick={() => setShowConfirm(false)}
            />

            {/* Dialog */}
            <motion.div
              key="cancel-dialog"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.18 }}
              className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl border border-neutral-200 p-7 w-full max-w-sm"
              style={{ boxShadow: '0 20px 60px -12px rgba(0,0,0,0.18), 0 4px 16px -4px rgba(0,0,0,0.08)' }}
            >
              {/* Ícono */}
              <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center mb-5">
                <Square size={16} fill="#ef4444" strokeWidth={0} className="text-red-500" />
              </div>

              <h3 className="text-neutral-900 mb-2" style={{ fontWeight: 600, fontSize: '1rem' }}>
                ¿Detener el Agente {phaseNumber}?
              </h3>
              <p className="text-neutral-500 text-[13px] leading-relaxed mb-6">
                El agente se está ejecutando ahora. Al detenerlo, el análisis se cancelará y la fase volverá al estado <strong>disponible</strong>. Los datos procesados hasta este momento <strong>no se guardarán</strong>.
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-neutral-700 text-[13px] hover:bg-neutral-50 transition-colors"
                  style={{ fontWeight: 500 }}
                >
                  Continuar
                </button>
                <button
                  onClick={handleConfirmCancel}
                  className="flex-1 py-2.5 rounded-xl text-white text-[13px] transition-colors"
                  style={{ background: '#dc2626', fontWeight: 500 }}
                >
                  Sí, detener
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Modal de confirmación de Reprocesar ───────────────────────────── */}
      <AnimatePresence>
        {showReprocess && (
          <>
            <motion.div
              key="reprocess-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
              onClick={() => setShowReprocess(false)}
            />

            <motion.div
              key="reprocess-dialog"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.18 }}
              className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl border border-neutral-200 p-7 w-full max-w-sm"
              style={{ boxShadow: '0 20px 60px -12px rgba(0,0,0,0.18), 0 4px 16px -4px rgba(0,0,0,0.08)' }}
            >
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center mb-5">
                <RotateCcw size={16} className="text-amber-600" strokeWidth={1.75} />
              </div>

              <h3 className="text-neutral-900 mb-2" style={{ fontWeight: 600, fontSize: '1rem' }}>
                ¿Reiniciar la Fase {phaseNumber}?
              </h3>
              <p className="text-neutral-500 text-[13px] leading-relaxed mb-6">
                ¿Estás seguro de que deseas reiniciar la <strong>Fase {phaseNumber}: {phaseName}</strong>? Se restablecerán los datos de esta fase y todas las fases posteriores serán bloqueadas nuevamente.
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowReprocess(false)}
                  className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-neutral-700 text-[13px] hover:bg-neutral-50 transition-colors"
                  style={{ fontWeight: 500 }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmReprocess}
                  className="flex-1 py-2.5 rounded-xl text-white text-[13px] transition-colors"
                  style={{ background: '#0a0a0a', fontWeight: 500 }}
                >
                  Sí, reiniciar
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}