import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { session, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#fafaf9] gap-3">
        <Loader2 className="animate-spin text-neutral-400" size={24} />
        <span className="text-neutral-500 text-[13px]" style={{ fontWeight: 500 }}>
          Verificando acceso...
        </span>
      </div>
    );
  }

  if (!session) {
    // Redirigir al login pero guardando la ubicación actual para volver después
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
