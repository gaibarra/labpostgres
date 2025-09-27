// JSON Schema para validar estudio generado por IA
const studySchema = {
  $id: 'https://lab.local/schemas/study.json',
  type: 'object',
  required: ['name','category','parameters'],
  additionalProperties: true,
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 120 },
    description: { type: 'string' },
    indications: { type: 'string' },
    sample_type: { type: 'string' },
    sample_container: { type: 'string' },
    processing_time_hours: { type: ['number','null'], minimum: 0 },
    category: { type: 'string', minLength: 1 },
    parameters: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['name','unit','decimal_places','valorReferencia'],
        additionalProperties: true,
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 80 },
          unit: { type: 'string', maxLength: 40 },
          group: { type: 'string', maxLength: 60 },
          decimal_places: { type: 'integer', minimum: 0, maximum: 6 },
          valorReferencia: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['sexo','edadMin','edadMax','unidadEdad'],
              additionalProperties: true,
              properties: {
                sexo: { enum: ['Masculino','Femenino','Ambos'] },
                edadMin: { type: ['integer','null'], minimum: 0, maximum: 120 },
                edadMax: { type: ['integer','null'], minimum: 0, maximum: 120 },
                unidadEdad: { const: 'años' },
                valorMin: { type: ['number','null'] },
                valorMax: { type: ['number','null'] },
                textoPermitido: { type: 'string' },
                textoLibre: { type: 'string' },
                notas: { type: 'string' },
                // tipoValor opcional; permitir null o ausencia
                tipoValor: { enum: ['numerico','alfanumerico','textoLibre', null] }
              }
            }
          }
        }
      }
    }
  }
};

module.exports = { studySchema };
