import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────
export interface DocumentoLocal {
  id: string;
  name: string;
  size: number;
  type: string;
  category: string;
  customCategory: string;
  file?: File;
  // Después de subir a Supabase Storage:
  storagePath?: string;
  dbId?: string;
}

export interface AgentDiagnosis {
  summary: string;
  cobertura_documental: {
    total_esperado: number;
    recibidos_completos: number;
    faltantes: number;
  };
  calidad_documental: {
    resultado_consolidado: string;
    justificacion: string;
  };
  key_insights: string[];
  missing_documents: string[];
  recommendations: string[];
  brechas_documentales: Array<{
    id: string;
    dimension_o_area: string;
    descripcion: string;
    impacto: string;
  }>;
  hallazgos_documentales: Array<{
    nombre: string;
    descripcion: string;
    tipo: string;
  }>;
  limitaciones?: Array<{
    tipo: string;
    descripcion: string;
    impacto_confiabilidad: string;
  }>;
  estado_documentos?: Array<{
    document_id: string;
    codigo_catalogo: string;
    nombre: string;
    estado: string;
    vigencia: string;
    valor_analitico: string;
    nivel_analisis: string;
  }>;
  insumos_para_agente_4: {
    nivel_estandarizacion: string;
    nivel_calidad_documental: string;
    senales_estructuracion_formal: Array<{ descripcion: string; nivel_evidencia: string }>;
    senales_flexibilidad_agil: Array<{ descripcion: string; nivel_evidencia: string }>;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// NOMBRE DEL BUCKET EN SUPABASE STORAGE
// ─────────────────────────────────────────────────────────────────────────────
const STORAGE_BUCKET = 'documentos-pmo';

// ─────────────────────────────────────────────────────────────────────────────
// HOOK PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export function useDocumentacion(projectId: string) {
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [diagnosis, setDiagnosis] = useState<AgentDiagnosis | null>(null);
  const [documentos, setDocumentos] = useState<DocumentoLocal[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, 'pending' | 'uploading' | 'done' | 'error'>>({});

  /**
   * RECUPERAR DATOS AL CARGAR LA PÁGINA
   */
  const fetchInitialData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      // 1. Obtener documentos
      const { data: docsData } = await supabase
        .from('documentos')
        .select('*')
        .eq('proyecto_id', projectId);

      if (docsData) {
        setDocumentos(docsData.map(d => ({
          id: d.id,
          name: d.nombre_personalizado || 'Documento',
          size: (d.metadatos?.size_kb || 0) * 1024,
          type: 'application/pdf',
          category: d.categoria,
          customCategory: '',
          storagePath: d.storage_path,
          dbId: d.id,
        })));
      }

      // 2. Obtener diagnóstico de la fase 1
      const { data: faseData } = await supabase
        .from('fases_estado')
        .select('datos_consolidados')
        .eq('proyecto_id', projectId)
        .eq('numero_fase', 1)
        .single();

      if (faseData?.datos_consolidados) {
        // La BD guarda el envelope completo { metadata: {...}, diagnosis: {...} }
        const consolidated = faseData.datos_consolidados as Record<string, any>;
        const innerDiagnosis = consolidated.diagnosis ? consolidated.diagnosis : consolidated;
        setDiagnosis(innerDiagnosis as AgentDiagnosis);
      }
    } catch (err) {
      console.error('Error fetching initial phase 1 data', err);
    } finally {
      setIsLoadingData(false);
    }
  }, [projectId]);

  /**
   * PASO 1: Sube los archivos a Supabase Storage y registra sus rutas en la tabla `documentos`.
   * Retorna los documentos enriquecidos con sus paths y IDs de base de datos.
   */
  const uploadDocuments = useCallback(async (documentos: DocumentoLocal[]): Promise<DocumentoLocal[]> => {
    setIsUploading(true);
    const enriched: DocumentoLocal[] = [];

    try {
      for (const doc of documentos) {
        // Si ya fue subido antes (tiene storagePath), lo reutilizamos
        if (doc.storagePath) {
          enriched.push(doc);
          continue;
        }

        if (!doc.file) {
          toast.error(`No se encontró el archivo para: ${doc.name}`);
          continue;
        }

        setUploadProgress(prev => ({ ...prev, [doc.id]: 'uploading' }));

        // Ruta única en el bucket: proyectos/{projectId}/{timestamp}_{filename}
        const storagePath = `proyectos/${projectId}/${Date.now()}_${doc.name}`;

        // 1a. Subir el archivo al bucket de Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, doc.file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          setUploadProgress(prev => ({ ...prev, [doc.id]: 'error' }));
          toast.error(`Error subiendo ${doc.name}: ${uploadError.message}`);
          continue;
        }

        // 1b. Obtener URL firmada válida por 1 hora (que el agente usará para leer el PDF)
        const { data: signedData } = await supabase.storage
          .from(STORAGE_BUCKET)
          .createSignedUrl(storagePath, 3600);

        const signedUrl = signedData?.signedUrl ?? storagePath;

        // 1c. Registrar en la tabla `documentos`
        const { data: dbDoc, error: dbError } = await supabase
          .from('documentos')
          .insert({
            proyecto_id: projectId,
            storage_path: signedUrl,
            categoria: doc.category === 'D11' ? doc.customCategory : doc.category,
            nombre_personalizado: doc.name,
            metadatos: { size_kb: Math.round(doc.size / 1024), original_name: doc.name },
          })
          .select('id')
          .single();

        if (dbError) {
          setUploadProgress(prev => ({ ...prev, [doc.id]: 'error' }));
          toast.error(`Error registrando ${doc.name} en DB: ${dbError.message}`);
          continue;
        }

        setUploadProgress(prev => ({ ...prev, [doc.id]: 'done' }));
        enriched.push({ ...doc, storagePath: signedUrl, dbId: dbDoc.id });
      }

      return enriched;
    } finally {
      setIsUploading(false);
    }
  }, [projectId]);

  /**
   * PASO 2: Llama a la Edge Function `pmo-agent` con phaseNumber=1.
   * La función recuperará los documentos de la DB y los enviará a Gemini con el prompt del Agente.
   */
  const runAgent = useCallback(async (iteration = 1, comments: string | null = null) => {
    setIsAnalyzing(true);
    setDiagnosis(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL.replace('/rest/v1', '')}/functions/v1/pmo-agent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            projectId,
            phaseNumber: 1,
            iteration,
            comments,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error ?? 'Error desconocido en el agente');
      }

      // El diagnóstico viene en result.data.diagnosis (estructura del Agente 3)
      const diagnosisData: AgentDiagnosis = result.data?.diagnosis ?? result.data;
      setDiagnosis(diagnosisData);

      return diagnosisData;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al contactar el agente';
      toast.error('Error en el Agente', { description: message });
      throw err;
    } finally {
      setIsAnalyzing(false);
    }
  }, [projectId]);

  /**
   * Flujo completo: Upload → DB → Agente
   */
  const processPhase = useCallback(async (documentos: DocumentoLocal[]) => {
    // 1. Subir archivos y registrar en DB
    const enriched = await uploadDocuments(documentos);

    if (enriched.length === 0) {
      toast.error('No se pudo subir ningún documento.');
      return null;
    }

    toast.success(`${enriched.length} documentos subidos correctamente.`);

    // 2. Llamar al Agente 3 (Gemini)
    const result = await runAgent();

    return result;
  }, [uploadDocuments, runAgent]);

  /**
   * ELIMINAR documento: borra del Storage, de la tabla documentos y del estado local.
   */
  const deleteDocument = useCallback(async (doc: DocumentoLocal) => {
    // 1. Si ya está en la DB, borrarlo
    if (doc.dbId) {
      // 1a. Extraer la ruta raw del storage (sin el token de la signed URL)
      const rawPath = doc.storagePath
        ? doc.storagePath.match(/documentos-pmo\/(.+?)(?:\?token=|$)/)?.[1]
        : null;

      if (rawPath) {
        const decodedPath = decodeURIComponent(rawPath);
        const { error: storageError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .remove([decodedPath]);
        if (storageError) console.warn('Error borrando del storage:', storageError.message);
      }

      const { error: dbError } = await supabase
        .from('documentos')
        .delete()
        .eq('id', doc.dbId);

      if (dbError) {
        toast.error(`Error eliminando ${doc.name}: ${dbError.message}`);
        return;
      }
    }

    // 2. Quitar del estado local
    setDocumentos(prev => prev.filter(d => d.id !== doc.id));
    toast.success(`${doc.name} eliminado correctamente.`);
  }, [projectId]);

  return {
    isUploading,
    isAnalyzing,
    isLoadingData,
    isProcessing: isUploading || isAnalyzing,
    uploadProgress,
    diagnosis,
    documentos,
    setDocumentos,
    processPhase,
    runAgent,
    fetchInitialData,
    deleteDocument,
  };
}
