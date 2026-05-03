import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface BancoPregunta {
  id: string;
  codigo: string;
  categoria: string;
  texto_pregunta: string;
}

export interface EncuestaLink {
  id: string;
  proyecto_id: string;
  token: string;
  activo: boolean;
}

export function useEncuestaExterna(token: string) {
  const [linkInfo, setLinkInfo] = useState<EncuestaLink | null>(null);
  const [preguntas, setPreguntas] = useState<BancoPregunta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!token) {
        setError('Token no válido');
        setIsLoading(false);
        return;
      }
      
      try {
        // 1. Validar el token
        const { data: linkData, error: linkError } = await supabase
          .from('encuestas_links')
          .select('*')
          .eq('token', token)
          .eq('activo', true)
          .single();

        if (linkError || !linkData) {
          setError('El enlace de la encuesta es inválido o ha expirado.');
          setIsLoading(false);
          return;
        }

        setLinkInfo(linkData);

        // 2. Cargar preguntas del banco
        const { data: qData, error: qError } = await supabase
          .from('banco_preguntas')
          .select('id, codigo, categoria, texto_pregunta')
          .order('codigo', { ascending: true });

        if (qError) throw qError;
        setPreguntas(qData || []);

      } catch (err) {
        console.error(err);
        setError('Error al cargar la encuesta. Inténtalo más tarde.');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [token]);

  const submitRespuestas = async (
    nombre: string,
    cargo: string,
    area: string,
    respuestas: Record<string, number>
  ) => {
    if (!linkInfo) throw new Error('No hay link info');

    // Convert Record<string, number> to array of objects
    const respuestasArray = Object.entries(respuestas).map(([qId, valor]) => {
      const p = preguntas.find((x) => x.id === qId);
      return {
        pregunta_id: qId,
        codigo: p?.codigo,
        valor
      };
    });

    const { error: insertError } = await supabase
      .from('encuestas_respuestas')
      .insert({
        proyecto_id: linkInfo.proyecto_id,
        link_id: linkInfo.id,
        nombre_encuestado: nombre,
        cargo_encuestado: cargo,
        area_encuestado: area,
        respuestas: respuestasArray
      });

    if (insertError) throw insertError;
    return true;
  };

  return { linkInfo, preguntas, isLoading, error, submitRespuestas };
}
