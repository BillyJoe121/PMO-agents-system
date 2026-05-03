-- PASO 1: Ver qué hay actualmente en configuracion_agentes
SELECT fase_numero, modelo, temperatura, 
       length(prompt_sistema) AS prompt_length,
       left(prompt_sistema, 60) AS prompt_preview
FROM public.configuracion_agentes
ORDER BY fase_numero;

-- PASO 2: Forzar gemini-1.5-flash en TODOS los agentes (el que funciona)
UPDATE public.configuracion_agentes
SET modelo = 'gemini-1.5-flash'
WHERE modelo = 'gemini-1.5-pro' OR modelo IS NULL;

-- PASO 3: Si no existe la fila para fase 4, crearla mínima
-- (reemplaza el prompt con el completo del archivo update_prompt_fase_4.sql)
INSERT INTO public.configuracion_agentes (fase_numero, modelo, temperatura, prompt_sistema)
VALUES (4, 'gemini-1.5-flash', 0.2, 'PLACEHOLDER - reemplaza con el prompt completo')
ON CONFLICT (fase_numero) DO UPDATE SET
  modelo = 'gemini-1.5-flash';

-- PASO 4: Confirmar resultado
SELECT fase_numero, modelo, length(prompt_sistema) AS prompt_chars
FROM public.configuracion_agentes
ORDER BY fase_numero;
