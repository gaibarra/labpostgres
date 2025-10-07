// ai-schemas.js - Esquemas AJV para endpoints AI
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const ajv = new Ajv({ allErrors:true, strict:false });
addFormats(ajv);

const studySchema = {
  type:'object',
  properties:{
    name:{ type:'string', nullable:true },
    description:{ type:'string', nullable:true },
    indications:{ type:'string', nullable:true },
    sample_type:{ type:'string', nullable:true },
    sample_container:{ type:'string', nullable:true },
    processing_time_hours:{ type:['number','null'], nullable:true },
  category:{ type:'string', nullable:true },
    parameters:{
      type:'array',
      items:{
        type:'object',
        properties:{
          name:{ type:'string' },
          unit:{ type:'string', nullable:true },
          decimal_places:{ type:['number','integer'], minimum:0, maximum:6 },
          valorReferencia:{
            type:'array',
            items:{
              type:'object',
              properties:{
                sexo:{ type:'string' },
                edadMin:{ type:'number' },
                edadMax:{ type:'number' },
                unidadEdad:{ type:'string' },
                valorMin:{ type:['number','null'] },
                valorMax:{ type:['number','null'] },
                notas:{ type:'string' }
              },
              required:['sexo','edadMin','edadMax','unidadEdad']
            }
          }
        },
        required:['name']
      }
    }
  },
  required:['parameters']
};

const parameterSchema = {
  type:'object',
  properties:{
    name:{ type:'string' },
    unit:{ type:'string' },
    decimal_places:{ type:['number','integer'], minimum:0, maximum:6 },
    valorReferencia:{
      type:'array',
      minItems:1,
      items:{
        type:'object',
        properties:{
          sexo:{ type:'string' },
          edadMin:{ type:'number' },
          edadMax:{ type:'number' },
          unidadEdad:{ type:'string' },
          valorMin:{ type:['number','null'] },
          valorMax:{ type:['number','null'] },
          notas:{ type:'string' }
        },
        required:['sexo','edadMin','edadMax','unidadEdad']
      }
    }
  },
  required:['name','valorReferencia']
};

const validateStudy = ajv.compile(studySchema);
const validateParameter = ajv.compile(parameterSchema);

module.exports = { validateStudy, validateParameter };
