// Compara cada CV generado en tests/salidas con su CV maestro (y con el perfil): números, enlaces y términos técnicos que no estén en el maestro.
// Uso: node tests/fidelidad.mjs   (solo lee; el idioma sale del final del nombre del .docx: -es o -en)
import mammoth from 'mammoth';
import { readFile, readdir } from 'node:fs/promises';
import { datosNuevos } from '../src/validacion/controles.mjs';

const texto = async (ruta) => (await mammoth.extractRawText({ path: ruta })).value;
const perfil = await readFile('datos-privados/perfil.md', 'utf8');
const maestros = { es: await texto('datos-privados/CV-maestro-Maria-Sol-Alcaraz-es.docx'), en: await texto('datos-privados/CV-maestro-Maria-Sol-Alcaraz-en.docx') };
const mostrar = (avisos) => (avisos.length ? avisos.map((a) => `${a.tipo} "${a.valor}"`).join(', ') : 'ninguno');

for (const d of (await readdir('tests/salidas', { withFileTypes: true })).filter((x) => x.isDirectory())) {
  const archivo = (await readdir(`tests/salidas/${d.name}`)).find((x) => x.endsWith('.docx'));
  if (!archivo) { console.log(`${d.name}: SIN .docx`); continue; }
  const cv = [{ ruta: 'cv', texto: await texto(`tests/salidas/${d.name}/${archivo}`) }];
  const idioma = archivo.endsWith('-en.docx') ? 'en' : 'es';
  console.log(`${d.name} (${idioma})\n  fuera del CV maestro: ${mostrar(datosNuevos(cv, [maestros[idioma]]))}\n  fuera de maestro + perfil: ${mostrar(datosNuevos(cv, [maestros[idioma], perfil]))}`);
}
