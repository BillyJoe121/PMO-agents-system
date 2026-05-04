import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase
    .from('fases_estado')
    .select('*')
    .eq('numero_fase', 5);

  if (error) {
    console.error(error);
    return;
  }
  console.log('Fase 5 records:', data);

  const { data: projs } = await supabase.from('proyectos').select('id, nombre');
  console.log('Proyectos:', projs);
}

check();
