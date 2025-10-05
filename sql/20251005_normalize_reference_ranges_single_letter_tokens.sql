-- Normaliza valores legacy de sex en reference_ranges de M/F/O a canónicos
-- Idempotente: solo actúa sobre tokens single-letter.
UPDATE reference_ranges
SET sex = CASE sex
            WHEN 'M' THEN 'Masculino'
            WHEN 'F' THEN 'Femenino'
            WHEN 'O' THEN 'Ambos'
            ELSE sex
          END
WHERE sex IN ('M','F','O');
