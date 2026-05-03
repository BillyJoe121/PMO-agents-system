CREATE TABLE IF NOT EXISTS public.entrevistas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proyecto_id UUID REFERENCES public.proyectos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  cargo TEXT NOT NULL,
  area TEXT,
  notas TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.entrevistas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo a usuarios autenticados" ON public.entrevistas FOR ALL USING (auth.role() = 'authenticated');
