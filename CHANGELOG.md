# Changelog

Todas las notas relevantes de cambios de la app. Sigue el formato YYYY-MM-DD.

## 2025-10-12

- Remoción completa de Perfil Hormonal:
  - Eliminados scripts `server/scripts/syncPanelHormoneRanges.js` y `server/scripts/resyncPanelHormoneRangesForTenants.js`.
  - Eliminada la migración `sql/tenant_migrations/013_sync_perfil_hormonal.sql`.
  - Limpieza de referencias en provisión de tenants, seeds, categorías, descripciones, tests, UI y docs.
- Normalización y calidad de rangos de referencia:
  - Mantiene enforcement de tramos de edad right-open y normalización de sexo (pediátrico: Ambos permitido; adulto: M/F explícitos).
  - Dedupe y checks de conflicto integrados.
- Linter: reducción de ruido de warnings
  - Ajustada configuración ESLint del servidor para suprimir `no-unused-vars` y permitir `catch` vacío donde aplica.
  - Script raíz `lint` ahora corre el linter del servidor y el del frontend.
- Validación:
  - Suite de servidor en verde: 157 tests.
  - Lint sin errores.

## 2025-10-12 (cont.)

- Semilla: se agregó un nuevo panel "Perfil Hormonal General" (código PHG) al seeder por defecto de nuevos tenants.
  - Parámetros incluidos: FSH, LH, Prolactina, Estradiol, Progesterona, Testosterona Total, Testosterona Libre, DHEA-S, Androstenediona, Cortisol Matutino, Cortisol Vespertino, AMH.
  - Los rangos y unidades se obtienen de las plantillas canónicas con tramos right-open 0–120 y diferenciación por sexo en adultos donde aplica.

## 2025-10-12 (cont. 2)

- Extensión del PHG: se añadieron SHBG, IGF-1, GH y DHT con plantillas nuevas.
  - Todas con tramos pediátricos unisex y separación por sexo en adultos; unidades: SHBG (nmol/L), IGF-1 (ng/mL), GH (ng/mL), DHT (ng/dL).
  - Auditoría `auditSexSplitHormones.js` confirma split por sexo en adultos para paneles Hormonal/Ginecológico.

## 2025-10-12 (cont. 3)

- Ampliación del PHG: Estrona (E1), Estriol (E3) y ACTH añadidos a plantillas y al seeder.
- Nueva documentación: `docs/perfil_hormonal_ejes.md` con organización por ejes y notas de implementación.

