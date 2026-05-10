import { Component, ErrorInfo, ReactNode } from 'react';
import { isRouteErrorResponse, useNavigate, useRouteError, useLocation } from 'react-router';
import { AlertTriangle, ArrowLeft, Loader2, RefreshCw } from 'lucide-react';

function StateShell({
  icon,
  eyebrow,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f7f8ff] flex items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <div className="w-14 h-14 rounded-2xl bg-white border border-neutral-200/80 flex items-center justify-center mx-auto mb-5 shadow-sm">
          {icon}
        </div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400 mb-2" style={{ fontWeight: 600 }}>
          {eyebrow}
        </p>
        <h1 className="text-neutral-900 tracking-tight mb-3" style={{ fontWeight: 600, fontSize: '1.35rem' }}>
          {title}
        </h1>
        <p className="text-neutral-500 text-[13px] leading-relaxed mb-7">
          {description}
        </p>
        {action}
      </div>
    </div>
  );
}

export function LoadingRouteState({ message = 'Cargando datos de la pantalla...' }: { message?: string }) {
  return (
    <StateShell
      icon={<Loader2 size={22} className="text-neutral-600 animate-spin" strokeWidth={1.75} />}
      eyebrow="Un momento"
      title="Preparando la vista"
      description={message}
    />
  );
}

export function MissingProjectState({
  title = 'Proyecto no disponible',
  description = 'No pudimos cargar este proyecto. Puede haber sido eliminado, no tienes acceso o la sesion necesita refrescarse.',
}: {
  title?: string;
  description?: string;
}) {
  const navigate = useNavigate();

  return (
    <StateShell
      icon={<AlertTriangle size={22} className="text-amber-500" strokeWidth={1.75} />}
      eyebrow="Vista no encontrada"
      title={title}
      description={description}
      action={
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-neutral-900 text-white text-[13px] transition-all hover:-translate-y-px"
            style={{ fontWeight: 500 }}
          >
            <ArrowLeft size={14} />
            Volver al dashboard
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white border border-neutral-200/80 text-neutral-700 text-[13px] transition-all hover:border-neutral-300"
            style={{ fontWeight: 500 }}
          >
            <RefreshCw size={14} />
            Recargar
          </button>
        </div>
      }
    />
  );
}

function CrashState({ error }: { error?: unknown }) {
  const message = error instanceof Error ? error.message : undefined;

  return (
    <StateShell
      icon={<AlertTriangle size={22} className="text-rose-500" strokeWidth={1.75} />}
      eyebrow="Error de pantalla"
      title="La vista no pudo cargarse"
      description={
        message
          ? `La aplicacion encontro un problema en esta pantalla: ${message}`
          : 'La aplicacion encontro un problema inesperado en esta pantalla.'
      }
      action={
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => window.location.assign('/dashboard')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-neutral-900 text-white text-[13px] transition-all hover:-translate-y-px"
            style={{ fontWeight: 500 }}
          >
            <ArrowLeft size={14} />
            Dashboard
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white border border-neutral-200/80 text-neutral-700 text-[13px] transition-all hover:border-neutral-300"
            style={{ fontWeight: 500 }}
          >
            <RefreshCw size={14} />
            Recargar
          </button>
        </div>
      }
    />
  );
}

class ErrorBoundaryInner extends Component<
  { children: ReactNode; resetKey: string },
  { error: unknown }
> {
  state = { error: null as unknown };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('[AppErrorBoundary] Unhandled render error:', error, info);
  }

  componentDidUpdate(prevProps: { resetKey: string }) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) return <CrashState error={this.state.error} />;
    return this.props.children;
  }
}

export function AppErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  return <ErrorBoundaryInner resetKey={location.pathname}>{children}</ErrorBoundaryInner>;
}

export function RouteErrorFallback() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : undefined;

  return <CrashState error={message ? new Error(message) : error} />;
}
