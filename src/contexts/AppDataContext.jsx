import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/apiClient';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const AppDataContext = createContext();

export const useAppData = () => useContext(AppDataContext);

const PAGE_SIZE = 15;

export const AppDataProvider = ({ children }) => {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  
  const [patients, setPatients] = useState([]);
  const [patientsPage, setPatientsPage] = useState(0);
  const [patientsCount, setPatientsCount] = useState(0);
  const [loadingPatients, setLoadingPatients] = useState(true);

  const [referrers, setReferrers] = useState([]);
  const [studies, setStudies] = useState([]);
  const [packages, setPackages] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadPatients = useCallback(async (page = 0) => {
    if (!user) {
      setLoadingPatients(false);
      return;
    }
    setLoadingPatients(true);
    try {
      // Backend currently returns up to 200; implement client-side pagination simulation
      const data = await apiClient.get('/patients');
      setPatients(data.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE));
      setPatientsCount(data.length);
      setPatientsPage(page);
    } catch (error) {
      toast({ title: 'Error cargando pacientes', description: error.message, variant: 'destructive' });
    } finally {
      setLoadingPatients(false);
    }
  }, [user, toast]);

  const loadData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      await loadPatients();
      const [referrersData, studiesData, packagesData, rolesData] = await Promise.all([
        apiClient.get('/referrers'),
        apiClient.get('/analysis'),
        apiClient.get('/packages'),
        apiClient.get('/roles')
      ]);
      setReferrers(referrersData?.data || referrersData);
      setStudies(studiesData?.data || studiesData);
      setPackages(packagesData?.data || packagesData);
      setRoles(rolesData?.data || rolesData);
    } catch (error) {
      toast({ title: 'Error cargando datos de la aplicación', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [user, toast, loadPatients]);

  // Evitar doble carga en StrictMode y solo recargar cuando cambia el usuario autenticado
  const loadedForUserRef = useRef(null);
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      setLoadingPatients(false);
      loadedForUserRef.current = null;
      return;
    }
    const userKey = user?.id || user?.email || 'anonymous';
    if (loadedForUserRef.current === userKey) return;
    loadedForUserRef.current = userKey;
    loadData();
  }, [authLoading, user, loadData]);

  const refreshData = useCallback(async (dataType) => {
    if (!user) return;
    if (dataType === 'patients') {
      await loadPatients(patientsPage); // Refresh current page
    }
    // Can be extended for other data types
  }, [user, loadPatients, patientsPage]);

  const value = {
    patients,
    patientsPage,
    patientsCount,
    PAGE_SIZE,
    loadingPatients,
    loadPatients,
    setPatients,
    referrers,
    setReferrers,
    studies,
    setStudies,
    packages,
    setPackages,
    loading,
    loadData,
    refreshData
    , roles, setRoles
  };

  return (
    <AppDataContext.Provider value={value}>
      {children}
    </AppDataContext.Provider>
  );
};