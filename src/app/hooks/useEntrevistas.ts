import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

export interface EntrevistaLocal {
  id: string;
  nombre: string;
  cargo: string;
  area: string;
  notas: string;
  createdAt: string;
  dbId?: string;
  file?: File;
  fileName?: string;
  storagePath?: string;
}

export interface EntrevistasDiagnosis {
  summary: string;
  advertencia_fuente_unica?: boolean;
  numero_entrevistados?: number;
  nivel_formalizacion_general?: string;
  roles_identificados?: Array<{
    nombre_cargo: string;
    area: string;
    nivel_jerarquico: string;
    participacion_en_proyectos: string;
  }>;
  contexto_organizacional?: {
    organizacion?: string;
    sector?: string;
    tamanio_aproximado?: string;
    tipo_proyecto_analizado?: string;
    cultura_visible?: string;
  };
  calidad_input?: {
    vacios_tematicos?: string[];
    ambiguedades?: string[];
    superficialidad?: string[];
    sesgo_por_rol?: string;
  };
  dimensiones_base?: Record<string, {
    practicas_reales: string[];
    evidencias: string[];
    nivel_formalidad: string;
    herramientas: string[];
    tipo_gestion: string;
    confianza: string;
    recurrencia: string;
  }>;
  herramientas_identificadas?: Array<{
    nombre: string;
    tipo: string;
    uso_identificado: string;
    fases_donde_se_usa: string[];
    es_repositorio_digital: boolean;
    mencionado_por: string[];
  }>;
  reuniones_existentes?: Array<{
    nombre: string;
    frecuencia: string;
    participantes: string[];
    proposito: string;
    nivel_formalidad: string;
    mencionado_por: string[];
  }>;
  key_findings?: string[];
  recurring_themes?: {
    theme: string;
    frequency: string;
    mentioned_by: string[];
  }[];
  critical_voices?: {
    interview_id: string;
    interviewee_name: string;
    relevance: string;
    key_insight: string;
  }[];
  patrones_organizacionales?: {
    nombre: string;
    descripcion: string;
    dimensiones_donde_se_observa: string[];
  }[];
  tensiones?: {
    tipo: string;
    descripcion: string;
    evidencia: string;
    roles_involucrados: string[];
    intensidad: string;
  }[];
  brechas?: {
    dimension_o_fase: string;
    descripcion: string;
    evidencia_o_ausencia: string;
    impacto_potencial: string;
  }[];
  limitaciones?: {
    tipo: string;
    descripcion: string;
    dimensiones_afectadas: string[];
  }[];
  recommendations?: string[];
  insumos_para_agente_4?: {
    tiene_preproyecto?: boolean | null;
    justificacion_preproyecto?: string;
    tiene_postcierre?: boolean | null;
    justificacion_postcierre?: string;
    patrones_clave_resumen?: string[];
    brechas_criticas_resumen?: string[];
    indicadores_predictivos?: string[];
    indicadores_agilidad?: string[];
    indicadores_hibridos?: string[];
    nivel_general_formalizacion?: string;
  };
  listo_para_integracion?: boolean;
}

export interface AgentErrorPayload {
  code?: string;
  message: string;
  details?: string;
  retryable?: boolean;
}

