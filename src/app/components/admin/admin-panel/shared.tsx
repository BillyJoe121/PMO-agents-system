import type { ReactNode } from 'react';
import { AlignLeft, List, Shield, ToggleLeft } from 'lucide-react';
import type { QuestionType, UserRole } from '../../../hooks/useAdmin';

export const DIMENSIONS = ['Procesos', 'Personas', 'Tecnología', 'Gobernanza', 'Métricas', 'Cultura', 'Comunicación'];

/* ── Question type metadata ── */
export const QUESTION_TYPE_CONFIG: Record<QuestionType, { label: string; icon: ReactNode; description: string; color: string }> = {
  abierta: {
    label: 'Abierta',
    icon: <AlignLeft size={13} />,
    description: 'Respuesta de texto libre',
    color: '#4f46e5',
  },
  si_no: {
    label: 'Sí / No',
    icon: <ToggleLeft size={13} />,
    description: 'Respuesta binaria Sí o No',
    color: '#059669',
  },
  multiple: {
    label: 'Selección múltiple',
    icon: <List size={13} />,
    description: 'El encuestado elige entre opciones',
    color: '#d97706',
  },
};

/* ── Sub-components ── */
function RoleBadge({ role }: { role: UserRole }) {
  const isAdmin = role === 'admin';
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs ${
        isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
      }`}
      style={{ fontWeight: 600 }}
    >
      {isAdmin && <Shield size={10} />}
      {isAdmin ? 'Admin' : 'Auditor'}
    </span>
  );
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full ${active ? 'bg-green-500' : 'bg-gray-300'}`} />
      <span className="text-xs text-gray-500">{active ? 'Activo' : 'Inactivo'}</span>
    </div>
  );
}

function QuestionTypeBadge({ type }: { type: QuestionType }) {
  const cfg = QUESTION_TYPE_CONFIG[type];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
      style={{ background: `${cfg.color}18`, color: cfg.color, fontWeight: 600 }}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}


export { RoleBadge, StatusDot, QuestionTypeBadge };