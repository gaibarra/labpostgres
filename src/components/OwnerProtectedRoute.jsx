import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';

/*
  OwnerProtectedRoute
  - Requiere usuario autenticado y que la membresía actual tenga is_owner true.
  - Si no es owner: redirige al inicio.
*/
export default function OwnerProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const { orgs, currentOrgId } = useTenant();
  const location = useLocation();

  if (loading) {
    return <div className="flex items-center justify-center h-screen text-sm text-muted-foreground">Cargando...</div>;
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (!currentOrgId) {
    return <div className="p-6">Selecciona o crea una organización para acceder.</div>;
  }
  const membership = orgs.find(o => o.org_id === currentOrgId);
  if (!membership?.organization) {
    return <div className="p-6">Sin datos de organización.</div>;
  }
  // is_owner no está en orgs mapping actual (solo org_id, role, organization). Podrías extender mapping; fallback: permitir sólo rol Administrador.
  // Ajuste: si deseas is_owner real agrega ese campo al select en TenantContext.
  if (membership.role !== 'Administrador') {
    return <Navigate to="/" replace />;
  }
  return children;
}
