# Perfil Hormonal por Ejes (implementación clínica)

Este documento organiza el perfil hormonal en ejes para su implementación directa en apps (Supabase, Django, etc.).

- Bandas de edad right-open: [0–1), [1–2), [2–12), [12–18), [18–65), [65–120).
- Pediatría: sexo = Ambos; Adultos: sexos diferenciados según analito.
- Unidades y decimales normalizados vía plantillas en `server/utils/referenceTemplates.js`.

## Eje Gonadal / Sexual

Hormona | Unidad | Comentarios
---|---|---
Estrona (E1) | pg/mL | Predomina postmenopausia.
Estradiol (E2) | pg/mL | Estrógeno más potente; varía por fase.
Estriol (E3) | ng/mL | Predomina en embarazo (no modelado por trimestre).
Progesterona | ng/mL | Alta en fase lútea.
Testosterona Total | ng/dL | Disminuye levemente con edad.
Testosterona Libre | pg/mL | Depende de SHBG.
DHEA-S | µg/dL | Declina con edad.
Androstenediona | ng/mL | Elevada en SOP/CAH.
AMH | ng/mL | Reserva ovárica.
SHBG | nmol/L | Aumenta con estrógenos.

## Eje Hipotálamo-Hipófisis-Gonadal

Hormona | Unidad | Comentarios
---|---|---
FSH | mIU/mL | Sube en menopausia/falla gonadal.
LH | mIU/mL | Pico ovulatorio.
Prolactina | ng/mL | Hiperprolactinemia inhibe gonadotropinas.

## Eje Suprarrenal y Metabólico

Hormona | Unidad | Comentarios
---|---|---
Cortisol Matutino | µg/dL | 8–10 am recomendado.
Cortisol Vespertino | µg/dL | Valores más bajos por la tarde.
ACTH | pg/mL | Regula cortisol.
GH | ng/mL | Interpretar con pruebas dinámicas.
IGF-1 | ng/mL | Refleja acción de GH.

## Eje Tiroideo

Hormona | Unidad | Comentarios
---|---|---
TSH | µUI/mL | Aumenta en hipotiroidismo.
T4 Libre (fT4) | ng/dL | Disminuye en hipotiroidismo.
T3 Libre (fT3) | pg/mL | Aumenta en hipertiroidismo.

## Implementación técnica

- Para nuevos tenants, el seed `server/scripts/seedDefaultStudies.js` crea el panel: "Perfil Hormonal General (PHG)" con todos los parámetros listados.
- Los rangos se insertan desde las plantillas; si faltara alguno, se crea cualitativo por defecto.
- Recomendado validar método y horario (por ejemplo, cortisol 8–10 am) en `analysis_reference_ranges.method`/`notes`.
- Auditoría: `server/scripts/auditSexSplitHormones.js` verifica la separación por sexo en adultos.
