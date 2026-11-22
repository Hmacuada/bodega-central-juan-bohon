// Genera la semilla del MVP a partir de las mallas públicas de juanbohon.cl (transcritas a mano desde los PDF, nov. 2026).
// Uso: node build_seed.js  → escribe carreras_mallas.json y valida horas contra los totales impresos en cada malla.
const fs = require('fs');
const path = require('path');

// Asignaturas transversales (fondo amarillo en las mallas): se repiten en todas las carreras.
const TRANSV = new Set(['Tecnologías de la Información', 'Comunicación Efectiva', 'Taller de Habilidades Sociales', 'Innovación y Creatividad']);

// [código, nombre, jornada, url, pdf, totales impresos por semestre, total impreso, semanas impresas por semestre (null si la malla dice "horas semanales"), semestres]
const C = [
  ['TLI', 'Logística Industrial', 'Vespertino', 'logistica-industrial', '2025/10/tli_malla_admision_10022025-scaled-1.pdf', [396, 396, 396, 414], 1602, [22, 22, 22, 23], [
    [['Herramientas para Análisis Contable Básico', 72], ['Administración de Personal en el Área Logística', 72], ['Introducción a la Cadena de Suministros Logísticos', 72], ['Inglés Técnico', 54], ['Matemática Básica', 72], ['Tecnologías de la Información', 54]],
    [['Herramientas Básicas de Costos y Presupuestos', 72], ['Gestión de Adquisiciones y Abastecimiento', 90], ['Taller de Procesos Industriales', 72], ['Herramientas de Estadísticas Aplicada a la Logística', 54], ['Herramientas de Excel Intermedio', 54], ['Comunicación Efectiva', 54]],
    [['Gestión de Inventario', 72], ['Medio Ambiente y Seguridad Industrial', 54], ['Operación de Transporte y Distribución I', 72], ['Operaciones de Almacenamiento', 90], ['Liderazgo en Logística', 54], ['Taller de Habilidades Sociales', 54]],
    [['Control de Pérdidas', 54], ['Sistemas de Gestión de Calidad', 54], ['Operación de Transporte y Distribución II', 72], ['Logística Internacional', 90], ['Sistema de Gestión Logística', 90], ['Innovación y Creatividad', 54]]
  ]],
  ['APM', 'Administración de Procesos Mineros', 'Vespertino', 'administracion-de-procesos-mineros', '2025/10/pmi_malla_admision.pdf', [396, 414, 414, 396], 1620, null, [
    [['Introducción a los Procesos Mineros', 72], ['Seguridad, Salud y Medio Ambiente en Minería', 72], ['Administración General', 72], ['Herramientas Digitales para la Gestión Administrativa', 72], ['Matemática Básica', 54], ['Comunicación Efectiva', 54]],
    [['Administración de Bodegas e Inventarios', 90], ['Gestión de Operaciones Mineras', 72], ['Portafolio Certificación de Competencias', 54], ['Logística y Cadena de Suministro en Minería', 90], ['Sistemas ERP en la Gestión Minera', 54], ['Tecnologías de la Información', 54]],
    [['Liderazgo e Inclusión en Contextos Mineros', 54], ['Gestión de Proyectos en Minería', 72], ['Sistema de Gestión de Calidad en Minería', 90], ['Gestión de Recursos Humanos y Remuneraciones', 90], ['Sustentabilidad y Sostenibilidad en Minería', 54], ['Taller de Habilidades Sociales', 54]],
    [['Sistemas de Control y Monitoreo de Procesos Mineros', 90], ['Legislación Laboral y Seguridad Social', 72], ['Formulación y Evaluación de Proyectos Mineros', 72], ['Ética Profesional y Responsabilidad Social en Minería', 54], ['Inglés Técnico', 54], ['Innovación y Creatividad', 54]]
  ]],
  ['AED', 'Asistente de Educación Diferencial', 'Diurno', 'asistente-de-educacion-diferencial', '2025/10/aed_malla_admision.pdf', [396, 414, 396, 396], 1602, null, [
    [['Introducción a la Educación Especial', 72], ['Desarrollo Humano y Ciclos Vitales', 54], ['Políticas y Legislación de Inclusión y Diversidad', 54], ['Curriculum Educativo', 90], ['Diversidad e Inclusión Social', 72], ['Comunicación Efectiva', 54]],
    [['Adaptaciones Curriculares y Acceso al Aprendizaje', 90], ['Inglés Técnico', 54], ['Autonomía y Habilidades para la Vida', 54], ['Manejo de Conducta y Habilidades Socioemocionales', 72], ['Materiales Didácticos y Tecnologías de Apoyo', 90], ['Tecnologías de la Información', 54]],
    [['Taller de Psicomotricidad y Sensorialidad', 72], ['Ética y Rol Profesional', 54], ['Planificación Didáctica y Estrategias Evaluativas', 72], ['Neurodiversidad y Neurodivergencia', 90], ['Familia y Comunidad', 54], ['Taller de Habilidades Sociales', 54]],
    [['Técnicas de Manejo de Grupo', 72], ['Evaluación Psicopedagógica y Funcional', 90], ['Gestión y Planificación de Proyectos de Inclusión', 54], ['Aprendizaje Visible y Diversidad en el Aula', 72], ['Pasantía de Trabajo Multidisciplinar', 54], ['Innovación y Creatividad', 54]]
  ]],
  ['COS', 'Cosmetología', 'Diurno', 'cosmetologia', '2025/10/cos_malla_admision_10022025-scaled-1.pdf', [378, 414, 414, 414], 1620, [21, 23, 23, 23], [
    [['Cosmetología Básica', 72], ['Química Cosmética', 54], ['Teoría del Color y Visagismo', 72], ['Anatomofisiología General', 72], ['Asepsia y Bioseguridad', 54], ['Tecnologías de la Información', 54]],
    [['Taller de Cosmetología', 90], ['Primeros Auxilios', 54], ['Taller de Maquillaje', 72], ['Anatomofisiología Aplicada a la Cosmetología', 72], ['Técnicas de Cuidado de Manos y Uñas', 72], ['Comunicación Efectiva', 54]],
    [['Taller de Alteraciones Cutáneas', 72], ['Taller de Cejas y Pestañas', 72], ['Taller de Caracterización y Maquillaje Artístico', 90], ['Electrocosmética', 54], ['Taller de Manicura y Pedicura', 72], ['Taller de Habilidades Sociales', 54]],
    [['Taller Integrado de Cosmetología', 90], ['Taller de Epilación', 72], ['Asesoría de Imagen', 72], ['Psicología General y Atención al Cliente', 54], ['Taller de Manicura Acrílico y Gel', 72], ['Innovación y Creatividad', 54]]
  ]],
  ['EEI', 'Electricidad y Electrónica Industrial', 'Vespertino', 'electricidad-y-electronica-industrial', '2025/10/eei_malla_admision_10022025-scaled-1.pdf', [378, 396, 432, 396], 1602, [21, 22, 24, 22], [
    [['Electricidad en Corriente Continua', 90], ['Matemática Básica', 54], ['Física Aplicada a la Electricidad', 54], ['Diseño e Interpretación de Planos Eléctricos y Electrónicos', 72], ['Prevención de Riesgos Eléctricos', 54], ['Comunicación Efectiva', 54]],
    [['Electricidad en Corriente Alterna', 90], ['Instalaciones Eléctricas Domiciliaria y Comerciales', 72], ['Electrónica Básica', 72], ['Fundamentos de Electromecánica', 54], ['Inglés Técnico', 54], ['Tecnologías de la Información', 54]],
    [['Máquinas y Comandos Eléctricos I', 72], ['Instalaciones Eléctricas Industriales', 72], ['Electrónica Digital', 72], ['Controladores Lógicos Programables (PLC)', 90], ['Microprocesadores', 72], ['Taller de Habilidades Sociales', 54]],
    [['Máquinas y Comandos Eléctricos II', 72], ['Protecciones y Sistemas Eléctricos', 54], ['Electrónica de Potencia', 72], ['Redes Industriales', 72], ['Automatismo Industrial', 72], ['Innovación y Creatividad', 54]]
  ]],
  ['EER', 'Electricidad y Energías Renovables', 'Vespertino', 'electricidad-y-energias-renovables', '2025/10/eer_malla_admision.pdf', [396, 432, 414, 378], 1620, null, [
    [['Introducción a las Energías Renovables y Eficiencia Energética', 90], ['Electrónica Básica', 54], ['Diseño e Interpretación de Planos Eléctricos', 72], ['Prevención de Riesgos Eléctricos', 54], ['Física Aplicada a la Electricidad', 72], ['Tecnologías de la Información', 54]],
    [['Normativa de Energías Renovables y Electricidad', 72], ['Electricidad en Corriente Continua', 72], ['Instalaciones Eléctricas Domiciliarias e Industriales', 90], ['Termodinámica', 72], ['Sistemas de Iluminación Eficiente', 72], ['Comunicación Efectiva', 54]],
    [['Protecciones Eléctricas y Puesta a Tierra', 54], ['Electricidad en Corriente Alterna', 72], ['Montaje y Mantención de Instalaciones de Energía Fotovoltáica', 90], ['Máquinas Eléctricas y Comandos', 54], ['Montaje y Mantención de Instalaciones de Energía Solar Térmica', 90], ['Taller de Habilidades Sociales', 54]],
    [['Taller de Proyectos de Sistemas Eléctricos y Energías Renovables', 90], ['Sistemas de Evaluación de Impacto Ambiental', 54], ['Mantención de Instalaciones Eólicas', 72], ['Inglés Técnico', 54], ['Sistemas de Automatización', 54], ['Innovación y Creatividad', 54]]
  ]],
  ['EME', 'Electromecánica', 'Vespertino', 'electromecanica', '2025/10/eme_malla-1-scaled-1.pdf', [414, 396, 414, 378], 1602, [23, 22, 23, 21], [
    [['Sistemas Electromecánicos', 72], ['Neumática e Hidráulica', 72], ['Sistemas Eléctricos', 72], ['Matemática Básica', 72], ['Metrología Aplicada', 72], ['Comunicación Efectiva', 54]],
    [['Técnicas de Diagnóstico en Sistemas Electromecánicos', 72], ['Sistemas Electroneumáticos y Electrohidráulicos', 72], ['Protección de Sistemas Eléctricos', 72], ['Sistemas Electrónicos', 72], ['Interpretación de Planos', 54], ['Tecnologías de la Información', 54]],
    [['Mantenimiento Preventivo de Máquinas y Equipos Electromecánicos', 90], ['Montaje de Elementos y Sistemas Electromecánicos', 72], ['Circuitos de Control en Sistemas Electromecánicos', 72], ['Interpretación de Manuales Técnicos', 72], ['Prevención de Riesgos y Medioambiente', 54], ['Taller de Habilidades Sociales', 54]],
    [['Mantenimiento Correctivo de Sistemas Electromecánicos', 72], ['Taller Integrado de Puesta en Marcha y Eficiencia Operativa', 90], ['Automatización de Sistemas Electromecánicos', 90], ['Gestión de Control y Monitoreo', 72], ['Innovación y Creatividad', 54]]
  ]],
  ['ESI', 'Estética Integral', 'Diurno', 'estetica-integral', '2025/10/esi_malla_admision_10022025-scaled-1.pdf', [378, 414, 396, 432], 1620, [21, 23, 22, 24], [
    [['Taller de Corte I', 72], ['Tricología Capilar', 54], ['Primeros Auxilios', 54], ['Anatomía y Fisiología Aplicada', 72], ['Taller de Cejas y Pestañas', 72], ['Tecnologías de la Información', 54]],
    [['Taller de Corte II', 90], ['Taller de Peinado', 72], ['Asepsia y Bioseguridad', 72], ['Taller de Masaje de Relajación y Descontracturante', 72], ['Inglés Técnico', 54], ['Comunicación Efectiva', 54]],
    [['Colorimetría Capilar I', 90], ['Taller de Maquillaje', 72], ['Taller de Manicura', 72], ['Nutrición y Vida Saludable', 54], ['Psicología General y Atención al Cliente', 54], ['Taller de Habilidades Sociales', 54]],
    [['Colorimetría Capilar II', 90], ['Taller de Epilación', 72], ['Taller de Pedicura', 72], ['Taller de Masoterapia Reductiva', 72], ['Asesoría de Imagen', 72], ['Innovación y Creatividad', 54]]
  ]],
  ['GCI', 'Gastronomía y Cocina Internacional', 'Diurno', 'gastronomia-y-cocina-internacional', '2025/10/gci_malla_admision_10022025-scaled-1.pdf', [414, 378, 396, 432], 1620, [23, 21, 22, 24], [
    [['Técnicas de Cocina', 90], ['Técnicas de Pastelería', 72], ['Seguridad Alimentaria y HACCP', 72], ['Prevención de Riesgos y Primeros Auxilios en la Industria Gastronómica', 54], ['Matemática Básica', 72], ['Tecnologías de la Información', 54]],
    [['Taller de Cocina Industrial', 90], ['Taller de Panadería', 72], ['Análisis y Tecnología de los Alimentos', 54], ['Taller de Servicios de Comedor y Protocolo', 54], ['Inglés Técnico I', 54], ['Comunicación Efectiva', 54]],
    [['Taller de Cocina Chilena y Regional', 108], ['Taller de Repostería', 72], ['Nutrición y Dietética', 54], ['Administración de Restaurant', 54], ['Inglés Técnico II', 54], ['Taller de Habilidades Sociales', 54]],
    [['Taller de Cocina Contemporánea y de Vanguardia', 108], ['Taller de Pastelería Avanzada y Chocolatería', 72], ['Taller de Servicio de Bar, Vinos y Coctelería', 72], ['Diseño y Planificación de Eventos', 72], ['Técnicas de Vanguardia Gastronómica', 54], ['Innovación y Creatividad', 54]]
  ]],
  ['IAC', 'Instrumentación, Automatización y Control Industrial', 'Vespertino', 'instrumentacion-automatizacion-y-control-industrial', '2025/10/iac_malla_admision_10022025-scaled-1.pdf', [378, 414, 432, 414], 1638, [21, 23, 24, 23], [
    [['Taller de Instrumentación', 72], ['Sensores y Acondicionamiento de Señales', 72], ['Electricidad en Corriente Continua', 72], ['Matemática Básica', 54], ['Física Aplicada a la Electricidad', 54], ['Comunicación Efectiva', 54]],
    [['Control de Procesos e Instrumentos', 90], ['Programación de Microcontroladores Lógicos', 72], ['Electrónica Básica', 72], ['Transmisión y Recepción de Datos', 72], ['Prevención de Riesgos Industriales', 54], ['Tecnologías de la Información', 54]],
    [['Control de Procesos y Calibración', 90], ['Electrónica Aplicada a la Automatización', 72], ['Electricidad en Corriente Alterna', 72], ['Aplicaciones PLC y HMI I', 72], ['Interpretación de Planos Eléctricos P&ID', 72], ['Taller de Habilidades Sociales', 54]],
    [['Taller de Automatización y Control Industrial', 72], ['Proyecto de Titulación', 54], ['Máquinas y Comandos Eléctricos', 90], ['Aplicaciones PLC y HMI II', 72], ['Automatización Hidráulica y Neumática', 72], ['Innovación y Creatividad', 54]]
  ]],
  ['MMI', 'Mantenimiento Mecánico Industrial', 'Vespertino', 'mantenimiento-mecanico-industrial', '2025/10/mmi_malla_admision_10022025.pdf', [432, 378, 414, 396], 1620, [24, 21, 23, 22], [
    [['Electricidad Aplicada', 72], ['Procesos Industriales', 72], ['Metrología e Interpretación de Planos', 90], ['Dibujo Técnico Industrial', 72], ['Matemática Básica', 72], ['Tecnologías de la Información', 54]],
    [['Sistemas Mecánicos, Neumáticos e Hidráulicos', 72], ['Soldaduras y Técnicas de Unión', 72], ['Máquinas y Herramientas', 72], ['Inglés Técnico', 54], ['Física Aplicada', 54], ['Comunicación Efectiva', 54]],
    [['Mantención, Reparación y Manipulación de Equipos Fijos', 72], ['Elementos de Máquinas', 54], ['Técnicas de Supervisión', 72], ['Automatización y Control Industrial', 72], ['Mantenimiento Industrial', 90], ['Taller de Habilidades Sociales', 54]],
    [['Mantenimiento, Reparación y Manipulación de Equipos Móviles', 72], ['Montaje y Mantenimiento Mecánico', 72], ['Alineación y Balanceo', 54], ['Prevención de Riesgos y Medio Ambiente', 54], ['Mantenimiento Preventivo', 90], ['Innovación y Creatividad', 54]]
  ]],
  ['MMP', 'Mecánica en Maquinaria Pesada', 'Vespertino', 'mecanica-en-maquinaria-pesada', '2025/10/mmp_malla_admision_10022025-scaled-1.pdf', [414, 396, 378, 414], 1602, [23, 22, 21, 23], [
    [['Introducción a la Oleohidráulica y Neumática', 72], ['Metrología', 72], ['Interpretación de Planos', 72], ['Electricidad Básica', 72], ['Matemática Básica', 72], ['Tecnologías de la Información', 54]],
    [['Sistema Oleohidráulico de Levante e Implementos', 72], ['Motores de Combustión Interna', 72], ['Tribología', 72], ['Taller de Electricidad Aplicada', 72], ['Física Mecánica', 54], ['Comunicación Efectiva', 54]],
    [['Sistema Oleohidráulico de Dirección y Frenos', 72], ['Control Electrónico de Motores Diesel', 72], ['Inglés Técnico', 54], ['Taller de Electrónica', 72], ['Prevención de Riesgos y Medio Ambiente', 54], ['Taller de Habilidades Sociales', 54]],
    [['Taller Integrado de Oleohidráulica y Neumática', 72], ['Sistema de Tren de Fuerza', 72], ['Taller Integrado de Mantenimiento de Equipo Pesado', 72], ['Operación de Maquinaria Pesada Básica', 72], ['Interpretación de Manuales Técnicos', 72], ['Innovación y Creatividad', 54]]
  ]],
  ['OMP', 'Operación y Mantención de Maquinaria Pesada', 'Diurno', 'operacion-y-mantencion-de-maquinaria-pesada', '2025/10/omp_malla_admision_10022025-scaled-1.pdf', [396, 414, 396, 414], 1620, [22, 23, 22, 23], [
    [['Operación de Maquinaria Pesada Inicial', 90], ['Sistemas Eléctricos', 72], ['Metrología', 72], ['Inglés Técnico', 54], ['Matemática Básica', 54], ['Tecnologías de la Información', 54]],
    [['Operación de Maquinaria Pesada Básica', 90], ['Introducción a la Oleohidráulica y Neumática', 54], ['Tribología', 54], ['Sistema de Tren de Fuerza', 72], ['Motores de Combustión Interna', 90], ['Comunicación Efectiva', 54]],
    [['Operación de Maquinaria Pesada Intermedia', 90], ['Sistema Oleohidráulica y Neumática', 72], ['Mantención de Equipos Estacionarios', 72], ['Prevención de Riesgos y Medio Ambiente', 54], ['Sistemas Electrónicos', 54], ['Taller de Habilidades Sociales', 54]],
    [['Operación de Maquinaria Pesada Avanzada', 90], ['Taller de Oleohidráulica y Neumática', 72], ['Mantención de Equipos Móviles', 72], ['Taller Integrado de Mecánica', 72], ['Interpretación de Manuales Técnicos', 54], ['Innovación y Creatividad', 54]]
  ]],
  ['MME', 'Minería y Metalurgia', 'Vespertino', 'tecnico-en-mineria-y-metalurgia', '2025/10/mme_malla_admision.pdf', [396, 396, 396, 414], 1602, null, [
    [['Introducción a la Minería y Metalurgia', 72], ['Seguridad Industrial', 72], ['Máquinas y Equipos Industriales', 72], ['Física', 54], ['Legislación y Medioambiente', 72], ['Comunicación Efectiva', 54]],
    [['Fundamentos de Perforación y Tronadura', 72], ['Geomecánica Básica', 72], ['Topografía aplicada a la Minería', 72], ['Dibujo Técnico e Interpretación de Planos', 72], ['Matemática Básica', 54], ['Tecnologías de la Información', 54]],
    [['Proceso de Conminución y Concentración de Minerales', 90], ['Equipos de Carguío y Transporte', 72], ['Sistemas de Control y Monitoreo de Procesos Mineros', 72], ['Ética Profesional y Responsabilidad Social en Minería', 54], ['Herramientas Digitales para Procesos Minero-Metalúrgicos', 54], ['Taller de Habilidades Sociales', 54]],
    [['Operación y Control de Procesos de Tratamiento de Minerales', 90], ['Gestión de Procesos Mineros', 90], ['Liderazgo e Inclusión en Contextos Mineros', 54], ['Supervisión de Operaciones Mineras', 72], ['Inglés Técnico', 54], ['Innovación y Creatividad', 54]]
  ]],
  ['TOP', 'Topografía', 'Vespertino', 'topografia', '2025/10/top_malla_admision_10022025-scaled-1.pdf', [396, 396, 396, 414], 1602, [22, 22, 22, 23], [
    [['Topografía Básica', 72], ['Taller de Dibujo Topográfico Digital', 72], ['Matemática Básica', 72], ['Trigonometría Aplicada a la Topografía', 72], ['Prevención de Riesgos y Medioambiente', 54], ['Comunicación Efectiva', 54]],
    [['Altimetría y Nivelación', 72], ['Sistema de Información Geográfica (SIG)', 72], ['Matemática Aplicada a la Topografía', 72], ['Herramientas de Geología', 54], ['Excel Aplicado a la Topografía', 72], ['Tecnologías de la Información', 54]],
    [['Levantamiento Planimétrico', 72], ['Taller de Fotogrametría', 72], ['Catastro y Planificación', 72], ['Taller de Cartografía y Geodesia Satelital', 54], ['Herramientas Digitales Topográficas', 72], ['Taller de Habilidades Sociales', 54]],
    [['Taller de Topografía para Obras Viales', 72], ['Taller de Topografía de Minas', 90], ['Taller de Topografía para Construcción', 72], ['Taller de Topografía Agrícola', 72], ['Inglés Técnico', 54], ['Innovación y Creatividad', 54]]
  ]]
];

