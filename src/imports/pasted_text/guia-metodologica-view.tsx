Módulo 8 — Fase 7: Guía Metodológica (Visor e Iteración documental)
Contexto del Componente: Genera el módulo para la Fase 7 en React (GuiaMetodologicaView.tsx). Este componente funciona como un visor de documentos generados por IA con un panel lateral para solicitar ajustes iterativos.
1. Layout de Panel Dividido Asimétrico (70% / 30%):
•	Utiliza CSS Grid para crear una columna izquierda predominante (col-span-8) y una derecha más estrecha (col-span-4).
2. Columna Izquierda — Visor de Documentos (RF-F7-03):
•	Barra de Herramientas del Visor: Una cabecera gris clara que contenga el título del documento ("Guía Metodológica Corporativa"), la versión actual (ej. "Versión 2 - Revisada"), y dos botones de esquema a la derecha: "Descargar DOCX" y "Descargar PDF".
•	Lienzo del Visor: Un contenedor grande con fondo gris oscuro (bg-gray-800). En el centro, un contenedor blanco con sombra pronunciada (shadow-2xl) y proporciones de página A4, que servirá como placeholder para el iframe o visor del PDF renderizado.
3. Columna Derecha — Panel de Iteración y Control (RF-F7-04, 05, 06):
•	Historial de Versiones: Una lista vertical compacta mostrando el rastro de auditoría. Ej: "Versión 1 - Generada [Fecha]", "Versión 2 - Revisada con comentarios".
•	Panel de Ajustes: * Un <textarea> con el label "Solicitar ajustes al documento". Debe tener un placeholder explicativo: "Ej: Modifica el capítulo 3 para incluir el framework Scrum...".
o	Botón de acción: "Re-procesar Guía con Agente 7" (color amarillo/ámbar). Al presionarse, el visor izquierdo debe mostrar una superposición de carga ("Generando nueva versión...").
•	Cierre de Fase (Sticky Bottom): En la base de la columna, anclado al fondo, un botón masivo verde sólido: "Aprobar Guía Metodológica".
4. Modal de Confirmación:
•	El botón de aprobación verde debe disparar un modal advirtiendo: "Al aprobar esta guía, la Fase 7 se cerrará y se enviará la estructura al Agente 8 para generar los artefactos. ¿Continuar?".
5. Trazabilidad de Código (Comentarios):
•	// RF-F7-03: Integrar react-pdf o iframe nativo apuntando a la signedUrl de Supabase Storage
•	// TODO: Ocultar panel de iteración si el estado_fase es 'completado'
•	// TODO: webhook n8n_agente_7_reproceso(proyecto_id, version_actual, comentario)
6. Estilo y UX:
•	Usa Tailwind CSS.
•	El visor de PDF/Documento debe ocupar la altura máxima disponible de la pantalla (h-[calc(100vh-theme(spacing.32))]) con scroll independiente, permitiendo leer el documento sin perder de vista el botón de aprobar.
Módulo 9 — Fase 8: Artefactos (Gestor de Paquetes y Entrega Final)
Contexto del Componente: Genera el módulo final para la Fase 8 en React (ArtefactosView.tsx). Este componente debe renderizar múltiples archivos generados por el Agente 8 (plantillas, matrices, actas) y permitir iteración global antes de cerrar el proyecto.
1. Layout Principal (Grid 70/30):
•	Emplea un layout de dos columnas análogo al de la Fase 7. Columna izquierda (col-span-8) para el grid de artefactos y columna derecha (col-span-4) para iteración.
2. Columna Izquierda — Grid de Artefactos (RF-F8-03, 04):
•	Cabecera de Sección: Título "Paquete de Artefactos de Soporte" y un botón primario alineado a la derecha: "Descargar todos (ZIP)".
•	Cuadrícula de Archivos: Renderiza un CSS Grid (grid-cols-2 o grid-cols-3) con tarjetas para cada archivo.
•	Tarjeta de Artefacto:
o	Icono representativo del formato (Word, Excel, PDF).
o	Nombre del archivo (ej. Matriz_Riesgos_V1.xlsx).
o	Descripción corta del propósito de la plantilla.
o	Botones inferiores: "Visualizar" (outline) y "Descargar" (sólido).
3. Columna Derecha — Iteración y Cierre (RF-F8-05, 06):
•	Historial y Ajustes: Un área de texto (textarea) etiquetada "Solicitar ajustes al paquete de artefactos".
•	Botón de acción: "Re-procesar Artefactos" (color amarillo/ámbar).
•	Acción Definitiva (Cierre del Proyecto): En la base, un botón verde masivo y destacado: "Aprobar Artefactos y Completar Proyecto".
4. Modal de Confirmación Crítica:
•	El botón verde final debe disparar un Modal de confirmación estricto: "Está a punto de aprobar los artefactos y cerrar definitivamente el proyecto. No se permitirán más modificaciones. ¿Desea proceder?".
5. Trazabilidad de Código:
•	// RF-F8-04: Implementar JSZip o llamar a endpoint de Supabase Edge Function para comprimir
•	// TODO: Mutación final -> update public.proyectos set fecha_cierre = NOW()
6. Estilo y UX:
•	Usa Tailwind CSS.
•	Las tarjetas de los artefactos deben tener un efecto hover:shadow-md para incitar a la interacción.
________________________________________
Prompt: Módulo 10 — Resumen Consolidado de Proyecto (Reporte Ejecutivo)
Contexto del Componente: Genera la vista de Resumen Consolidado en React (ProjectSummaryView.tsx), solicitada en Joe (RF-PROJ-09 y RF-F8-07). Es una vista estrictamente de solo lectura (Read-Only) para exportación y presentación ejecutiva.
1. Layout de Documento Continuo:
•	Diseño de página única con scroll vertical, optimizado para impresión o exportación a PDF (max-w-5xl mx-auto bg-white p-10 shadow-lg).
2. Encabezado del Reporte:
•	Logos institucionales (placeholder).
•	Título grande: "Diagnóstico Consolidado de PMO".
•	Metadatos en formato de tabla o grid de 2 columnas: Nombre de la Empresa, Nombre del Proyecto, Fecha de Inicio, Fecha de Cierre, Consultores Asignados.
•	Botón de acción superior (no imprimible): "Exportar a PDF".
3. Estructura de Secciones (Vertical Stack):
•	Sección 1: Diagnóstico de Idoneidad: Grid de tarjetas con el Score Final y los hallazgos principales del Agente 1 y 2.
•	Sección 2: Entorno y Madurez: Layout de dos columnas. Izquierda: Gráfico de radar (Spider Chart) de la Madurez. Derecha: Tipo de PMO (Ágil/Predictiva/Híbrida) y justificación.
•	Sección 3: Enfoque Estratégico: Párrafos de texto extraídos de la Fase 6.
•	Sección 4: Entregables: Una tabla resumen enumerando la Guía Metodológica y todos los Artefactos, cada uno con un link directo de descarga.
4. Trazabilidad de Código:
•	// TODO: fetch de todas las tablas uniendo por proyecto_id
•	// RF-F8-07: Implementar html2pdf.js o react-to-print para el botón de exportación
•	// CRÍTICO: Asegurar que no existan inputs, textareas ni botones de mutación en este componente.
5. Estilo y UX:
•	Usa Tailwind CSS enfocándote en clases de tipografía (prose, leading-relaxed, text-gray-800).
•	Emplea divisores visuales (hr o bordes inferiores) para separar claramente cada sección analítica.
Módulo 11 — Vista Externa de Encuestas (Interfaz para el Cliente)
Contexto del Componente: Genera una interfaz de encuesta pública en React (ExternalSurveyView.tsx). Esta vista debe estar optimizada para la recolección de datos masiva, con un diseño "Distraction-Free" (libre de distracciones), enfocado al 100% en la legibilidad y facilidad de respuesta.
1. Layout "Distraction-Free" (Centrado):
•	No incluyas sidebars ni menús de navegación complejos.
•	Header: Logo de la organización (placeholder), nombre de la encuesta (ej. "Encuesta de Madurez de la PMO") y una barra de progreso horizontal (Progress Bar) que se actualice en tiempo real.
•	Cuerpo: Un contenedor central estrecho (max-w-2xl) para enfocar la atención en la pregunta actual.
2. Flujo Paso a Paso (RF-F1-02, RF-F5-02):
•	Implementa la lógica de una sola pregunta por pantalla.
•	Componente Pregunta:
o	Texto de la pregunta en tipografía grande (text-2xl).
o	Opciones de Respuesta: Renderiza una Escala Likert de 5 puntos mediante tarjetas de opción vertical u horizontalmente. Cada opción debe tener un estado :hover y :active con el color institucional.
•	Navegación: Botones inferiores de "Anterior" y "Siguiente". El botón "Siguiente" debe permanecer deshabilitado hasta que se seleccione una opción.
3. Pantalla de Finalización:
•	Al completar la última pregunta, realiza una transición hacia una pantalla de "Agradecimiento".
•	Elementos: Icono de éxito, texto: "Sus respuestas han sido registradas correctamente. Gracias por contribuir al diagnóstico de la PMO", y un botón opcional para cerrar la pestaña.
4. Adaptabilidad (Responsive):
•	Crítico: Asegura que este componente sea 100% funcional en dispositivos móviles (iPhone/Android). Los botones deben tener un tamaño táctil mínimo de 44px.
5. Trazabilidad de Código (Comentarios):
•	// TODO: fetch('banco_preguntas') usando el 'id_encuesta' de la URL (useParams)
•	// TODO: Mutación insert en 'respuestas_encuesta' por cada respuesta confirmada
•	// TODO: Manejar estado local 'currentStep' para la navegación entre preguntas
6. Estilo y UX:
•	Usa Tailwind CSS.
•	Diseño minimalista con mucho espacio en blanco (padding).
•	Tipografía con alto contraste para asegurar accesibilidad.
________________________________________
Prompt: Módulo 12 — Panel de Administración (Gestión de Usuarios y Preguntas)
Contexto del Componente: Genera la interfaz de administración (AdminPanelView.tsx) solicitada en el requisito RF-AUTH-06. Esta vista permite gestionar el acceso de los consultores y configurar el contenido técnico de las encuestas.
1. Layout de Panel Administrativo:
•	Sidebar izquierdo con dos secciones: "Gestión de Usuarios" y "Banco de Preguntas".
2. Sección A: Gestión de Usuarios (Consultores):
•	Tabla de Usuarios: Columnas para Nombre, Email, Rol (Auditor/Admin) y Último Acceso.
•	Acciones: Botón "+ Crear Consultor" que abra un formulario lateral para ingresar email y asignar contraseña inicial. Botones de "Editar" y "Desactivar" cuenta.
3. Sección B: Banco de Preguntas (RF-F1-02):
•	Filtros: Selector por tipo de encuesta (Idoneidad, Madurez Predictiva, Madurez Ágil).
•	Gestor de Contenido: Lista de preguntas con capacidad de edición en línea.
o	Cada fila permite modificar el texto de la pregunta y la Dimensión a la que pertenece (ej. Procesos, Personas, Tecnología).
o	Botón para "+ Agregar Pregunta" al final del catálogo.
4. Trazabilidad de Código:
•	// TODO: supabase.auth.admin.createUser() - Requiere Service Role Key
•	// TODO: select * from banco_preguntas order by tipo_encuesta, dimension
•	// TODO: update banco_preguntas set pregunta_texto = '...' where id = '...'
5. Estilo y UX:
•	Estilo de tabla "Data Grid" limpio, con capacidad de ordenamiento por columnas.
•	Colores sobrios para diferenciar el área administrativa del área operativa.

