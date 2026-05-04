import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { EncuestaResponse } from './useIdoneidad';

export function useMadurez(projectId: string | undefined, tipoEncuesta: 'predictiva' | 'agil') {
  const [activeLink, setActiveLink] = useState<string | null>(null);
  const [responses, setResponses] = useState<EncuestaResponse[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [externalFile, setExternalFile] = useState<File | null>(null);
  const [existingFileName, setExistingFileName] = useState<string | null>(null);
  const [existingFileUrl, setExistingFileUrl] = useState<string | null>(null);
  const deletedFilesRef = useRef<Set<string>>(new Set());

  const fetchInitialData = useCallback(async (isSilent = false) => {
    if (!projectId) return;
    if (!isSilent) setIsLoadingData(true);
    try {
      const { data: linkData } = await supabase
        .from('encuestas_links')
        .select('token')
        .eq('proyecto_id', projectId)
        .eq('activo', true)
        .eq('tipo_encuesta', tipoEncuesta)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (linkData) setActiveLink(linkData.token);
      else setActiveLink(null);

      const { data: respData } = await supabase
        .from('encuestas_respuestas')
        .select('*')
        .eq('proyecto_id', projectId)
        .eq('tipo_encuesta', tipoEncuesta)
        .order('created_at', { ascending: false });
        
      setResponses(respData || []);

      const { data: files } = await supabase.storage.from('documentos-pmo').list(`proyectos/${projectId}`);
      const prefix = `f5_${tipoEncuesta}_`;
      const f5Files = files?.filter(f => f.name.startsWith(prefix)) || [];
      if (f5Files.length > 0) {
        f5Files.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const latestFile = f5Files[0];
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
      console.error(`Error fetching madurez ${tipoEncuesta} data:`, err);
    } finally {
      if (!isSilent) setIsLoadingData(false);
    }
  }, [projectId, tipoEncuesta]);

  useEffect(() => {
    if (!projectId) return;
    fetchInitialData();
    const channel = supabase
      .channel(`realtime_${tipoEncuesta}_${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'encuestas_respuestas', filter: `proyecto_id=eq.${projectId}` }, () => {
        fetchInitialData(true);
      })
      .subscribe();
    const interval = setInterval(() => fetchInitialData(true), 5000);
    return () => { supabase.removeChannel(channel); clearInterval(interval); };
  }, [projectId, tipoEncuesta, fetchInitialData]);

  const generateLink = async () => {
    if (!projectId) return null;
    await supabase.from('encuestas_links').update({ activo: false }).eq('proyecto_id', projectId).eq('tipo_encuesta', tipoEncuesta);
    const { data, error } = await supabase.from('encuestas_links').insert({ proyecto_id: projectId, activo: true, tipo_encuesta: tipoEncuesta }).select('token').single();
    if (error) throw error;
    setActiveLink(data.token);
    return data.token;
  };

  const deleteFile = async () => {
    if (!projectId || !existingFileName) return;
    const path = `proyectos/${projectId}/${existingFileName}`;
    deletedFilesRef.current.add(existingFileName);
    setExistingFileName(null);
    setExistingFileUrl(null);
    const { error } = await supabase.storage.from('documentos-pmo').remove([path]);
    if (error) { deletedFilesRef.current.delete(existingFileName); throw error; }
  };

  const uploadFileIfAny = async () => {
    if (!projectId || !externalFile) return existingFileUrl;
    const path = `proyectos/${projectId}/f5_${tipoEncuesta}_${Date.now()}_${externalFile.name}`;
    const { error } = await supabase.storage.from('documentos-pmo').upload(path, externalFile);
    if (error) throw error;
    const { data } = await supabase.storage.from('documentos-pmo').createSignedUrl(path, 3600);
    return data?.signedUrl || null;
  };

  const clearExternalFile = () => {
    setExternalFile(null);
  };

  const downloadCSV = () => {
    if (!responses.length) return;
    
    const allQuestions = new Map<string, string>();
    
    // Identificar todas las preguntas únicas en las respuestas
    responses.forEach(r => {
      if (Array.isArray(r.respuestas)) {
        r.respuestas.forEach((ans, idx) => {
          const key = ans.id || ans.codigo || `Pregunta_${idx + 1}`;
          const text = ans.pregunta || ans.texto || key;
          allQuestions.set(key, text);
        });
      } else if (r.respuestas && typeof r.respuestas === 'object') {
        Object.keys(r.respuestas).forEach(k => allQuestions.set(k, k));
      }
    });
    
    const questionKeys = Array.from(allQuestions.keys());
    const header = ['Fecha', 'ID Respuesta', 'Nombre', 'Cargo', 'Área', ...questionKeys.map(k => `"${(allQuestions.get(k) || k).replace(/"/g, '""')}"`)].join(',');
    
    const rows = responses.map(r => {
      const date = `"${new Date(r.created_at).toLocaleString('es-CO')}"`;
      const resId = `"${r.id || 'Anónimo'}"`;
      
      const nombre = `"${(r.nombre_encuestado || 'N/A').replace(/"/g, '""')}"`;
      const cargo = `"${(r.cargo_encuestado || 'N/A').replace(/"/g, '""')}"`;
      const area = `"${(r.area_encuestado || 'N/A').replace(/"/g, '""')}"`;
      
      const answers = questionKeys.map(k => {
        let val: any = '';
        if (Array.isArray(r.respuestas)) {
          const ansObj = r.respuestas.find((a, idx) => 
            (a.id || a.codigo || `Pregunta_${idx + 1}`) === k
          );
          if (ansObj) {
            val = ansObj.valor !== undefined ? ansObj.valor : ansObj.respuesta !== undefined ? ansObj.respuesta : '';
            if (val === '' && typeof ansObj === 'object') {
                // Fallback si no encontramos la llave clásica
                val = Object.values(ansObj).find(v => typeof v === 'number' || typeof v === 'string') || '';
            }
          }
        } else if (r.respuestas && typeof r.respuestas === 'object') {
          val = r.respuestas[k];
        }
        
        if (val !== null && typeof val === 'object') val = JSON.stringify(val);
        return `"${String(val ?? '').replace(/"/g, '""')}"`;
      });
      
      return [date, resId, nombre, cargo, area, ...answers].join(',');
    });
    
    const csvContent = '\uFEFF' + [header, ...rows].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `respuestas_madurez_${tipoEncuesta}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return { activeLink, responses, isLoadingData, externalFile, setExternalFile, clearExternalFile, existingFileName, existingFileUrl, fetchInitialData, generateLink, deleteFile, uploadFileIfAny, downloadCSV };
}
