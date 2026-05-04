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
  roles_identificados?: string[];
  contexto_organizacional?: {
    sector?: string;
    tamanio_aproximado?: string;
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
}

export function useEntrevistas(projectId: string) {
  const [entrevistas, setEntrevistas] = useState<EntrevistaLocal[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [diagnosis, setDiagnosis] = useState<EntrevistasDiagnosis | null>(null);

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
        const innerDiagnosis = consolidated.diagnosis ? consolidated.diagnosis : consolidated;
        setDiagnosis(innerDiagnosis as EntrevistasDiagnosis);
      }
    } catch (err) {
      console.error('Error fetching initial phase 2 data', err);
    } finally {
      setIsLoadingData(false);
    }
  }, [projectId]);

  const saveEntrevista = async (entrevista: EntrevistaLocal) => {
    try {
      let finalStoragePath = entrevista.storagePath;
      let finalFileName = entrevista.fileName;

      // Upload file if attached and not yet uploaded
      if (entrevista.file && !entrevista.storagePath) {
        const filePath = `entrevistas/${projectId}/${Date.now()}_${entrevista.file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const { error: uploadError } = await supabase.storage
          .from('documentos-pmo') // Reusing the same bucket
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

      if (!response.ok || !result.success) {
        throw new Error(result.error ?? 'Error desconocido en el agente');
      }

      const diagnosisData: EntrevistasDiagnosis = result.data?.diagnosis ?? result.data;
      setDiagnosis(diagnosisData);

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
    fetchInitialData,
    saveEntrevista,
    deleteEntrevista,
    processPhase,
  };
}
