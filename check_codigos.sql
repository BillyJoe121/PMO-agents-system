SELECT LEFT(codigo, 3) as prefijo, count(*) as cantidad FROM public.banco_preguntas GROUP BY LEFT(codigo, 3);
