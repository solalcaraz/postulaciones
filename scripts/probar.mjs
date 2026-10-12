// Prueba los prompts sin interfaz: corre las tres llamadas con un CV y una oferta, y guarda los resultados.
//
//   node scripts/probar.mjs --oferta datos-privados/ofertas/exactian-soporte-tecnico.md \
//        --cv datos-privados/cv-desarrollo.txt --perfil datos-privados/perfil.md --niveles es=nativo,en=B1
//
// Opciones: --info <archivo> (información extra de la empresa) · --idioma auto|es|en · --dry (arma los textos, no llama a la IA)
//           --fundir (2 llamadas: la revisión anti-IA va dentro de la que escribe) · --etiqueta <texto> (sufijo de la carpeta de salida)
// Si no se pasa --niveles, muestra los que detectó en el CV y se detiene: es la confirmación que después hará la pantalla.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { llamar } from '../src/ia.mjs';
import { idiomasSchema, resultadoSchema, resultadoFundidoSchema, revisionSchema } from '../src/esquema/index.mjs';
import { pasoIdiomas, pasoGeneracion, pasoRevision } from '../src/prompts.mjs';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));

function leerArgumentos(lista) {
  const a = {};
  for (let i = 0; i < lista.length; i++) {
    if (!lista[i].startsWith('--')) continue;
    const clave = lista[i].slice(2);
    const siguiente = lista[i + 1];
    if (siguiente === undefined || siguiente.startsWith('--')) a[clave] = true;
    else { a[clave] = siguiente; i++; }
  }
  return a;
}

const args = leerArgumentos(process.argv.slice(2));
for (const obligatorio of ['oferta', 'cv', 'perfil']) {
  if (!args[obligatorio]) { console.error(`Falta --${obligatorio}`); process.exit(1); }
}
if (String(args.cv).toLowerCase().endsWith('.pdf')) {
  console.error('Por ahora el CV tiene que estar en texto. Convertilo con: pdftotext -enc UTF-8 -layout "archivo.pdf" datos-privados/cv.txt\n(La lectura de PDF y Word entra en la Fase 3.)');
  process.exit(1);
}

const [oferta, cv, perfil] = await Promise.all([args.oferta, args.cv, args.perfil].map(r => readFile(r, 'utf8')));
const infoEmpresa = args.info ? await readFile(args.info, 'utf8') : '';
const slug = basename(args.oferta).replace(/\.\w+$/, '') + (args.etiqueta ? '-' + args.etiqueta : '');
const carpeta = join(RAIZ, 'datos-privados', 'salidas', slug);
await mkdir(carpeta, { recursive: true });
const guardar = (nombre, contenido) => writeFile(join(carpeta, nombre), typeof contenido === 'string' ? contenido : JSON.stringify(contenido, null, 2), 'utf8');

function leerNiveles(texto) {
  return Object.fromEntries(String(texto).split(',').map(p => p.split('=').map(s => s.trim())));
}

const informe = [];
let costo = 0;
async function correr(nombre, prompt, esquema) {
  console.log(`\n▶ ${nombre} (${prompt.length.toLocaleString('es-AR')} caracteres de entrada)`);
  const r = await llamar({ prompt, esquema });
  costo += r.costoEstimadoUsd;
  console.log(`  listo en ${(r.duracionMs / 1000).toFixed(0)} s, costo estimado ${r.costoEstimadoUsd.toFixed(3)} USD (referencia: sale de tu plan)`);
  return r.resultado;
}

// ---------- Llamada 1: idiomas ----------
const promptIdiomas = await pasoIdiomas({ cv, oferta });
if (args.dry && !args.niveles) args.niveles = 'es=nativo,en=B1';
let idiomaSalida = args.idioma && args.idioma !== 'auto' ? args.idioma : 'es';
if (!args.dry) {
  const idiomas = await correr('Llamada 1: idiomas', promptIdiomas, idiomasSchema);
  await guardar('1-idiomas.json', idiomas);
  console.log('\nIdiomas detectados en el CV:');
  for (const i of idiomas.cv_idiomas) console.log(`  - ${i.idioma}: "${i.nivel_en_el_cv}" (${i.nivel_cefr})`);
  console.log(`Idioma de la oferta: ${idiomas.oferta.idioma_detectado}`);
  for (const i of idiomas.oferta.idiomas_requeridos) console.log(`  pide ${i.idioma}: ${i.nivel_pedido}${i.excluyente ? ' (excluyente)' : ''}`);
  if (!args.idioma || args.idioma === 'auto') idiomaSalida = idiomas.oferta.idioma_detectado;
  if (idiomaSalida === 'otro') { console.error('\nLa oferta está en otro idioma: elegí con --idioma es o --idioma en.'); process.exit(2); }
  if (!args.niveles) {
    console.error('\nConfirmá los niveles (es la pantalla de confirmación) y volvé a correr con, por ejemplo: --niveles es=nativo,en=B1');
    process.exit(2);
  }
}
const niveles = leerNiveles(args.niveles);
if (!niveles[idiomaSalida]) { console.error(`Falta el nivel de ${idiomaSalida} en --niveles.`); process.exit(2); }
console.log(`\nIdioma de salida: ${idiomaSalida} · niveles confirmados: ${JSON.stringify(niveles)}`);

