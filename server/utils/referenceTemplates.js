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
  const key = name.toLowerCase();

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

  // ===== Hormonal / Gynecologic overlaps =====
  if (key === 'fsh') {
    return { unit:'mIU/mL', decimal_places:2, valorReferencia: unisexRanges([
      [0.5,6.0],[0.5,6.0],[0.5,6.5],[1.0,12.0],[1.0,10.0],[1.0,12.0]
    ]) };
  }
  if (key === 'lh') {
    return { unit:'mIU/mL', decimal_places:2, valorReferencia: unisexRanges([
      [0.1,5.0],[0.1,5.0],[0.1,6.0],[1.0,15.0],[1.0,12.0],[1.0,15.0]
    ]) };
  }
  if (key === 'prolactina') {
    return { unit:'ng/mL', decimal_places:1, valorReferencia: unisexRanges([
      [2,30],[2,25],[2,22],[2,22],[2,20],[2,20]
    ]) };
  }
  if (key === 'estradiol') {
    return { unit:'pg/mL', decimal_places:0, valorReferencia: unisexRanges([
      [15,50],[15,50],[15,50],[15,350],[15,300],[15,250]
    ]) };
  }
  if (key === 'progesterona') {
    return { unit:'ng/mL', decimal_places:2, valorReferencia: unisexRanges([
      [0.1,1.5],[0.1,1.5],[0.1,1.5],[0.1,20.0],[0.1,20.0],[0.1,20.0]
    ]) };
  }
  if (key === 'testosterona total') {
    return { unit:'ng/dL', decimal_places:0, valorReferencia: unisexRanges([
      [20,200],[20,200],[20,350],[300,1000],[250,900],[200,850]
    ]) };
  }
  if (key === 'testosterona libre') {
    return { unit:'pg/mL', decimal_places:1, valorReferencia: unisexRanges([
      [1,25],[1,25],[1,30],[50,200],[40,160],[30,140]
    ]) };
  }
  if (key === 'dhea-s' || key === 'dhea s') {
    return { unit:'µg/dL', decimal_places:0, valorReferencia: unisexRanges([
      [15,150],[15,150],[30,300],[110,510],[80,560],[30,350]
    ]) };
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
    return { unit:'ng/mL', decimal_places:2, valorReferencia: unisexRanges([
      [0.2,1.2],[0.2,1.2],[0.2,1.5],[0.3,3.0],[0.3,2.8],[0.3,2.5]
    ]) };
  }
  if (key === 'amh') {
    return { unit:'ng/mL', decimal_places:2, valorReferencia: unisexRanges([
      [0.5,12.0],[0.5,12.0],[0.5,8.0],[1.0,6.0],[0.5,5.0],[0.2,4.0]
    ]) };
  }
  if (key === 'ca-125') {
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
  if (key === 'bicarbonato') {
    return { unit:'mmol/L', decimal_places:0, valorReferencia: unisexRanges([
      [18,26],[20,26],[21,28],[22,28],[22,29],[22,29]
    ]) };
  }

  // ===== Coagulation =====
  if (key === 'tp') { // Prothrombin time reported as seconds
    return { unit:'s', decimal_places:1, valorReferencia: unisexRanges([
      [10,17],[10,17],[10,16],[10,15],[10,15],[10,16]
    ]) };
  }
  if (key === 'inr') {
    return { unit:'', decimal_places:2, valorReferencia: unisexRanges([
      [0.8,1.3],[0.8,1.3],[0.8,1.3],[0.8,1.3],[0.8,1.3],[0.8,1.4]
    ]) };
  }
  if (key === 'ttpa' || key === 'tt-pa' || key === 'aptt' ) {
    return { unit:'s', decimal_places:1, valorReferencia: unisexRanges([
      [25,45],[25,41],[25,38],[25,37],[25,37],[25,40]
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

  return null; // Not found
}

module.exports = { buildParameterTemplate, SEGMENTS };
