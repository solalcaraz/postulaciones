// Corre una postulación completa sin interfaz y guarda los resultados en una carpeta (solo para probar; la app no guarda nada).
//
//   node scripts/postular.mjs --oferta tests/ofertas/a-backend-jr-java.md --cv datos-privados/CV-maestro-Maria-Sol-Alcaraz-es.docx \
//        --perfil datos-privados/perfil.md --niveles es=nativo,en=B1 [--celular "11 1234 5678"] [--empresa Exactian]
//
// Opciones: --guia (también arma la guía de entrevista; sin esto no se genera) · --info <archivo> (información extra de la empresa) · --idioma auto|es|en · --salida <carpeta> · --dry (arma los textos, no llama a la IA)
// Si no se pasa --niveles, muestra los que detectó en el CV y se detiene: es la confirmación que después hará la pantalla.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerArchivo, ErrorArchivo } from '../src/lectura/archivo.mjs';
import { detectarIdiomas, generarPostulacion } from '../src/postular.mjs';
import { pasoGeneracion } from '../src/prompts.mjs';
import { renderPanel } from '../src/panel.mjs';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));

function leerArgumentos(lista) {
  const a = {};
  for (let i = 0; i < lista.length; i++) {
    if (!lista[i].startsWith('--')) continue;
    const siguiente = lista[i + 1];
    if (siguiente === undefined || siguiente.startsWith('--')) a[lista[i].slice(2)] = true;
    else { a[lista[i].slice(2)] = siguiente; i++; }
  }
  return a;
}

const args = leerArgumentos(process.argv.slice(2));
for (const obligatorio of ['oferta', 'cv', 'perfil']) {
  if (!args[obligatorio]) { console.error(`Falta --${obligatorio}`); process.exit(1); }
}

async function leerCv(ruta) {
  if (/\.(txt|md)$/i.test(ruta)) return readFile(ruta, 'utf8');
  return leerArchivo(await readFile(ruta), basename(ruta));
}

let cv;
try { cv = await leerCv(args.cv); } catch (e) {
  if (e instanceof ErrorArchivo) { console.error(e.message); process.exit(1); }
  throw e;
}
const [oferta, perfil] = await Promise.all([readFile(args.oferta, 'utf8'), readFile(args.perfil, 'utf8')]);
const infoEmpresa = args.info ? await readFile(args.info, 'utf8') : '';
const slug = basename(args.oferta).replace(/\.\w+$/, '');
const carpeta = args.salida || join(RAIZ, 'datos-privados', 'salidas', slug);
const niveles = args.niveles ? Object.fromEntries(String(args.niveles).split(',').map((p) => p.split('=').map((s) => s.trim()))) : null;
let idiomaSalida = args.idioma && args.idioma !== 'auto' ? args.idioma : 'es';

if (!args.dry) {
  const { resultado: idiomas } = await detectarIdiomas({ cv, oferta });
  console.log('Idiomas detectados en el CV:');
  for (const i of idiomas.cv_idiomas) console.log(`  - ${i.idioma}: "${i.nivel_en_el_cv}" (${i.nivel_cefr})`);
  console.log(`Idioma de la oferta: ${idiomas.oferta.idioma_detectado}`);
  for (const i of idiomas.oferta.idiomas_requeridos) console.log(`  pide ${i.idioma}: ${i.nivel_pedido}${i.excluyente ? ' (excluyente)' : ''}`);
  if (!args.idioma || args.idioma === 'auto') idiomaSalida = idiomas.oferta.idioma_detectado;
  if (idiomaSalida === 'otro') { console.error('\nLa oferta está en otro idioma: elegí con --idioma es o --idioma en.'); process.exit(2); }
  if (!niveles) { console.error('\nConfirmá los niveles y volvé a correr con, por ejemplo: --niveles es=nativo,en=B1'); process.exit(2); }
}
const nivelesFinales = niveles ?? { es: 'nativo', en: 'B1' };
if (!nivelesFinales[idiomaSalida]) { console.error(`Falta el nivel de ${idiomaSalida} en --niveles.`); process.exit(2); }
console.log(`\nIdioma de salida: ${idiomaSalida} · niveles confirmados: ${JSON.stringify(nivelesFinales)}`);

if (args.dry) {
  const p = await pasoGeneracion({ oferta, infoEmpresa, cv, perfil, idiomaSalida, niveles: nivelesFinales });
  console.log(`[dry] La llamada de generación armaría ${p.length.toLocaleString('es-AR')} caracteres. No se llamó a la IA.`);
  process.exit(0);
}

const conGuia = args.guia === true;
const r = await generarPostulacion({
  cv, oferta, perfil, infoEmpresa, idiomaSalida, niveles: nivelesFinales, conGuia,
  celular: args.celular === true ? '' : args.celular || '', empresa: args.empresa || '',
  alPaso: (m) => console.log(`▶ ${m}`),
});

await mkdir(carpeta, { recursive: true });
await writeFile(join(carpeta, r.docx.nombre), r.docx.buffer);
await writeFile(join(carpeta, 'carta.txt'), r.cartaTexto, 'utf8');
if (conGuia) await writeFile(join(carpeta, 'entrevista.txt'), r.guiaTexto, 'utf8');
await writeFile(join(carpeta, 'panel.md'), renderPanel(r), 'utf8');
console.log(`\n✔ Listo. Carta: ${r.palabrasCarta} palabras · CV: ${r.paginas.cantidad} pág.${r.paginas.medido ? ` (la última llena en un ${Math.round(r.paginas.ultima * 100)} %)` : ' (estimado)'} · costo estimado ${r.costoEstimadoUsd.toFixed(3)} USD`);
console.log(`  Archivos en ${carpeta}: ${r.docx.nombre}, carta.txt, ${conGuia ? 'entrevista.txt, ' : ''}panel.md`);
const c = r.controles;
console.log(`  Controles: ${c.frasesProhibidas.length} frases prohibidas · ${c.datosNuevos.length} datos para revisar · ${c.avisos.length} avisos`);
