import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(url, key);

async function test() {
  const { data } = await supabase
    .from('banco_preguntas')
    .select('id, codigo, categoria');

  console.log('All questions:', data);
}

test();
