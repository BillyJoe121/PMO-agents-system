import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams } from 'react-router';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { useApp } from '../../context/AppContext';
import { useDocumentacion, type AgentDiagnosis, type DocumentoLocal } from '../../hooks/useDocumentacion';
import { useSoundManager } from '../../hooks/useSoundManager';
import { supabase } from '../../lib/supabase';
import PhaseHeader from './_shared/PhaseHeader';
import NextPhaseButton from './_shared/NextPhaseButton';
import type { DocCategory } from './documentacion/documentCategories';
import { CompletedDiagnosisSection } from './documentacion/module/CompletedDiagnosisSection';
import { DocumentacionHeaderStats } from './documentacion/module/DocumentacionHeaderStats';
import { DocumentacionLoadingView } from './documentacion/module/DocumentacionLoadingView';
import { DocumentacionProcessingOverlay } from './documentacion/module/DocumentacionProcessingOverlay';
import { DocumentList } from './documentacion/module/DocumentList';
import { DocumentUploadSection } from './documentacion/module/DocumentUploadSection';
import { LoadingRouteState, MissingProjectState } from '../layout/RouteState';

type Documento = DocumentoLocal;

export default function DocumentacionModule() {
  const { id: projectId } = useParams<{ id: string }>();
  const { getProject, updatePhaseStatus, isLoading } = useApp();
  const { playProcessError, playPhaseComplete } = useSoundManager();

  const project = getProject(projectId!);
  const phase = project?.phases.find(p => p.number === 1);
  const isCompleted = phase?.status === 'completado';

  const { isProcessing: hookIsProcessing, isLoadingData, diagnosis, documentos, setDocumentos, processPhase, fetchInitialData, deleteDocument } = useDocumentacion(projectId!);
  const isProcessing = phase?.status === 'procesando' || hookIsProcessing;

  const [liveDiagnosis, setLiveDiagnosis] = useState<AgentDiagnosis | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [documentsExpanded, setDocumentsExpanded] = useState(false);

  const [agent9Data, setAgent9Data] = useState<any>(null);
  const [agent9Status, setAgent9Status] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
  const [expandedDim, setExpandedDim] = useState<string | null>(null);
  const agent9PollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const agent9TriggerInFlightRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    if (isProcessing) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isProcessing]);

  const triggerAgent9 = useCallback(async () => {
    if (!projectId) return;
    if (agent9TriggerInFlightRef.current) return;
    agent9TriggerInFlightRef.current = true;
    setAgent9Status('processing');
    try {
      await supabase.from('fases_estado').upsert(
        { proyecto_id: projectId, numero_fase: 9, estado_visual: 'procesando', datos_consolidados: null, updated_at: new Date().toISOString() },
        { onConflict: 'proyecto_id,numero_fase' }
      );
      supabase.functions.invoke('pmo-agent', {
        body: { projectId, phaseNumber: 9, iteration: 1 }
      }).catch(e => {
        agent9TriggerInFlightRef.current = false;
        console.error('[Agent9] invoke error:', e);
        setAgent9Status('error');
      });
    } catch (e) {
      agent9TriggerInFlightRef.current = false;
      console.error('[Agent9] trigger error:', e);
      setAgent9Status('error');
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId || (!isCompleted && !diagnosis)) return;

    const pollAgent9 = async () => {
      const { data, error } = await supabase
        .from('fases_estado')
        .select('datos_consolidados, estado_visual, updated_at')
        .eq('proyecto_id', projectId)
        .eq('numero_fase', 9)
        .maybeSingle();

      if (error) {
        console.error('[Agent9] poll error:', error);
        return;
      }

      if (data?.datos_consolidados) {
        const dc = data.datos_consolidados as any;
        if (dc?._error) {
          agent9TriggerInFlightRef.current = false;
          setAgent9Status('error');
          if (agent9PollRef.current) clearInterval(agent9PollRef.current);
          return;
        }
        const parsed = dc?.diagnosis ?? dc;
        if (parsed?.preguntas_apertura || parsed?.preguntas_por_dimension) {
          agent9TriggerInFlightRef.current = false;
          setAgent9Data(parsed);
          setAgent9Status('done');
          if (agent9PollRef.current) clearInterval(agent9PollRef.current);
          return;
        }
      }

      if (data?.estado_visual === 'error') {
        agent9TriggerInFlightRef.current = false;
        setAgent9Status('error');
        if (agent9PollRef.current) clearInterval(agent9PollRef.current);
      } else if (data?.estado_visual === 'procesando') {
        const updatedAt = data?.updated_at ? new Date(data.updated_at).getTime() : 0;
        const minutesElapsed = (Date.now() - updatedAt) / 1000 / 60;
        if (minutesElapsed > 3) {
          console.warn('[Agent9] Estado procesando > 3 min sin resultado — se considera timeout. Reintentando.');
          agent9TriggerInFlightRef.current = false;
          await supabase.from('fases_estado').upsert(
            { proyecto_id: projectId, numero_fase: 9, estado_visual: 'disponible', datos_consolidados: null, updated_at: new Date().toISOString() },
            { onConflict: 'proyecto_id,numero_fase' }
          );
          triggerAgent9();
        } else {
          setAgent9Status('processing');
        }
      } else if (!data || !data?.datos_consolidados) {
        triggerAgent9();
      }
    };

    pollAgent9();
    agent9PollRef.current = setInterval(pollAgent9, 4000);

    return () => { if (agent9PollRef.current) clearInterval(agent9PollRef.current); };
  }, [projectId, isCompleted, diagnosis, triggerAgent9]);

  useEffect(() => {
    return () => { if (agent9PollRef.current) clearInterval(agent9PollRef.current); };
  }, []);

  const canComplete = documentos.length > 0 && documentos.every(d =>
    d.category !== 'D16' || d.customCategory.trim() !== ''
  );

  const handleFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const maxSize = 50 * 1024 * 1024;

    fileArray.forEach(file => {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (ext !== 'pdf' && ext !== 'csv') {
        toast.error(`Formato no permitido: .${ext}`, {
          description: 'Solo se aceptan archivos PDF o CSV.',
        });
        return;
      }
      if (file.size > maxSize) { toast.error(`${file.name} supera el límite de 50MB`); return; }

      setDocumentos(prev => {
        if (prev.some(d => d.name === file.name)) {
          toast.error(`${file.name} ya está en la lista`, { description: 'No se agregarán duplicados.' });
          return prev;
        }

        const doc: Documento = {
          id: `d${Date.now()}_${Math.random()}`,
          name: file.name,
          size: file.size,
          type: file.type,
          category: 'D01',
          customCategory: '',
          file,
        };
        toast.success(`${file.name} cargado correctamente`);
        return [...prev, doc];
      });
    });
  }, [setDocumentos]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
  };

  const updateCategory = (id: string, category: DocCategory) => {
    setDocumentos(prev => prev.map(d => d.id === id ? { ...d, category, customCategory: '' } : d));
  };

  const updateCustomCategory = (id: string, val: string) => {
    setDocumentos(prev => prev.map(d => d.id === id ? { ...d, customCategory: val } : d));
  };

  const handleDelete = (doc: DocumentoLocal) => {
    deleteDocument(doc);
  };

  const handleMarkComplete = () => {
    if (!canComplete) {
      toast.error('Complete todos los campos de categoría antes de continuar.');
      return;
    }
    handleConfirm();
  };

  const handleConfirm = async () => {
    setIsSending(true);
    updatePhaseStatus(projectId!, 1, 'procesando');

    try {
      const result = await processPhase(documentos);
      if (result) {
        setLiveDiagnosis(result);
        const summary = result.summary ?? `${documentos.length} documentos analizados.`;
        updatePhaseStatus(projectId!, 1, 'completado', summary);
        playPhaseComplete();
        toast.success('¡Fase 1 completada!', { description: 'El Agente  finalizó el análisis documental.' });
        await fetchInitialData();
      }
    } catch {
      updatePhaseStatus(projectId!, 1, 'disponible');
      playProcessError();
      toast.error('Hubo un error al procesar. Intenta nuevamente.');
    } finally {
      setIsSending(false);
    }
  };

  if (!project) {
    return isLoading
      ? <LoadingRouteState message="Cargando el proyecto y la fase documental..." />
      : <MissingProjectState />;
  }

  if (isLoadingData) {
    return <DocumentacionLoadingView />;
  }

  return (
    <div className="min-h-screen bg-[#f7f8ff]">
      <PhaseHeader
        projectId={projectId!}
        companyName={project.companyName}
        phaseNumber={1}
        phaseName="Gestión Documental"
        eyebrow={isCompleted ? 'Completada' : 'Activa'}
      />

      <DocumentacionProcessingOverlay isProcessing={isProcessing} />

      <div className="max-w-[1100px] mx-auto px-10 py-10">
        <DocumentacionHeaderStats isCompleted={isCompleted} canComplete={canComplete} documentos={documentos} />

        {!isCompleted && (
          <DocumentUploadSection
            dragActive={dragActive}
            fileInputRef={fileInputRef}
            onDrag={handleDrag}
            onDrop={handleDrop}
            onFileInput={handleFileInput}
          />
        )}

        <DocumentList
          documentos={documentos}
          isCompleted={isCompleted}
          documentsExpanded={documentsExpanded}
          onToggleExpanded={() => setDocumentsExpanded(open => !open)}
          onUpdateCategory={updateCategory}
          onUpdateCustomCategory={updateCustomCategory}
          onDelete={handleDelete}
        />

        {!isCompleted && !isProcessing && (
          <div className="mt-8 flex justify-end">
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ y: 0 }}
              onClick={handleMarkComplete}
              disabled={!canComplete}
              className="px-6 py-3 rounded-full text-white text-[13px] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              style={{ background: '#5454e9', fontWeight: 500, boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 8px 24px -8px rgba(0,0,0,0.18)' }}
            >
              Enviar al Agente
            </motion.button>
          </div>
        )}

        {isCompleted && (
          <CompletedDiagnosisSection
            diagnosis={liveDiagnosis ?? diagnosis}
            agent9Status={agent9Status}
            agent9Data={agent9Data}
            expandedDim={expandedDim}
            setExpandedDim={setExpandedDim}
            triggerAgent9={triggerAgent9}
          />
        )}
      </div>

      <NextPhaseButton projectId={projectId!} nextPhase={2} show={isCompleted} />
    </div>
  );
}
