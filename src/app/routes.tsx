import { createBrowserRouter, Outlet } from 'react-router';
import { AppProvider } from './context/AppContext';
import AuthModule from './components/auth/AuthModule';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './components/dashboard/Dashboard';
import ProjectDetailView from './components/project/ProjectDetailView';
import ProjectSummaryView from './components/project/ProjectSummaryView';
import IdoneidadModule from './components/phases/IdoneidadModule';
import EntrevistasModule from './components/phases/EntrevistasModule';
import DocumentacionModule from './components/phases/DocumentacionModule';
import TipoProyectosModule from './components/phases/TipoProyectosModule';
import MadurezModule from './components/phases/MadurezModule';
import EnfoqueModule from './components/phases/EnfoqueModule';
import GenericPhaseModule from './components/phases/GenericPhaseModule';
import GuiaMetodologicaView from './components/phases/GuiaMetodologicaView';
import ArtefactosView from './components/phases/ArtefactosView';
import ExternalSurveyView from './components/survey/ExternalSurveyView';
import AdminPanelView from './components/admin/AdminPanelView';
import Papelera from './pages/Papelera';
import PlaceholderPage from './components/layout/PlaceholderPage';

/**
 * Root layout: provee AppProvider a todo el árbol del router.
 * CRÍTICO: createBrowserRouter crea un árbol de renderizado aislado;
 * los contextos del componente padre en App.tsx NO se propagan aquí.
 * Por eso AppProvider vive dentro del router como ruta raíz.
 */
function Root() {
  return (
    <AppProvider>
      <Outlet />
    </AppProvider>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Root,
    children: [
      // ── Auth (index) ──
      { index: true, Component: AuthModule },

      // ── Ruta pública: encuesta externa (no requiere layout) ──
      { path: 'survey/:surveyId', Component: ExternalSurveyView },

      // ── Rutas protegidas del dashboard ──
      {
        path: 'dashboard',
        Component: AppLayout,
        children: [
          { index: true, Component: Dashboard },

          // Placeholders de módulos
          {
            path: 'auditoria',
            Component: () => (
              <PlaceholderPage
                title="Auditoría"
                description="Módulo de auditoría y reportes ejecutivos. Disponible próximamente."
              />
            ),
          },
          {
            path: 'ajustes',
            Component: () => (
              <PlaceholderPage
                title="Ajustes"
                description="Configuración de la plataforma, perfiles de usuario y preferencias."
              />
            ),
          },

          // Panel de administración y Papelera
          { path: 'admin', Component: AdminPanelView },
          { path: 'papelera', Component: Papelera },

          // Detalle y resumen de proyecto (rutas dinámicas — :id se resuelve vía useParams)
          { path: 'project/:id', Component: ProjectDetailView },
          { path: 'project/:id/summary', Component: ProjectSummaryView },

          // Fases específicas (:id + :phaseNum capturados con useParams para queries a Supabase)
          { path: 'project/:id/phase/1', Component: DocumentacionModule },
          { path: 'project/:id/phase/2', Component: EntrevistasModule },
          { path: 'project/:id/phase/3', Component: IdoneidadModule },
          { path: 'project/:id/phase/4', Component: TipoProyectosModule },
          { path: 'project/:id/phase/5', Component: MadurezModule },
          { path: 'project/:id/phase/6', Component: EnfoqueModule },
          { path: 'project/:id/phase/7', Component: GuiaMetodologicaView },
          { path: 'project/:id/phase/8', Component: ArtefactosView },

          // Fallback genérico para fases 5, 6
          { path: 'project/:id/phase/:phaseNum', Component: GenericPhaseModule },
        ],
      },
    ],
  },
]);