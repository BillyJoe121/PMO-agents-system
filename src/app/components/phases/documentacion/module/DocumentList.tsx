import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, Download, FolderOpen, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { DocumentoLocal } from '../../../../hooks/useDocumentacion';
import { supabase } from '../../../../lib/supabase';
import DocumentCategoryDropdown from '../DocumentCategoryDropdown';
import { DOCUMENT_CATEGORIES, type DocCategory } from '../documentCategories';
import { formatSize, getFileIcon } from './documentacionUtils';

type DocumentListProps = {
  documentos: DocumentoLocal[];
  isCompleted: boolean;
  documentsExpanded: boolean;
  onToggleExpanded: () => void;
  onUpdateCategory: (id: string, category: DocCategory) => void;
  onUpdateCustomCategory: (id: string, val: string) => void;
  onDelete: (doc: DocumentoLocal) => void;
};

export function DocumentList({
  documentos,
  isCompleted,
  documentsExpanded,
  onToggleExpanded,
  onUpdateCategory,
  onUpdateCustomCategory,
  onDelete,
}: DocumentListProps) {
  if (documentos.length === 0 && !isCompleted) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-neutral-200 p-10 text-center">
        <FolderOpen size={24} className="text-neutral-300 mx-auto mb-3" strokeWidth={1.5} />
        <p className="text-neutral-500 text-[13px]">No hay documentos cargados.</p>
      </div>
    );
  }

  if (documentos.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-neutral-200/70 mb-6 overflow-hidden" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
      <button
        type="button"
        onClick={onToggleExpanded}
        className={`w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-neutral-50 transition-colors ${documentsExpanded ? 'border-b border-neutral-100' : ''}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <FolderOpen size={13} className="text-neutral-500 flex-shrink-0" strokeWidth={1.75} />
          <span className="text-neutral-900 text-[13px] truncate" style={{ fontWeight: 500 }}>
            Documentos cargados
          </span>
          <span className="text-[11px] text-neutral-400 tabular-nums flex-shrink-0">{documentos.length}</span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-[11px] text-neutral-400 tabular-nums">{formatSize(documentos.reduce((s, d) => s + d.size, 0))}</span>
          <ChevronDown size={13} className={`text-neutral-400 transition-transform duration-200 ${documentsExpanded ? 'rotate-180' : ''}`} strokeWidth={1.75} />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {documentsExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="divide-y divide-neutral-100">
              {documentos.map(doc => (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="px-5 py-4 flex items-center gap-4 transition-colors hover:bg-neutral-50/60"
                >
                  <div className="w-9 h-9 rounded-xl bg-neutral-50 border border-neutral-200/70 flex items-center justify-center flex-shrink-0">
                    {getFileIcon(doc.name)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-neutral-900 text-[13px] truncate" style={{ fontWeight: 500 }}>{doc.name}</p>
                    <p className="text-neutral-400 text-[11px] tabular-nums">{formatSize(doc.size)}</p>
                  </div>

                  {!isCompleted ? (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <DocumentCategoryDropdown
                        value={doc.category}
                        onChange={v => onUpdateCategory(doc.id, v)}
                      />

                      <AnimatePresence>
                        {doc.category === 'D16' && (
                          <motion.input
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: '10rem', opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            type="text"
                            value={doc.customCategory}
                            onChange={e => onUpdateCustomCategory(doc.id, e.target.value)}
                            placeholder="Especifique…"
                            className={`px-2.5 py-1.5 border rounded-full text-[12px] outline-none transition-all bg-white
                              ${!doc.customCategory.trim() ? 'border-neutral-900 focus:ring-2 focus:ring-neutral-100' : 'border-neutral-200/80 focus:border-neutral-300'}
                            `}
                          />
                        )}
                      </AnimatePresence>

                      <button title="Reemplazar" className="w-7 h-7 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors">
                        <RefreshCw size={12} strokeWidth={1.75} />
                      </button>
                      <button onClick={() => onDelete(doc)} title="Eliminar"
                        className="w-7 h-7 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition-colors">
                        <Trash2 size={12} strokeWidth={1.75} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="px-2.5 py-1 bg-neutral-100 text-neutral-700 text-[11px] rounded-full" style={{ fontWeight: 500 }}>
                        {DOCUMENT_CATEGORIES.find(c => c.value === doc.category)?.label || doc.category || 'Sin categoría'}
                      </span>
                      <button
                        onClick={async () => {
                          try {
                            let url = doc.storagePath || (doc.file ? URL.createObjectURL(doc.file) : '');

                            if (url && url.includes('token=')) {
                              const match = url.match(/documentos-pmo\/(.+?)\?token=/);
                              if (match && match[1]) {
                                const rawPath = decodeURIComponent(match[1]);
                                const { data } = await supabase.storage.from('documentos-pmo').createSignedUrl(rawPath, 3600);
                                if (data?.signedUrl) url = data.signedUrl;
                              }
                            }

                            if (url) {
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = doc.name;
                              a.target = '_blank';
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                            }
                          } catch (err) {
                            console.error('Error al descargar:', err);
                            toast.error('No se pudo generar el enlace de descarga.');
                          }
                        }}
                        className="inline-flex items-center gap-1 text-[12px] text-neutral-700 hover:text-neutral-900 hover:underline"
                        style={{ fontWeight: 500 }}
                      >
                        <Download size={11} /> Descargar
                      </button>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
