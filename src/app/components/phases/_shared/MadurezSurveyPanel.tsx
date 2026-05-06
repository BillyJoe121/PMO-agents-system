import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, Copy, RefreshCw, ClipboardEdit, AlertTriangle, Users, Trash2, Paperclip, CheckCircle2, Download } from 'lucide-react';
import { useMadurez } from '../../../hooks/useMadurez';
import { toast } from 'sonner';

export default function MadurezSurveyPanel({
  title,
  subtitle,
  manager,
  disabled
}: {
  title: string;
  subtitle: string;
  manager: ReturnType<typeof useMadurez>;
  disabled?: boolean;
}) {
  const {
    activeLink, responses, isLoadingData,
    externalFiles, addExternalFile, removeExternalFile,
    existingFiles, deleteExistingFile,
    generateLink, downloadCSV
  } = manager;

  const [linkCopied, setLinkCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://pmo.icesi.edu.co';
  const surveyLink = activeLink ? `${baseUrl}/survey/${activeLink}` : '';

  const handleCopyLink = () => {
    if (!surveyLink) return;
    navigator.clipboard.writeText(surveyLink).catch(() => {});
    setLinkCopied(true);
    toast.success('Enlace copiado al portapapeles');
    setTimeout(() => setLinkCopied(false), 2500);
  };

  const handleGenerateLink = async () => {
    try {
      await generateLink();
      toast.success('Nuevo enlace generado');
    } catch (e) {
      toast.error('Error generando enlace');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach(file => {
        if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
          toast.error(`El archivo ${file.name} no es CSV.`);
        } else {
          addExternalFile(file);
        }
      });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteExisting = async (fileName: string) => {
    try {
      await deleteExistingFile(fileName);
      toast.success('Archivo eliminado correctamente');
    } catch (e: any) {
      toast.error(e.message || 'Error eliminando el archivo');
    }
  };

  // El panel se considera completado (tiene datos) si hay al menos una respuesta online o un archivo
  const hasData = responses.length > 0 || externalFiles.length > 0 || existingFiles.length > 0;

  return (
    <div className={`bg-white rounded-2xl border ${hasData ? 'border-neutral-900/20 shadow-sm' : 'border-neutral-200/80'} overflow-hidden`}>
      <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
        <div>
          <h2 className="text-neutral-900" style={{ fontWeight: 600, fontSize: '1.125rem' }}>{title}</h2>
          <p className="text-neutral-500 text-[13px]">{subtitle}</p>
        </div>
        {hasData && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs" style={{ fontWeight: 600 }}>
            <CheckCircle2 size={12} /> Datos recolectados
          </div>
        )}
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Opción 1: Encuesta Online */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 flex flex-col relative overflow-hidden group">
            {disabled && <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10" />}
            
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Globe size={18} className="text-neutral-700" />
                  <h3 className="text-neutral-900" style={{ fontWeight: 600 }}>Encuesta web</h3>
                </div>
                <p className="text-neutral-500 text-[13px] leading-relaxed">Genera un enlace único para responder en línea</p>
              </div>
            </div>

            <div className="mt-auto">
              {!activeLink ? (
                <button onClick={handleGenerateLink} disabled={disabled} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-neutral-200/80 text-neutral-700 text-[13px] hover:bg-neutral-50 transition-colors" style={{ fontWeight: 500 }}>
                  Generar enlace
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="flex-1 text-[13px] text-neutral-600 font-medium truncate" title={surveyLink}>
                      /survey/{activeLink.split('-')[0]}...
                    </span>
                    <button onClick={handleCopyLink} disabled={disabled} className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-white rounded-md transition-colors" title="Copiar enlace">
                      {linkCopied ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    </button>
                  </div>
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[12px] text-neutral-500">
                      {responses.length} respuesta{responses.length !== 1 ? 's' : ''} en línea
                    </span>
                    <div className="flex items-center gap-3">
                      {responses.length > 0 && (
                        <button onClick={downloadCSV} disabled={disabled} className="text-[12px] text-neutral-500 hover:text-neutral-900 flex items-center gap-1 transition-colors" style={{ fontWeight: 500 }} title="Descargar respuestas">
                          <Download size={12} /> CSV
                        </button>
                      )}
                      <button onClick={handleGenerateLink} disabled={disabled} className="text-[12px] text-neutral-500 hover:text-neutral-900 flex items-center gap-1 transition-colors" style={{ fontWeight: 500 }}>
                        <RefreshCw size={12} /> Regenerar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Opción 2: Carga Documental */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 flex flex-col relative overflow-hidden">
            {disabled && <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10" />}
            
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <ClipboardEdit size={18} className="text-neutral-700" />
                  <h3 className="text-neutral-900" style={{ fontWeight: 600 }}>Carga manual</h3>
                </div>
                <p className="text-neutral-500 text-[13px] leading-relaxed">Sube respuestas en formato CSV</p>
              </div>
            </div>

            <div className="mt-auto flex flex-col gap-3">
              <input ref={fileInputRef} type="file" accept=".csv" multiple className="hidden" onChange={handleFileChange} />
              
              <div className="space-y-2 mb-3">
                {existingFiles.map((f, i) => (
                  <div key={`exist-${i}`} className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600">
                      <Paperclip size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-blue-900 font-medium truncate">{f.name}</p>
                      <p className="text-[11px] text-blue-600/70">Archivo en base de datos</p>
                    </div>
                    <div className="flex items-center gap-1 border-l border-blue-200/50 pl-1">
                      <button onClick={() => window.open(f.url, '_blank')} disabled={disabled} className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-100/50 rounded-lg transition-colors" title="Descargar archivo">
                        <Download size={14} />
                      </button>
                      <button onClick={() => handleDeleteExisting(f.name)} disabled={disabled} className="p-1.5 text-blue-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar archivo">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}

                {externalFiles.map((f, i) => (
                  <div key={`ext-${i}`} className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white border border-neutral-200 flex items-center justify-center flex-shrink-0 text-neutral-600">
                      <CheckCircle2 size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-neutral-900 font-medium truncate">{f.name}</p>
                      <p className="text-[11px] text-neutral-500">Listo para subir</p>
                    </div>
                    <button onClick={() => removeExternalFile(f.name)} disabled={disabled} className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Quitar archivo">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <button onClick={() => fileInputRef.current?.click()} disabled={disabled} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-neutral-200/80 text-neutral-700 text-[13px] hover:bg-neutral-50 transition-colors" style={{ fontWeight: 500 }}>
                <Paperclip size={14} /> Cargar archivo CSV
              </button>
            </div>
          </div>

        </div>

        {/* Resumen de estado actual */}
        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 px-3 py-2 bg-neutral-50 rounded-lg text-[12px] text-neutral-500">
            <Users size={14} className="text-neutral-400" />
            <span>
              {hasData ? (
                <>Recolección activa: <strong>{responses.length} encuestas online</strong> {(existingFiles.length > 0 || externalFiles.length > 0) ? ` + ${existingFiles.length + externalFiles.length} archivo(s) cargado(s)` : ''}</>
              ) : (
                <>Aún no se han recibido respuestas ni cargado archivos.</>
              )}
            </span>
          </div>

          {responses.length > 0 && (
            <button onClick={downloadCSV} className="flex items-center gap-1.5 px-3 py-2 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 rounded-lg text-[12px] text-neutral-700 transition-colors" style={{ fontWeight: 500 }}>
              <Download size={13} />
              Descargar respuestas (CSV)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
