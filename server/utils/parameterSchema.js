// JSON Schema para un único parámetro generado por IA
module.exports.parameterSchema = {
  $id: 'https://lab.local/schemas/parameter.json',
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
          textoPermitido: { type: ['string','null'] },
          textoLibre: { type: ['string','null'] },
          notas: { type: ['string','null'] },
          tipoValor: { enum: ['numerico','alfanumerico','textoLibre', null] }
        }
      }
    }
  }
};
