import { z } from 'zod';

// Esquema para los valores de referencia de un parámetro
const referenceValueSchema = z.object({
  id: z.string().optional().nullable(),
  sexo: z.enum(['Ambos', 'Masculino', 'Femenino']),
  edadMin: z.preprocess(
    (val) => (val === '' || val === null) ? null : Number(val),
    z.number().nullable()
  ),
  edadMax: z.preprocess(
    (val) => (val === '' || val === null) ? null : Number(val),
    z.number().nullable()
  ),
  unidadEdad: z.enum(['días', 'meses', 'años', 'years']),
  valorMin: z.preprocess(
    (val) => (val === '' || val === null) ? null : Number(val),
    z.number().nullable()
  ),
  valorMax: z.preprocess(
    (val) => (val === '' || val === null) ? null : Number(val),
    z.number().nullable()
  ),
  textoPermitido: z.string().optional().nullable(),
  textoLibre: z.string().optional().nullable(),
  tipoValor: z.enum(['numerico', 'alfanumerico', 'textoLibre']),
  notas: z.string().optional().nullable(),
});

// Esquema para un parámetro de estudio
const parameterSchema = z.object({
  id: z.string().optional().nullable(),
  tempId: z.string().optional(), // Para control en el UI
  name: z.string().min(1, 'El nombre del parámetro es requerido.'),
  unit: z.string().optional().nullable(),
  group: z.string().optional().nullable(),
  decimal_places: z.number().int().min(0).optional().nullable(),
  valorReferencia: z.array(referenceValueSchema).optional(),
});

// Esquema principal para un Estudio
export const studySchema = z.object({
  id: z.string().optional().nullable(),
  name: z.string().min(3, 'El nombre del estudio es requerido (mínimo 3 caracteres).'),
  clave: z.string().optional().nullable(),
  category: z.string().min(1, 'La categoría es requerida.'),
  particularPrice: z.preprocess(
    (val) => (val === '' || val === null) ? null : Number(val),
    z.number().min(0, 'El precio debe ser un número positivo.').nullable()
  ),
  description: z.string().optional().nullable(),
  indications: z.string().optional().nullable(),
  sample_type: z.string().optional().nullable(),
  sample_container: z.string().optional().nullable(),
  processing_time_hours: z.preprocess(
    (val) => (val === '' || val === null) ? null : Number(val),
    z.number().int('Debe ser un número entero.').min(0).nullable()
  ),
  parameters: z.array(parameterSchema).optional(),
});

export const singleParameterSchema = parameterSchema; // Reutilizamos el esquema
