// Reference parameter templates with canonical 6 life-stage segments.
// Edades en años: [0-1], [1-2], [2-12], [12-18], [18-65], [65-120]
// Nota: Valores ofrecidos como guía general; requieren validación y posible ajuste según población y metodología local.

const SEGMENTS = [ [0,1], [1,2], [2,12], [12,18], [18,65], [65,120] ];

// Helper to build unisex ranges quickly
function unisexRanges(values, notasMap) {
  return SEGMENTS.map(([a,b], idx) => {
    const v = values[idx] || values[values.length-1];
    const [valorMin, valorMax] = v;
    return { sexo:'Ambos', edadMin:a, edadMax:b, unidadEdad:'años', valorMin, valorMax, notas: notasMap?.[idx] || '' };
  });
}

// Helper for sex-differentiated adult segments >=12, unisex pediatrics
function sexSplitRanges(pediatricValues, maleValues, femaleValues) {
  // pediatricValues: length 3 for first three segments
  const out = [];
  // First three segments unisex
  SEGMENTS.slice(0,3).forEach(([a,b], i) => {
    const [min,max] = pediatricValues[i];
    out.push({ sexo:'Ambos', edadMin:a, edadMax:b, unidadEdad:'años', valorMin:min, valorMax:max, notas:'' });
  });
  // Remaining segments sex specific
  SEGMENTS.slice(3).forEach(([a,b], i) => {
    const [mMin,mMax] = maleValues[i];
    const [fMin,fMax] = femaleValues[i];
    out.push({ sexo:'Masculino', edadMin:a, edadMax:b, unidadEdad:'años', valorMin:mMin, valorMax:mMax, notas:'' });
    out.push({ sexo:'Femenino', edadMin:a, edadMax:b, unidadEdad:'años', valorMin:fMin, valorMax:fMax, notas:'' });
  });
  return out;
}

