import { motion } from 'motion/react';
import { ExternalLink, Info, Upload } from 'lucide-react';
import type { RefObject } from 'react';

type DocumentUploadSectionProps = {
  dragActive: boolean;
  fileInputRef: RefObject<HTMLInputElement>;
  onDrag: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export function DocumentUploadSection({ dragActive, fileInputRef, onDrag, onDrop, onFileInput }: DocumentUploadSectionProps) {
  return (
    <>
      <div className="flex items-start gap-3 px-4 py-3 rounded-2xl border border-neutral-200/70 bg-white mb-4" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
        <div className="w-7 h-7 rounded-lg bg-neutral-50 border border-neutral-200/80 flex items-center justify-center flex-shrink-0">
          <Info size={13} className="text-neutral-700" strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-neutral-800 text-[13px] leading-snug">
            <span style={{ fontWeight: 500 }}>Solo se aceptan archivos PDF o CSV.</span>{' '}
            Los modelos de IA procesan estos formatos para garantizar la extracción de texto y análisis estructurado.
          </p>
          <a
            href="https://www.ilovepdf.com/"
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="inline-flex items-center gap-1 mt-1.5 text-neutral-700 hover:text-neutral-900 hover:underline text-[12px] transition-colors"
            style={{ fontWeight: 500 }}
          >
            ¿Tienes otro tipo de archivo? Conviértelo a PDF o CSV aquí
            <ExternalLink size={11} />
          </a>
        </div>
      </div>

      <div
        onDragEnter={onDrag}
        onDragOver={onDrag}
        onDragLeave={onDrag}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`group relative rounded-2xl p-14 text-center cursor-pointer transition-all mb-6 overflow-hidden
          ${dragActive
            ? 'bg-neutral-900 text-white'
            : 'bg-white border border-dashed border-neutral-300 hover:border-neutral-400'}
        `}
        style={!dragActive ? { boxShadow: '0 1px 2px rgba(0,0,0,0.02)' } : undefined}
      >
        {!dragActive && (
          <div className="pointer-events-none absolute inset-0 opacity-60" style={{
            background: 'radial-gradient(ellipse 600px 200px at 50% 0%, rgba(10,10,10,0.025), transparent 70%)'
          }} />
        )}
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={onFileInput} accept=".pdf,.csv" />
        <motion.div animate={dragActive ? { scale: 1.03 } : { scale: 1 }} className="relative">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 border transition-all ${dragActive
            ? 'bg-white/10 border-white/20 text-white'
            : 'bg-neutral-50 border-neutral-200/80 text-neutral-700 group-hover:bg-neutral-900 group-hover:border-neutral-900 group-hover:text-white'
            }`}>
            <Upload size={20} strokeWidth={1.75} />
          </div>
          <p className={`mb-1.5 tracking-tight ${dragActive ? 'text-white' : 'text-neutral-900'}`}
            style={{ fontWeight: 500, fontSize: '1rem', letterSpacing: '-0.01em' }}>
            {dragActive ? 'Suelte los archivos aquí' : 'Arrastre archivos aquí'}
          </p>
          <p className={`text-[12px] ${dragActive ? 'text-white/70' : 'text-neutral-500'}`}>
            o <span className="underline decoration-neutral-300 underline-offset-4">haga clic para explorar</span> · Máx. 50 MB
          </p>
        </motion.div>
      </div>
    </>
  );
}
