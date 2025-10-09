-- 011_add_analysis_metadata.sql
-- Asegura columnas de metadatos en `analysis` y rellena campos para estudios preexistentes
-- Campos: description, indications, sample_type, sample_container, processing_time_hours, general_units
-- Idempotente.

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='analysis') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='analysis' AND column_name='description') THEN
      ALTER TABLE analysis ADD COLUMN description text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='analysis' AND column_name='indications') THEN
      ALTER TABLE analysis ADD COLUMN indications text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='analysis' AND column_name='sample_type') THEN
      ALTER TABLE analysis ADD COLUMN sample_type text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='analysis' AND column_name='sample_container') THEN
      ALTER TABLE analysis ADD COLUMN sample_container text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='analysis' AND column_name='processing_time_hours') THEN
      ALTER TABLE analysis ADD COLUMN processing_time_hours integer;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='analysis' AND column_name='general_units') THEN
      ALTER TABLE analysis ADD COLUMN general_units text;
    END IF;
  END IF;
END$$;

-- Backfill básico por nombre conocido (sólo si campos están NULL)
-- Nota: Los nombres deben corresponder con los creados por el seed canónico.
UPDATE analysis SET 
  description = COALESCE(description, 'Conteo sanguíneo completo para valoración hematológica.'),
  indications = COALESCE(indications, 'Evaluación general, anemia, infecciones, seguimiento clínico.'),
  sample_type = COALESCE(sample_type, 'Sangre total'),
  sample_container = COALESCE(sample_container, 'Tubo morado (EDTA)'),
  processing_time_hours = COALESCE(processing_time_hours, 2)
WHERE LOWER(name) = LOWER('Biometría Hemática');

UPDATE analysis SET 
  description = COALESCE(description, 'Evaluación de función tiroidea con hormonas y anticuerpos.'),
  indications = COALESCE(indications, 'Hipotiroidismo/hipertiroidismo, seguimiento tratamiento.'),
  sample_type = COALESCE(sample_type, 'Suero'),
  sample_container = COALESCE(sample_container, 'Tubo rojo o amarillo (SST)'),
  processing_time_hours = COALESCE(processing_time_hours, 24)
WHERE LOWER(name) = LOWER('Perfil Tiroideo');

UPDATE analysis SET 
  description = COALESCE(description, 'Enzimas y metabolitos para evaluación de función hepática.'),
  indications = COALESCE(indications, 'Daño hepático, colestasis, seguimiento de hepatopatías.'),
  sample_type = COALESCE(sample_type, 'Suero'),
  sample_container = COALESCE(sample_container, 'Tubo rojo o amarillo (SST)'),
  processing_time_hours = COALESCE(processing_time_hours, 8)
WHERE LOWER(name) = LOWER('Perfil Hepático');

UPDATE analysis SET 
  description = COALESCE(description, 'Panel básico de hormonas para evaluación endocrina.'),
  indications = COALESCE(indications, 'Trastornos hormonales, fertilidad, seguimiento terapéutico.'),
  sample_type = COALESCE(sample_type, 'Suero'),
  sample_container = COALESCE(sample_container, 'Tubo rojo o amarillo (SST)'),
  processing_time_hours = COALESCE(processing_time_hours, 24)
WHERE LOWER(name) = LOWER('Perfil Hormonal');

UPDATE analysis SET 
  description = COALESCE(description, 'Hormonas y marcadores asociados a salud ginecológica.'),
  indications = COALESCE(indications, 'Trastornos menstruales, fertilidad, SOP, seguimiento.'),
  sample_type = COALESCE(sample_type, 'Suero'),
  sample_container = COALESCE(sample_container, 'Tubo rojo o amarillo (SST)'),
  processing_time_hours = COALESCE(processing_time_hours, 24)
WHERE LOWER(name) = LOWER('Perfil Ginecológico');

UPDATE analysis SET 
  description = COALESCE(description, 'Análisis físico-químico y microscópico de orina.'),
  indications = COALESCE(indications, 'Evaluación renal/urinaria, infecciones urinarias, tamizaje.'),
  sample_type = COALESCE(sample_type, 'Orina'),
  sample_container = COALESCE(sample_container, 'Vaso estéril de orina'),
  processing_time_hours = COALESCE(processing_time_hours, 1)
