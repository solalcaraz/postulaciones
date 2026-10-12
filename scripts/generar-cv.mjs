// Convierte un CV en JSON (con el mismo formato que devuelve la IA) en un .docx editable.
//   node scripts/generar-cv.mjs --cv datos-privados/cv-actualizados/cv-base-es.json --perfil datos-privados/perfil.md --idioma es --salida datos-privados/cv-actualizados/CV.docx [--celular "11 1234 5678"]
// También corre el control de datos nuevos contra los textos de referencia que se pasen con --fuentes (separados por coma).
import { readFile, writeFile } from 'node:fs/promises';
import { leerContacto } from '../src/lectura/contacto.mjs';
import { generarCv } from '../src/docx/generar.mjs';
import { validar } from '../src/validacion/esquema.mjs';
import { datosNuevos, textosConUbicacion } from '../src/validacion/controles.mjs';
import { cvSchema } from '../src/esquema/index.mjs';

const a = {};
const lista = process.argv.slice(2);
for (let i = 0; i < lista.length; i++) if (lista[i].startsWith('--')) a[lista[i].slice(2)] = lista[i + 1]?.startsWith('--') || lista[i + 1] === undefined ? true : lista[++i];
for (const k of ['cv', 'perfil', 'salida']) if (!a[k]) { console.error(`Falta --${k}`); process.exit(1); }

const cv = JSON.parse(await readFile(a.cv, 'utf8'));
const perfil = await readFile(a.perfil, 'utf8');
const v = validar(cvSchema, cv);
if (!v.ok) { console.error('El CV no cumple el formato:\n' + v.errores.join('\n')); process.exit(1); }

const contacto = leerContacto(perfil);
const { buffer, paginasEstimadas } = await generarCv({ cv, contacto, celular: a.celular === true ? '' : a.celular || '', idioma: a.idioma || 'es' });
await writeFile(a.salida, buffer);
console.log(`✔ ${a.salida} (~${paginasEstimadas} páginas estimadas)`);

const fuentes = [perfil, ...(await Promise.all(String(a.fuentes || '').split(',').filter(Boolean).map((f) => readFile(f, 'utf8'))))];
const avisos = datosNuevos(textosConUbicacion(cv), fuentes, { contacto });
console.log(avisos.length ? `Datos que no están en las fuentes (${avisos.length}):\n` + avisos.map((d) => `  - ${d.tipo} "${d.valor}" en ${d.donde}`).join('\n') : 'Control de datos nuevos: todo figura en las fuentes.');
