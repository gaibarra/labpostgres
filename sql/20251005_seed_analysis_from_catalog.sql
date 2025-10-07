-- Nota: Eliminamos BEGIN/COMMIT externos para permitir diagnóstico granular dentro del DO.
DO $$
DECLARE
  seed jsonb := $CATALOG$[
    {"key":"vcm","name":"Volumen Corpuscular Medio","unit":"fL","dec":1,"categories":["Biometría Hemática"],"groups":[{"sex":"Ambos","min":0,"max":1,"lower":84,"upper":106},{"sex":"Ambos","min":1,"max":2,"lower":72,"upper":84},{"sex":"Ambos","min":2,"max":12,"lower":76,"upper":90},{"sex":"Ambos","min":12,"max":18,"lower":78,"upper":95},{"sex":"Femenino","min":18,"max":120,"lower":80,"upper":96},{"sex":"Masculino","min":18,"max":120,"lower":80,"upper":96}]},
    {"key":"hcm","name":"Hemoglobina Corpuscular Media","unit":"pg","dec":1,"categories":["Biometría Hemática"],"groups":[{"sex":"Ambos","min":0,"max":1,"lower":28,"upper":40},{"sex":"Ambos","min":1,"max":2,"lower":23,"upper":31},{"sex":"Ambos","min":2,"max":12,"lower":25,"upper":33},{"sex":"Ambos","min":12,"max":18,"lower":26,"upper":34},{"sex":"Femenino","min":18,"max":120,"lower":27,"upper":33},{"sex":"Masculino","min":18,"max":120,"lower":27,"upper":33}]},
    {"key":"rdw","name":"Amplitud de Distribución Eritrocitaria","unit":"%","dec":1,"categories":["Biometría Hemática"],"groups":[{"sex":"Ambos","min":0,"max":1,"lower":14,"upper":18},{"sex":"Ambos","min":1,"max":2,"lower":12.5,"upper":15.5},{"sex":"Ambos","min":2,"max":12,"lower":11.5,"upper":14.5},{"sex":"Ambos","min":12,"max":120,"lower":11,"upper":14.5}]},
    {"key":"glucosa","name":"Glucosa","unit":"mg/dL","dec":0,"categories":["Química Sanguínea"],"groups":[{"sex":"Ambos","min":0,"max":2,"lower":60,"upper":110},{"sex":"Ambos","min":2,"max":12,"lower":70,"upper":105},{"sex":"Ambos","min":12,"max":120,"lower":70,"upper":99}]},
  {"key":"urea","name":"Urea","unit":"mg/dL","dec":0,"categories":["Renal"],"groups":[{"sex":"Ambos","min":0,"max":1,"lower":3,"upper":18},{"sex":"Ambos","min":1,"max":12,"lower":7,"upper":20},{"sex":"Ambos","min":12,"max":120,"lower":10,"upper":40}]},
    {"key":"creatinina","name":"Creatinina","unit":"mg/dL","dec":2,"categories":["Renal"],"groups":[{"sex":"Ambos","min":0,"max":1,"lower":0.20,"upper":0.50},{"sex":"Ambos","min":1,"max":12,"lower":0.30,"upper":0.70},{"sex":"Femenino","min":12,"max":120,"lower":0.50,"upper":1.00},{"sex":"Masculino","min":12,"max":120,"lower":0.60,"upper":1.20}]},
    {"key":"acido_urico","name":"Ácido Úrico","unit":"mg/dL","dec":1,"categories":["Metabólico"],"groups":[{"sex":"Ambos","min":0,"max":12,"lower":2.0,"upper":5.5},{"sex":"Femenino","min":12,"max":120,"lower":2.4,"upper":6.0},{"sex":"Masculino","min":12,"max":120,"lower":3.4,"upper":7.0}]},
    {"key":"colesterol_total","name":"Colesterol Total","unit":"mg/dL","dec":0,"categories":["Perfil Lipídico"],"groups":[{"sex":"Ambos","min":0,"max":12,"lower":120,"upper":200},{"sex":"Ambos","min":12,"max":120,"lower":125,"upper":200}]},
    {"key":"hdl","name":"Colesterol HDL","unit":"mg/dL","dec":0,"categories":["Perfil Lipídico"],"groups":[{"sex":"Ambos","min":0,"max":12,"lower":35,"upper":80},{"sex":"Femenino","min":12,"max":120,"lower":50,"upper":90},{"sex":"Masculino","min":12,"max":120,"lower":40,"upper":80}]},
    {"key":"ldl_calculado","name":"LDL Calculado","unit":"mg/dL","dec":0,"categories":["Perfil Lipídico"],"groups":[{"sex":"Ambos","min":12,"max":120,"lower":50,"upper":129}]},
    {"key":"trigliceridos","name":"Triglicéridos","unit":"mg/dL","dec":0,"categories":["Perfil Lipídico"],"groups":[{"sex":"Ambos","min":0,"max":12,"lower":30,"upper":130},{"sex":"Ambos","min":12,"max":120,"lower":40,"upper":149}]},
    {"key":"vldl","name":"VLDL Estimado","unit":"mg/dL","dec":0,"categories":["Perfil Lipídico"],"groups":[{"sex":"Ambos","min":12,"max":120,"lower":5,"upper":30}]},
    {"key":"proteinas_totales","name":"Proteínas Totales","unit":"g/dL","dec":1,"categories":["Hepático"],"groups":[{"sex":"Ambos","min":0,"max":1,"lower":4.6,"upper":7.2},{"sex":"Ambos","min":1,"max":12,"lower":5.5,"upper":7.8},{"sex":"Ambos","min":12,"max":120,"lower":6.4,"upper":8.3}]},
    {"key":"albumina","name":"Albúmina","unit":"g/dL","dec":1,"categories":["Hepático"],"groups":[{"sex":"Ambos","min":0,"max":1,"lower":3.4,"upper":5.4},{"sex":"Ambos","min":1,"max":12,"lower":3.8,"upper":5.4},{"sex":"Ambos","min":12,"max":120,"lower":3.5,"upper":5.0}]},
    {"key":"bilirrubina_total","name":"Bilirrubina Total","unit":"mg/dL","dec":2,"categories":["Hepático"],"groups":[{"sex":"Ambos","min":0,"max":120,"lower":0.2,"upper":1.2}]},
    {"key":"bilirrubina_directa","name":"Bilirrubina Directa","unit":"mg/dL","dec":2,"categories":["Hepático"],"groups":[{"sex":"Ambos","min":0,"max":120,"lower":0.0,"upper":0.3}]},
    {"key":"tgo_ast","name":"AST (TGO)","unit":"U/L","dec":0,"categories":["Hepático"],"groups":[{"sex":"Ambos","min":12,"max":120,"lower":10,"upper":40}]},
    {"key":"tgp_alt","name":"ALT (TGP)","unit":"U/L","dec":0,"categories":["Hepático"],"groups":[{"sex":"Ambos","min":12,"max":120,"lower":7,"upper":56}]},
    {"key":"fosfatasa_alcalina","name":"Fosfatasa Alcalina","unit":"U/L","dec":0,"categories":["Hepático"],"groups":[{"sex":"Ambos","min":0,"max":1,"lower":110,"upper":400},{"sex":"Ambos","min":1,"max":12,"lower":130,"upper":420},{"sex":"Ambos","min":12,"max":18,"lower":80,"upper":300},{"sex":"Femenino","min":18,"max":120,"lower":44,"upper":147},{"sex":"Masculino","min":18,"max":120,"lower":44,"upper":147}]},
    {"key":"sodio","name":"Sodio","unit":"mmol/L","dec":0,"categories":["Electrolitos"],"groups":[{"sex":"Ambos","min":0,"max":120,"lower":135,"upper":145}]},
    {"key":"potasio","name":"Potasio","unit":"mmol/L","dec":1,"categories":["Electrolitos"],"groups":[{"sex":"Ambos","min":0,"max":120,"lower":3.5,"upper":5.1}]},
    {"key":"cloro","name":"Cloro","unit":"mmol/L","dec":0,"categories":["Electrolitos"],"groups":[{"sex":"Ambos","min":0,"max":120,"lower":98,"upper":107}]},
    {"key":"co2_total","name":"CO2 Total","unit":"mmol/L","dec":0,"categories":["Ácido-Base"],"groups":[{"sex":"Ambos","min":0,"max":120,"lower":22,"upper":29}]},
    {"key":"calcio","name":"Calcio","unit":"mg/dL","dec":2,"categories":["Electrolitos"],"groups":[{"sex":"Ambos","min":0,"max":1,"lower":8.8,"upper":11.0},{"sex":"Ambos","min":1,"max":12,"lower":8.8,"upper":10.8},{"sex":"Ambos","min":12,"max":120,"lower":8.6,"upper":10.2}]},
    {"key":"fosforo","name":"Fósforo","unit":"mg/dL","dec":1,"categories":["Renal"],"groups":[{"sex":"Ambos","min":0,"max":1,"lower":4.5,"upper":6.7},{"sex":"Ambos","min":1,"max":12,"lower":3.5,"upper":5.5},{"sex":"Ambos","min":12,"max":120,"lower":2.5,"upper":4.5}]},
    {"key":"magnesio","name":"Magnesio","unit":"mg/dL","dec":2,"categories":["Electrolitos"],"groups":[{"sex":"Ambos","min":0,"max":120,"lower":1.6,"upper":2.6}]},
    {"key":"ggt","name":"GGT","unit":"U/L","dec":0,"categories":["Hepático"],"groups":[{"sex":"Femenino","min":12,"max":120,"lower":9,"upper":36},{"sex":"Masculino","min":12,"max":120,"lower":12,"upper":64}]},
    {"key":"ldh","name":"LDH","unit":"U/L","dec":0,"categories":["Metabólico"],"groups":[{"sex":"Ambos","min":12,"max":120,"lower":140,"upper":280}]},
    {"key":"amilasa","name":"Amilasa","unit":"U/L","dec":0,"categories":["Pancreático"],"groups":[{"sex":"Ambos","min":12,"max":120,"lower":28,"upper":100}]},
    {"key":"lipasa","name":"Lipasa","unit":"U/L","dec":0,"categories":["Pancreático"],"groups":[{"sex":"Ambos","min":12,"max":120,"lower":13,"upper":60}]},
    {"key":"ck_cpk","name":"CK (CPK)","unit":"U/L","dec":0,"categories":["Cardíaco"],"groups":[{"sex":"Femenino","min":12,"max":120,"lower":38,"upper":176},{"sex":"Masculino","min":12,"max":120,"lower":52,"upper":336}]},
    {"key":"hierro_serico","name":"Hierro Sérico","unit":"µg/dL","dec":0,"categories":["Metabolismo Hierro"],"groups":[{"sex":"Ambos","min":12,"max":120,"lower":60,"upper":170}]},
    {"key":"ferritina","name":"Ferritina","unit":"ng/mL","dec":0,"categories":["Metabolismo Hierro"],"groups":[{"sex":"Femenino","min":12,"max":120,"lower":13,"upper":150},{"sex":"Masculino","min":12,"max":120,"lower":30,"upper":400}]},
    {"key":"transferrina","name":"Transferrina","unit":"mg/dL","dec":0,"categories":["Metabolismo Hierro"],"groups":[{"sex":"Ambos","min":12,"max":120,"lower":200,"upper":360}]},
    {"key":"tibc","name":"TIBC","unit":"µg/dL","dec":0,"categories":["Metabolismo Hierro"],"groups":[{"sex":"Ambos","min":12,"max":120,"lower":250,"upper":450}]},
    {"key":"saturacion_transferrina","name":"Saturación Transferrina","unit":"%","dec":0,"categories":["Metabolismo Hierro"],"groups":[{"sex":"Ambos","min":12,"max":120,"lower":20,"upper":50}]},
    {"key":"vitamina_d_25oh","name":"Vitamina D 25-OH","unit":"ng/mL","dec":1,"categories":["Vitaminas"],"groups":[{"sex":"Ambos","min":0,"max":120,"lower":30,"upper":100}]},
    {"key":"hba1c","name":"Hemoglobina Glicosilada (HbA1c)","unit":"%","dec":2,"categories":["Endocrino"],"groups":[{"sex":"Ambos","min":0,"max":120,"lower":4.0,"upper":5.6}]},
    {"key":"tsh","name":"TSH","unit":"µIU/mL","dec":2,"categories":["Tiroideo"],"groups":[{"sex":"Ambos","min":12,"max":120,"lower":0.4,"upper":4.0}]},
    {"key":"t4_libre","name":"T4 Libre","unit":"ng/dL","dec":2,"categories":["Tiroideo"],"groups":[{"sex":"Ambos","min":12,"max":120,"lower":0.8,"upper":1.8}]},
    {"key":"t4_total","name":"T4 Total","unit":"µg/dL","dec":2,"categories":["Tiroideo"],"groups":[{"sex":"Ambos","min":12,"max":120,"lower":4.5,"upper":11.2}]},
    {"key":"t3_libre","name":"T3 Libre","unit":"pg/mL","dec":2,"categories":["Tiroideo"],"groups":[{"sex":"Ambos","min":12,"max":120,"lower":2.3,"upper":4.2}]},
    {"key":"t3_total","name":"T3 Total","unit":"ng/dL","dec":0,"categories":["Tiroideo"],"groups":[{"sex":"Ambos","min":12,"max":120,"lower":80,"upper":200}]},
    {"key":"anti_tpo","name":"Anticuerpos Anti-TPO","unit":"UI/mL","dec":0,"categories":["Autoinmune"],"groups":[{"sex":"Ambos","min":12,"max":120,"lower":0,"upper":34}]},
    {"key":"anti_tiroglobulina","name":"Anticuerpos Anti-Tiroglobulina","unit":"UI/mL","dec":0,"categories":["Autoinmune"],"groups":[{"sex":"Ambos","min":12,"max":120,"lower":0,"upper":115}]},
    {"key":"pcr","name":"Proteína C Reactiva","unit":"mg/L","dec":2,"categories":["Inflamación"],"groups":[{"sex":"Ambos","min":12,"max":120,"lower":0.0,"upper":5.0}]},
    {"key":"procalcitonina","name":"Procalcitonina","unit":"ng/mL","dec":2,"categories":["Inflamación"],"groups":[{"sex":"Ambos","min":0,"max":120,"lower":0.00,"upper":0.05}]},
    {"key":"insulina","name":"Insulina","unit":"µIU/mL","dec":1,"categories":["Endocrino"],"groups":[{"sex":"Ambos","min":12,"max":120,"lower":2.0,"upper":24.9}]},
    {"key":"troponina_i_hs","name":"Troponina I Alta Sensibilidad","unit":"ng/L","dec":1,"categories":["Cardíaco"],"groups":[{"sex":"Femenino","min":18,"max":120,"lower":0,"upper":16},{"sex":"Masculino","min":18,"max":120,"lower":0,"upper":34}]},
    {"key":"troponina_t_hs","name":"Troponina T Alta Sensibilidad","unit":"ng/L","dec":1,"categories":["Cardíaco"],"groups":[{"sex":"Femenino","min":18,"max":120,"lower":0,"upper":10},{"sex":"Masculino","min":18,"max":120,"lower":0,"upper":14}]},
    {"key":"nt_probnp","name":"NT-proBNP","unit":"pg/mL","dec":0,"categories":["Cardíaco"],"groups":[{"sex":"Ambos","min":18,"max":50,"lower":0,"upper":125},{"sex":"Ambos","min":50,"max":120,"lower":0,"upper":450}]},
    {"key":"ck_mb_masa","name":"CK-MB Masa","unit":"ng/mL","dec":1,"categories":["Cardíaco"],"groups":[{"sex":"Ambos","min":18,"max":120,"lower":0.0,"upper":6.0}]},
    {"key":"fsh","name":"FSH","unit":"mIU/mL","dec":2,"categories":["Reproductivo"],"groups":[{"sex":"Femenino","min":18,"max":50,"lower":3.0,"upper":12.0},{"sex":"Femenino","min":50,"max":120,"lower":25.0,"upper":134.0},{"sex":"Masculino","min":18,"max":120,"lower":1.0,"upper":12.0}]},
    {"key":"lh","name":"LH","unit":"mIU/mL","dec":2,"categories":["Reproductivo"],"groups":[{"sex":"Femenino","min":18,"max":50,"lower":2.0,"upper":15.0},{"sex":"Femenino","min":50,"max":120,"lower":15.0,"upper":62.0},{"sex":"Masculino","min":18,"max":120,"lower":1.5,"upper":9.3}]},
  {"key":"estradiol","name":"Estradiol","unit":"pg/mL","dec":1,"categories":["Reproductivo"],"groups":[{"sex":"Femenino","min":18,"max":50,"lower":30,"upper":400},{"sex":"Femenino","min":50,"max":120,"lower":5,"upper":50},{"sex":"Masculino","min":18,"max":120,"lower":10,"upper":60}]},
    {"key":"testosterona_total","name":"Testosterona Total","unit":"ng/dL","dec":0,"categories":["Reproductivo"],"groups":[{"sex":"Masculino","min":18,"max":120,"lower":300,"upper":1000},{"sex":"Femenino","min":18,"max":120,"lower":15,"upper":70}]},
    {"key":"prolactina","name":"Prolactina","unit":"ng/mL","dec":1,"categories":["Endocrino"],"groups":[{"sex":"Femenino","min":18,"max":120,"lower":4.8,"upper":23.0},{"sex":"Masculino","min":18,"max":120,"lower":4.0,"upper":15.2}]},
    {"key":"psa_total","name":"PSA Total","unit":"ng/mL","dec":2,"categories":["Oncológico"],"groups":[{"sex":"Masculino","min":40,"max":50,"lower":0.00,"upper":2.5},{"sex":"Masculino","min":50,"max":60,"lower":0.00,"upper":3.5},{"sex":"Masculino","min":60,"max":70,"lower":0.00,"upper":4.5},{"sex":"Masculino","min":70,"max":120,"lower":0.00,"upper":6.5}]},
    {"key":"shbg","name":"SHBG","unit":"nmol/L","dec":1,"categories":["Reproductivo"],"groups":[{"sex":"Masculino","min":18,"max":120,"lower":10,"upper":57},{"sex":"Femenino","min":18,"max":50,"lower":18,"upper":114},{"sex":"Femenino","min":50,"max":120,"lower":20,"upper":122}]},
    {"key":"testosterona_libre_calculada","name":"Testosterona Libre Calculada","unit":"pg/mL","dec":1,"categories":["Reproductivo"],"groups":[{"sex":"Masculino","min":18,"max":120,"lower":47,"upper":244},{"sex":"Femenino","min":18,"max":120,"lower":0.5,"upper":8.0}]},
    {"key":"indice_androgeno_libre","name":"Índice Andrógeno Libre","unit":"%","dec":1,"categories":["Reproductivo"],"groups":[{"sex":"Femenino","min":18,"max":120,"lower":0.5,"upper":11.0},{"sex":"Masculino","min":18,"max":120,"lower":14,"upper":95}]},
    {"key":"cea","name":"CEA","unit":"ng/mL","dec":1,"categories":["Oncológico"],"groups":[{"sex":"Ambos","min":18,"max":120,"lower":0.0,"upper":3.0}]},
    {"key":"ca_125","name":"CA 125","unit":"U/mL","dec":0,"categories":["Oncológico"],"groups":[{"sex":"Femenino","min":18,"max":120,"lower":0,"upper":35}]},
    {"key":"ca_19_9","name":"CA 19-9","unit":"U/mL","dec":0,"categories":["Oncológico"],"groups":[{"sex":"Ambos","min":18,"max":120,"lower":0,"upper":37}]},
    {"key":"afp","name":"Alfa-Fetoproteína (AFP)","unit":"ng/mL","dec":1,"categories":["Oncológico"],"groups":[{"sex":"Ambos","min":18,"max":120,"lower":0.0,"upper":10.0}]},
    {"key":"beta_hcg","name":"Beta-hCG","unit":"mIU/mL","dec":1,"categories":["Oncológico"],"groups":[{"sex":"Femenino","min":18,"max":50,"lower":0.0,"upper":5.0},{"sex":"Femenino","min":50,"max":120,"lower":0.0,"upper":8.0},{"sex":"Masculino","min":18,"max":120,"lower":0.0,"upper":5.0}]},
    {"key":"tp_protrombina","name":"Tiempo de Protrombina (TP)","unit":"s","dec":1,"categories":["Coagulación"],"groups":[{"sex":"Ambos","min":18,"max":120,"lower":11.0,"upper":15.0}]},
    {"key":"inr","name":"INR","unit":"","dec":2,"categories":["Coagulación"],"groups":[{"sex":"Ambos","min":18,"max":120,"lower":0.8,"upper":1.2}]},
    {"key":"aptt","name":"aPTT","unit":"s","dec":1,"categories":["Coagulación"],"groups":[{"sex":"Ambos","min":18,"max":120,"lower":25.0,"upper":35.0}]},
    {"key":"fibrinogeno","name":"Fibrinógeno","unit":"mg/dL","dec":0,"categories":["Coagulación"],"groups":[{"sex":"Ambos","min":18,"max":120,"lower":200,"upper":400}]},
    {"key":"ana_titulo","name":"ANA (Título)","unit":"Título","dec":0,"categories":["Autoinmune"],"groups":[{"sex":"Ambos","min":18,"max":120,"lower":0,"upper":80}]},
    {"key":"factor_reumatoide","name":"Factor Reumatoide","unit":"IU/mL","dec":1,"categories":["Autoinmune"],"groups":[{"sex":"Ambos","min":18,"max":120,"lower":0.0,"upper":14.0}]},
    {"key":"anti_ccp","name":"Anticuerpos Anti-CCP","unit":"U/mL","dec":1,"categories":["Autoinmune"],"groups":[{"sex":"Ambos","min":18,"max":120,"lower":0.0,"upper":20.0}]},
    {"key":"hbsag","name":"HBsAg","unit":"Índice","dec":2,"categories":["Serológico"],"groups":[{"sex":"Ambos","min":18,"max":120,"lower":0.00,"upper":0.99}]},
    {"key":"anti_hbs","name":"Anti-HBs","unit":"mIU/mL","dec":1,"categories":["Serológico"],"groups":[{"sex":"Ambos","min":18,"max":120,"lower":0.0,"upper":9.9}]},
    {"key":"anti_hcv","name":"Anti-HCV","unit":"Índice","dec":2,"categories":["Serológico"],"groups":[{"sex":"Ambos","min":18,"max":120,"lower":0.00,"upper":0.99}]},
    {"key":"vih_ag_ac","name":"VIH Ag/Ac (Combo)","unit":"Índice","dec":2,"categories":["Serológico"],"groups":[{"sex":"Ambos","min":18,"max":120,"lower":0.00,"upper":0.99}]},
    {"key":"vdrl_rpr","name":"VDRL / RPR (Título)","unit":"Título","dec":0,"categories":["Serológico"],"groups":[{"sex":"Ambos","min":18,"max":120,"lower":0,"upper":0}]},
    {"key":"ph_arterial","name":"pH Arterial","unit":"pH","dec":2,"categories":["Gases Arteriales"],"groups":[{"sex":"Ambos","min":18,"max":120,"lower":7.35,"upper":7.45}]},
    {"key":"pco2_arterial","name":"pCO2 Arterial","unit":"mmHg","dec":1,"categories":["Gases Arteriales"],"groups":[{"sex":"Ambos","min":18,"max":120,"lower":35,"upper":45}]},
    {"key":"po2_arterial","name":"pO2 Arterial","unit":"mmHg","dec":0,"categories":["Gases Arteriales"],"groups":[{"sex":"Ambos","min":18,"max":120,"lower":80,"upper":100}]},
    {"key":"hco3_arterial","name":"HCO3- Arterial","unit":"mmol/L","dec":1,"categories":["Gases Arteriales"],"groups":[{"sex":"Ambos","min":18,"max":120,"lower":22,"upper":26}]},
    {"key":"saturacion_o2_arterial","name":"Saturación O2 Arterial","unit":"%","dec":1,"categories":["Gases Arteriales"],"groups":[{"sex":"Ambos","min":18,"max":120,"lower":95,"upper":100}]},
    {"key":"lactato","name":"Lactato","unit":"mmol/L","dec":2,"categories":["Crítico"],"groups":[{"sex":"Ambos","min":0,"max":120,"lower":0.5,"upper":2.2}]}
  ]$CATALOG$::jsonb;
  r RECORD; v_analysis_id uuid; v_param_id uuid; g jsonb; sex_txt text;
  def_rec RECORD; constraint_def text; sex_mode text := 'capital'; -- por defecto asumimos constraint capitalizado
  has_code boolean := false; has_clave boolean := false;
  inserted_count int := 0; updated_count int := 0; param_count int := 0; range_count int := 0; error_count int := 0;
