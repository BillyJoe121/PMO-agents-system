import { createBrowserRouter, Outlet, Navigate } from 'react-router';
import { AppProvider } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
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
 * Root layout: provee los proveedores globales.
 */
function Root() {
  return (
    <AuthProvider>
      <AppProvider>
        <Outlet />
      </AppProvider>
    </AuthProvider>
  );
}

/**
 * Componente para manejar el redireccionamiento del login
 * si el usuario ya tiene una sesión activa.
 */
function AuthRoute() {
  const { session, isLoading } = useAuth();
  
  if (isLoading) return null; // El ProtectedRoute ya maneja el loading principal
  if (session) return <Navigate to="/dashboard" replace />;
  
  return <AuthModule />;
}

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Root,
    children: [
      // ── Auth (index) ──
      { index: true, Component: AuthRoute },

      // ── Ruta pública: encuesta externa (no requiere layout ni auth) ──
      { path: 'survey/:surveyId', Component: ExternalSurveyView },

      // ── Rutas protegidas del dashboard ──
      {
        path: 'dashboard',
        element: (
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        ),
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

          // Detalle y resumen de proyecto
          { path: 'project/:id', Component: ProjectDetailView },
          { path: 'project/:id/summary', Component: ProjectSummaryView },

          // Fases específicas
          { path: 'project/:id/phase/1', Component: DocumentacionModule },
          { path: 'project/:id/phase/2', Component: EntrevistasModule },
          { path: 'project/:id/phase/3', Component: IdoneidadModule },
          { path: 'project/:id/phase/4', Component: TipoProyectosModule },
          { path: 'project/:id/phase/5', Component: MadurezModule },
          { path: 'project/:id/phase/6', Component: EnfoqueModule },
          { path: 'project/:id/phase/7', Component: GuiaMetodologicaView },
          { path: 'project/:id/phase/8', Component: ArtefactosView },

          // Fallback genérico para fases
          { path: 'project/:id/phase/:phaseNum', Component: GenericPhaseModule },
        ],
      },
    ],
  },
]);