function extractAgentError(value: any): AgentErrorPayload | null {
  if (!value || typeof value !== 'object') return null;

  if (value._error) {
    return {
      message: value.message ?? 'El agente reporto un error durante el procesamiento.',
      details: value.details,
      retryable: true,
    };
  }

  const nestedError = value.error;
  if (nestedError && typeof nestedError === 'object' && value.diagnosis === null) {
    return {
      code: nestedError.code,
      message: nestedError.message ?? 'El agente no pudo generar el diagnostico.',
      details: nestedError.details,
      retryable: nestedError.retryable,
    };
  }

  if (value.metadata?.status === 'error') {
    return {
      code: nestedError?.code,
      message: nestedError?.message ?? 'El agente finalizo con error.',
      details: nestedError?.details,
      retryable: nestedError?.retryable,
    };
  }

  return null;
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isEntrevistasProcessingPayload(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  if (value._processing === true) return true;
  if (value.metadata?.status === 'processing' || value.metadata?.status === 'procesando') return true;
  const nested = value.diagnosis ?? value.data?.diagnosis ?? value.data;
  return nested !== value && isEntrevistasProcessingPayload(nested);
}

export function normalizeEntrevistasDiagnosis(value: unknown): EntrevistasDiagnosis | null {
  if (!isPlainObject(value)) return null;
  if (isEntrevistasProcessingPayload(value) || extractAgentError(value)) return null;

  const candidate = value.diagnosis ?? value.data?.diagnosis ?? value.data ?? value;
  if (!isPlainObject(candidate)) return null;
  if (isEntrevistasProcessingPayload(candidate) || extractAgentError(candidate)) return null;
  if (Object.keys(candidate).length === 0) return null;

  const hasMeaningfulContent = [
    typeof candidate.summary === 'string' && candidate.summary.trim().length > 0,
    Number.isFinite(Number(candidate.numero_entrevistados)),
    isPlainObject(candidate.dimensiones_base),
    Array.isArray(candidate.roles_identificados) && candidate.roles_identificados.length > 0,
    Array.isArray(candidate.key_findings) && candidate.key_findings.length > 0,
    Array.isArray(candidate.recurring_themes) && candidate.recurring_themes.length > 0,
    isPlainObject(candidate.insumos_para_agente_4),
  ].some(Boolean);

  return hasMeaningfulContent ? candidate as EntrevistasDiagnosis : null;
}

export function useEntrevistas(projectId: string) {
  const [entrevistas, setEntrevistas] = useState<EntrevistaLocal[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [diagnosis, setDiagnosis] = useState<EntrevistasDiagnosis | null>(null);
  const [agentError, setAgentError] = useState<AgentErrorPayload | null>(null);

  const fetchInitialData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      // 1. Obtener entrevistas guardadas
      const { data: entData } = await supabase
        .from('entrevistas')
        .select('*')
        .eq('proyecto_id', projectId)
        .order('created_at', { ascending: true });

      if (entData) {
        setEntrevistas(
          entData.map((e) => ({
            id: e.id,
            dbId: e.id,
            nombre: e.nombre,
            cargo: e.cargo,
            area: e.area || '',
            notas: e.notas || '',
            fileName: e.file_name,
            storagePath: e.storage_path,
            createdAt: new Date(e.created_at).toLocaleDateString('es-CO'),
          }))
        );
      }

      // 2. Obtener diagnóstico si la fase ya se corrió
      const { data: faseData } = await supabase
        .from('fases_estado')
        .select('datos_consolidados')
        .eq('proyecto_id', projectId)
        .eq('numero_fase', 2)
        .single();

      if (faseData?.datos_consolidados) {
        const consolidated = faseData.datos_consolidados as Record<string, any>;
        const storedError = extractAgentError(consolidated);
        if (storedError) {
          setAgentError(storedError);
          setDiagnosis(null);
          return;
        }
        const storedDiagnosis = normalizeEntrevistasDiagnosis(consolidated);
        setDiagnosis(storedDiagnosis);
        setAgentError(null);
      } else {
        setDiagnosis(null);
        setAgentError(null);
      }
    } catch (err) {
      console.error('Error fetching initial phase 2 data', err);
    } finally {
      setIsLoadingData(false);
    }
  }, [projectId]);

  const saveEntrevista = async (entrevista: EntrevistaLocal) => {
    try {
      let finalStoragePath = entrevista.storagePath || null;
      let finalFileName = entrevista.fileName || null;

      // Handle explicit file removal
      if (entrevista.file === null) {
        if (finalStoragePath) {
          const pathMatch = finalStoragePath.match(/documentos-pmo\/(.+?)(?:\?token=|$)/);
          const rawPath = pathMatch ? decodeURIComponent(pathMatch[1]) : finalStoragePath;
          await supabase.storage.from('documentos-pmo').remove([rawPath]).catch(e => console.error(e));
        }
        finalStoragePath = null;
        finalFileName = null;
      }
      // Upload file if attached (it's a new file selected by the user)
      else if (entrevista.file) {
        // Delete previous file if replacing
        if (finalStoragePath) {
          const pathMatch = finalStoragePath.match(/documentos-pmo\/(.+?)(?:\?token=|$)/);
          const rawPath = pathMatch ? decodeURIComponent(pathMatch[1]) : finalStoragePath;
          await supabase.storage.from('documentos-pmo').remove([rawPath]).catch(e => console.error(e));
        }

        const normalizePath = (str: string) => {
          return str
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") // Quitar tildes
            .replace(/[^a-zA-Z0-9._-]/g, "_") // Reemplazar caracteres especiales por guiones bajos
            .replace(/_{2,}/g, "_"); // Evitar guiones bajos duplicados
        };
        const safeName = normalizePath(entrevista.file.name);
        const filePath = `entrevistas/${projectId}/${Date.now()}_${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from('documentos-pmo')
          .upload(filePath, entrevista.file, { cacheControl: '3600', upsert: false });
        
        if (uploadError) throw uploadError;

        const { data: signedData } = await supabase.storage
          .from('documentos-pmo')
          .createSignedUrl(filePath, 3600);

        finalStoragePath = signedData?.signedUrl ?? filePath;
        finalFileName = entrevista.file.name;
      }

      const payload = {
        proyecto_id: projectId,
        nombre: entrevista.nombre,
        cargo: entrevista.cargo,
        area: entrevista.area,
        notas: entrevista.notas,
        storage_path: finalStoragePath,
        file_name: finalFileName,
      };

      if (entrevista.dbId) {
        const { error } = await supabase.from('entrevistas').update(payload).eq('id', entrevista.dbId);
        if (error) throw error;
        return { dbId: entrevista.dbId, storagePath: finalStoragePath, fileName: finalFileName };
      } else {
        const { data, error } = await supabase.from('entrevistas').insert(payload).select('id').single();
        if (error) throw error;
        return { dbId: data.id, storagePath: finalStoragePath, fileName: finalFileName };
      }
    } catch (err) {
      console.error('Error guardando entrevista', err);
      throw err;
    }
  };

  const deleteEntrevista = async (entrevista: EntrevistaLocal) => {
    try {
      if (entrevista.dbId) {
        // 1. Eliminar del Storage si tiene archivo
        if (entrevista.storagePath) {
          // Extraer ruta relativa del storage
          const pathMatch = entrevista.storagePath.match(/documentos-pmo\/(.+?)(?:\?token=|$)/);
          const rawPath = pathMatch ? decodeURIComponent(pathMatch[1]) : entrevista.storagePath;

          const { error: storageError } = await supabase.storage
            .from('documentos-pmo')
            .remove([rawPath]);
          
          if (storageError) {
            console.warn('Error eliminando archivo de storage:', storageError.message);
          }
        }

        // 2. Eliminar de la base de datos
        const { error: dbError } = await supabase
          .from('entrevistas')
          .delete()
          .eq('id', entrevista.dbId);
        
        if (dbError) throw dbError;
      }

      // 3. Actualizar estado local
      setEntrevistas((prev) => prev.filter((e) => e.id !== entrevista.id));
      toast.success('Entrevista eliminada correctamente');
    } catch (err) {
      console.error('Error eliminando entrevista', err);
      toast.error('Error al eliminar la entrevista');
      throw err;
    }
  };

  const processPhase = useCallback(async () => {
    setIsProcessing(true);
    setDiagnosis(null);
    setAgentError(null);
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
            phaseNumber: 2,
            iteration: 1,
            comments: null,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || result.success === false) {
        throw new Error(result.error ?? 'Error desconocido en el agente');
      }

      const reportedError = extractAgentError(result.data);
      if (reportedError) {
        setAgentError(reportedError);
        throw new Error(reportedError.message);
      }

      const diagnosisData = normalizeEntrevistasDiagnosis(result.data);
      if (!diagnosisData) {
        throw new Error('El Agente aun no devolvio un diagnostico de entrevistas valido.');
      }

      setDiagnosis(diagnosisData);
      setAgentError(null);

      return diagnosisData;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al contactar el agente';
      toast.error('Error en el Agente', { description: message });
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [projectId]);

  return {
    entrevistas,
    setEntrevistas,
    isLoadingData,
    isProcessing,
    diagnosis,
    agentError,
    fetchInitialData,
    saveEntrevista,
    deleteEntrevista,
    processPhase,
  };
}