BEGIN
  -- Detectar columnas disponibles en runtime (permite coexistir esquemas con code y/o clave)
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='analysis' AND column_name='code'
  ) INTO has_code;
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='analysis' AND column_name='clave'
  ) INTO has_clave;
  RAISE NOTICE 'Seed análisis: has_code=%, has_clave=%', has_code, has_clave;

  -- Detectar forma actual del constraint de sexo (tokens en minúscula vs capitalizados)
  FOR def_rec IN (
    SELECT pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname='reference_ranges' AND c.contype='c' AND pg_get_constraintdef(c.oid) ILIKE '%sex%'
  ) LOOP
    constraint_def := def_rec.def;
    -- Patrón minúsculas exactas
    IF constraint_def LIKE '%''ambos'',''masculino'',''femenino''%' OR constraint_def LIKE '%ARRAY[''ambos'',''masculino'',''femenino'']%' THEN
      sex_mode := 'lower';
      EXIT;
    ELSIF constraint_def LIKE '%''Ambos'',''Masculino'',''Femenino''%' OR constraint_def LIKE '%ARRAY[''Ambos'',''Masculino'',''Femenino'']%' THEN
      sex_mode := 'capital';
      EXIT;
    END IF;
  END LOOP;
  RAISE NOTICE 'Constraint sexo detectado (sex_mode=%): %', sex_mode, COALESCE(constraint_def,'(no constraint sex encontrado)');

  FOR r IN (
    SELECT (obj->>'key') clave,(obj->>'name') name,COALESCE((obj->'categories')->>0,'General') category,(obj->>'unit') unit,((obj->>'dec')::int) decimal_places,(obj->'groups') groups_json
    FROM jsonb_array_elements(seed) obj(obj)
  ) LOOP
    BEGIN
      -- Upsert manual flexible: prioriza code si existe; si no, usa clave. Mantiene ambas si existen.
      IF has_code THEN
        SELECT id INTO v_analysis_id FROM analysis WHERE code = r.clave LIMIT 1;
      ELSIF has_clave THEN
        SELECT id INTO v_analysis_id FROM analysis WHERE clave = r.clave LIMIT 1;
      ELSE
        RAISE EXCEPTION 'La tabla analysis no tiene columna code ni clave; no se puede sembrar';
      END IF;

      IF v_analysis_id IS NULL THEN
        IF has_code AND has_clave THEN
          EXECUTE format(
            'INSERT INTO analysis (code,clave,name,category,description,general_units) VALUES (%L,%L,%L,%L,%L,%L) RETURNING id',
            r.clave, r.clave, r.name, r.category, 'Importado catálogo interno', r.unit
          ) INTO v_analysis_id;
        ELSIF has_code THEN
          EXECUTE format(
            'INSERT INTO analysis (code,name,category,description,general_units) VALUES (%L,%L,%L,%L,%L) RETURNING id',
            r.clave, r.name, r.category, 'Importado catálogo interno', r.unit
          ) INTO v_analysis_id;
        ELSE
          EXECUTE format(
            'INSERT INTO analysis (clave,name,category,description,general_units) VALUES (%L,%L,%L,%L,%L) RETURNING id',
            r.clave, r.name, r.category, 'Importado catálogo interno', r.unit
          ) INTO v_analysis_id;
        END IF;
        inserted_count := inserted_count + 1;
      ELSE
        IF has_code AND has_clave THEN
          EXECUTE format(
            'UPDATE analysis SET code=%L, clave=%L, name=%L, category=%L, description=%L, general_units=%L WHERE id=%L',
            r.clave, r.clave, r.name, r.category, 'Importado catálogo interno', r.unit, v_analysis_id::text
          );
        ELSIF has_code THEN
          EXECUTE format(
            'UPDATE analysis SET code=%L, name=%L, category=%L, description=%L, general_units=%L WHERE id=%L',
            r.clave, r.name, r.category, 'Importado catálogo interno', r.unit, v_analysis_id::text
          );
        ELSE
          EXECUTE format(
            'UPDATE analysis SET clave=%L, name=%L, category=%L, description=%L, general_units=%L WHERE id=%L',
            r.clave, r.name, r.category, 'Importado catálogo interno', r.unit, v_analysis_id::text
          );
        END IF;
        updated_count := updated_count + 1;
      END IF;

      SELECT p.id INTO v_param_id FROM analysis_parameters p WHERE p.analysis_id=v_analysis_id LIMIT 1;
      IF v_param_id IS NULL THEN
        INSERT INTO analysis_parameters(analysis_id,name,unit,decimal_places) VALUES (v_analysis_id,r.name,r.unit,r.decimal_places) RETURNING id INTO v_param_id;
      ELSE
        UPDATE analysis_parameters SET name=r.name, unit=r.unit, decimal_places=r.decimal_places WHERE id=v_param_id;
        DELETE FROM reference_ranges WHERE parameter_id=v_param_id;
      END IF;
      param_count := param_count + 1;

      FOR g IN SELECT * FROM jsonb_array_elements(r.groups_json) LOOP
        sex_txt := COALESCE(g->>'sex','Ambos');
        sex_txt := CASE
          WHEN sex_txt ILIKE 'fem%' THEN 'Femenino'
          WHEN sex_txt ILIKE 'masc%' THEN 'Masculino'
          WHEN sex_txt ILIKE 'amb%' OR sex_txt IS NULL OR TRIM(sex_txt)='' THEN 'Ambos'
          ELSE INITCAP(LOWER(sex_txt))
        END;
        IF sex_txt NOT IN ('Ambos','Masculino','Femenino') THEN sex_txt:='Ambos'; END IF;
        -- Ajustar al modo del constraint: si espera minúsculas usar minúsculas
        IF sex_mode='lower' THEN
          IF sex_txt='Ambos' THEN sex_txt:='ambos';
          ELSIF sex_txt='Masculino' THEN sex_txt:='masculino';
          ELSIF sex_txt='Femenino' THEN sex_txt:='femenino';
          END IF;
        END IF;
        RAISE NOTICE 'Insert rango clave=%, sex_normalizado=% (original=%; modo=%)', r.clave, sex_txt, g->>'sex', sex_mode;
        INSERT INTO reference_ranges(parameter_id,sex,age_min,age_max,age_min_unit,lower,upper,notes)
        VALUES (v_param_id,sex_txt,(g->>'min')::int,(g->>'max')::int,'años',(g->>'lower')::numeric,(g->>'upper')::numeric,'Seed catálogo');
        range_count := range_count + 1;
      END LOOP;
    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;
      RAISE NOTICE 'Error en clave %: [%] %', r.clave, SQLSTATE, SQLERRM;
    END;
  END LOOP;
  RAISE NOTICE 'Resumen seed -> insertados: %, actualizados: %, parámetros: %, rangos: %, errores: %', inserted_count, updated_count, param_count, range_count, error_count;
END $$;

