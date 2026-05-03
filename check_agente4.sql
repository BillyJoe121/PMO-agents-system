-- ============================================================
-- 1. Verificar qué hay en configuracion_agentes
-- ============================================================
SELECT fase_numero, 
       left(prompt_sistema, 80) AS prompt_preview,
       modelo,
       temperatura
FROM public.configuracion_agentes
ORDER BY fase_numero;
