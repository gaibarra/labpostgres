import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
// Multi-org pendiente: implementar endpoints backend antes de habilitar.
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { logAuditEvent } from '@/lib/auditUtils';

/*
  TenantContext
  - Holds current organization (tenant) and list of organizations user belongs to.
  - Provides switchOrg and createOrganization helpers.
  - Persiste en memoria; cuando implementemos multi-org, usaremos backend.
*/
const TenantContext = createContext(undefined);
// const LOCAL_KEY = 'app.current_org_id';

export const TenantProvider = ({ children }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [orgs, setOrgs] = useState([]);
  const [currentOrgId, setCurrentOrgId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  const loadMemberships = useCallback(async () => {
    // Temporary single-tenant stub until backend multi-org implemented
    if (!user) { setOrgs([]); setCurrentOrgId(null); setInitializing(false); return; }
    setLoading(true);
    try {
      const single = [{
        org_id: 'default-org',
        role: 'Administrador',
        is_owner: true,
        organization: { id: 'default-org', name: 'Laboratorio', slug: 'laboratorio', plan_id: 'free', status: 'active' }
      }];
      setOrgs(single);
  // Sin persistencia local: por ahora fijamos 'default-org' en memoria.
  setCurrentOrgId('default-org');
    } finally {
      setLoading(false);
      setInitializing(false);
    }
  }, [user]);

  useEffect(() => { loadMemberships(); }, [loadMemberships]);

  const currentOrg = useMemo(() => orgs.find(o => o.org_id === currentOrgId)?.organization || null, [orgs, currentOrgId]);
  const currentRole = useMemo(() => orgs.find(o => o.org_id === currentOrgId)?.role || null, [orgs, currentOrgId]);
  const currentIsOwner = useMemo(() => orgs.find(o => o.org_id === currentOrgId)?.is_owner || false, [orgs, currentOrgId]);

  const switchOrg = useCallback(async (orgId) => {
    if (!orgs.some(o => o.org_id === orgId)) {
      toast({ title: 'Organización inválida', description: 'No perteneces a esta organización.', variant: 'destructive' });
      return;
    }
    setCurrentOrgId(orgId);
  // Persistencia pendiente a backend cuando tengamos multi-org.
    await logAuditEvent('Tenant:Switch', { to: orgId }, user?.id || 'Sistema');
  }, [orgs, toast, user]);

  const createOrganization = useCallback(async (_name) => {
    return { error: new Error('Multi-organización no habilitada actualmente') };
  }, []);

  const value = useMemo(() => ({
    orgs,
    currentOrg,
    currentOrgId,
    currentRole,
    currentIsOwner,
    loading,
    initializing,
    switchOrg,
    reload: loadMemberships,
    createOrganization
  }), [orgs, currentOrg, currentOrgId, currentRole, currentIsOwner, loading, initializing, switchOrg, loadMemberships, createOrganization]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
};

export const useTenant = () => {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant debe usarse dentro de TenantProvider');
  return ctx;
};