const SESSION_H = 3; // horas pedagógicas por sesión (supuesto tomado de la carga horaria real de TLI)
const careers = [];
const issues = [];
for (const [code, name, jornada, slug, pdf, semTot, total, semWeeks, sems] of C) {
  const semesters = sems.map((subs, i) => {
    const hours = subs.reduce((t, [, h]) => t + h, 0);
    if (hours !== semTot[i]) issues.push(`${code} semestre ${i + 1}: suma ${hours} h, la malla imprime ${semTot[i]} h`);
    return {
      n: i + 1,
      horas: hours,
      semanas_impresas: semWeeks ? semWeeks[i] : null,
      asignaturas: subs.map(([nombre, h], j) => ({
        codigo: `${code}-${i + 1}${String(j + 1).padStart(2, '0')}`,
        nombre, horas: h, sesiones: h / SESSION_H, transversal: TRANSV.has(nombre)
      }))
    };
  });
  const sumSem = semesters.reduce((t, s) => t + s.horas, 0);
  // El total impreso (p. ej. 1.602) no coincide con la suma de los 4 semestres (p. ej. 1.602 = 396×3+414): se compara y se informa.
  if (sumSem !== total) issues.push(`${code}: suma de semestres ${sumSem} h, total impreso ${total} h`);
  careers.push({
    codigo: code, nombre: name, jornada, semestres_lectivos: 4,
    practica_laboral_horas: 400, examen_competencias: true, titulacion: '1 semestre (V semestre: práctica laboral y examen de competencias)',
    horas_lectivas: sumSem, horas_impresas: total,
    fuente: { pagina: `https://juanbohon.cl/carreras/${slug}`, malla_pdf: `https://juanbohon.cl/wp-content/uploads/${pdf}` },
    semestres: semesters
  });
}

