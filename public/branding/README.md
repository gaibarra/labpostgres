# Branding del laboratorio (Logo)

Este directorio contiene los recursos de marca del laboratorio para usarse en la aplicación y en los PDF del Reporte de Resultados.

## Archivos sugeridos

Coloca aquí las versiones optimizadas del logo con fondo transparente y un padding de seguridad (~20 px) para evitar recortes:

- hematos.logo@1x.png  → ~800 px de ancho (UI estándar)
- hematos.logo@2x.png  → ~1600 px de ancho (UI pantallas retina)
- hematos.logo@3x.png  → ~2400 px de ancho (UI alta densidad)
- hematos.logo.pdf.png → ~2400 px de ancho (se usa en PDF para máxima nitidez)

Convenciones:
- Fondo: transparente (eliminar blanco puro si aplica)
- Espacio de seguridad: ~20 px alrededor
- Perfil de color: RGB
- Formato: PNG (ideal para transparencias). Si cuentas con SVG, consérvalo en este folder, pero la app usa PNG para los PDF.

## Integración con la app

El generador de PDF lee la URL del logo desde los ajustes de UI.

- UI (App): usa normalmente `@2x` (o el que decidas)
- PDF: usa la versión grande `hematos.logo.pdf.png`

Ejemplo de configuración (vía Configuración → Apariencia/Reportes o API):

```json
{
  "uiSettings": {
    "logoUrl": "/branding/hematos.logo.pdf.png",
    "logoIncludesLabName": true
  },
  "reportSettings": {
    "logoAlignCenter": true
  }
}
```

Para escenarios multi‑tenant, consulta la guía completa: `docs/branding_logo_per_tenant.md`.

Notas:
- `logoIncludesLabName: true` evita imprimir el nombre del laboratorio debajo del logo en el PDF (útil si el logo ya lo contiene).
- `logoAlignCenter: true` centra el logo en el encabezado del PDF.

## Preparación rápida (opcional)

Ejemplos con ImageMagick y pngquant para limpiar fondo, recortar bordes y exportar tamaños:

```bash
# 1) Quitar fondo blanco (si aplica), recortar y agregar padding
convert hematos.png -fuzz 6% -transparent white -trim +repage -bordercolor none -border 20 hematos.clean.png

# 2) Exportar tamaños para UI
convert hematos.clean.png -resize 800x  hematos.logo@1x.png
convert hematos.clean.png -resize 1600x hematos.logo@2x.png
convert hematos.clean.png -resize 2400x hematos.logo@3x.png

# 3) Exportar versión grande para PDF
convert hematos.clean.png -resize 2400x hematos.logo.pdf.png

# 4) Optimizar (opcional)
pngquant --force --strip --quality=70-90 --output hematos.logo@1x.png hematos.logo@1x.png
pngquant --force --strip --quality=70-90 --output hematos.logo@2x.png hematos.logo@2x.png
pngquant --force --strip --quality=70-90 --output hematos.logo@3x.png hematos.logo@3x.png
```

## Verificación

- Vista previa (UI): El encabezado/marca debe verse nítido en claro/oscuro.
- PDF: El logo se escala a ~12 mm de alto máx. y hasta ~50% del ancho de página. Si se ve pequeño, incrementa la resolución fuente (`.pdf.png`).

## Solución de problemas

- El PDF duplica el nombre del laboratorio: habilita `logoIncludesLabName: true`.
- Bordes recortados: agrega más `-border 20` al preparar el archivo.
- Fondo blanco visible: utiliza `-transparent white` (ajusta `-fuzz` al % mínimo que funcione sin dañar el logo).
