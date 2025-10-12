import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useStudies, initialStudyFormState } from './studies/hooks/useStudies';
import StudiesHeader from './studies/StudiesHeader';
import StudiesTable from './studies/StudiesTable';
import StudiesCardView from './studies/StudiesCardView';
import StudiesModalsHost from './studies/StudiesModalsHost';
import StudyHelpDialog from './studies/StudyHelpDialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAuth } from '@/contexts/AuthContext';
import { useAppData } from '@/contexts/AppDataContext';

class StudiesErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state = { hasError:false, error:null }; }
  static getDerivedStateFromError(error){ return { hasError:true, error }; }
  componentDidCatch(error, info){ console.error('[StudiesErrorBoundary] error', error, info); }
  render(){
    if (this.state.hasError){
      return <div className="p-6 space-y-4"><h2 className="text-xl font-semibold text-red-600">Se produjo un error en Estudios</h2><p className="text-sm text-muted-foreground break-all">{this.state.error?.message}</p><button className="px-3 py-1 rounded bg-sky-600 text-white text-sm" onClick={()=> this.setState({ hasError:false, error:null })}>Reintentar</button></div>;
    }
    return this.props.children;
  }
}

const StudiesInner = () => {
  const { user: _user } = useAuth();
  const { referrers } = useAppData();
  const [searchTerm, setSearchTerm] = useState('');
  const {
    studies, studiesCount, loadingStudies, isSubmitting,
    getParticularPrice, handleSubmit, handleImmediateParameterSave,
    handleDeleteStudy, handleImmediateParameterDelete, persistParameterOrder,
    updateStudyPrices, studiesPage, setStudiesPage, PAGE_SIZE, totalStudiesPages,
    loadStudies
  } = useStudies(searchTerm);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentStudy, setCurrentStudy] = useState(initialStudyFormState);
  const [studyToDelete, setStudyToDelete] = useState(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isAIAssistOpen, setIsAIAssistOpen] = useState(false);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [studyForPricing, setStudyForPricing] = useState(null);
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);
  const [aiGeneratedData, setAiGeneratedData] = useState(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  // Estado para resaltar un rango inválido (paramIndex, rangeIndex)
  const [invalidHighlight, setInvalidHighlight] = useState(null);
  // Estado para mostrar modal de clave duplicada
  const [duplicateKeyError, setDuplicateKeyError] = useState(null);

  const handleNewStudyClick = () => {
    setCurrentStudy({ ...initialStudyFormState, parameters: [] });
    setIsFormOpen(true);
  };
  const handleEdit = useCallback((study)=>{
    const priceForParticular = getParticularPrice(study.id);
    setCurrentStudy(prev => ({ ...prev, ...study, particularPrice: priceForParticular === '0.00' ? '' : priceForParticular }));
    setIsFormOpen(true);
  }, [getParticularPrice]);
  const openDeleteConfirmDialog = useCallback((study)=>{ setStudyToDelete(study); setIsDeleteConfirmOpen(true); },[]);
  const handleAssignPrices = useCallback((study)=>{ setStudyForPricing(study); setIsPriceModalOpen(true); },[]);
  const handleFormSubmit = async (studyData) => {
    // Limpiar highlight previo
    setInvalidHighlight(null);
    // Cerrar cualquier modal de duplicado previo
    if (duplicateKeyError) setDuplicateKeyError(null);
    try {
      const success = await handleSubmit(studyData);
      if (success){
        setIsFormOpen(false);
        if (!studyData.id) setCurrentStudy(initialStudyFormState);
      }
    } catch (e) {
      // Captura de detalles de validación (cliente o servidor) con índices
      const d = e?.details || e; // algunos errores guardan las props en details
      // Mostrar modal específico cuando backend retorna DUPLICATE_KEY (409) para clave ya existente
      const code = e?.code || d?.code;
      if (code === 'DUPLICATE_KEY') {
        const field = d?.field || d?.details?.field || 'clave';
        const value = d?.value || d?.details?.value || studyData?.clave || '';
        setDuplicateKeyError({ field, value });
        // Mantener el formulario abierto para corregir
        setIsFormOpen(true);
        return; // no continuar con highlight logic
      }
      if (d && (typeof d.paramIndex === 'number' || typeof d.rangeIndex === 'number')) {
        setInvalidHighlight({
          paramIndex: typeof d.paramIndex === 'number' ? d.paramIndex : 0,
            rangeIndex: typeof d.rangeIndex === 'number' ? d.rangeIndex : 0,
            code: e?.code || d.code || 'UNKNOWN',
            ts: Date.now()
        });
        // Asegura que el formulario siga abierto para permitir corrección
        setIsFormOpen(true);
      }
      // No relanzamos para evitar toast duplicado (toast ya manejado en hook)
    }
  };
  const handleConfirmDelete = async () => { if (!studyToDelete) return; const success = await handleDeleteStudy(studyToDelete); if (success){ setStudyToDelete(null); setIsDeleteConfirmOpen(false); } };
  const handleAcceptAIPreview = (payload) => {
    const base = payload || aiGeneratedData || null;
    if (!base) { setIsPreviewModalOpen(false); return; }
    // Aislar datos IA: clonar profundamente y marcar como borrador IA
    const cloned = typeof structuredClone === 'function' ? structuredClone(base) : JSON.parse(JSON.stringify(base));
    cloned.id = null; // siempre como nuevo estudio al aceptar
    cloned._origin = 'ai';
    cloned._aiDraft = true;
    // Normalizar arrays defensivamente
    const normalizeRanges = (ranges) => {
      const arr = Array.isArray(ranges) ? ranges : [];
      return arr.map(vr => {
        const genderRaw = (vr.gender ?? vr.sexo ?? 'Ambos').toString().trim().toLowerCase();
        const gender = genderRaw.startsWith('m') ? 'masculino' : genderRaw.startsWith('f') ? 'femenino' : 'ambos';
        const age_min = vr.age_min ?? vr.edadMin ?? null;
        const age_max = vr.age_max ?? vr.edadMax ?? null;
        const age_unit = vr.age_unit ?? vr.unidadEdad ?? 'años';
        const normal_min = vr.normal_min ?? vr.valorMin ?? vr.lower ?? null;
        const normal_max = vr.normal_max ?? vr.valorMax ?? vr.upper ?? null;
        const tipoValor = vr.tipoValor || (vr.textoLibre ? 'textoLibre' : (vr.textoPermitido ? 'alfanumerico' : 'numerico'));
        const textoPermitido = vr.textoPermitido ?? '';
        const textoLibre = vr.textoLibre ?? '';
        const notas = vr.notas ?? '';
        return {
          // IDs locales se generarán más adelante en el editor si faltan
          gender,
          sexo: gender === 'masculino' ? 'Masculino' : gender === 'femenino' ? 'Femenino' : 'Ambos',
          age_min, edadMin: age_min,
          age_max, edadMax: age_max,
          age_unit, unidadEdad: age_unit,
          normal_min, valorMin: normal_min,
          normal_max, valorMax: normal_max,
          lower: normal_min, upper: normal_max,
          tipoValor, textoPermitido, textoLibre, notas,
        };
      });
    };
    cloned.parameters = (Array.isArray(cloned.parameters) ? cloned.parameters : []).map(p => ({
      ...p,
      decimal_places: typeof p.decimal_places === 'number' ? p.decimal_places : (typeof p.decimals === 'number' ? p.decimals : 0),
      unit: p.unit || p.unidad || p.units || '',
      valorReferencia: normalizeRanges(p.valorReferencia || p.reference_values || p.reference_ranges || p.rangos || [])
    }));
    setCurrentStudy(cloned);
    setIsPreviewModalOpen(false);
    setIsFormOpen(true);
    // Limpiar para evitar que otra aceptación accidental reutilice el mismo objeto
    setAiGeneratedData(null);
  };
  const handleCancelAIPreview = () => { setIsPreviewModalOpen(false); setAiGeneratedData(null); };

  const displayedStudies = studies;

  return (
    <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.5 }} className="flex flex-col h-full">
      <StudyHelpDialog open={isHelpDialogOpen} onOpenChange={setIsHelpDialogOpen} />
      <Card className="shadow-xl glass-card flex flex-col flex-grow mb-4">
        <StudiesHeader
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          onNewStudyClick={handleNewStudyClick}
          onAIAssist={()=> setIsAIAssistOpen(true)}
          onHelpClick={()=> setIsHelpDialogOpen(true)}
          currentPage={studiesPage}
          totalCount={studiesCount}
          pageSize={PAGE_SIZE}
          onPageChange={setStudiesPage}
          onSearch={(term)=> loadStudies(0, term)}
          totalStudiesPages={totalStudiesPages}
        />
        <CardContent className="flex-grow p-2 md:p-6 pt-0">
          {loadingStudies ? (
            <div className="flex justify-center items-center h-full flex-grow"><Loader2 className="h-8 w-8 animate-spin text-sky-600" /></div>
          ) : (
            <ScrollArea className="h-[calc(100vh-220px)]">
              {isMobile ? (
                <StudiesCardView
                  studies={displayedStudies}
                  onEdit={handleEdit}
                  onDeleteConfirm={openDeleteConfirmDialog}
                  onAssignPrices={handleAssignPrices}
                  getParticularPrice={getParticularPrice}
                />
              ) : (
                <div className="overflow-x-auto">
                  <StudiesTable
                    studies={displayedStudies}
                    onEdit={handleEdit}
                    onDeleteConfirm={openDeleteConfirmDialog}
                    onAssignPrices={handleAssignPrices}
                    getParticularPrice={getParticularPrice}
                  />
                </div>
              )}
            </ScrollArea>
          )}
        </CardContent>
        {!loadingStudies && studiesCount > 0 && (
          <CardFooter className="text-sm text-muted-foreground p-6 pt-0">Mostrando {studies.length} de {studiesCount} estudios.</CardFooter>
        )}
      </Card>

      <StudiesModalsHost
        isFormOpen={isFormOpen}
        setIsFormOpen={setIsFormOpen}
        currentStudy={currentStudy}
        handleFormSubmit={handleFormSubmit}
        invalidHighlight={invalidHighlight}
        isSubmitting={isSubmitting}
        loadingStudies={loadingStudies}
        studies={studies}
        studiesCount={studiesCount}
        PAGE_SIZE={PAGE_SIZE}
        getParticularPrice={getParticularPrice}
        studiesPage={studiesPage}
        setStudiesPage={setStudiesPage}
        totalStudiesPages={totalStudiesPages}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        onNewStudyClick={handleNewStudyClick}
        onEditStudy={handleEdit}
        onDeleteRequest={openDeleteConfirmDialog}
        onAssignPrices={handleAssignPrices}
        onAIAssist={()=> setIsAIAssistOpen(true)}
        onHelp={()=> setIsHelpDialogOpen(true)}
        isMobile={isMobile}
        studyToDelete={studyToDelete}
        setStudyToDelete={setStudyToDelete}
        isDeleteConfirmOpen={isDeleteConfirmOpen}
        setIsDeleteConfirmOpen={setIsDeleteConfirmOpen}
        handleConfirmDelete={handleConfirmDelete}
        isAIAssistOpen={isAIAssistOpen}
        setIsAIAssistOpen={setIsAIAssistOpen}
        aiGeneratedData={aiGeneratedData}
        setAiGeneratedData={setAiGeneratedData}
        isPreviewModalOpen={isPreviewModalOpen}
        setIsPreviewModalOpen={setIsPreviewModalOpen}
        handleAcceptAIPreview={handleAcceptAIPreview}
        handleCancelAIPreview={handleCancelAIPreview}
        studyForPricing={studyForPricing}
        setStudyForPricing={setStudyForPricing}
        isPriceModalOpen={isPriceModalOpen}
        setIsPriceModalOpen={setIsPriceModalOpen}
        updateStudyPrices={updateStudyPrices}
        referrers={referrers}
        persistParameterOrder={persistParameterOrder}
        handleImmediateParameterSave={handleImmediateParameterSave}
        handleImmediateParameterDelete={handleImmediateParameterDelete}
        getParticularPriceForStudy={getParticularPrice}
        duplicateKeyError={duplicateKeyError}
        setDuplicateKeyError={setDuplicateKeyError}
      />
    </motion.div>
  );
};

const Studies = (props) => (
  <StudiesErrorBoundary>
    <StudiesInner {...props} />
  </StudiesErrorBoundary>
);

export default Studies;