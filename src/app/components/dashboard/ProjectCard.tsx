import { motion } from 'motion/react';
import { useNavigate } from 'react-router';
import { Calendar, ArrowRight, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Project, PhaseStatus } from '../../context/AppContext';

interface ProjectCardProps {
  project: Project;
  index: number;
}

function StatusBadge({ status }: { status: PhaseStatus }) {
  const config: Record<PhaseStatus, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
    bloqueado: { label: 'No iniciada', bg: 'bg-gray-100', text: 'text-gray-500', icon: null },
    disponible: { label: 'Disponible', bg: 'bg-zinc-100', text: 'text-zinc-700', icon: null },
    procesando: {
      label: 'En proceso',
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      icon: <Loader2 size={10} className="animate-spin" />,
    },
    completado: { label: 'Completada', bg: 'bg-green-50', text: 'text-green-700', icon: <CheckCircle2 size={10} /> },
    error: { label: 'Error', bg: 'bg-red-50', text: 'text-red-700', icon: <AlertCircle size={10} /> },
  };
  const c = config[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${c.bg} ${c.text}`} style={{ fontWeight: 500 }}>
      {c.icon}
      {c.label}
    </span>
  );
}

function getBorderColor(phases: Project['phases']): string {
  const activePhase =
    phases.find(p => p.status === 'error') ||
    phases.find(p => p.status === 'procesando') ||
    phases.find(p => p.status === 'disponible');

  if (!activePhase) return '#e5e7eb';
  const colors: Record<PhaseStatus, string> = {
    bloqueado: '#e5e7eb',
    disponible: '#030213',
    procesando: '#f59e0b',
    completado: '#16a34a',
    error: '#dc2626',
  };
  return colors[activePhase.status] || '#e5e7eb';
}

export default function ProjectCard({ project, index }: ProjectCardProps) {
  const navigate = useNavigate();
  const completedCount = project.phases.filter(p => p.status === 'completado').length;
  const totalPhases = project.phases.length;
  const progress = (completedCount / totalPhases) * 100;

  const currentPhase =
    project.phases.find(p => p.status === 'procesando' || p.status === 'disponible' || p.status === 'error') ||
    project.phases[totalPhases - 1];

  const borderColor = getBorderColor(project.phases);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      whileHover={{ y: -4 }}
      onClick={() => navigate(`/dashboard/project/${project.id}`)}
      className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden border-l-4 group"
      style={{ borderLeftColor: borderColor, borderTop: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6', borderBottom: '1px solid #f3f4f6' }}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="text-gray-900 truncate" style={{ fontWeight: 600, fontSize: '1rem' }}>
            {project.companyName}
          </h3>
          <ArrowRight
            size={16}
            className="text-gray-300 group-hover:text-zinc-600 flex-shrink-0 mt-0.5 transition-colors"
          />
        </div>
        <p className="text-gray-500 text-sm truncate">{project.projectName}</p>
        <div className="flex items-center gap-1.5 mt-2 text-gray-400">
          <Calendar size={12} />
          <span className="text-xs">
            Inicio:{' '}
            {new Date(project.startDate).toLocaleDateString('es-CO', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>
      </div>

      {/* Auditores */}
      <div className="px-5 py-2 flex items-center gap-2">
        <div className="flex -space-x-2">
          {project.auditors.slice(0, 4).map(a => (
            <div
              key={a.id}
              title={a.name}
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs border-2 border-white flex-shrink-0"
              style={{ background: a.color, fontWeight: 600 }}
            >
              {a.initials}
            </div>
          ))}
          {project.auditors.length > 4 && (
            <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-xs border-2 border-white">
              +{project.auditors.length - 4}
            </div>
          )}
        </div>
        <span className="text-gray-400 text-xs">
          {project.auditors.length} auditor{project.auditors.length !== 1 ? 'es' : ''}
        </span>
      </div>

      {/* Current Phase Badge */}
      <div className="px-5 py-2">
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-xs">Fase actual:</span>
          <StatusBadge status={currentPhase.status} />
          <span className="text-gray-600 text-xs truncate" style={{ fontWeight: 500 }}>
            F{currentPhase.number}: {currentPhase.name}
          </span>
        </div>
      </div>

      {/* Progress */}
      <div className="px-5 pb-5 pt-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-gray-500 text-xs">Progreso global</span>
          <span className="text-xs" style={{ fontWeight: 500, color: '#030213' }}>
            {completedCount}/{totalPhases} fases
          </span>
        </div>
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, delay: index * 0.08 + 0.3, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{ background: progress === 100 ? '#16a34a' : '#030213' }}
          />
        </div>
      </div>
    </motion.div>
  );
}