// Template builders per parameter name (case-insensitive match)
function buildParameterTemplate(name){
  if (!name) return null;
  const raw = name.toLowerCase();
  const SYNONYMS = {
    // Hormonas: normalizaciones comunes de nombres
    'estrógenos': 'estradiol',
    'estrogenos': 'estradiol',
    'estrogeno': 'estradiol',
    'estrógeno': 'estradiol',
    'testosterona': 'testosterona total',
    'anticuerpos anti-tpo': 'anti-tpo',
    'anticuerpos anti tiroglobulina': 'anti-tg',
    'anticuerpos anti-tiroglobulina': 'anti-tg',
    'pcr ultrasensible (hs-crp)': 'pcr ultrasensible',
    'pcr ultrasensible (hs crp)': 'pcr ultrasensible',
    'litio (nivel terapéutico)': 'litio',
    'litio (nivel terapeutico)': 'litio',
    // Hormonas adicionales
    'somatomedina c': 'igf-1',
    'igf 1': 'igf-1',
    'igf1': 'igf-1',
    'hormona del crecimiento': 'gh',
    'somatotropina': 'gh',
    'dihidrotestosterona': 'dht',
  // Estrógenos adicionales
  'estrona': 'e1',
  'estrona (e1)': 'e1',
  'e1': 'e1',
  'estriol': 'e3',
  'estriol (e3)': 'e3',
  'e3': 'e3',
  // ACTH
  'acth': 'acth',
  // Canonical BH names -> hematology keys
  'volumen corpuscular medio': 'vcm',
  'hemoglobina corpuscular media': 'hcm',
  'amplitud de distribución eritrocitaria': 'rdw',
  'amplitud de distribucion eritrocitaria': 'rdw',
  };
  const key = SYNONYMS[raw] || raw;

  // Hemoglobina
  if (key === 'hemoglobina') {
    return {
      unit: 'g/dL',
      decimal_places: 1,
      valorReferencia: sexSplitRanges(
        [ [13.5,20.0], [11.0,13.5], [11.5,14.5] ], // pediatrics 0-1,1-2,2-12
        [ [13.0,16.0], [13.5,17.5], [13.0,17.0] ], // male 12-18,18-65,65-120
        [ [12.0,15.0], [12.0,16.0], [11.5,15.5] ]  // female
      )
    };
  }
  // Hematocrito
  if (key === 'hematocrito') {
    return {
      unit: '%',
      decimal_places: 0,
      valorReferencia: sexSplitRanges(
        [ [42,65], [33,39], [35,45] ],
        [ [37,49], [41,53], [38,52] ],
        [ [36,46], [36,46], [35,47] ]
      )
    };
  }
  // Eritrocitos
  if (key === 'eritrocitos') {
    return {
      unit: 'x10^6/µL',
      decimal_places: 2,
      valorReferencia: sexSplitRanges(
        [ [4.0,6.6], [3.7,5.3], [4.0,5.2] ],
        [ [4.5,5.5], [4.7,6.1], [4.4,5.8] ],
        [ [4.1,5.1], [4.2,5.4], [4.0,5.2] ]
      )
    };
  }
  // VCM
  if (key === 'vcm') {
    return {
      unit: 'fL',
      decimal_places: 1,
      valorReferencia: unisexRanges([
        [95,120], [72,84], [78,90], [80,94], [80,96], [80,100]
      ])
    };
  }
  // HCM
  if (key === 'hcm') {
    return {
      unit: 'pg',
      decimal_places: 1,
      valorReferencia: unisexRanges([
        [30,37], [24,30], [25,33], [26,34], [27,34], [27,34]
      ])
    };
  }
  // CHCM
  if (key === 'chcm') {
    return {
      unit: 'g/dL',
      decimal_places: 1,
      valorReferencia: unisexRanges([
        [30,36], [32,36], [32,36], [32,36], [32,36], [32,36]
      ])
    };
  }
  // RDW
  if (key === 'rdw') {
    return {
      unit: '%',
      decimal_places: 1,
      valorReferencia: unisexRanges([
        [11.5,14.5], [11.5,14.5], [11.5,14.5], [11.5,14.5], [11.5,14.5], [11.5,14.5]
      ])
    };
  }
  // Plaquetas
  if (key === 'plaquetas') {
    return {
      unit: 'x10^3/µL',
      decimal_places: 0,
      valorReferencia: unisexRanges([
        [150,450], [180,450], [150,450], [150,400], [150,400], [150,400]
      ])
    };
  }
  // VMP
  if (key === 'vmp') {
    return {
      unit: 'fL',
      decimal_places: 1,
      valorReferencia: unisexRanges([
        [7.0,11.0], [7.0,11.0], [7.0,11.0], [7.0,11.0], [7.0,11.0], [7.0,11.0]
      ])
    };
  }
  // Leucocitos Totales
  if (key === 'leucocitos totales') {
    return {
      unit: 'x10^3/µL',
      decimal_places: 1,
      valorReferencia: unisexRanges([
        [9.0,30.0], [6.0,17.0], [5.0,14.5], [4.5,13.0], [4.0,11.0], [3.5,11.0]
      ])
    };
  }
  // Neutrofilos Segmentados
  if (key === 'neutrófilos segmentados' || key === 'neutrofilos segmentados') {
    return {
      unit: '%',
      decimal_places: 0,
      valorReferencia: unisexRanges([
        [50,70], [30,60], [35,65], [40,70], [40,75], [40,75]
      ])
    };
  }
  // Neutrofilos Banda
  if (key === 'neutrófilos banda' || key === 'neutrofilos banda') {
    return {
      unit: '%',
      decimal_places: 0,
      valorReferencia: unisexRanges([
        [0,10], [0,6], [0,6], [0,6], [0,6], [0,6]
      ])
    };
  }
  // Linfocitos
  if (key === 'linfocitos') {
    return {
      unit: '%',
      decimal_places: 0,
      valorReferencia: unisexRanges([
        [20,40], [40,60], [30,60], [20,45], [20,45], [20,45]
      ])
    };
  }
  // Monocitos
  if (key === 'monocitos') {
    return {
      unit: '%',
      decimal_places: 0,
      valorReferencia: unisexRanges([
        [2,12], [2,10], [2,10], [2,10], [2,10], [2,10]
      ])
    };
  }
  // Eosinofilos
  if (key === 'eosinófilos' || key === 'eosinofilos') {
    return {
      unit: '%',
      decimal_places: 0,
      valorReferencia: unisexRanges([
        [0,5], [0,5], [0,5], [0,5], [0,5], [0,5]
      ])
    };
  }
  if (key === 'eosinófilos (recuento absoluto)' || key === 'eosinofilos (recuento absoluto)') {
    return {
      unit: 'x10^3/µL',
      decimal_places: 2,
      valorReferencia: unisexRanges([
        [0.00,0.70], [0.00,0.70], [0.00,0.70], [0.00,0.70], [0.00,0.70], [0.00,0.70]
      ])
    };
  }
  // Basofilos
  if (key === 'basófilos' || key === 'basofilos') {
    return {
      unit: '%',
      decimal_places: 0,
      valorReferencia: unisexRanges([
        [0,1], [0,1], [0,1], [0,1], [0,1], [0,1]
      ])
    };
  }
  // Blastos
  if (key === 'blastos') {
    return {
      unit: '%', decimal_places: 0,
      valorReferencia: unisexRanges([
        [0,0], [0,0], [0,0], [0,0], [0,0], [0,0]
      ], { 0:'Ausentes en sangre periférica normal' })
    };
  }
  // Metamielocitos
  if (key === 'metamielocitos') {
    return { unit:'%', decimal_places:0, valorReferencia: unisexRanges([
      [0,0],[0,0],[0,0],[0,0],[0,0],[0,0]
    ], { 0:'Ausentes en sangre periférica normal' }) };
  }
  // Mielocitos
  if (key === 'mielocitos') {
    return { unit:'%', decimal_places:0, valorReferencia: unisexRanges([
      [0,0],[0,0],[0,0],[0,0],[0,0],[0,0]
    ], { 0:'Ausentes en sangre periférica normal' }) };
  }
  // Promielocitos
  if (key === 'promielocitos') {
    return { unit:'%', decimal_places:0, valorReferencia: unisexRanges([
      [0,0],[0,0],[0,0],[0,0],[0,0],[0,0]
    ], { 0:'Ausentes en sangre periférica normal' }) };
  }

  // ===== Thyroid Panel =====
  if (key === 'tsh') {
    return { unit:'µIU/mL', decimal_places:2, valorReferencia: unisexRanges([
      [0.7,15],[0.7,8.5],[0.7,6.0],[0.5,5.0],[0.4,4.5],[0.4,5.0]
    ]) };
  }
  if (key === 't4 libre') {
    return { unit:'ng/dL', decimal_places:2, valorReferencia: unisexRanges([
      [0.8,2.0],[0.8,2.0],[0.8,1.9],[0.8,1.9],[0.8,1.8],[0.8,1.8]
    ]) };
  }
  if (key === 't4 total') {
    return { unit:'µg/dL', decimal_places:2, valorReferencia: unisexRanges([
      [6.0,14.0],[6.0,13.0],[5.5,12.5],[5.0,12.0],[5.0,12.0],[5.0,12.0]
    ]) };
  }
  if (key === 't3 total') {
    return { unit:'ng/dL', decimal_places:1, valorReferencia: unisexRanges([
      [80,220],[80,210],[80,200],[80,190],[80,180],[80,180]
    ]) };
  }
  if (key === 't3 libre') {
    return { unit:'pg/mL', decimal_places:2, valorReferencia: unisexRanges([
      [2.0,5.5],[2.0,5.5],[2.0,5.2],[2.0,5.0],[2.0,4.8],[2.0,4.8]
    ]) };
  }
  if (key === 'trab / tsi' || key === 'trab' || key === 'tsi' ) {
    return { unit:'UI/L', decimal_places:2, valorReferencia: unisexRanges([
      [0.00,1.75],[0.00,1.75],[0.00,1.75],[0.00,1.75],[0.00,1.75],[0.00,1.75]
    ]) };
  }
  if (key === 'anti-tpo') {
    return { unit:'UI/mL', decimal_places:1, valorReferencia: unisexRanges([
      [0,35],[0,35],[0,35],[0,35],[0,35],[0,35]
    ]) };
  }
  if (key === 'anti-tg') {
    return { unit:'UI/mL', decimal_places:1, valorReferencia: unisexRanges([
      [0,40],[0,40],[0,40],[0,40],[0,40],[0,40]
    ]) };
  }

  // ===== Hepatic Panel =====
  if (key === 'alt (tgp)') {
    return { unit:'U/L', decimal_places:0, valorReferencia: unisexRanges([
      [5,45],[5,40],[5,40],[5,40],[5,41],[5,45]
    ]) };
  }
  if (key === 'ast (tgo)') {
    return { unit:'U/L', decimal_places:0, valorReferencia: unisexRanges([
      [5,80],[5,70],[5,50],[5,40],[5,40],[5,45]
    ]) };
  }
  if (key === 'fosfatasa alcalina') {
    return { unit:'U/L', decimal_places:0, valorReferencia: unisexRanges([
      [110,550],[110,550],[130,400],[100,300],[44,147],[44,130]
    ]) };
  }
  if (key === 'bilirrubina total') {
    return { unit:'mg/dL', decimal_places:2, valorReferencia: unisexRanges([
      [0.2,1.2],[0.2,1.2],[0.2,1.2],[0.2,1.2],[0.2,1.2],[0.2,1.4]
    ]) };
  }
  if (key === 'bilirrubina directa') {
    return { unit:'mg/dL', decimal_places:2, valorReferencia: unisexRanges([
      [0.0,0.4],[0.0,0.4],[0.0,0.4],[0.0,0.4],[0.0,0.4],[0.0,0.4]
    ]) };
  }
  if (key === 'bilirrubina indirecta') {
    return { unit:'mg/dL', decimal_places:2, valorReferencia: unisexRanges([
      [0.2,0.8],[0.2,0.8],[0.2,0.8],[0.2,0.8],[0.2,0.8],[0.2,1.0]
    ]) };
  }
  if (key === 'ggt') {
    return { unit:'U/L', decimal_places:0, valorReferencia: unisexRanges([
      [10,120],[10,60],[10,50],[10,45],[10,40],[10,50]
    ]) };
  }
  if (key === 'albúmina' || key === 'albumina') {
    return { unit:'g/dL', decimal_places:2, valorReferencia: unisexRanges([
      [3.0,5.0],[3.2,5.2],[3.5,5.2],[3.5,5.0],[3.5,5.0],[3.2,4.8]
    ]) };
  }
  if (key === 'proteínas totales' || key === 'proteinas totales') {
    return { unit:'g/dL', decimal_places:2, valorReferencia: unisexRanges([
      [5.5,7.5],[5.8,7.8],[6.0,8.0],[6.2,8.0],[6.3,8.2],[6.0,8.0]
    ]) };
  }
  if (key === 'retinol-binding protein' || key === 'rbp') {
    return { unit:'mg/L', decimal_places:1, valorReferencia: unisexRanges([
      [25,70],[25,70],[25,70],[25,70],[25,70],[25,70]
    ]) };
  }

  // ===== Hormonal / Gynecologic overlaps =====
  if (key === 'fsh') {
    return { unit:'mIU/mL', decimal_places:2, valorReferencia: sexSplitRanges(
      // Pediátrico (Ambos)
      [ [0.5,6.0],[0.5,6.0],[0.5,6.5] ],
      // Adulto Masculino (12-18, 18-65, 65-120)
      [ [1.0,12.0],[1.0,12.0],[1.0,12.0] ],
      // Adulto Femenino
      [ [1.0,10.0],[1.0,10.0],[1.0,10.0] ]
    ) };
  }
  if (key === 'lh') {
    return { unit:'mIU/mL', decimal_places:2, valorReferencia: sexSplitRanges(
      [ [0.1,5.0],[0.1,5.0],[0.1,6.0] ],
      [ [1.0,9.0],[1.0,9.0],[1.0,9.0] ],
      [ [1.0,15.0],[1.0,15.0],[1.0,15.0] ]
    ) };
  }
  if (key === 'prolactina') {
    return { unit:'ng/mL', decimal_places:1, valorReferencia: sexSplitRanges(
      [ [2,30],[2,25],[2,22] ],
      [ [2,18],[2,18],[2,18] ],
      [ [2,25],[2,22],[2,22] ]
    ) };
  }
  if (key === 'estradiol') {
    return { unit:'pg/mL', decimal_places:0, valorReferencia: sexSplitRanges(
      [ [15,50],[15,50],[15,50] ],
      [ [10,50],[10,45],[10,45] ],
      [ [15,350],[15,300],[15,250] ]
    ) };
  }
  if (key === 'progesterona') {
    return { unit:'ng/mL', decimal_places:2, valorReferencia: sexSplitRanges(
      [ [0.1,1.5],[0.1,1.5],[0.1,1.5] ],
      [ [0.1,1.0],[0.1,1.0],[0.1,1.0] ],
      [ [0.1,20.0],[0.1,20.0],[0.1,20.0] ]
    ) };
  }
  if (key === 'he4') {
    return { unit:'pmol/L', decimal_places:0, valorReferencia: unisexRanges([
      [0,140],[0,140],[0,140],[0,140],[0,140],[0,140]
    ]) };
  }
  if (key === 'testosterona total') {
    return { unit:'ng/dL', decimal_places:0, valorReferencia: sexSplitRanges(
      [ [20,200],[20,200],[20,350] ],
      [ [300,1000],[250,900],[200,850] ],
      [ [15,70],[15,70],[10,60] ]
    ) };
  }
  if (key === 'testosterona libre') {
    return { unit:'pg/mL', decimal_places:1, valorReferencia: sexSplitRanges(
      [ [1,25],[1,25],[1,30] ],
      [ [50,200],[40,160],[30,140] ],
      [ [1,30],[1,25],[1,20] ]
    ) };
  }
  if (key === 'dhea-s' || key === 'dhea s') {
    return { unit:'µg/dL', decimal_places:0, valorReferencia: sexSplitRanges(
      [ [15,150],[15,150],[30,300] ],
      [ [120,520],[100,560],[60,400] ],
      [ [100,480],[60,340],[30,260] ]
    ) };
  }
  if (key === 'cortisol matutino') {
    return { unit:'µg/dL', decimal_places:1, valorReferencia: unisexRanges([
      [5,25],[5,25],[5,22],[5,20],[5,18],[5,18]
    ]) };
  }
  if (key === 'cortisol vespertino') {
    return { unit:'µg/dL', decimal_places:1, valorReferencia: unisexRanges([
      [2,15],[2,15],[2,12],[2,10],[2,9],[2,9]
    ]) };
  }
  if (key === 'androstenediona') {
    return { unit:'ng/mL', decimal_places:2, valorReferencia: sexSplitRanges(
      [ [0.2,1.2],[0.2,1.2],[0.2,1.5] ],
      [ [0.3,2.5],[0.3,2.2],[0.3,2.0] ],
      [ [0.3,3.0],[0.3,2.8],[0.3,2.5] ]
    ) };
  }
  if (key === 'amh') {
    return { unit:'ng/mL', decimal_places:2, valorReferencia: sexSplitRanges(
      [ [0.5,12.0],[0.5,12.0],[0.5,8.0] ],
      [ [2.0,5.0],[1.5,4.0],[1.0,3.5] ],
      [ [1.0,6.0],[0.5,5.0],[0.2,4.0] ]
    ) };
  }
  // Estrona (E1)
  if (key === 'e1') {
    return { unit:'pg/mL', decimal_places:0, valorReferencia: sexSplitRanges(
      // Pediátrico (Ambos)
      [ [10,40],[10,50],[10,60] ],
      // Adulto Masculino
      [ [10,60],[10,60],[10,60] ],
      // Adulto Femenino (posmenopausia frecuente en 65+)
      [ [30,400],[30,400],[10,60] ]
    ) };
  }
  // Estriol (E3) - no embarazo muy bajo; embarazo eleva (no modelado por trimestres)
  if (key === 'e3') {
    return { unit:'ng/mL', decimal_places:2, valorReferencia: sexSplitRanges(
      [ [0.00,0.10],[0.00,0.10],[0.00,0.10] ],
      [ [0.00,0.10],[0.00,0.10],[0.00,0.08] ],
      [ [0.00,0.10],[0.00,0.10],[0.00,0.08] ]
    ) };
  }
  // ACTH - típicamente reportado como unisex; mantenemos unisex por tramos
  if (key === 'acth') {
    return { unit:'pg/mL', decimal_places:0, valorReferencia: unisexRanges([
      [5,80],[5,70],[5,70],[10,60],[10,60],[10,60]
    ]) };
  }
  // SHBG
  if (key === 'shbg') {
    return { unit:'nmol/L', decimal_places:0, valorReferencia: sexSplitRanges(
      [ [20,120],[20,120],[20,120] ],
      [ [10,60],[10,55],[10,50] ],
      [ [20,120],[18,110],[15,100] ]
    ) };
  }
  // IGF-1
  if (key === 'igf-1') {
    return { unit:'ng/mL', decimal_places:0, valorReferencia: sexSplitRanges(
      [ [30,120],[40,160],[60,350] ],
      [ [150,500],[120,350],[100,250] ],
      [ [150,500],[120,350],[100,250] ]
    ) };
  }
  // GH
  if (key === 'gh') {
    return { unit:'ng/mL', decimal_places:2, valorReferencia: sexSplitRanges(
      [ [0.1,7.0],[0.1,6.0],[0.1,5.0] ],
      [ [0.1,3.0],[0.1,2.5],[0.1,2.0] ],
      [ [0.1,3.0],[0.1,2.5],[0.1,2.0] ]
    ) };
  }
  // DHT
  if (key === 'dht') {
    return { unit:'ng/dL', decimal_places:0, valorReferencia: sexSplitRanges(
      [ [5,60],[5,60],[5,75] ],
      [ [30,85],[25,75],[20,70] ],
      [ [5,30],[5,25],[5,20] ]
    ) };
  }
  if (key === 'ca-125') {
    return { unit:'U/mL', decimal_places:1, valorReferencia: unisexRanges([
      [0,35],[0,35],[0,35],[0,35],[0,35],[0,35]
    ]) };
  }
  if (key === 'ca 125') {
    return { unit:'U/mL', decimal_places:1, valorReferencia: unisexRanges([
      [0,35],[0,35],[0,35],[0,35],[0,35],[0,35]
    ]) };
  }

  // ===== Urinalysis ===== (qualitative default placeholders)
  if (['color orina','aspecto orina','glucosa orina','proteínas orina','proteinas orina','cuerpos cetónicos','cuerpos cetonicos','bilirrubina orina','urobilinógeno','urobilinogeno','sangre orina','nitritos','esterasa leucocitaria','densidad','ph orina'].includes(key)) {
    return { unit:'', decimal_places:0, valorReferencia: unisexRanges([
      [null,null],[null,null],[null,null],[null,null],[null,null],[null,null]
    ]).map(r=>({ ...r, tipoValor:'textoLibre', notas:(key==='densidad'||key==='ph orina')? '' : 'Resultado cualitativo' })) };
  }
  if (['leucocitos (sedimento)','eritrocitos (sedimento)','células epiteliales','celulas epiteliales','bacterias'].includes(key)) {
    return { unit:'/campo', decimal_places:0, valorReferencia: unisexRanges([
      [0,5],[0,5],[0,5],[0,5],[0,5],[0,5]
    ]) };
  }
  if (key === 'leucocitos urinarios (conteo)' || key === 'eritrocitos urinarios (conteo)') {
    return { unit:'/campo', decimal_places:0, valorReferencia: unisexRanges([
      [0,5],[0,5],[0,5],[0,5],[0,5],[0,5]
    ]) };
  }

  // ===== General Chemistry Panel common =====
  if (key === 'glucosa') {
    return { unit:'mg/dL', decimal_places:0, valorReferencia: unisexRanges([
      [40,110],[60,110],[70,110],[70,100],[70,100],[70,110]
    ]) };
  }
  if (key === 'urea') {
    return { unit:'mg/dL', decimal_places:0, valorReferencia: unisexRanges([
      [3,40],[3,40],[5,40],[7,40],[10,50],[10,55]
    ]) };
  }
  if (key === 'creatinina') {
    return { unit:'mg/dL', decimal_places:2, valorReferencia: unisexRanges([
      [0.2,0.9],[0.2,0.9],[0.3,0.9],[0.5,1.1],[0.6,1.2],[0.6,1.3]
    ]) };
  }
  if (key === 'ácido úrico' || key === 'acido urico') {
    return { unit:'mg/dL', decimal_places:2, valorReferencia: unisexRanges([
      [2.0,6.5],[2.0,6.5],[2.0,6.5],[2.5,7.0],[3.0,7.5],[3.0,8.0]
    ]) };
  }
  if (key === 'colesterol total') {
    return { unit:'mg/dL', decimal_places:0, valorReferencia: unisexRanges([
      [60,180],[60,180],[90,200],[120,200],[125,200],[125,220]
    ]) };
  }
  if (key === 'triglicéridos' || key === 'trigliceridos') {
    return { unit:'mg/dL', decimal_places:0, valorReferencia: unisexRanges([
      [30,150],[30,150],[30,150],[30,150],[30,150],[30,160]
    ]) };
  }
  if (key === 'hdl') {
    return { unit:'mg/dL', decimal_places:0, valorReferencia: unisexRanges([
      [30,90],[30,90],[35,80],[40,80],[40,90],[40,90]
    ]) };
  }
  if (key === 'ldl calculado') {
    return { unit:'mg/dL', decimal_places:0, valorReferencia: unisexRanges([
      [30,140],[30,140],[40,130],[50,130],[50,130],[50,140]
    ]) };
  }
  if (key === 'calcio') {
    return { unit:'mg/dL', decimal_places:2, valorReferencia: unisexRanges([
      [8.0,11.0],[8.5,11.0],[9.0,11.0],[8.8,10.8],[8.5,10.5],[8.4,10.2]
    ]) };
  }
  if (key === 'fósforo' || key === 'fosforo') {
    return { unit:'mg/dL', decimal_places:2, valorReferencia: unisexRanges([
      [4.0,7.5],[4.0,7.0],[3.5,5.5],[2.5,4.9],[2.5,4.5],[2.5,4.5]
    ]) };
  }
  if (key === 'vitamina d 25-oh' || key === 'vitamina d 25 oh') {
    return { unit:'ng/mL', decimal_places:1, valorReferencia: unisexRanges([
      [20,60],[20,60],[20,60],[20,60],[30,60],[25,60]
    ]) };
  }

  // ===== Trace elements / vitamins =====
  if (key === 'zinc') {
    return { unit:'µg/dL', decimal_places:0, valorReferencia: unisexRanges([
      [50,120],[60,130],[65,130],[70,130],[70,120],[70,115]
    ]) };
  }
  if (key === 'zinc seminal') {
    return { unit:'mg/L', decimal_places:1, valorReferencia: unisexRanges([
      [2.0,6.0],[2.0,6.0],[2.0,6.0],[2.0,6.0],[2.0,6.0],[2.0,6.0]
    ]) };
  }
  if (key === 'ácido fólico' || key === 'acido folico') {
    return { unit:'ng/mL', decimal_places:1, valorReferencia: unisexRanges([
      [3.0,17.0],[3.0,17.0],[3.0,17.0],[3.0,17.0],[3.0,17.0],[3.0,17.0]
    ]) };
  }
  if (key === 'yodo urinario') {
    return { unit:'µg/L', decimal_places:0, valorReferencia: unisexRanges([
      [100,300],[100,300],[100,300],[100,300],[100,300],[100,300]
    ]) };
  }

  // ===== Pregnancy / tumor markers =====
  if (key === 'hcg total' || key === 'β-hcg total' || key === 'bhcg total') {
    return { unit:'mIU/mL', decimal_places:0, valorReferencia: unisexRanges([
      [0,5],[0,5],[0,5],[0,5],[0,5],[0,5]
    ]).map(r=>({ ...r, notas:'Valores de no embarazo' })) };
  }

  // ===== Blood gases / acid-base =====
  if (key === 'ph arterial') {
    return { unit:'', decimal_places:2, valorReferencia: unisexRanges([
      [7.30,7.45],[7.32,7.45],[7.35,7.45],[7.35,7.45],[7.35,7.45],[7.35,7.45]
    ]) };
  }
  if (key === 'pco₂' || key === 'pco2') {
    return { unit:'mmHg', decimal_places:0, valorReferencia: unisexRanges([
      [30,45],[32,45],[35,45],[35,45],[35,45],[35,47]
    ]) };
  }
  if (key === 'po₂' || key === 'po2') {
    return { unit:'mmHg', decimal_places:0, valorReferencia: unisexRanges([
      [60,100],[70,100],[75,100],[80,100],[80,100],[75,100]
    ]) };
  }
  if (key === 'ph fecal') {
    return { unit:'', decimal_places:1, valorReferencia: unisexRanges([
      [5.5,8.0],[5.5,8.0],[5.5,8.0],[5.5,8.0],[5.5,8.0],[5.5,8.0]
    ]) };
  }

  // ===== Bile acids =====
  if (key === 'ácidos biliares séricos' || key === 'acidos biliares sericos') {
    return { unit:'µmol/L', decimal_places:1, valorReferencia: unisexRanges([
      [0.0,10.0],[0.0,10.0],[0.0,10.0],[0.0,10.0],[0.0,10.0],[0.0,10.0]
    ]) };
  }

  // ===== Urine ratios / 24h =====
  if (key === 'índice albúmina/creatinina urinaria' || key === 'indice albumina/creatinina urinaria' || key === 'indice albúmina/creatinina urinaria' || key === 'índice albumina/creatinina urinaria') {
    return { unit:'mg/g', decimal_places:0, valorReferencia: unisexRanges([
      [0,30],[0,30],[0,30],[0,30],[0,30],[0,30]
    ]) };
  }
  if (key === 'ácido úrico urinario 24 h' || key === 'acido urico urinario 24 h') {
    return { unit:'mg/24h', decimal_places:0, valorReferencia: unisexRanges([
      [150,600],[150,600],[150,600],[200,700],[250,750],[250,750]
    ]) };
  }

  // ===== Hemostasis =====
  if (key === 'von willebrand antígeno' || key === 'von willebrand antigeno') {
    return { unit:'%', decimal_places:0, valorReferencia: unisexRanges([
      [50,150],[50,150],[50,150],[50,150],[50,150],[50,150]
    ]) };
  }
  if (key === 'índice de saturación de transferrina (reportado)' || key === 'indice de saturacion de transferrina (reportado)' || key === 'índice de saturación de transferrina' || key === 'indice de saturacion de transferrina') {
    return { unit:'%', decimal_places:0, valorReferencia: unisexRanges([
      [20,50],[20,50],[20,50],[20,50],[20,50],[20,50]
    ]) };
  }

  // ===== Electrolytes =====
  if (key === 'sodio') {
    return { unit:'mmol/L', decimal_places:0, valorReferencia: unisexRanges([
      [130,145],[132,145],[135,145],[135,145],[135,145],[135,146]
    ]) };
  }
  if (key === 'potasio') {
    return { unit:'mmol/L', decimal_places:1, valorReferencia: unisexRanges([
      [3.5,6.0],[3.5,5.5],[3.5,5.0],[3.5,5.0],[3.5,5.1],[3.5,5.3]
    ]) };
  }
  if (key === 'cloro') {
    return { unit:'mmol/L', decimal_places:0, valorReferencia: unisexRanges([
      [96,110],[97,108],[98,107],[98,107],[98,107],[98,109]
    ]) };
  }
  if (key === 'calcio ionizado') {
    return { unit:'mmol/L', decimal_places:2, valorReferencia: unisexRanges([
      [1.00,1.50],[1.05,1.40],[1.08,1.40],[1.10,1.32],[1.12,1.32],[1.10,1.30]
    ]) };
  }
  if (key === 'magnesio') {
    return { unit:'mg/dL', decimal_places:2, valorReferencia: unisexRanges([
      [1.6,2.5],[1.6,2.4],[1.6,2.3],[1.6,2.3],[1.6,2.4],[1.6,2.4]
    ]) };
  }
  if (key === 'litio' || key === 'litio (nivel terapéutico)' || key === 'litio (nivel terapeutico)') {
    return { unit:'mEq/L', decimal_places:2, valorReferencia: unisexRanges([
      [0.60,1.20],[0.60,1.20],[0.60,1.20],[0.60,1.20],[0.60,1.20],[0.60,1.20]
    ]) };
  }
  if (key === 'bicarbonato') {
    return { unit:'mmol/L', decimal_places:0, valorReferencia: unisexRanges([
      [18,26],[20,26],[21,28],[22,28],[22,29],[22,29]
    ]) };
  }

  // ===== Coagulation =====
  if (key === 'tp' || key === 'tp (tiempo de protrombina)' || key === 'tiempo de protrombina') { // Prothrombin time reported as seconds
    return { unit:'s', decimal_places:1, valorReferencia: unisexRanges([
      [10,17],[10,17],[10,16],[10,15],[10,15],[10,16]
    ]) };
  }
  if (key === 'inr') {
    return { unit:'', decimal_places:2, valorReferencia: unisexRanges([
      [0.8,1.3],[0.8,1.3],[0.8,1.3],[0.8,1.3],[0.8,1.3],[0.8,1.4]
    ]) };
  }
  if (key === 'ttpa' || key === 'tt-pa' || key === 'aptt' || key === 'ttpa (aptt)') {
    return { unit:'s', decimal_places:1, valorReferencia: unisexRanges([
      [25,45],[25,41],[25,38],[25,37],[25,37],[25,40]
    ]) };
  }
  if (key === 'lupus anticoagulante (drvvt ratio)' || key === 'lupus anticoagulante') {
    return { unit:'', decimal_places:2, valorReferencia: unisexRanges([
      [0.80,1.20],[0.80,1.20],[0.80,1.20],[0.80,1.20],[0.80,1.20],[0.80,1.20]
    ]) };
  }
  if (key === 'tiempo de trombina') {
    return { unit:'s', decimal_places:1, valorReferencia: unisexRanges([
      [14,21],[14,21],[14,21],[14,21],[14,21],[14,21]
    ]) };
  }
  if (key === 'tiempo de reptilasa') {
    return { unit:'s', decimal_places:1, valorReferencia: unisexRanges([
      [16,22],[16,22],[16,22],[16,22],[16,22],[16,22]
    ]) };
  }
  if (key === 'proteína c (actividad)' || key === 'proteina c (actividad)') {
    return { unit:'%', decimal_places:0, valorReferencia: unisexRanges([
      [70,140],[70,140],[70,140],[70,140],[70,140],[70,140]
    ]) };
  }
  if (key === 'proteína s (actividad o antígeno)' || key === 'proteina s (actividad o antigeno)' || key === 'proteína s (actividad)' || key === 'proteina s (actividad)') {
    return { unit:'%', decimal_places:0, valorReferencia: unisexRanges([
      [60,130],[60,130],[60,130],[60,130],[60,130],[60,130]
    ]) };
  }
  if (key === 'plasminógeno' || key === 'plasminogeno') {
    return { unit:'%', decimal_places:0, valorReferencia: unisexRanges([
      [75,130],[75,130],[75,130],[75,130],[75,130],[75,130]
    ]) };
  }
  if (key === 'ch50') {
    return { unit:'U/mL', decimal_places:0, valorReferencia: unisexRanges([
      [23,63],[23,63],[23,63],[23,63],[23,63],[23,63]
    ]) };
  }
  if (key === 'c1 inhibidor (cantidad)' || key === 'c1 inhibidor (antigeno)' || key === 'c1 inhibidor (antígeno)') {
    return { unit:'mg/dL', decimal_places:1, valorReferencia: unisexRanges([
      [16,33],[16,33],[16,33],[16,33],[16,33],[16,33]
    ]) };
  }
  if (key === 'c1 inhibidor (función)' || key === 'c1 inhibidor (funcion)') {
    return { unit:'%', decimal_places:0, valorReferencia: unisexRanges([
      [70,130],[70,130],[70,130],[70,130],[70,130],[70,130]
    ]) };
  }
  if (key === 'factor viii (actividad)' || key === 'factor ix (actividad)' || key === 'factor xi (actividad)' || key === 'factor xii (actividad)') {
    return { unit:'%', decimal_places:0, valorReferencia: unisexRanges([
      [50,150],[50,150],[50,150],[50,150],[50,150],[50,150]
    ]) };
  }

  // ===== Blood Group placeholders =====
  if (key === 'grupo sanguíneo' || key === 'grupo sanguineo') {
    return { unit:'', decimal_places:0, valorReferencia: unisexRanges([
      [null,null],[null,null],[null,null],[null,null],[null,null],[null,null]
    ]).map(r=>({ ...r, tipoValor:'textoLibre', notas:'ABO (A, B, AB, O)' })) };
  }
  if (key === 'factor rh' || key === 'rh' ) {
    return { unit:'', decimal_places:0, valorReferencia: unisexRanges([
      [null,null],[null,null],[null,null],[null,null],[null,null],[null,null]
    ]).map(r=>({ ...r, tipoValor:'textoLibre', notas:'Rh(+)/Rh(-)' })) };
  }
  if (key === 'coombs directo') {
    return { unit:'', decimal_places:0, valorReferencia: unisexRanges([
      [null,null],[null,null],[null,null],[null,null],[null,null],[null,null]
    ]).map(r=>({ ...r, tipoValor:'textoLibre', notas:'Negativo' })) };
  }

  // ===== Lipid extended =====
  if (key === 'vldl') {
    return { unit:'mg/dL', decimal_places:0, valorReferencia: unisexRanges([
      [5,40],[5,40],[5,40],[5,40],[5,40],[5,42]
    ]) };
  }
  if (key === 'colesterol no-hdl' || key === 'colesterol no hdl') {
    return { unit:'mg/dL', decimal_places:0, valorReferencia: unisexRanges([
      [60,150],[60,150],[70,160],[80,160],[80,160],[80,170]
    ]) };
  }
  if (key === 'psa total') {
    // Reference typical upper limit ~4 ng/mL for adult males; keep broad for others
    return { unit:'ng/mL', decimal_places:1, valorReferencia: unisexRanges([
      [0.0,1.0],[0.0,1.0],[0.0,1.0],[0.0,4.0],[0.0,4.0],[0.0,6.5]
    ]) };
  }
  if (key === 'psa libre') {
    return { unit:'ng/mL', decimal_places:2, valorReferencia: unisexRanges([
      [0.00,0.50],[0.00,0.50],[0.00,0.60],[0.00,1.50],[0.00,1.50],[0.00,1.80]
    ]) };
  }
  if (key === '% psa libre (reportado)' || key === '% psa libre') {
    return { unit:'%', decimal_places:0, valorReferencia: unisexRanges([
      [10,35],[10,35],[10,35],[10,35],[10,35],[10,35]
    ]) };
  }
  if (key === 'prealbúmina' || key === 'prealbumina') {
    return { unit:'mg/dL', decimal_places:1, valorReferencia: unisexRanges([
      [10,40],[10,40],[12,40],[18,45],[18,45],[18,40]
    ]) };
  }
  if (key === 'tiroglobulina') {
    return { unit:'ng/mL', decimal_places:1, valorReferencia: unisexRanges([
      [0.0,30.0],[0.0,30.0],[0.0,30.0],[1.0,30.0],[1.0,30.0],[1.0,30.0]
    ]) };
  }
  if (key === 'triptasa sérica' || key === 'triptasa serica') {
    return { unit:'ng/mL', decimal_places:1, valorReferencia: unisexRanges([
      [1.0,11.4],[1.0,11.4],[1.0,11.4],[1.0,11.4],[1.0,11.4],[1.0,11.4]
    ]) };
  }
  if (key === 'progrp') {
    return { unit:'pg/mL', decimal_places:0, valorReferencia: unisexRanges([
      [0,80],[0,80],[0,80],[0,80],[0,80],[0,80]
    ]) };
  }
  if (key === 'scc') {
    return { unit:'ng/mL', decimal_places:1, valorReferencia: unisexRanges([
      [0.0,2.0],[0.0,2.0],[0.0,2.0],[0.0,2.0],[0.0,2.0],[0.0,2.0]
    ]) };
  }
  if (key === 'receptor soluble de transferrina') {
    return { unit:'mg/L', decimal_places:2, valorReferencia: unisexRanges([
      [0.76,1.76],[0.76,1.76],[0.76,1.76],[0.76,1.76],[0.76,1.76],[0.76,1.76]
    ]) };
  }
  if (key === 'proteinuria 24 h') {
    return { unit:'mg/24h', decimal_places:0, valorReferencia: unisexRanges([
      [0,150],[0,150],[0,150],[0,150],[0,150],[0,150]
    ]) };
  }
  if (key === 'proteína urinaria puntual' || key === 'proteina urinaria puntual') {
    return { unit:'mg/dL', decimal_places:0, valorReferencia: unisexRanges([
      [0,20],[0,20],[0,20],[0,20],[0,20],[0,20]
    ]) };
  }
  if (key === 'beta-2 microglobulina' || key === 'beta 2 microglobulina' ) {
    return { unit:'mg/L', decimal_places:1, valorReferencia: unisexRanges([
      [0.7,1.8],[0.7,1.8],[0.7,1.8],[0.7,1.8],[0.7,1.8],[0.7,2.3]
    ]) };
  }
  if (key === 'nse') {
    return { unit:'ng/mL', decimal_places:1, valorReferencia: unisexRanges([
      [0.0,16.3],[0.0,16.3],[0.0,16.3],[0.0,16.3],[0.0,16.3],[0.0,16.3]
    ]) };
  }
  if (key === 'eritropoyetina') {
    return { unit:'mIU/mL', decimal_places:1, valorReferencia: unisexRanges([
      [3.0,30.0],[3.0,30.0],[3.0,30.0],[3.0,30.0],[3.0,30.0],[3.0,30.0]
    ]) };
  }
  if (key === 'leptina') {
    return { unit:'ng/mL', decimal_places:1, valorReferencia: unisexRanges([
      [0.5,30.0],[0.5,30.0],[0.5,30.0],[0.5,30.0],[0.5,30.0],[0.5,30.0]
    ]) };
  }
  if (key === 'vasopresina (adh)' || key === 'vasopresina' || key === 'adh') {
    return { unit:'pg/mL', decimal_places:1, valorReferencia: unisexRanges([
      [0.5,6.0],[0.5,6.0],[0.5,6.0],[0.5,6.0],[0.5,6.0],[0.5,6.0]
    ]) };
  }
  if (key === 'beta-hcg sérica cuantitativa' || key === 'beta-hcg serica cuantitativa') {
    return { unit:'mIU/mL', decimal_places:0, valorReferencia: unisexRanges([
      [0,5],[0,5],[0,5],[0,5],[0,5],[0,5]
    ]) };
  }

  // ===== Renal panel extras =====
  if (key === 'bun') {
    return { unit:'mg/dL', decimal_places:0, valorReferencia: unisexRanges([
      [2,25],[2,25],[5,25],[7,25],[8,26],[8,28]
    ]) };
  }
  if (key === 'depuración creatinina' || key === 'depuracion creatinina') {
    return { unit:'mL/min', decimal_places:0, valorReferencia: unisexRanges([
      [60,180],[60,180],[80,180],[90,140],[80,130],[60,120]
    ]) };
  }

  // ===== Cardiac markers =====
  if (key === 'troponina i') {
    return { unit:'ng/mL', decimal_places:3, valorReferencia: unisexRanges([
      [0.000,0.030],[0.000,0.030],[0.000,0.030],[0.000,0.030],[0.000,0.030],[0.000,0.030]
    ]) };
  }
  if (key === 'ck total') {
    return { unit:'U/L', decimal_places:0, valorReferencia: unisexRanges([
      [30,300],[30,300],[30,250],[30,200],[30,170],[30,160]
    ]) };
  }
  if (key === 'ck-mb' || key === 'ck mb') {
    return { unit:'ng/mL', decimal_places:1, valorReferencia: unisexRanges([
      [0.0,6.0],[0.0,6.0],[0.0,5.0],[0.0,5.0],[0.0,5.0],[0.0,5.0]
    ]) };
  }
  if (key === 'dhl') { // LDH
    return { unit:'U/L', decimal_places:0, valorReferencia: unisexRanges([
      [160,450],[160,450],[160,370],[140,280],[135,225],[130,230]
    ]) };
  }
  if (key === 'mioglobina') {
    return { unit:'ng/mL', decimal_places:0, valorReferencia: unisexRanges([
      [10,90],[10,90],[10,80],[10,75],[10,70],[10,70]
    ]) };
  }
  if (key === 'bnp') {
    return { unit:'pg/mL', decimal_places:0, valorReferencia: unisexRanges([
      [0,100],[0,100],[0,80],[0,80],[0,100],[0,120]
    ]) };
  }
  if (key === 'dímero d' || key === 'dimero d') {
    return { unit:'ng/mL', decimal_places:0, valorReferencia: unisexRanges([
      [0,500],[0,500],[0,500],[0,500],[0,500],[0,600]
    ]) };
  }

  // ===== Inflammatory markers =====
  if (key === 'pcr' || key === 'proteína c reactiva' || key === 'proteina c reactiva') {
    return { unit:'mg/L', decimal_places:1, valorReferencia: unisexRanges([
      [0.0,10.0],[0.0,10.0],[0.0,10.0],[0.0,10.0],[0.0,10.0],[0.0,10.0]
    ]) };
  }
  if (key === 'pcr ultrasensible' || key === 'hs-crp' || key === 'pcr hs' || key === 'pcr ultrasensible (hs-crp)' || key === 'pcr ultrasensible (hs crp)') {
    return { unit:'mg/L', decimal_places:1, valorReferencia: unisexRanges([
      [0.0,3.0],[0.0,3.0],[0.0,3.0],[0.0,3.0],[0.0,3.0],[0.0,3.0]
    ]) };
  }
  if (key === 'vsg' || key === 'eritrosedimentacion' || key === 'eritrosedimentación') {
    // ESR varies by sex in adults; pediatrics similar unisex
    const pedi = [[0,10],[0,10],[0,12]];
    const male = [[0,15],[0,15],[0,20]];
    const female = [[0,20],[0,20],[0,25]];
    return { unit:'mm/h', decimal_places:0, valorReferencia: sexSplitRanges(pedi, male, female) };
  }
  if (key === 'fibrinógeno' || key === 'fibrinogeno') {
    return { unit:'mg/dL', decimal_places:0, valorReferencia: unisexRanges([
      [150,400],[150,400],[200,400],[200,400],[200,400],[200,450]
    ]) };
  }

  // ===== Immunoglobulins =====
  if (key === 'iga sérica' || key === 'iga serica' || key === 'iga') {
    return { unit:'mg/dL', decimal_places:0, valorReferencia: unisexRanges([
      [10,100],[10,100],[20,220],[40,350],[70,400],[70,400]
    ]) };
  }
  if (key === 'igg sérica' || key === 'igg serica' || key === 'igg') {
    return { unit:'mg/dL', decimal_places:0, valorReferencia: unisexRanges([
      [200,800],[200,800],[300,1200],[500,1500],[700,1600],[700,1600]
    ]) };
  }
  if (key === 'igm sérica' || key === 'igm serica' || key === 'igm') {
    return { unit:'mg/dL', decimal_places:0, valorReferencia: unisexRanges([
      [15,90],[15,90],[30,200],[40,230],[40,230],[40,230]
    ]) };
  }
  if (key === 'ige total' || key === 'ige') {
    return { unit:'UI/mL', decimal_places:0, valorReferencia: unisexRanges([
      [0,15],[0,15],[0,60],[0,140],[0,100],[0,100]
    ]) };
  }
  if (key === 'igg4 total' || key === 'igg4') {
    return { unit:'mg/dL', decimal_places:1, valorReferencia: unisexRanges([
      [0.0,100.0],[0.0,100.0],[0.0,120.0],[0.0,135.0],[0.0,135.0],[0.0,135.0]
    ]) };
  }

  // ===== Complement =====
  if (key === 'complemento c3' || key === 'c3') {
    return { unit:'mg/dL', decimal_places:0, valorReferencia: unisexRanges([
      [60,180],[60,180],[80,180],[90,180],[90,180],[90,180]
    ]) };
  }
  if (key === 'complemento c4' || key === 'c4') {
    return { unit:'mg/dL', decimal_places:0, valorReferencia: unisexRanges([
      [10,40],[10,40],[10,40],[10,40],[10,40],[10,40]
    ]) };
  }

  // ===== Tumor markers (additional) =====
  if (key === 'cea') {
    return { unit:'ng/mL', decimal_places:1, valorReferencia: unisexRanges([
      [0.0,3.0],[0.0,3.0],[0.0,3.0],[0.0,3.0],[0.0,3.0],[0.0,3.0]
    ]) };
  }
  if (key === 'afp') {
    return { unit:'ng/mL', decimal_places:1, valorReferencia: unisexRanges([
      [0.0,10.0],[0.0,10.0],[0.0,10.0],[0.0,10.0],[0.0,10.0],[0.0,10.0]
    ]) };
  }
  if (key === 'ca 15-3' || key === 'ca 15 3') {
    return { unit:'U/mL', decimal_places:1, valorReferencia: unisexRanges([
      [0,30],[0,30],[0,30],[0,30],[0,30],[0,30]
    ]) };
  }
  if (key === 'ca 19-9' || key === 'ca 19 9') {
    return { unit:'U/mL', decimal_places:1, valorReferencia: unisexRanges([
      [0,37],[0,37],[0,37],[0,37],[0,37],[0,37]
    ]) };
  }
  if (key === 'ca 72-4' || key === 'ca 72 4') {
    return { unit:'U/mL', decimal_places:1, valorReferencia: unisexRanges([
      [0,6],[0,6],[0,6],[0,6],[0,6],[0,6]
    ]) };
  }

  // ===== Sepsis markers =====
  if (key === 'procalcitonina') {
    return { unit:'ng/mL', decimal_places:2, valorReferencia: unisexRanges([
      [0.00,0.50],[0.00,0.50],[0.00,0.50],[0.00,0.50],[0.00,0.50],[0.00,0.50]
    ]) };
  }

  // ===== Gasometry extras and electrolytes synonyms =====
  if (key === 'hco₃⁻' || key === 'hco3-' || key === 'hco3' ) {
    return { unit:'mmol/L', decimal_places:0, valorReferencia: unisexRanges([
      [18,26],[20,26],[21,28],[22,28],[22,29],[22,29]
    ]) };
  }
  if (key === 'saturación de o₂' || key === 'saturacion de o2' || key === 'saturacion de o₂' || key === 'saturación de o2') {
    return { unit:'%', decimal_places:0, valorReferencia: unisexRanges([
      [90,100],[92,100],[94,100],[95,100],[95,100],[94,100]
    ]) };
  }
  if (key === 'potasio en gasometría' || key === 'potasio en gasometria') {
    return { unit:'mmol/L', decimal_places:1, valorReferencia: unisexRanges([
      [3.5,6.0],[3.5,5.5],[3.5,5.0],[3.5,5.0],[3.5,5.1],[3.5,5.3]
    ]) };
  }
  if (key === 'lactato') {
    return { unit:'mmol/L', decimal_places:1, valorReferencia: unisexRanges([
      [0.5,2.5],[0.5,2.5],[0.5,2.5],[0.5,2.2],[0.5,2.2],[0.5,2.5]
    ]) };
  }
  if (key === 'carboxihemoglobina' || key === 'cohb venoso' || key === 'carboxihemoglobina venosa') {
    return { unit:'%', decimal_places:1, valorReferencia: unisexRanges([
      [0.0,3.0],[0.0,3.0],[0.0,3.0],[0.0,3.0],[0.0,3.0],[0.0,5.0]
    ]) };
  }
  if (key === 'metahemoglobina' || key === 'methemoglobina') {
    return { unit:'%', decimal_places:1, valorReferencia: unisexRanges([
      [0.0,2.0],[0.0,2.0],[0.0,2.0],[0.0,2.0],[0.0,2.0],[0.0,2.0]
    ]) };
  }
  if (key === 'grasas en heces (cuantitativa)') {
    return { unit:'g/24h', decimal_places:1, valorReferencia: unisexRanges([
      [0.0,7.0],[0.0,7.0],[0.0,7.0],[0.0,7.0],[0.0,7.0],[0.0,7.0]
    ]) };
  }

  // ===== Urine 24h and spot tests =====
  if (key === 'calcio urinario 24 h') {
    return { unit:'mg/24h', decimal_places:0, valorReferencia: unisexRanges([
      [50,300],[50,300],[50,300],[100,300],[100,300],[100,300]
    ]) };
  }
  if (key === 'potasio urinario 24 h') {
    return { unit:'mEq/24h', decimal_places:0, valorReferencia: unisexRanges([
      [10,80],[10,80],[10,80],[25,125],[25,125],[25,125]
    ]) };
  }
  if (key === 'sodio urinario 24 h') {
    return { unit:'mEq/24h', decimal_places:0, valorReferencia: unisexRanges([
      [20,150],[20,150],[20,150],[40,220],[40,220],[40,220]
    ]) };
  }
  if (key === 'cloro urinario 24 h') {
    return { unit:'mEq/24h', decimal_places:0, valorReferencia: unisexRanges([
      [50,200],[50,200],[50,200],[110,250],[110,250],[110,250]
    ]) };
  }
  if (key === 'nitrógeno ureico urinario 24 h' || key === 'nitrogeno ureico urinario 24 h') {
    return { unit:'g/24h', decimal_places:1, valorReferencia: unisexRanges([
      [4.0,16.0],[4.0,16.0],[4.0,16.0],[6.0,20.0],[6.0,20.0],[6.0,20.0]
    ]) };
  }
  if (key === 'oxalato urinario 24 h') {
    return { unit:'mg/24h', decimal_places:0, valorReferencia: unisexRanges([
      [5,25],[5,25],[5,25],[7,44],[7,44],[7,44]
    ]) };
  }
  if (key === 'citrato urinario 24 h') {
    return { unit:'mg/24h', decimal_places:0, valorReferencia: unisexRanges([
      [200,800],[200,800],[200,800],[320,1240],[320,1240],[320,1240]
    ]) };
  }
  if (key === 'fosfato urinario 24 h') {
    return { unit:'mg/24h', decimal_places:0, valorReferencia: unisexRanges([
      [200,1000],[200,1000],[200,1000],[400,1300],[400,1300],[400,1300]
    ]) };
  }
  if (key === 'magnesio urinario 24 h') {
    return { unit:'mg/24h', decimal_places:0, valorReferencia: unisexRanges([
      [30,150],[30,150],[30,150],[50,150],[50,150],[50,150]
    ]) };
  }
  if (key === 'creatinina urinaria') {
    return { unit:'mg/dL', decimal_places:0, valorReferencia: unisexRanges([
      [20,150],[20,150],[20,200],[40,300],[50,320],[50,300]
    ]) };
  }
  if (key === 'creatinina 24 h') {
    return { unit:'mg/24h', decimal_places:0, valorReferencia: unisexRanges([
      [300,1200],[300,1200],[400,1500],[800,2000],[800,2000],[700,1800]
    ]) };
  }
  if (key === 'calprotectina fecal') {
    return { unit:'µg/g', decimal_places:0, valorReferencia: unisexRanges([
      [0,50],[0,50],[0,50],[0,50],[0,50],[0,50]
    ]) };
  }
  if (key === 'elastasa pancreática fecal' || key === 'elastasa pancreatica fecal') {
    return { unit:'µg/g', decimal_places:0, valorReferencia: unisexRanges([
      [200,1000],[200,1000],[200,1000],[200,1000],[200,1000],[200,1000]
    ]) };
  }
  if (key === 'lactoferrina fecal') {
    return { unit:'µg/g', decimal_places:0, valorReferencia: unisexRanges([
      [0,7.25],[0,7.25],[0,7.25],[0,7.25],[0,7.25],[0,7.25]
    ]) };
  }
  if (key === 'exceso de base (be)' || key === 'exceso de base' || key === 'be') {
    return { unit:'mmol/L', decimal_places:1, valorReferencia: unisexRanges([
      [-3.0,3.0],[-3.0,3.0],[-3.0,3.0],[-3.0,3.0],[-3.0,3.0],[-3.0,3.0]
    ]) };
  }

  // ===== Metals / toxicology (blood) =====
  if (key === 'plomo' || key === 'plomo (pb)') {
    return { unit:'µg/dL', decimal_places:1, valorReferencia: unisexRanges([
      [0.0,5.0],[0.0,5.0],[0.0,5.0],[0.0,5.0],[0.0,10.0],[0.0,10.0]
    ]) };
  }
  if (key === 'mercurio' || key === 'mercurio (hg)') {
    return { unit:'µg/L', decimal_places:1, valorReferencia: unisexRanges([
      [0.0,5.0],[0.0,5.0],[0.0,5.0],[0.0,5.0],[0.0,10.0],[0.0,10.0]
    ]) };
  }
  if (key === 'arsénico' || key === 'arsenico') {
    return { unit:'µg/L', decimal_places:1, valorReferencia: unisexRanges([
      [0.0,10.0],[0.0,10.0],[0.0,10.0],[0.0,10.0],[0.0,15.0],[0.0,15.0]
    ]) };
  }
  if (key === 'cobre') {
    return { unit:'µg/dL', decimal_places:0, valorReferencia: unisexRanges([
      [70,180],[70,180],[70,180],[80,155],[80,155],[80,155]
    ]) };
  }
  if (key === 'aluminio') {
    return { unit:'µg/L', decimal_places:1, valorReferencia: unisexRanges([
      [0.0,15.0],[0.0,15.0],[0.0,15.0],[0.0,15.0],[0.0,15.0],[0.0,15.0]
    ]) };
  }
  if (key === 'microalbúmina urinaria' || key === 'microalbumina urinaria') {
    return { unit:'mg/L', decimal_places:0, valorReferencia: unisexRanges([
      [0,30],[0,30],[0,30],[0,30],[0,30],[0,30]
    ]) };
  }

  // ===== Therapeutic Drug Monitoring (selected) =====
  if (key === 'valproato (ácido valproico)' || key === 'valproato' || key === 'acido valproico') {
    return { unit:'µg/mL', decimal_places:1, valorReferencia: unisexRanges([
      [50,100],[50,100],[50,100],[50,100],[50,100],[50,100]
    ]) };
  }
  if (key === 'fenobarbital' || key === 'fenobarbital') {
    return { unit:'µg/mL', decimal_places:1, valorReferencia: unisexRanges([
      [10,40],[10,40],[10,40],[10,40],[10,40],[10,40]
    ]) };
  }
  if (key === 'carbamazepina') {
    return { unit:'µg/mL', decimal_places:1, valorReferencia: unisexRanges([
      [4,12],[4,12],[4,12],[4,12],[4,12],[4,12]
    ]) };
  }
  if (key === 'fenitoína' || key === 'fenitoina') {
    return { unit:'µg/mL', decimal_places:1, valorReferencia: unisexRanges([
      [10,20],[10,20],[10,20],[10,20],[10,20],[10,20]
    ]) };
  }
  if (key === 'teofilina') {
    return { unit:'µg/mL', decimal_places:1, valorReferencia: unisexRanges([
      [10,20],[10,20],[10,20],[10,20],[10,20],[10,20]
    ]) };
  }
  if (key === 'digoxina') {
    return { unit:'ng/mL', decimal_places:1, valorReferencia: unisexRanges([
      [0.5,2.0],[0.5,2.0],[0.5,2.0],[0.5,2.0],[0.5,2.0],[0.5,2.0]
    ]) };
  }
  if (key === 'tacrolimus') {
    return { unit:'ng/mL', decimal_places:1, valorReferencia: unisexRanges([
      [5,15],[5,15],[5,15],[5,15],[5,15],[5,15]
    ]) };
  }
  if (key === 'sirolimus') {
    return { unit:'ng/mL', decimal_places:1, valorReferencia: unisexRanges([
      [5,15],[5,15],[5,15],[5,15],[5,15],[5,15]
    ]) };
  }
  if (key === 'everolimus') {
    return { unit:'ng/mL', decimal_places:1, valorReferencia: unisexRanges([
      [3,8],[3,8],[3,8],[3,8],[3,8],[3,8]
    ]) };
  }
  
  // ===== Additional analytes and synonyms (appended) =====
  if (key === 'aso' || key === 'aso (antiestreptolisina o)' || key === 'antiestreptolisina o') {
    return { unit:'UI/mL', decimal_places:0, valorReferencia: unisexRanges([
      [0,200],[0,200],[0,200],[0,200],[0,200],[0,200]
    ]) };
  }
  if (key === 'factor reumatoide' || key === 'fr') {
    return { unit:'UI/mL', decimal_places:0, valorReferencia: unisexRanges([
      [0,20],[0,20],[0,20],[0,20],[0,20],[0,20]
    ]) };
  }
  if (key === 'complemento c1q' || key === 'c1q') {
    return { unit:'mg/dL', decimal_places:1, valorReferencia: unisexRanges([
      [8.0,18.0],[8.0,18.0],[8.0,18.0],[8.0,18.0],[8.0,18.0],[8.0,18.0]
    ]) };
  }
  if (key === 'cyfra 21-1' || key === 'cyfra 21 1') {
    return { unit:'ng/mL', decimal_places:1, valorReferencia: unisexRanges([
      [0.0,3.5],[0.0,3.5],[0.0,3.5],[0.0,3.5],[0.0,3.5],[0.0,3.5]
    ]) };
  }
  if (key === 'hepcidina' || key === 'hepcidina sérica' || key === 'hepcidina serica') {
    return { unit:'ng/mL', decimal_places:1, valorReferencia: unisexRanges([
      [0.0,25.0],[0.0,25.0],[0.0,25.0],[0.0,25.0],[0.0,25.0],[0.0,25.0]
    ]) };
  }
  if (key === 'von willebrand actividad (ristocetina)' || key === 'von willebrand actividad') {
    return { unit:'%', decimal_places:0, valorReferencia: unisexRanges([
      [50,150],[50,150],[50,150],[50,150],[50,150],[50,150]
    ]) };
  }
  if (key === 'antitrombina iii (actividad)' || key === 'antitrombina iii') {
    return { unit:'%', decimal_places:0, valorReferencia: unisexRanges([
      [80,120],[80,120],[80,120],[80,120],[80,120],[80,120]
    ]) };
  }
  if (key === 'resistencia a proteína c activada' || key === 'resistencia a proteina c activada') {
    return { unit:'ratio', decimal_places:2, valorReferencia: unisexRanges([
      [0.80,1.30],[0.80,1.30],[0.80,1.30],[0.80,1.30],[0.80,1.30],[0.80,1.30]
    ]) };
  }
  if (key === 'etanol' || key === 'volátiles (etanol)' || key === 'volatiles (etanol)') {
    return { unit:'mg/dL', decimal_places:0, valorReferencia: unisexRanges([
      [0,10],[0,10],[0,10],[0,10],[0,10],[0,10]
    ]) };
  }
  if (key === 'metanol') {
    return { unit:'mg/dL', decimal_places:0, valorReferencia: unisexRanges([
      [0,10],[0,10],[0,10],[0,10],[0,10],[0,10]
    ]) };
  }
  if (key === 'fructosa seminal') {
    return { unit:'mg/dL', decimal_places:0, valorReferencia: unisexRanges([
      [150,600],[150,600],[150,600],[150,600],[150,600],[150,600]
    ]) };
  }
  if (key === 'hemoglobina a2') {
    return { unit:'%', decimal_places:1, valorReferencia: unisexRanges([
      [1.5,3.5],[1.5,3.5],[1.5,3.5],[1.5,3.5],[1.5,3.5],[1.5,3.5]
    ]) };
  }
  if (key === 'hemoglobina fetal (hbf)' || key === 'hemoglobina fetal' || key === 'hbf') {
    return { unit:'%', decimal_places:1, valorReferencia: unisexRanges([
      [0.0,2.0],[0.0,2.0],[0.0,2.0],[0.0,2.0],[0.0,2.0],[0.0,2.0]
    ]) };
  }
  if (key === 'calcio urinario puntual') {
    return { unit:'mg/dL', decimal_places:0, valorReferencia: unisexRanges([
      [0,15],[0,15],[0,15],[0,15],[0,15],[0,15]
    ]) };
  }
  if (key === 'sodio urinario puntual') {
    return { unit:'mEq/L', decimal_places:0, valorReferencia: unisexRanges([
      [20,120],[20,120],[20,120],[40,220],[40,220],[40,220]
    ]) };
  }
  if (key === 'cloro urinario puntual') {
    return { unit:'mEq/L', decimal_places:0, valorReferencia: unisexRanges([
      [20,120],[20,120],[20,120],[40,220],[40,220],[40,220]
    ]) };
  }
  if (key === 'cromo') {
    return { unit:'µg/L', decimal_places:1, valorReferencia: unisexRanges([
      [0.0,1.5],[0.0,1.5],[0.0,1.5],[0.0,1.5],[0.0,1.5],[0.0,1.5]
    ]) };
  }
  if (key === 'manganeso') {
    return { unit:'µg/L', decimal_places:1, valorReferencia: unisexRanges([
      [0.0,1.5],[0.0,1.5],[0.0,1.5],[0.0,1.5],[0.0,1.5],[0.0,1.5]
    ]) };
  }
  if (key === 'selenio') {
    return { unit:'µg/L', decimal_places:0, valorReferencia: unisexRanges([
      [60,150],[60,150],[60,150],[60,150],[60,150],[60,150]
    ]) };
  }
  if (key === 'ciclosporina') {
    return { unit:'ng/mL', decimal_places:0, valorReferencia: unisexRanges([
      [50,400],[50,400],[50,400],[50,400],[50,400],[50,400]
    ]) };
  }
  if (key === 'nicotina / cotinina' || key === 'nicotina' || key === 'cotinina') {
    return { unit:'ng/mL', decimal_places:0, valorReferencia: unisexRanges([
      [0,10],[0,10],[0,10],[0,10],[0,10],[0,10]
    ]) };
  }
  if (key === 'opiáceos (confirmatorio)' || key === 'opiaceos (confirmatorio)') {
    return { unit:'ng/mL', decimal_places:0, valorReferencia: unisexRanges([
      [0,300],[0,300],[0,300],[0,300],[0,300],[0,300]
    ]) };
  }
  if (key === 'cocaína (confirmatorio cuantitativo)' || key === 'cocaina (confirmatorio cuantitativo)') {
    return { unit:'ng/mL', decimal_places:0, valorReferencia: unisexRanges([
      [0,300],[0,300],[0,300],[0,300],[0,300],[0,300]
    ]) };
  }
  if (key === 'oxitocina') {
    return { unit:'pg/mL', decimal_places:0, valorReferencia: unisexRanges([
      [2,10],[2,10],[2,10],[2,10],[2,10],[2,10]
    ]) };
  }
  if (key === 'adiponectina') {
    return { unit:'ng/mL', decimal_places:1, valorReferencia: unisexRanges([
      [2.0,30.0],[2.0,30.0],[2.0,30.0],[2.0,30.0],[2.0,30.0],[2.0,30.0]
    ]) };
  }
  if (key === 'alpha-glucosidasa neutral seminal' || key === 'alpha glucosidasa neutral seminal') {
    return { unit:'U/L', decimal_places:0, valorReferencia: unisexRanges([
      [10,60],[10,60],[10,60],[10,60],[10,60],[10,60]
    ]) };
  }
  if (key === 'amikacina (pico/valle)' || key === 'gentamicina (pico/valle)' || key === 'vancomicina (pico/valle)' || key === 'tobramicina') {
    return { unit:'µg/mL', decimal_places:1, valorReferencia: unisexRanges([
      [0.0,20.0],[0.0,20.0],[0.0,20.0],[0.0,20.0],[0.0,20.0],[0.0,20.0]
    ]) };
  }
  if (key === 'amiodarona' || key === 'procainamida / napa' || key === 'paracetamol (acetaminofén)' || key === 'paracetamol (acetaminofen)' || key === 'salicilatos' || key === 'levetiracetam' || key === 'metotrexato' || key === 'clozapina') {
    return { unit:'µg/mL', decimal_places:1, valorReferencia: unisexRanges([
      [0.0,50.0],[0.0,50.0],[0.0,50.0],[0.0,50.0],[0.0,50.0],[0.0,50.0]
    ]) };
  }
  if (key === 'carbamazepina') {
    return { unit:'µg/mL', decimal_places:1, valorReferencia: unisexRanges([
      [4,12],[4,12],[4,12],[4,12],[4,12],[4,12]
    ]) };
  }
  if (key === 'fenitoína' || key === 'fenitoina') {
    return { unit:'µg/mL', decimal_places:1, valorReferencia: unisexRanges([
      [10,20],[10,20],[10,20],[10,20],[10,20],[10,20]
    ]) };
  }
  if (key === 'teofilina') {
    return { unit:'µg/mL', decimal_places:1, valorReferencia: unisexRanges([
      [10,20],[10,20],[10,20],[10,20],[10,20],[10,20]
    ]) };
  }
  if (key === 'digoxina') {
    return { unit:'ng/mL', decimal_places:1, valorReferencia: unisexRanges([
      [0.5,2.0],[0.5,2.0],[0.5,2.0],[0.5,2.0],[0.5,2.0],[0.5,2.0]
    ]) };
  }
  if (key === 'tacrolimus') {
    return { unit:'ng/mL', decimal_places:1, valorReferencia: unisexRanges([
      [5,15],[5,15],[5,15],[5,15],[5,15],[5,15]
    ]) };
  }
  if (key === 'sirolimus') {
    return { unit:'ng/mL', decimal_places:1, valorReferencia: unisexRanges([
      [5,15],[5,15],[5,15],[5,15],[5,15],[5,15]
    ]) };
  }
  if (key === 'everolimus') {
    return { unit:'ng/mL', decimal_places:1, valorReferencia: unisexRanges([
      [3,8],[3,8],[3,8],[3,8],[3,8],[3,8]
    ]) };
  }

  return null; // Not found
}

module.exports = { buildParameterTemplate, SEGMENTS };
