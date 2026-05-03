-- ==========================================
-- SCRIPT: CREACIÓN DE TABLAS FASE 3 (ENCUESTAS)
-- ==========================================

DROP TABLE IF EXISTS public.encuestas_respuestas CASCADE;
DROP TABLE IF EXISTS public.encuestas_links CASCADE;
DROP TABLE IF EXISTS public.banco_preguntas CASCADE;

-- 1. Tabla: Banco de Preguntas
-- Almacena las preguntas estándar que se usarán en las encuestas de madurez.
CREATE TABLE IF NOT EXISTS public.banco_preguntas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    codigo TEXT NOT NULL UNIQUE, -- Ej: C01, E01, P01
    categoria TEXT NOT NULL, -- Ej: Cultura, Equipo, Proyecto
    texto_pregunta TEXT NOT NULL,
    tipo TEXT DEFAULT 'likert_10', -- Escala 0 al 10
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS para banco de preguntas (Solo lectura pública para las encuestas)
ALTER TABLE public.banco_preguntas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura pública del banco de preguntas"
    ON public.banco_preguntas FOR SELECT
    USING (true);


-- 2. Tabla: Links de Encuestas
-- Mapea un token único y seguro con un proyecto, para no exponer el ID del proyecto en la URL.
CREATE TABLE IF NOT EXISTS public.encuestas_links (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    proyecto_id UUID REFERENCES public.proyectos(id) ON DELETE CASCADE,
    token UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS para links
ALTER TABLE public.encuestas_links ENABLE ROW LEVEL SECURITY;

-- Consultores autenticados pueden crear links y administrarlos
CREATE POLICY "Acceso total a links para usuarios autenticados"
    ON public.encuestas_links FOR ALL TO authenticated
    USING (true);

-- Acceso anónimo/público SOLO de lectura para el token
CREATE POLICY "Lectura anónima de links activos"
    ON public.encuestas_links FOR SELECT
    USING (activo = true);


-- 3. Tabla: Respuestas de Encuestas
-- Almacena las respuestas enviadas por los stakeholders.
CREATE TABLE IF NOT EXISTS public.encuestas_respuestas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    proyecto_id UUID REFERENCES public.proyectos(id) ON DELETE CASCADE,
    link_id UUID REFERENCES public.encuestas_links(id) ON DELETE CASCADE,
    nombre_encuestado TEXT NOT NULL,
    cargo_encuestado TEXT NOT NULL,
    area_encuestado TEXT,
    respuestas JSONB NOT NULL, -- Formato: [{"pregunta_id": "uuid", "codigo": "GOB-01", "valor": 4}, ...]
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS para respuestas
ALTER TABLE public.encuestas_respuestas ENABLE ROW LEVEL SECURITY;

-- Consultores autenticados pueden ver todas las respuestas
CREATE POLICY "Lectura total de respuestas para usuarios autenticados"
    ON public.encuestas_respuestas FOR SELECT TO authenticated
    USING (true);

-- Usuarios anónimos SOLO pueden insertar respuestas (no leer las de otros)
CREATE POLICY "Inserción anónima de respuestas"
    ON public.encuestas_respuestas FOR INSERT
    WITH CHECK (true);


-- ==========================================
-- INSERTAR PREGUNTAS ESTÁNDAR (SEED DATA)
-- ==========================================
INSERT INTO public.banco_preguntas (codigo, categoria, texto_pregunta) VALUES
('C01', 'Cultura', 'Experiencia Organizacional'),
('C02', 'Cultura', 'Entorno de Trabajo'),
('C03', 'Cultura', 'Aceptación del Enfoque'),
('C04', 'Cultura', 'Confianza en el Equipo'),
('C05', 'Cultura', 'Toma de Decisiones'),
('C06', 'Cultura', 'Aceptación del Cambio'),
('C07', 'Cultura', 'Disponibilidad'),
('C08', 'Cultura', 'Documentación'),
('C09', 'Cultura', 'Entrega de Valor'),
('C10', 'Cultura', 'Incentivos y Métricas'),
('E01', 'Equipo', 'Tamaño del Equipo'),
('E02', 'Equipo', 'Habilidades y Experiencia'),
('E03', 'Equipo', 'Experiencia en Ágil'),
('E04', 'Equipo', 'Acceso al Cliente'),
('E05', 'Equipo', 'Ubicación'),
('E06', 'Equipo', 'Dedicación de Roles'),
('P01', 'Proyecto', 'Probabilidad de Cambio'),
('P02', 'Proyecto', 'Entrega Incremental'),
('P03', 'Proyecto', 'Entrega Iterativa'),
('P04', 'Proyecto', 'Criticidad del Producto'),
('P05', 'Proyecto', 'Claridad de Requisitos')
ON CONFLICT (codigo) DO NOTHING;
