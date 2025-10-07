const request = require('supertest');
const app = require('../index');
const { createAdminAndGetToken } = require('./test-helpers');

// Valores esperados del seed para los parámetros de Biometría Hemática
const EXPECTED = {
  'Volumen Corpuscular Medio': [
    { sex:'Ambos', age_min:0, age_max:1, lower:84, upper:106 },
    { sex:'Ambos', age_min:1, age_max:2, lower:72, upper:84 },
    { sex:'Ambos', age_min:2, age_max:12, lower:76, upper:90 },
    { sex:'Ambos', age_min:12, age_max:18, lower:78, upper:95 },
    { sex:'Femenino', age_min:18, age_max:120, lower:80, upper:96 },
    { sex:'Masculino', age_min:18, age_max:120, lower:80, upper:96 }
  ],
  'Hemoglobina Corpuscular Media': [
    { sex:'Ambos', age_min:0, age_max:1, lower:28, upper:40 },
    { sex:'Ambos', age_min:1, age_max:2, lower:23, upper:31 },
    { sex:'Ambos', age_min:2, age_max:12, lower:25, upper:33 },
    { sex:'Ambos', age_min:12, age_max:18, lower:26, upper:34 },
    { sex:'Femenino', age_min:18, age_max:120, lower:27, upper:33 },
    { sex:'Masculino', age_min:18, age_max:120, lower:27, upper:33 }
  ],
  'Amplitud de Distribución Eritrocitaria': [
    { sex:'Ambos', age_min:0, age_max:1, lower:14, upper:18 },
    { sex:'Ambos', age_min:1, age_max:2, lower:12.5, upper:15.5 },
    { sex:'Ambos', age_min:2, age_max:12, lower:11.5, upper:14.5 },
    { sex:'Ambos', age_min:12, age_max:120, lower:11, upper:14.5 }
  ]
};

describe('Biometría Hemática seed consistency', () => {
  let token;
  beforeAll(async () => { token = await createAdminAndGetToken(); });

  it('matches expected reference ranges for seed parameters', async () => {
    // Obtener lista detallada y filtrar categoría Biometría Hemática
    const res = await request(app)
      .get('/api/analysis/detailed?limit=200')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const items = res.body.data.filter(a => a.category === 'Biometría Hemática');
    // Esperamos 3 estudios (cada uno actúa como parámetro principal bajo este modelo simplificado)
    expect(items.length).toBeGreaterThanOrEqual(3);
    // Para cada uno, obtener parámetros vía endpoint parameters
    for (const study of items) {
      const pRes = await request(app)
        .get(`/api/analysis/${study.id}/parameters`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(pRes.body.length).toBeGreaterThanOrEqual(1);
      // Asumimos un parámetro principal coincide por nombre
  const param = pRes.body.find(p => p.name === study.name && EXPECTED[study.name]);
      if (!param) continue; // si no está en expected, saltar
      // Obtener rangos
      const rRes = await request(app)
        .get(`/api/analysis/parameters/${param.id}/reference-ranges`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const got = rRes.body
        .filter(r => r.notes === 'Seed catálogo')
        .map(r => ({
          sex: r.sex,
          age_min: r.age_min,
            age_max: r.age_max,
          lower: Number(r.lower ?? r.min_value),
          upper: Number(r.upper ?? r.max_value)
        }));
      // Orden lógico por edad y luego sex para asegurar determinismo
      const ord = arr => arr.slice().sort((a,b)=> (a.age_min - b.age_min) || (a.age_max - b.age_max) || a.sex.localeCompare(b.sex));
      expect(ord(got)).toEqual(ord(EXPECTED[study.name]));
    }
  });
});
