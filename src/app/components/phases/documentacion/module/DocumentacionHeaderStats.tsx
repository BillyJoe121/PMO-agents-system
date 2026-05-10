import type { DocumentoLocal } from '../../../../hooks/useDocumentacion';
import { formatSize } from './documentacionUtils';

type DocumentacionHeaderStatsProps = {
  isCompleted: boolean;
  canComplete: boolean;
  documentos: DocumentoLocal[];
};

export function DocumentacionHeaderStats({ isCompleted, canComplete, documentos }: DocumentacionHeaderStatsProps) {
  return (
    <div className="mb-10">
      <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400 mb-3" style={{ fontWeight: 500 }}>Fase 1 · Gestión documental</p>
      <h1 className="text-neutral-900 tracking-tight" style={{ fontWeight: 500, fontSize: '2.25rem', lineHeight: 1.05, letterSpacing: '-0.025em' }}>
        {isCompleted ? 'Documentación analizada' : 'Cargue de artefactos PMO'}
      </h1>
      <p className="text-neutral-500 text-[14px] mt-3 max-w-2xl leading-relaxed">
        {isCompleted
          ? 'El Agente 1 evaluó la completitud, actualización y calidad del contenido documental.'
          : 'Cargue y categorice los documentos institucionales. El Agente 1 evaluará completitud y brechas.'}
      </p>

      <div className="grid grid-cols-3 gap-px bg-neutral-200/60 rounded-2xl overflow-hidden mt-7 border border-neutral-200/60">
        <div className="bg-white px-5 py-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-400" style={{ fontWeight: 500 }}>Documentos</p>
          <p className="mt-1.5 text-neutral-900 tabular-nums" style={{ fontWeight: 500, fontSize: '1.375rem', letterSpacing: '-0.02em' }}>
            {documentos.length}
          </p>
        </div>
        <div className="bg-white px-5 py-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-400" style={{ fontWeight: 500 }}>Tamaño total</p>
          <p className="mt-1.5 text-neutral-900 tabular-nums" style={{ fontWeight: 500, fontSize: '1.375rem', letterSpacing: '-0.02em' }}>
            {formatSize(documentos.reduce((s, d) => s + d.size, 0))}
          </p>
        </div>
        <div className="bg-white px-5 py-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-400" style={{ fontWeight: 500 }}>Estado</p>
          <div className="mt-1.5 flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${isCompleted ? 'bg-neutral-900' : canComplete ? 'bg-neutral-800' : 'bg-neutral-300'}`} />
            <p className="text-neutral-900 text-[13px]" style={{ fontWeight: 500 }}>
              {isCompleted ? 'Completada' : canComplete ? 'Lista para enviar' : 'En preparación'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
