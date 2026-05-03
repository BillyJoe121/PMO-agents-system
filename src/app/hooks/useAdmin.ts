import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────
export type QuestionType = 'abierta' | 'si_no' | 'multiple';
export type UserRole = 'auditor' | 'admin' | 'usuario_externo';

export interface AuditorUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  lastAccess: string;
  active: boolean;
}

export interface BankQuestion {
  id: string;
  text: string;
  dimension: string;
  surveyType: string;       // valor exacto de la DB: 'idoneidad' | 'madurez_predictiva' | 'madurez_agil'
  type: QuestionType;
  options?: string[];
  // edit buffer
  isEditing?: boolean;
  isNew?: boolean;
  editText?: string;
  editDimension?: string;
  editType?: QuestionType;
  editOptions?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK: Usuarios (tabla profiles)
// ─────────────────────────────────────────────────────────────────────────────
export function useAdminUsers() {
  const [users, setUsers] = useState<AuditorUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, updated_at, active')
        .order('full_name');

      if (error) throw error;

      const mapped: AuditorUser[] = (data ?? []).map(p => ({
        id: p.id,
        name: p.full_name ?? 'Sin nombre',
        email: p.email ?? '',
        role: (p.role as UserRole) ?? 'auditor',
        lastAccess: p.updated_at
          ? new Date(p.updated_at).toLocaleDateString('es-CO', {
              day: '2-digit', month: 'short', year: 'numeric',
            })
          : 'Sin registro',
        active: p.active !== false, // default true if undefined
      }));

      setUsers(mapped);
    } catch (err) {
      console.error('[useAdminUsers] Error:', err);
      toast.error('No se pudieron cargar los usuarios.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  /** Crear usuario via Edge Function (usa Service Role Key internamente) */
  const createUser = useCallback(async (
    name: string, email: string, password: string, role: UserRole
  ) => {
    const { data: { session } } = await supabase.auth.getSession();

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ name, email, password, role }),
      }
    );

    const result = await res.json();
    if (!result.success) throw new Error(result.error);

    await fetchUsers();
  }, [fetchUsers]);

  /** Actualizar usuario (nombre y rol) */
  const updateUser = useCallback(async (id: string, name: string, role: UserRole) => {
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: name, role })
      .eq('id', id);
    if (error) throw error;
    await fetchUsers();
  }, [fetchUsers]);

  /** Activar/Desactivar usuario (Soft delete) */
  const toggleUserActive = useCallback(async (id: string, currentActive: boolean) => {
    const { error } = await supabase
      .from('profiles')
      .update({ active: !currentActive })
      .eq('id', id);
    if (error) throw error;
    await fetchUsers();
  }, [fetchUsers]);

  return { users, isLoading, fetchUsers, createUser, updateUser, toggleUserActive };
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK: Banco de Preguntas (tabla banco_preguntas)
// ─────────────────────────────────────────────────────────────────────────────
export function useAdminQuestions() {
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchQuestions = useCallback(async () => {
    setIsLoading(true);
    try {
      let data: any[] | null = null;

      // Intentar primero con todas las columnas
      const res1 = await supabase
        .from('banco_preguntas')
        .select('*')
        .order('categoria', { ascending: true })
        .order('codigo', { ascending: true });

      if (!res1.error) {
        data = res1.data;
      } else {
        console.warn('[useAdminQuestions] Falló select * con order by categoria, codigo:', res1.error);
        // Fallback si no existen esas columnas de ordenamiento
        const res2 = await supabase.from('banco_preguntas').select('*');
        if (!res2.error) {
          data = res2.data;
        } else {
          console.error('[useAdminQuestions] Falló el fallback select *:', res2.error);
          throw res2.error;
        }
      }

      console.log('[useAdminQuestions] Datos obtenidos del banco:', data);

      const mapped: BankQuestion[] = (data ?? []).map((q: any) => {
        const st = q.tipo_encuesta || 'Idoneidad';
        return {
          id: q.id,
          text: q.texto_pregunta || q.pregunta_texto || '',
          dimension: q.categoria || q.dimension || '',
          surveyType: st,
          type: (q.tipo === 'likert_10' ? 'abierta' : 'si_no') as QuestionType, // Ajuste tentativo
          options: []
        };
      });

      setQuestions(mapped);
    } catch (err) {
      console.error('[useAdminQuestions] Error:', err);
      toast.error('No se pudieron cargar las preguntas.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  /** Actualizar texto de una pregunta */
  const updateQuestion = useCallback(async (id: string, text: string, dimension: string) => {
    const { error: err1 } = await supabase
      .from('banco_preguntas')
      .update({ texto_pregunta: text, categoria: dimension })
      .eq('id', id);

    if (err1) {
      await supabase
        .from('banco_preguntas')
        .update({ pregunta_texto: text, dimension })
        .eq('id', id);
    }

    setQuestions(prev =>
      prev.map(q => q.id === id ? { ...q, text, dimension, isEditing: false } : q)
    );
  }, []);

  /** Insertar nueva pregunta */
  const insertQuestion = useCallback(async (
    text: string, dimension: string, surveyType: string
  ) => {
    const { data, error: err1 } = await supabase
      .from('banco_preguntas')
      .insert({ texto_pregunta: text, categoria: dimension, codigo: surveyType })
      .select('id')
      .single();

    let newId = data?.id;
    if (err1) {
      const { data: d2 } = await supabase
        .from('banco_preguntas')
        .insert({ pregunta_texto: text, dimension, tipo_encuesta: surveyType })
        .select('id')
        .single();
      newId = d2?.id;
    }

    const newQ: BankQuestion = { id: newId || '', text, dimension, surveyType, type: 'si_no' };
    setQuestions(prev => [...prev, newQ]);
    return newQ;
  }, []);

  /** Eliminar pregunta */
  const deleteQuestion = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('banco_preguntas')
      .delete()
      .eq('id', id);

    if (error) throw error;
    setQuestions(prev => prev.filter(q => q.id !== id));
  }, []);

  /** Edición local (sin guardar aún) */
  const patchLocal = useCallback((id: string, patch: Partial<BankQuestion>) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...patch } : q));
  }, []);

  return {
    questions,
    isLoading,
    setQuestions,
    updateQuestion,
    insertQuestion,
    deleteQuestion,
    patchLocal,
  };
}
