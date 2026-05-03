ALTER TABLE public.entrevistas ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE public.entrevistas ADD COLUMN IF NOT EXISTS file_name TEXT;