WHERE LOWER(name) = LOWER('Examen General de Orina');

UPDATE analysis SET 
  description = COALESCE(description, 'Panel orientado a evaluación integral en adultos mayores.'),
  indications = COALESCE(indications, 'Tamizaje y seguimiento en población geriátrica.'),
  sample_type = COALESCE(sample_type, 'Suero'),
  sample_container = COALESCE(sample_container, 'Tubo rojo o amarillo (SST)'),
  processing_time_hours = COALESCE(processing_time_hours, 8)
WHERE LOWER(name) = LOWER('Perfil Geriátrico');

UPDATE analysis SET 
  description = COALESCE(description, 'Metabolitos básicos para evaluación metabólica.'),
  indications = COALESCE(indications, 'Tamizaje general, control de padecimientos crónicos.'),
  sample_type = COALESCE(sample_type, 'Suero'),
  sample_container = COALESCE(sample_container, 'Tubo rojo o amarillo (SST)'),
  processing_time_hours = COALESCE(processing_time_hours, 4)
WHERE LOWER(name) = LOWER('Química Sanguínea (6 Elementos)');

UPDATE analysis SET 
  description = COALESCE(description, 'Determinación de electrolitos séricos principales.'),
  indications = COALESCE(indications, 'Balance hidroelectrolítico, trastornos ácido-base.'),
  sample_type = COALESCE(sample_type, 'Suero'),
  sample_container = COALESCE(sample_container, 'Tubo rojo o amarillo (SST)'),
  processing_time_hours = COALESCE(processing_time_hours, 2)
WHERE LOWER(name) = LOWER('Electrolitos');

UPDATE analysis SET 
  description = COALESCE(description, 'Panel prequirúrgico básico para evaluación de riesgo.'),
  indications = COALESCE(indications, 'Estudios previos a procedimientos quirúrgicos.'),
  sample_type = COALESCE(sample_type, 'Sangre total y suero'),
  sample_container = COALESCE(sample_container, 'Tubo morado (EDTA) y tubo rojo/amarillo (SST)'),
  processing_time_hours = COALESCE(processing_time_hours, 6)
WHERE LOWER(name) = LOWER('Perfil Preoperatorio');

UPDATE analysis SET 
  description = COALESCE(description, 'Determinación de grupo ABO y factor Rh.'),
  indications = COALESCE(indications, 'Transfusiones, embarazo, procedimientos invasivos.'),
  sample_type = COALESCE(sample_type, 'Sangre total'),
  sample_container = COALESCE(sample_container, 'Tubo morado (EDTA)'),
  processing_time_hours = COALESCE(processing_time_hours, 2)
WHERE LOWER(name) = LOWER('Tipo de Sangre y RH');

UPDATE analysis SET 
  description = COALESCE(description, 'Lípidos sanguíneos para riesgo cardiovascular.'),
  indications = COALESCE(indications, 'Tamizaje y seguimiento de dislipidemias.'),
  sample_type = COALESCE(sample_type, 'Suero (ayuno recomendado)'),
  sample_container = COALESCE(sample_container, 'Tubo rojo o amarillo (SST)'),
  processing_time_hours = COALESCE(processing_time_hours, 6)
WHERE LOWER(name) = LOWER('Perfil Lipídico');

UPDATE analysis SET 
  description = COALESCE(description, 'Evaluación de función renal y metabolismo mineral.'),
  indications = COALESCE(indications, 'Enfermedad renal, evaluación metabólica.'),
  sample_type = COALESCE(sample_type, 'Suero'),
  sample_container = COALESCE(sample_container, 'Tubo rojo o amarillo (SST)'),
  processing_time_hours = COALESCE(processing_time_hours, 4)
WHERE LOWER(name) = LOWER('Perfil Renal');

UPDATE analysis SET 
  description = COALESCE(description, 'Marcadores cardíacos y enzimáticos.'),
  indications = COALESCE(indications, 'Dolor torácico, isquemia, seguimiento.'),
  sample_type = COALESCE(sample_type, 'Suero'),
  sample_container = COALESCE(sample_container, 'Tubo rojo o amarillo (SST)'),
  processing_time_hours = COALESCE(processing_time_hours, 4)
WHERE LOWER(name) = LOWER('Perfil Cardíaco');

COMMIT;