// Asignaturas compartidas entre carreras (mismo nombre): candidatas a docentes y secciones compartidas.
const shared = {};
for (const c of careers) for (const s of c.semestres) for (const a of s.asignaturas) {
  (shared[a.nombre] = shared[a.nombre] || []).push(`${c.codigo}-S${s.n} (${a.horas} h)`);
}
const compartidas = Object.entries(shared).filter(([, v]) => v.length > 1).sort((a, b) => b[1].length - a[1].length).map(([nombre, en]) => ({ nombre, en }));

const out = {
  institucion: 'CFT Juan Bohon',
  fuente: 'https://juanbohon.cl/carreras/ (mallas de admisión publicadas; revisado 2026-11-21)',
  supuestos: {
    horas_por_sesion: SESSION_H,
    sesiones_por_semana: 6,
    nota: 'Todas las mallas dan 18 h/semana = 6 sesiones de 3 h = 3 días × 2 bloques.'
  },
  // Bloques horarios para el generador. Los marcados "supuesto" deben confirmarse con la coordinación.
  jornadas: {
    Vespertino: {
      fuente: 'Usuario (patrón actual de TLI)',
      bloques_lu_vi: [{ id: 'V1', inicio: '18:30', fin: '20:30', estado: 'supuesto: corte exacto entre bloques' }, { id: 'V2', inicio: '20:50', fin: '22:50', estado: 'supuesto: corte exacto entre bloques' }],
      bloques_sabado: [{ id: 'S1', inicio: '09:00', fin: '11:40' }, { id: 'S2', inicio: '12:00', fin: '14:50' }],
      dias_por_nivel: { '1º año (semestres I y II)': ['Ma', 'Ju', 'Sá'], '2º año (semestres III y IV)': ['Lu', 'Mi', 'Vi'] }
    },
    Diurno: {
      fuente: 'Usuario: 6 horas en total desde las 9:00',
      bloques: [{ id: 'D1', inicio: '09:00', fin: '11:50', estado: 'supuesto: corte con recreo de 20 min' }, { id: 'D2', inicio: '12:10', fin: '15:00', estado: 'supuesto: corte con recreo de 20 min' }],
      dias_por_nivel: { estado: 'por confirmar', supuesto: 'Igual que vespertino: 3 días por nivel × 2 bloques; repartidos entre lunes y viernes' }
    }
  },
  carreras: careers,
  asignaturas_compartidas: compartidas,
  diferencias_detectadas: issues
};
fs.writeFileSync(path.join(__dirname, 'carreras_mallas.json'), JSON.stringify(out, null, 2));
console.log(careers.length, 'carreras,', careers.reduce((t, c) => t + c.semestres.reduce((u, s) => u + s.asignaturas.length, 0), 0), 'asignaturas');
console.log('compartidas:', compartidas.length);
console.log(issues.join('\n') || 'sin diferencias');
