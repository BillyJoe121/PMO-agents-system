import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { ArrowLeft, Calendar, BarChart3, ExternalLink, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../../context/AppContext';
import PhaseItem from './PhaseItem';

export default function ProjectDetailView() {
  // useParams() extrae :id desde la URL dinámica (TODO: usar para queries a Supabase)
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getProject, updatePhaseStatus } = useApp();
  const [showSummary, setShowSummary] = useState(false);

  // TODO: Realtime - subscribe to 'fases_estado' where proyecto_id = current_id
  // RF-PROJ-04: Mapear el ENUM de base de datos 'public.estado_fase' a las props del componente
  // TODO: fetch('fases_estado').order('numero_fase', { ascending: true })
  // TODO: Lógica de cliente para determinar disponibilidad basado en el array de estados

  const project = getProject(projectId!);

  if (!project) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Proyecto no encontrado.</p>
          <button onClick={() => navigate('/dashboard')} className="text-blue-600 hover:underline text-sm">
            ← Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  const completedCount = project.phases.filter(p => p.status === 'completado').length;
  const totalPhases = project.phases.length;
  const progressPct = (completedCount / totalPhases) * 100;

  const handleRetry = (phaseNumber: number) => {
    updatePhaseStatus(project.id, phaseNumber, 'disponible');
    toast.info(`Fase ${phaseNumber} reiniciada`, { description: 'Los datos han sido restablecidos.' });
  };

  const completedPhasesWithDiagnosis = project.phases.filter(
    p => p.status === 'completado' && p.agentDiagnosis
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm">
        <div className="max-w-4xl mx-auto px-8 py-5">
          {/* Navigation */}
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm mb-4 transition-colors group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            Volver al inicio
          </button>

          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs text-gray-400 uppercase tracking-wider" style={{ fontWeight: 600 }}>
                  {project.companyName}
                </span>
              </div>
              <h2 className="text-gray-900" style={{ fontWeight: 700, fontSize: '1.375rem' }}>
                {project.projectName}
              </h2>

              {/* Meta */}
              <div className="flex items-center gap-5 mt-2">
                <div className="flex items-center gap-1.5 text-gray-400">
                  <Calendar size={13} />
                  <span className="text-xs">
                    Inicio: {new Date(project.startDate).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                </div>
                {/* Auditores asignados */}
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {project.auditors.slice(0, 5).map(a => (
                      <div
                        key={a.id}
                        title={a.name}
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white border-2 border-white"
                        style={{ background: a.color, fontSize: '0.6rem', fontWeight: 700 }}
                      >
                        {a.initials}
                      </div>
                    ))}
                  </div>
                  <span className="text-xs text-gray-400">
                    {project.auditors.length} auditor{project.auditors.length !== 1 ? 'es' : ''}
                  </span>
                </div>
              </div>
            </div>

            {/* RF-PROJ-09: Ver Resumen */}
            <button
              onClick={() => navigate(`/dashboard/project/${projectId}/summary`)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm border border-gray-200 bg-white hover:border-zinc-400 hover:text-zinc-800 transition-all flex-shrink-0"
              style={{ fontWeight: 500 }}
            >
              <BarChart3 size={15} />
              Ver Resumen
            </button>
          </div>

          {/* Progress bar */}
          <div className="mt-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600" style={{ fontWeight: 500 }}>
                {completedCount === totalPhases ? (
                  <span className="text-green-600 flex items-center gap-1.5">
                    <CheckCircle2 size={15} /> ¡Proyecto completado!
                  </span>
                ) : (
                  `${completedCount} de ${totalPhases} fases completadas`
                )}
              </span>
              <span className="text-sm" style={{ fontWeight: 600, color: '#030213' }}>
                {Math.round(progressPct)}%
              </span>
            </div>
            <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className="h-full rounded-full transition-all"
                style={{ background: progressPct === 100 ? '#16a34a' : 'linear-gradient(90deg, #030213, #1a1a3e)' }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-8">
        {/* Summary Panel */}
        {showSummary && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-gray-900" style={{ fontWeight: 600 }}>Resumen del Diagnóstico</h3>
              <button onClick={() => setShowSummary(false)} className="text-gray-400 hover:text-gray-600 text-sm">Cerrar</button>
            </div>
            {completedPhasesWithDiagnosis.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-400 text-sm">
                Aún no hay diagnósticos completados para mostrar.
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {completedPhasesWithDiagnosis.map(phase => (
                  <div key={phase.number} className="px-6 py-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 size={14} className="text-green-500" />
                      <span className="text-sm text-gray-700" style={{ fontWeight: 600 }}>
                        Fase {phase.number}: {phase.name}
                      </span>
                      <span className="text-xs text-gray-400">— {phase.completedAt}</span>
                    </div>
                    <p className="text-gray-600 text-sm pl-5 leading-relaxed">{phase.agentDiagnosis}</p>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Phase Pipeline */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-700 text-sm uppercase tracking-wider" style={{ fontWeight: 600 }}>
              Pipeline de Fases
            </h3>
            <span className="text-xs text-gray-400">
              Haga clic en una fase disponible para iniciarla
            </span>
          </div>

          {/* Phase groups */}
          <div className="space-y-3">
            {/* Phases 1-3: Parallel */}
            <div className="relative">
              <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gray-200 ml-[2.75rem]" style={{ marginLeft: '3.4rem' }} />
              <div className="flex flex-col gap-3">
                {project.phases.slice(0, 3).map(phase => (
                  <PhaseItem
                    key={phase.number}
                    phase={phase}
                    projectId={project.id}
                    onRetry={handleRetry}
                  />
                ))}
              </div>
              <div className="mt-2 mb-4 ml-16 text-xs text-gray-400 flex items-center gap-1" style={{ fontWeight: 500 }}>
                <ExternalLink size={10} />
                Fases 1-3 se ejecutan en paralelo
              </div>
            </div>

            {/* Phase 4+ Sequential */}
            {project.phases.slice(3).map(phase => (
              <PhaseItem
                key={phase.number}
                phase={phase}
                projectId={project.id}
                onRetry={handleRetry}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
