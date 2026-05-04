import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export interface EncuestaResponse {
  id: string;
  nombre_encuestado: string;
  cargo_encuestado: string;
  area_encuestado: string;
  respuestas: any[];
  created_at: string;
}

export function useIdoneidad(projectId: string | undefined) {
  const [activeLink, setActiveLink] = useState<string | null>(null);
  const [responses, setResponses] = useState<EncuestaResponse[]>([]);
  const [diagnosis, setDiagnosis] = useState<any | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [externalFile, setExternalFile] = useState<File | null>(null);
  const [existingFileName, setExistingFileName] = useState<string | null>(null);
  const [existingFileUrl, setExistingFileUrl] = useState<string | null>(null);
  // Track locally-deleted files so polling doesn't restore them before Storage propagates
  const deletedFilesRef = useRef<Set<string>>(new Set());

  const fetchInitialData = useCallback(async (isSilent = false) => {
    if (!projectId) return;
    if (!isSilent) setIsLoadingData(true);
    try {
      // 1. Obtener link activo
      const { data: linkData } = await supabase
        .from('encuestas_links')
        .select('token')
        .eq('proyecto_id', projectId)
        .eq('activo', true)
        .eq('tipo_encuesta', 'idoneidad')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (linkData) {
        setActiveLink(linkData.token);
      }

      // 2. Obtener respuestas
      const { data: respData } = await supabase
        .from('encuestas_respuestas')
        .select('*')
        .eq('proyecto_id', projectId)
        .eq('tipo_encuesta', 'idoneidad')
        .order('created_at', { ascending: false });
        
      setResponses(respData || []);

      // 3. Obtener diagnóstico de la fase 3
      const { data: faseData } = await supabase
        .from('fases_estado')
        .select('datos_consolidados')
        .eq('proyecto_id', projectId)
        .eq('numero_fase', 3)
        .single();

      if (faseData?.datos_consolidados) {
        const consolidated = faseData.datos_consolidados as Record<string, any>;
        const innerDiagnosis = consolidated.diagnosis ? consolidated.diagnosis : consolidated;
        setDiagnosis(innerDiagnosis);
      }

      // 4. Buscar archivos de encuestas offline previos
      const { data: files } = await supabase.storage.from('documentos-pmo').list(`proyectos/${projectId}`);
      const f3Files = files?.filter(f => f.name.startsWith('f3_')) || [];
      if (f3Files.length > 0) {
        f3Files.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const latestFile = f3Files[0];
        // Skip files the user has deleted (Storage may lag)
        if (deletedFilesRef.current.has(latestFile.name)) {
          setExistingFileName(null);
          setExistingFileUrl(null);
        } else {
          setExistingFileName(latestFile.name);
          const { data: signedData } = await supabase.storage.from('documentos-pmo').createSignedUrl(`proyectos/${projectId}/${latestFile.name}`, 3600);
          setExistingFileUrl(signedData?.signedUrl || null);
        }
      } else {
        setExistingFileName(null);
        setExistingFileUrl(null);
      }
    } catch (err) {
      console.error("Error fetching idoneidad data:", err);
    } finally {
      if (!isSilent) setIsLoadingData(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;

    // Fetch inicial
    fetchInitialData();

    // 1. Suscripción a Realtime de Supabase
    const channel = supabase
      .channel(`realtime_respuestas_${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'encuestas_respuestas',
          filter: `proyecto_id=eq.${projectId}`, // Supabase realtime doesn't support multiple eq easily in basic filter, but we fetch Initial Data which will filter by tipo_encuesta
        },
        () => {
          console.log('[Realtime] Cambio detectado en encuestas_respuestas');
          fetchInitialData(true);
        }
      )
      .subscribe();

    // 2. Polling cada 5 segundos como fallback silencioso
    const interval = setInterval(() => {
      fetchInitialData(true);
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [projectId, fetchInitialData]);

  const generateLink = async () => {
    if (!projectId) return null;
    
    await supabase
      .from('encuestas_links')
      .update({ activo: false })
      .eq('proyecto_id', projectId)
      .eq('tipo_encuesta', 'idoneidad');

    const { data, error } = await supabase
      .from('encuestas_links')
      .insert({ proyecto_id: projectId, activo: true, tipo_encuesta: 'idoneidad' })
      .select('token')
      .single();

    if (error) throw error;
    setActiveLink(data.token);
    return data.token;
  };

  const processPhase = async () => {
    if (!projectId) return false;
    try {
      // Al confirmar el envío se invalida el enlace activo
      await supabase
        .from('encuestas_links')
        .update({ activo: false })
        .eq('proyecto_id', projectId)
        .eq('tipo_encuesta', 'idoneidad');
      
      setActiveLink(null);

      let finalFileUrl = existingFileUrl;
      if (externalFile) {
        const path = `proyectos/${projectId}/f3_${Date.now()}_${externalFile.name}`;
        const { error: uploadError } = await supabase.storage.from('documentos-pmo').upload(path, externalFile);
        if (uploadError) throw new Error(`Error subiendo archivo: ${uploadError.message}`);
        
        const { data: signedData } = await supabase.storage.from('documentos-pmo').createSignedUrl(path, 3600);
        finalFileUrl = signedData?.signedUrl;
      }

      const response = await supabase.functions.invoke('pmo-agent', {
        body: { projectId, phaseNumber: 3, iteration: 1, externalFileUrl: finalFileUrl }
      });
      if (response.error) throw new Error(response.error.message);
      return true;
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const deleteFile = async () => {
    if (!projectId || !existingFileName) return;
    const path = `proyectos/${projectId}/${existingFileName}`;
    // Register as deleted immediately so polling won't restore it
    deletedFilesRef.current.add(existingFileName);
    setExistingFileName(null);
    setExistingFileUrl(null);
    const { error } = await supabase.storage.from('documentos-pmo').remove([path]);
    if (error) {
      // Rollback the optimistic delete if storage call failed
      deletedFilesRef.current.delete(existingFileName);
      throw new Error(`Error eliminando archivo: ${error.message}`);
    }
  };

  return {
    activeLink,
    responses,
    diagnosis,
    isLoadingData,
    externalFile,
    setExternalFile,
    existingFileName,
    existingFileUrl,
    fetchInitialData,
    generateLink,
    processPhase,
    deleteFile,
  };
}
