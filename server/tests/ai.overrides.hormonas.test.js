const router = require('../routes/ai.js');

describe('AI ensureCoverage overrides hormonales y tiroideos', () => {
  function run(name){
    const base = { parameters:[ { name, unit:'', decimal_places:0, valorReferencia:[ { sexo:'Ambos', edadMin:0, edadMax:120, unidadEdad:'años', valorMin:null, valorMax:null } ] } ] };
    const enriched = router.__ensureCoverageForTest(base, 'TestStudy');
    return enriched.parameters[0];
  }

  test('Prolactina Femenino con 9 segmentos esperados', () => {
    const p = run('Prolactina');
    expect(p.unit).toBe('ng/mL');
    expect(p.valorReferencia.length).toBe(9);
    const span = p.valorReferencia.map(r=>`${r.edadMin}-${r.edadMax}`).join('|');
    expect(span).toContain('0-1');
    expect(span).toContain('55-120');
    expect(p.valorReferencia.every(r=> r.sexo==='Femenino')).toBe(true);
  });

  test('Progesterona segmentos y unidad', () => {
    const p = run('Progesterona');
    expect(p.unit).toBe('ng/mL');
    expect(p.valorReferencia.length).toBeGreaterThanOrEqual(8);
    expect(p.valorReferencia.some(r=> r.edadMin===18 && r.edadMax===45)).toBe(true);
  });

  test('TSH rango geriatría extendido', () => {
    const p = run('TSH');
    const geri = p.valorReferencia.find(r=> r.edadMin===65);
    expect(geri).toBeTruthy();
    expect(geri.valorMax).toBe(6);
  });

  test('T4 Libre valores decrecientes hacia adulto', () => {
    const p = run('T4 Libre');
    const pedi0 = p.valorReferencia.find(r=> r.edadMin===0 && r.edadMax===1);
    const adulto = p.valorReferencia.find(r=> r.edadMin===18 && r.edadMax===65);
    expect(pedi0.valorMax).toBeGreaterThan(adulto.valorMax);
  });

  test('T3 Libre mantiene precision decimal_places=2', () => {
    const p = run('T3 Libre');
    expect(p.decimal_places).toBe(2);
    expect(p.valorReferencia.length).toBe(6);
  });

  test('Anticuerpos anti peroxidasa (TPO) todos segmentos 0-35', () => {
    const p = run('Anti peroxidasa');
    const uniqueMax = new Set(p.valorReferencia.map(r=> r.valorMax));
    expect(uniqueMax.size).toBe(1);
    expect([...uniqueMax][0]).toBe(35);
  });

  test('Anti tiroglobulina todos segmentos 0-4', () => {
    const p = run('Anti Tiroglobulina');
    const uniqueMax = new Set(p.valorReferencia.map(r=> r.valorMax));
    expect(uniqueMax.size).toBe(1);
    expect([...uniqueMax][0]).toBe(4);
  });
});
