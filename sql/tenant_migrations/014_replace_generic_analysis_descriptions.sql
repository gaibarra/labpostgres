-- 014_replace_generic_analysis_descriptions.sql
-- Reemplaza la descripción genérica "Estudio de laboratorio clínico." por textos con valor clínico según categoría.
-- También afina las indicaciones cuando sólo tienen el default genérico.
-- Idempotente: sólo actúa cuando detecta el texto genérico (o variantes mínimas) y deja intactos los campos ya personalizados.

BEGIN;

-- Asegurar columnas requeridas (defensivo)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='analysis') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='analysis' AND column_name='description') THEN
      ALTER TABLE analysis ADD COLUMN description text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='analysis' AND column_name='indications') THEN
      ALTER TABLE analysis ADD COLUMN indications text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='analysis' AND column_name='category') THEN
      ALTER TABLE analysis ADD COLUMN category text;
    END IF;
  END IF;
END$$;

-- Normalizar espacios y tratar strings vacíos como NULL
UPDATE analysis SET
  description = NULLIF(BTRIM(description), ''),
  indications = NULLIF(BTRIM(indications), '');

-- Condiciones útiles
-- gen_desc: descripción es exactamente "Estudio de laboratorio clínico." (con o sin acento/punto/espacios)
-- gen_ind: indicaciones son exactamente el default aplicado en 012, o está NULL
WITH flags AS (
  SELECT a.id,
         ( BTRIM(a.description) ~* '^estudio de laboratorio cl[ií]nico\.?$' ) AS gen_desc,
         ( a.indications IS NULL OR BTRIM(a.indications) ~* '^seg[uú]n criterio cl[ií]nico y sospecha diagn[oó]stica\.?$' ) AS gen_ind,
         LOWER(COALESCE(a.category,'')) AS cat
  FROM analysis a
)
UPDATE analysis a SET
  description = CASE
    WHEN f.gen_desc AND f.cat LIKE '%hema%'
      THEN 'Conteo sanguíneo y/o evaluación hematológica (hemograma, morfología, coagulación) según estudio.'
    WHEN f.gen_desc AND f.cat LIKE '%orina%'
      THEN 'Análisis físico-químico y sedimento urinario según el estudio solicitado.'
    WHEN f.gen_desc AND (f.cat LIKE '%bioq%' OR f.cat LIKE '%qu[ií]mica%')
      THEN 'Determinación de analitos séricos para evaluación metabólica y de órganos (hepático, renal, perfil químico).'
    WHEN f.gen_desc AND f.cat LIKE '%hormon%'
      THEN 'Evaluación endocrina mediante inmunoensayo según el analito o panel solicitado.'
    WHEN f.gen_desc AND f.cat LIKE '%micro%'
      THEN 'Estudio microbiológico para detección/identificación y, cuando proceda, susceptibilidad antimicrobiana.'
    WHEN f.gen_desc AND (f.cat LIKE '%copro%' OR f.cat LIKE '%fecal%' OR f.cat LIKE '%heces%')
      THEN 'Evaluación coprológica macroscópica y microscópica según la indicación clínica.'
    WHEN f.gen_desc AND f.cat LIKE '%parasit%'
      THEN 'Búsqueda e identificación de parásitos (quistes, trofozoítos, huevos, larvas) según técnica.'
    WHEN f.gen_desc AND f.cat LIKE '%card%'
      THEN 'Determinación de marcadores cardiovasculares y enzimáticos para estratificación de riesgo/daño.'
    WHEN f.gen_desc AND f.cat LIKE '%renal%'
      THEN 'Marcadores de función renal y metabolismo mineral para evaluación nefrológica.'
    WHEN f.gen_desc
      THEN 'Estudio de laboratorio con enfoque clínico; la interpretación depende del contexto y sospecha diagnóstica.'
    ELSE a.description
  END,
  indications = CASE
    WHEN f.gen_ind AND f.cat LIKE '%hema%'
      THEN 'Tamizaje hematológico, anemia, infecciones, sangrado y seguimiento clínico.'
    WHEN f.gen_ind AND (f.cat LIKE '%bioq%' OR f.cat LIKE '%qu[ií]mica%')
      THEN 'Metabolismo, función hepática/renal, dislipidemias, glucosa; control de crónicos.'
    WHEN f.gen_ind AND f.cat LIKE '%hormon%'
      THEN 'Trastornos endocrinos, fertilidad, seguimiento terapéutico; considerar horario/método.'
    WHEN f.gen_ind AND f.cat LIKE '%orina%'
      THEN 'Evaluación de patología urinaria/renal, infecciones y tamizaje general.'
    WHEN f.gen_ind AND f.cat LIKE '%micro%'
      THEN 'Sospecha de infección bacteriana, micótica o mixta; orientar toma de muestra y antibiograma.'
    WHEN f.gen_ind AND (f.cat LIKE '%copro%' OR f.cat LIKE '%fecal%' OR f.cat LIKE '%heces%')
      THEN 'Diarrea, dolor abdominal, malabsorción; control post-tratamiento según hallazgos.'
    WHEN f.gen_ind AND f.cat LIKE '%parasit%'
      THEN 'Sospecha de parasitosis intestinal; tamizaje y control de erradicación.'
    WHEN f.gen_ind AND f.cat LIKE '%card%'
      THEN 'Dolor torácico, isquemia, estratificación de riesgo y seguimiento.'
    WHEN f.gen_ind AND f.cat LIKE '%renal%'
      THEN 'Enfermedad renal, alteraciones hidroelectrolíticas y metabolismo mineral.'
    WHEN f.gen_ind
      THEN 'Solicitar según cuadro clínico y utilidad diagnóstica esperada.'
    ELSE a.indications
  END
FROM flags f
WHERE a.id = f.id AND (f.gen_desc OR f.gen_ind);

COMMIT;