// ---------- Llamada 2: análisis, CV, carta y guía ----------
const promptGeneracion = await pasoGeneracion({ oferta, infoEmpresa, cv, perfil, idiomaSalida, niveles, fundir: !!args.fundir });
if (args.dry) {
  const revisionDemo = await pasoRevision({ resultado: { cv: {}, carta: {}, preparacion_entrevista: [] }, cv, perfil, oferta, infoEmpresa, idiomaSalida, niveles });
  console.log(`\n[dry] Llamada 2: ${promptGeneracion.length.toLocaleString('es-AR')} caracteres · Llamada 3 (sin contenido generado): ${revisionDemo.length.toLocaleString('es-AR')} caracteres. No se llamó a la IA.`);
  process.exit(0);
}
const resultado = await correr(args.fundir ? 'Llamada 2: análisis, CV, carta, guía y revisión' : 'Llamada 2: análisis, CV, carta y guía',
  promptGeneracion, args.fundir ? resultadoFundidoSchema : resultadoSchema);
await guardar('2-resultado.json', resultado);

// ---------- Llamada 3: revisión anti-IA (solo si no se fundió) ----------
let revision = resultado;
if (!args.fundir) {
  const promptRevision = await pasoRevision({ resultado, cv, perfil, oferta, infoEmpresa, idiomaSalida, niveles });
  revision = await correr('Llamada 3: revisión anti-IA', promptRevision, revisionSchema);
  await guardar('3-revision.json', revision);
}

// ---------- Informe legible ----------
const lista = (items) => items.map(i => `- ${i}`).join('\n') || '- (nada)';
const cvFinal = revision.cv;
const palabras = revision.carta.cuerpo.trim().split(/\s+/).length;
informe.push(`# ${slug}`, '',
  '## Análisis', '',
  `**Título elegido:** ${resultado.analisis.titulo_elegido.titulo} (${resultado.analisis.titulo_elegido.motivo})`, '',
  '### Requisitos',
  ...resultado.analisis.requisitos.map(r => `- [${r.puntaje}/3] (${r.tipo}) ${r.texto}\n  - cita: ${r.cita_del_cv || '—'}\n  - ${r.justificacion}`), '',
  '### No cubierto', lista(resultado.analisis.no_cubierto), '',
  '### Alertas', lista(resultado.analisis.alertas.map(a => `**${a.tipo}:** ${a.detalle}`)), '',
  '### Decisiones sobre el CV',
  `**Prioriza:**\n${lista(resultado.analisis.decisiones_del_cv.prioriza)}`,
  `**Deja afuera:**\n${lista(resultado.analisis.decisiones_del_cv.deja_afuera.map(d => `${d.elemento}: ${d.motivo}`))}`, '',
  '## CV (después de la revisión)', '',
  `**${cvFinal.titulo}**`, '', cvFinal.resumen, '',
  '### Experiencia', ...cvFinal.experiencia.map(e => `**${e.puesto}** · ${e.organizacion} · ${e.lugar_y_modalidad} · ${e.fechas}\n${lista(e.puntos)}`), '',
  '### Proyectos', ...cvFinal.proyectos.map(p => `**${p.nombre}** · ${p.encabezado} · ${p.fecha}\n${p.enlaces.join(' · ')}\n${lista(p.puntos)}`), '',
  '### Formación', lista(cvFinal.formacion.map(f => `${f.titulo} · ${f.institucion} · ${f.estado_y_fechas}`)), '',
  '### Habilidades', lista(cvFinal.habilidades.map(h => `${h.categoria}: ${h.items.join(', ')}`)), '',
  '### Idiomas', lista(cvFinal.idiomas.map(i => `${i.idioma}: ${i.nivel}`)), '',
  `## Carta (${palabras} palabras en el cuerpo)`, '', revision.carta.saludo, '', revision.carta.cuerpo, '', revision.carta.firma, '',
  '## Preparate para una entrevista', '',
  ...revision.preparacion_entrevista.map(q => `**${q.pregunta}**\n- Por qué es probable: ${q.por_que_es_probable}\n- Con qué responder: ${q.con_que_responder}\n- Evitá: ${q.evitar}\n- Si no lo hiciste: ${q.si_no_lo_hiciste}\n`),
  '## Qué corrigió la revisión', lista(revision.cambios), '', '### Sin arreglar', lista(revision.sin_arreglar), '');
await guardar('informe.md', informe.join('\n'));
console.log(`\n✔ Listo. Carta: ${palabras} palabras. Resultados en datos-privados/salidas/${slug}/ (informe.md es el que se lee). Costo estimado total: ${costo.toFixed(3)} USD.`);
