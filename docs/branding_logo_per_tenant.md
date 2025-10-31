# Guía: Logo por Tenant (Multi‑Tenant)

Esta guía describe, paso a paso, cómo configurar y mantener el logo de cada tenant para que se muestre correctamente en la aplicación (UI) y en los PDF del Reporte de Resultados.

## Objetivo
- Cada tenant define su propio logo y preferencias de presentación sin afectar a otros tenants.
- El logo mantiene proporciones, no se deforma y respeta límites de tamaño en UI y PDF.

## Dónde se guarda la configuración
La configuración por tenant se gestiona vía API en el endpoint `/api/config` y se refleja en la UI de Administración.

Claves relevantes:
- `labInfo.logoUrl`: URL del logo principal del laboratorio (usado por la UI). Puede establecerse desde Administración → Configuración General → Información del Laboratorio.
- `uiSettings.logoUrl`: URL del logo preferido para UI/PDF cuando `labInfo.logoUrl` está vacío. Útil para logos de alta resolución del PDF.
- `uiSettings.logoIncludesLabName` (boolean): si el logo ya incluye el nombre del laboratorio, habilítalo para no imprimir el nombre debajo en el PDF (evita duplicado).
- `reportSettings.logoAlignCenter` (boolean): centra el logo en el encabezado del PDF.

Notas de uso actual:
- PDF toma el logo de `uiSettings.logoUrl` (si existe). Si no, aplican fallbacks según configuración.
- En la UI (encabezados de reportes/recibos) se usa `labInfo.logoUrl` y, si está vacío, se cae a `uiSettings.logoUrl`.

## Preparar el archivo del logo
- Formato: PNG con fondo transparente (ideal). SVG es válido en UI, pero para PDF se recomienda PNG.
- Padding: agrega ~20 px de espacio alrededor para evitar recortes.
- Perfiles de color: RGB.
- Tamaños sugeridos (por tenant):
  - `tenant.logo@1x.png` ~800 px ancho (UI estándar)
  - `tenant.logo@2x.png` ~1600 px (pantallas retina)
  - `tenant.logo@3x.png` ~2400 px (alta densidad)
  - `tenant.logo.pdf.png` ~2400 px (PDF, máxima nitidez)

Opcional (ImageMagick/pngquant): consulta `public/branding/README.md` para comandos de limpieza, redimensionado y optimización.

## Opciones para cargar el logo
1) Desde Administración (recomendado para labInfo.logoUrl):
   - Ve a Administración → Configuración General → Información del Laboratorio.
   - Sube el archivo del logo. El sistema guardará su URL en `labInfo.logoUrl` (límite sugerido: 2MB).

2) Vía archivo estático (para `uiSettings.logoUrl`):
   - Coloca el archivo en `public/branding/` (por ejemplo: `/branding/tenantA.logo.pdf.png`).
   - Usa la ruta pública en la configuración (`/branding/tenantA.logo.pdf.png`).

3) Vía API (PATCH /config):
   - Ejemplo de payload para el tenant actual:

```json
{
  "uiSettings": {
    "logoUrl": "/branding/tenantA.logo.pdf.png",
    "logoIncludesLabName": true
  },
  "reportSettings": {
    "logoAlignCenter": true
  }
}
```

> La configuración enviada aplica únicamente al tenant autenticado. No afecta a otros tenants.

## Cómo se renderiza el logo
- UI (encabezados y recibos):
  - Usa `labInfo.logoUrl` y, si no existe, `uiSettings.logoUrl`.
  - Se muestra con `object-contain` y altura máxima controlada para evitar deformaciones.

- PDF (Reportes):
  - Lee `uiSettings.logoUrl`.
  - Mantiene proporción (aspect ratio) automáticamente.
  - Límites: alto máx. ~12 mm (10 mm en modo compacto) y ancho máx. 50% de la página.
  - Alineación: izquierda por defecto; centra si `reportSettings.logoAlignCenter = true`.
  - Si `uiSettings.logoIncludesLabName = true`, se omite imprimir el nombre del lab debajo del logo para evitar duplicado.

## Verificación rápida
- Previsualización de Reporte (UI): abre una orden y usa “Previsualizar PDF”.
- PDF resultante: confirma nitidez, tamaño y alineación del logo.
- Encabezado de la UI: verifica que el logo no se recorte y se vea bien en temas claro/oscuro.

## Solución de problemas
- Se ve duplicado el nombre (logo + texto): habilita `uiSettings.logoIncludesLabName = true`.
- Logo recortado en PDF: aumenta el padding del archivo fuente (~20–30 px) y reexporta.
- Se ve pequeño en PDF: aumenta la resolución de `*.logo.pdf.png` (p.ej. 2800–3200 px de ancho).
- El logo no aparece: revisa que la URL sea accesible y que `reportSettings.showLogoInReport` no esté deshabilitado.
- Multi-tenant en un mismo dominio/estático compartido: usa nombres de archivo únicos por tenant (p.ej. `tenantA.logo.pdf.png`, `tenantB.logo.pdf.png`) para evitar confusiones de caché.

## Buenas prácticas
- Mantén un repositorio de activos por tenant (con versiones originales y optimizadas).
- Documenta internamente la decisión de `logoIncludesLabName` para consistencia entre UI y PDF.
- Revisa el resultado en impresoras comunes (láser/tinta) para asegurar contraste y tamaño adecuados.

---

Relacionado: `public/branding/README.md` (preparación y optimización de imágenes).
